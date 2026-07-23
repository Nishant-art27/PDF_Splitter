import { randomInt } from "node:crypto";
import {
  findUser,
  normalizeLoginId,
  updatePassword,
  ValidationError,
  EMAIL_RE,
} from "./userStore.js";
import { sendPasswordResetEmail } from "./mailer.js";

/**
 * One-time password reset codes, held in memory only. A code is bound to
 * the email it was sent to, expires after 10 minutes, allows 5 wrong
 * guesses, and is destroyed on use.
 */
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

interface ResetEntry {
  code: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const entries = new Map<string, ResetEntry>();

function prune(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

/**
 * Start a reset: email a 6-digit code to the account's address.
 * Deliberately silent when the account doesn't exist — the response must
 * not reveal which emails are registered.
 */
export async function requestReset(loginIdRaw: string): Promise<void> {
  prune();
  const loginId = normalizeLoginId(loginIdRaw);
  const user = await findUser(loginId);
  if (!user || !EMAIL_RE.test(user.loginId)) return;

  const existing = entries.get(loginId);
  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) return;

  const code = String(randomInt(100000, 1000000));
  entries.set(loginId, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    lastSentAt: Date.now(),
    attempts: 0,
  });
  await sendPasswordResetEmail(user.loginId, code);
}

/** Finish a reset: verify the code and set the new password. */
export async function resetPassword(
  loginIdRaw: string,
  code: string,
  newPassword: string
): Promise<void> {
  prune();
  const loginId = normalizeLoginId(loginIdRaw);
  const entry = entries.get(loginId);
  if (!entry || entry.expiresAt <= Date.now()) {
    throw new ValidationError("This code has expired or was never sent. Request a new one.");
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
    entries.delete(loginId);
    throw new ValidationError("Too many wrong attempts. Request a new code.");
  }
  if (entry.code !== code.trim()) {
    throw new ValidationError("Wrong code. Check the email and try again.");
  }
  await updatePassword(loginId, newPassword);
  entries.delete(loginId);
}
