import { Router } from "express";
import {
  getHeadersForUser,
  saveHeadersForUser,
  DEFAULT_HEADERS,
} from "../services/headerStore.js";

/**
 * Headers are per-account: reads and writes always target the signed-in
 * user's own list (requireAuth puts their loginId in res.locals).
 */
export const headersRouter = Router();

headersRouter.get("/", async (_req, res, next) => {
  try {
    res.json({
      headers: await getHeadersForUser(res.locals.loginId),
      defaults: DEFAULT_HEADERS,
    });
  } catch (err) {
    next(err);
  }
});

headersRouter.put("/", async (req, res, next) => {
  try {
    const { headers } = req.body ?? {};
    if (!Array.isArray(headers) || headers.some((h) => typeof h !== "string")) {
      res.status(400).json({ error: "Body must be { headers: string[] }" });
      return;
    }
    if (headers.length === 0) {
      res.status(400).json({ error: "At least one header is required." });
      return;
    }
    res.json({ headers: await saveHeadersForUser(res.locals.loginId, headers) });
  } catch (err) {
    next(err);
  }
});
