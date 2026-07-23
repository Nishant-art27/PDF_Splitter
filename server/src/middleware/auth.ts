import type { Request, Response, NextFunction } from "express";
import { getAuthSession } from "../services/authSessions.js";

export const SESSION_COOKIE = "sid";

/** Gate for every API route except login/health: 401 when not signed in. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = typeof token === "string" ? getAuthSession(token) : undefined;
  if (!session) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.locals.loginId = session.loginId;
  res.locals.username = session.username;
  next();
}
