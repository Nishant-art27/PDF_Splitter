import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { headersRouter } from "./routes/headers.js";
import { processRouter, MAX_UPLOAD_MB } from "./routes/process.js";
import { downloadRouter } from "./routes/download.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";
import { startSessionCleanup } from "./services/sessionStore.js";
import { startAuthSessionCleanup } from "./services/authSessions.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cookieParser());
app.use(express.json());

// Public: sign-in and liveness. Everything else requires a session.
app.use("/api/auth", authRouter);
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/headers", requireAuth, headersRouter);
app.use("/api/process", requireAuth, processRouter);
app.use("/api/sessions", requireAuth, downloadRouter);

// In production the same process serves the built frontend, so the whole
// app is one command: node dist/index.js. (In dev, Vite serves the UI.)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
app.use(express.static(CLIENT_DIST));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(CLIENT_DIST, "index.html"), (err) => {
    if (err) next();
  });
});

// Central error handler — never leak internals to the client.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) {
      res.end();
      return;
    }
    const message =
      err && typeof err === "object" && "code" in err && err.code === "LIMIT_FILE_SIZE"
        ? `File is too large (limit ${MAX_UPLOAD_MB} MB).`
        : "Internal server error while processing the PDF.";
    res.status(500).json({ error: message });
  }
);

startSessionCleanup();
startAuthSessionCleanup();

/**
 * Free-tier keep-alive: Render spins the instance down after 15 idle
 * minutes and has (rarely) failed to wake it again, leaving the site
 * hanging. Pinging our own public URL every 10 minutes keeps the
 * instance awake around the clock — one service running 24/7 fits
 * within the 750 free instance-hours per month, provided no other free
 * service on the account is also running. RENDER_EXTERNAL_URL is set
 * automatically by Render, so this never runs in local dev.
 */
const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL;
if (KEEP_ALIVE_URL) {
  const keepAlive = setInterval(() => {
    fetch(`${KEEP_ALIVE_URL}/api/health`).catch(() => {
      // Best effort — if a ping fails, the next one tries again.
    });
  }, 10 * 60 * 1000);
  keepAlive.unref();
  console.log(`Keep-alive self-ping enabled for ${KEEP_ALIVE_URL}`);
}

app.listen(PORT, () => {
  console.log(`PDF splitter API listening on http://localhost:${PORT}`);
});
