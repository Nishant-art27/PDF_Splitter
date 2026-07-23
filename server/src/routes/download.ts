import { Router } from "express";
import archiver from "archiver";
import { getSession } from "../services/sessionStore.js";

export const downloadRouter = Router();

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Download a single generated PDF (only by the user who created it). */
downloadRouter.get("/:sessionId/files/:fileId", (req, res) => {
  const session = getSession(req.params.sessionId, res.locals.loginId);
  const file = session?.files.get(req.params.fileId);
  if (!session || !file) {
    res.status(404).json({ error: "File not found or session expired. Please re-process the PDF." });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", contentDisposition(file.info.filename));
  res.send(Buffer.from(file.bytes));
});

/**
 * Download all non-excluded PDFs as a ZIP. The archive is streamed
 * straight to the response — it is never written to disk, so there is
 * no ZIP artifact to clean up; the underlying session expires on its own.
 */
downloadRouter.get("/:sessionId/zip", (req, res, next) => {
  const session = getSession(req.params.sessionId, res.locals.loginId);
  if (!session) {
    res.status(404).json({ error: "Session expired. Please re-process the PDF." });
    return;
  }
  const excluded = new Set(
    typeof req.query.exclude === "string" && req.query.exclude.length > 0
      ? req.query.exclude.split(",")
      : []
  );
  const included = [...session.files.values()].filter((f) => !excluded.has(f.info.id));
  if (included.length === 0) {
    res.status(400).json({ error: "All files are excluded — nothing to download." });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", contentDisposition("split-documents.zip"));

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", next);
  archive.pipe(res);
  for (const file of included) {
    archive.append(Buffer.from(file.bytes), { name: file.info.filename });
  }
  void archive.finalize();
});
