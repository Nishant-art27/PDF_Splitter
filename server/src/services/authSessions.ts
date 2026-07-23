import { randomBytes } from "node:crypto";

/**
 * Signed-in sessions are held in memory only (nothing about who is using
 * the app is persisted). Each request slides the expiry forward, so the
 * session ends after 10 minutes of inactivity and the person signs in
 * again. A server restart also signs everyone out.
 */
const AUTH_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

interface AuthSession {
  /** Unique account key (email). */
  loginId: string;
  /** Display name. */
  username: string;
  expiresAt: number;
}

const sessions = new Map<string, AuthSession>();

export function createAuthSession(loginId: string, username: string): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { loginId, username, expiresAt: Date.now() + AUTH_TTL_MS });
  return token;
}

export function getAuthSession(token: string): AuthSession | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  session.expiresAt = Date.now() + AUTH_TTL_MS; // sliding expiry
  return session;
}

export function destroyAuthSession(token: string): void {
  sessions.delete(token);
}

export function startAuthSessionCleanup(): NodeJS.Timeout {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
