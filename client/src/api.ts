import type { HeadersResponse, ProcessResponse } from "./types";

/**
 * Called whenever any API request comes back 401 (session expired or
 * signed out elsewhere) so the app can drop back to the login page.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/** Thrown when the server itself cannot be reached (down/crashed). */
export class ServerDownError extends Error {
  constructor() {
    super("The site is under maintenance. Please try again in a few minutes.");
    this.name = "ServerDownError";
  }
}

/** fetch() that turns network failures into a friendly maintenance error. */
async function doFetch(input: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    // Could not reach the site at all.
    throw new ServerDownError();
  }
  // Gateway errors from a reverse proxy whose backend has crashed.
  if ([502, 503, 504].includes(res.status)) throw new ServerDownError();
  return res;
}

async function parseError(res: Response): Promise<string> {
  if (res.status === 401) onUnauthorized?.();
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // fall through to the generic message
  }
  return `Request failed (${res.status})`;
}

/**
 * Auth endpoints surface their message directly instead of going through
 * parseError: a wrong password or taken email is an expected outcome, not
 * a session expiry, so it must not bounce the app back to login state.
 */
async function authRequest(path: string, payload: object): Promise<string> {
  const res = await doFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }
  const error = (body as { error?: unknown } | null)?.error;
  if (!res.ok) throw new Error(typeof error === "string" ? error : "Request failed.");
  const username = (body as { username?: unknown } | null)?.username;
  if (typeof username !== "string") throw new Error("Request failed.");
  return username;
}

export type AuthMode = "accounts" | "passcode";

/** Which login UI this deployment uses (full accounts vs shared passcode). */
export async function fetchAuthMode(): Promise<AuthMode> {
  try {
    const res = await doFetch("/api/auth/mode");
    if (res.ok) {
      const body = await res.json();
      if (body?.mode === "passcode") return "passcode";
    }
  } catch {
    // fall through — worst case we show the full login form
  }
  return "accounts";
}

export function login(loginId: string, password: string): Promise<string> {
  return authRequest("/api/auth/login", { loginId, password });
}

/** Shared-passcode deployments: one passcode, no accounts. */
export function loginWithPasscode(password: string): Promise<string> {
  return authRequest("/api/auth/login", { password });
}

export function signup(loginId: string, username: string, password: string): Promise<string> {
  return authRequest("/api/auth/signup", { loginId, username, password });
}

/** Forgot password, step 1: ask the server to email a one-time code. */
export async function forgotPassword(loginId: string): Promise<void> {
  const res = await doFetch("/api/auth/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

/** Forgot password, step 2: verify the code and set the new password. */
export async function resetPassword(
  loginId: string,
  code: string,
  password: string
): Promise<void> {
  const res = await doFetch("/api/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, code, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function logout(): Promise<void> {
  await doFetch("/api/auth/logout", { method: "POST" });
}

/**
 * Returns the signed-in username, or null when there is no session.
 * This endpoint never fails for any other reason in normal operation, so
 * an unexpected status (e.g. a dev proxy's 500 for a dead backend) means
 * the site is effectively down.
 */
export async function fetchMe(): Promise<string | null> {
  const res = await doFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new ServerDownError();
  const body = await res.json();
  return typeof body?.username === "string" ? body.username : null;
}

export async function processPdf(file: File): Promise<ProcessResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await doFetch("/api/process", { method: "POST", body: form });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchHeaders(): Promise<HeadersResponse> {
  const res = await doFetch("/api/headers");
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function saveHeaders(headers: string[]): Promise<string[]> {
  const res = await doFetch("/api/headers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return body.headers;
}

/**
 * Tell the server to erase a result set from memory right now. Uses
 * sendBeacon so it also fires reliably while the page is being unloaded
 * (refresh / tab close); falls back to fetch for normal calls.
 */
export function destroyResultSession(sessionId: string): void {
  const url = `/api/sessions/${sessionId}/destroy`;
  if (navigator.sendBeacon?.(url)) return;
  void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
}

export function fileDownloadUrl(sessionId: string, fileId: string): string {
  return `/api/sessions/${sessionId}/files/${fileId}`;
}

export function zipDownloadUrl(sessionId: string, excludedIds: string[]): string {
  const base = `/api/sessions/${sessionId}/zip`;
  if (excludedIds.length === 0) return base;
  return `${base}?exclude=${excludedIds.map(encodeURIComponent).join(",")}`;
}
