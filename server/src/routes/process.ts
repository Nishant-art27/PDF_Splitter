import { Router } from "express";
import multer from "multer";
import { processPdf, NoTextError } from "../services/processor.js";
import { getHeadersForUser } from "../services/headerStore.js";

/**
 * Upload cap in MB — configurable so small-memory hosts (e.g. Render's
 * free 512 MB tier) can run with a lower ceiling. Default 200 MB.
 */
export const MAX_UPLOAD_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 200);

// Memory storage only — uploaded court documents never touch the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

/**
 * Simple job queue: at most MAX_CONCURRENT_JOBS splits run at once;
 * extra requests wait their turn instead of piling memory on top of
 * each other. Protects small hosts from a synchronized rush.
 */
const MAX_CONCURRENT_JOBS = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS) || 5);
let activeJobs = 0;
const waiters: (() => void)[] = [];

function acquireJobSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_JOBS) {
    activeJobs++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve)).then(() => {
    activeJobs++;
  });
}

function releaseJobSlot(): void {
  activeJobs--;
  waiters.shift()?.();
}

export const processRouter = Router();

processRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a PDF as the 'file' field." });
      return;
    }
    const looksLikePdf =
      req.file.buffer.length > 4 && req.file.buffer.subarray(0, 1024).includes("%PDF-");
    if (!looksLikePdf) {
      res.status(400).json({ error: "The uploaded file does not appear to be a PDF." });
      return;
    }
    const headers = await getHeadersForUser(res.locals.loginId);
    await acquireJobSlot();
    try {
      const result = await processPdf(
        new Uint8Array(req.file.buffer),
        headers,
        res.locals.loginId
      );
      res.json(result);
    } finally {
      releaseJobSlot();
    }
  } catch (err) {
    if (err instanceof NoTextError) {
      res.status(422).json({ error: err.message });
      return;
    }
    next(err);
  }
});
