import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * User accounts are configuration, so like the headers they persist in a
 * server-side JSON file. Passwords are stored only as scrypt hashes
 * (Node's built-in KDF — no external dependencies).
 */
const CONFIG_DIR = path.resolve(__dirname, "../../config");
const USERS_FILE = path.join(CONFIG_DIR, "users.json");

export interface UserRecord {
  /** Sign-in identifier: an email address or a mobile number. */
  loginId: string;
  /** Display name — what the person is called in the app. */
  username: string;
  /** Format: <salt hex>:<scrypt hash hex> */
  passwordHash: string;
}

export class ValidationError extends Error {}
export class DuplicateUserError extends Error {
  constructor() {
    super("An account with this email or number already exists. Sign in instead.");
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalize so "Jils@X.com" and "jils@x.com" are the same account. */
export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Accounts are created with an email address only — password resets are
 * delivered to it, so it must be a real mailbox.
 */
export function isValidLoginId(normalized: string): boolean {
  return EMAIL_RE.test(normalized);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

async function readUsers(): Promise<UserRecord[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
    if (!Array.isArray(parsed.users)) return [];
    return parsed.users.filter(
      (u: unknown): u is UserRecord =>
        typeof u === "object" &&
        u !== null &&
        typeof (u as UserRecord).loginId === "string" &&
        typeof (u as UserRecord).username === "string" &&
        typeof (u as UserRecord).passwordHash === "string"
    );
  } catch {
    return [];
  }
}

async function writeUsers(users: UserRecord[]): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  // Write via a temp file + rename so a concurrent reader never sees a
  // half-written config.
  const tmp = `${USERS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ users }, null, 2), "utf8");
  await fs.rename(tmp, USERS_FILE);
}

export async function findUser(loginId: string): Promise<UserRecord | undefined> {
  const wanted = normalizeLoginId(loginId);
  return (await readUsers()).find((u) => u.loginId === wanted);
}

function validate(loginId: string, username: string, password: string): void {
  if (!isValidLoginId(loginId)) {
    throw new ValidationError("Enter a valid email address.");
  }
  if (username.trim().length < 2) {
    throw new ValidationError("Name must be at least 2 characters.");
  }
  if (password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters.");
  }
}

/** Self-service signup: rejects an identifier that is already taken. */
export async function createUser(
  loginId: string,
  username: string,
  password: string
): Promise<UserRecord> {
  const id = normalizeLoginId(loginId);
  validate(id, username, password);
  const users = await readUsers();
  if (users.some((u) => u.loginId === id)) throw new DuplicateUserError();
  const record: UserRecord = {
    loginId: id,
    username: username.trim(),
    passwordHash: await hashPassword(password),
  };
  await writeUsers([...users, record]);
  return record;
}

/** Set a new password for an existing account (forgot-password flow). */
export async function updatePassword(loginId: string, password: string): Promise<void> {
  if (password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters.");
  }
  const id = normalizeLoginId(loginId);
  const users = await readUsers();
  const index = users.findIndex((u) => u.loginId === id);
  if (index < 0) throw new ValidationError("No account found for this email.");
  users[index] = { ...users[index], passwordHash: await hashPassword(password) };
  await writeUsers(users);
}

/** Admin CLI helper: create an account or reset name/password of one. */
export async function upsertUser(
  loginId: string,
  username: string,
  password: string
): Promise<UserRecord> {
  const id = normalizeLoginId(loginId);
  validate(id, username, password);
  const users = await readUsers();
  const record: UserRecord = {
    loginId: id,
    username: username.trim(),
    passwordHash: await hashPassword(password),
  };
  const index = users.findIndex((u) => u.loginId === id);
  if (index >= 0) users[index] = record;
  else users.push(record);
  await writeUsers(users);
  return record;
}
