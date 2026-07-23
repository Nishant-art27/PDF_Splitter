import { randomUUID } from "node:crypto";
import type { SplitFile } from "../types.js";

/**
 * Court documents are confidential: generated PDFs are held only in
 * memory, keyed by a random session id, and are wiped automatically
 * roughly 10 minutes after processing. ZIPs are streamed on demand and
 * never written anywhere.
 */
const SESSION_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

export interface StoredFile {
  info: SplitFile;
  bytes: Uint8Array;
}

interface Session {
  id: string;
  /** loginId of the user who processed the PDF — only they may download. */
  owner: string;
  files: Map<string, StoredFile>;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

export function createSession(files: StoredFile[], owner: string): Session {
  const session: Session = {
    id: randomUUID(),
    owner,
    files: new Map(files.map((f) => [f.info.id, f])),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string, owner: string): Session | undefined {
  const session = sessions.get(id);
  if (!session || session.owner !== owner) return undefined;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function startSessionCleanup(): NodeJS.Timeout {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(id);
    }
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
