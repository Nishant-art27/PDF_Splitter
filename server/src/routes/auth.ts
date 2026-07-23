import { Router } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  createUser,
  findUser,
  verifyPassword,
  normalizeLoginId,
  ValidationError,
  DuplicateUserError,
} from "../services/userStore.js";
import { requestReset, resetPassword } from "../services/passwordReset.js";
import {
  createAuthSession,
  destroyAuthSession,
  getAuthSession,
} from "../services/authSessions.js";
import { SESSION_COOKIE } from "../middleware/auth.js";

export const authRouter = Router();

/**
 * Two deployment modes, chosen by environment variable:
 * - "accounts" (default): full system — signup, email login, OTP reset.
 * - "passcode": one shared passcode from ACCESS_PASSCODE. No signup, no
 *   OTP, nothing account-related written to disk — this is the mode for
 *   free hosts with no permanent disk (e.g. Render's free tier).
 */
export const AUTH_MODE: "accounts" | "passcode" =
  process.env.AUTH_MODE === "passcode" ? "passcode" : "accounts";
const ACCESS_PASSCODE = process.env.ACCESS_PASSCODE ?? "";

if (AUTH_MODE === "passcode" && ACCESS_PASSCODE.length < 6) {
  console.warn(
    "[auth] AUTH_MODE=passcode but ACCESS_PASSCODE is missing or shorter than 6 characters — nobody will be able to sign in until it is set."
  );
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // Set SECURE_COOKIES=1 when running behind HTTPS (production).
  secure: process.env.SECURE_COOKIES === "1",
};

/**
 * Small brute-force brake: after 5 failed attempts for the same
 * identifier+IP, block further tries for 60 seconds.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

function isLocked(key: string): boolean {
  const entry = failures.get(key);
  return !!entry && entry.lockedUntil > Date.now();
}

function recordFailure(key: string): void {
  const entry = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  failures.set(key, entry);
}

/** Constant-time string comparison (hash first so lengths always match). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Which login UI should the frontend show? Public endpoint. */
authRouter.get("/mode", (_req, res) => {
  res.json({ mode: AUTH_MODE });
});

/** Reject account-only endpoints when running in shared-passcode mode. */
function accountsOnly(res: import("express").Response): boolean {
  if (AUTH_MODE === "passcode") {
    res.status(400).json({ error: "This deployment uses a shared passcode — accounts are disabled." });
    return true;
  }
  return false;
}

/** Create an account with email/mobile + password, and sign straight in. */
authRouter.post("/signup", async (req, res, next) => {
  if (accountsOnly(res)) return;
  try {
    const { loginId, username, password } = req.body ?? {};
    if (
      typeof loginId !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({ error: "Enter your name, email or number, and a password." });
      return;
    }
    const user = await createUser(loginId, username, password);
    const token = createAuthSession(user.loginId, user.username);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
    res.status(201).json({ username: user.username });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof DuplicateUserError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  // Shared-passcode mode: one password field, one shared identity.
  if (AUTH_MODE === "passcode") {
    const { password } = req.body ?? {};
    if (typeof password !== "string" || password === "") {
      res.status(400).json({ error: "Enter the office passcode." });
      return;
    }
    const key = `${req.ip}|passcode`;
    if (isLocked(key)) {
      res.status(429).json({ error: "Too many failed attempts. Try again in a minute." });
      return;
    }
    if (ACCESS_PASSCODE.length < 6 || !timingSafeEqualStr(password, ACCESS_PASSCODE)) {
      recordFailure(key);
      res.status(401).json({ error: "Wrong passcode." });
      return;
    }
    failures.delete(key);
    const token = createAuthSession("shared", "Staff");
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
    res.json({ username: "Staff" });
    return;
  }

  try {
    const { loginId, password } = req.body ?? {};
    if (typeof loginId !== "string" || typeof password !== "string" || !loginId.trim()) {
      res.status(400).json({ error: "Enter your email and your password." });
      return;
    }
    const key = `${req.ip}|${normalizeLoginId(loginId)}`;
    if (isLocked(key)) {
      res.status(429).json({ error: "Too many failed attempts. Try again in a minute." });
      return;
    }
    const user = await findUser(loginId);
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      recordFailure(key);
      res.status(401).json({ error: "Wrong email or password." });
      return;
    }
    failures.delete(key);
    const token = createAuthSession(user.loginId, user.username);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
    res.json({ username: user.username });
  } catch (err) {
    next(err);
  }
});

/**
 * Forgot password, step 1: email a one-time code. Always answers OK so
 * the response never reveals whether an email is registered.
 */
authRouter.post("/forgot", async (req, res, next) => {
  if (accountsOnly(res)) return;
  try {
    const { loginId } = req.body ?? {};
    if (typeof loginId !== "string" || !loginId.trim()) {
      res.status(400).json({ error: "Enter your email address." });
      return;
    }
    await requestReset(loginId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Forgot password, step 2: verify the code and set the new password. */
authRouter.post("/reset", async (req, res, next) => {
  if (accountsOnly(res)) return;
  try {
    const { loginId, code, password } = req.body ?? {};
    if (
      typeof loginId !== "string" ||
      typeof code !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({ error: "Enter your email, the code, and a new password." });
      return;
    }
    await resetPassword(loginId, code, password);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

authRouter.post("/logout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") destroyAuthSession(token);
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
  res.json({ ok: true });
});

/** Who am I? Used by the frontend on load to skip the login page. */
authRouter.get("/me", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = typeof token === "string" ? getAuthSession(token) : undefined;
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.json({ username: session.username });
});
