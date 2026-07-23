import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { Boundary, PageText, ProcessResponse } from "../types.js";
import { HeaderRuleDetector, HeadingFallbackDetector } from "./boundaryDetectors.js";
import { buildFilename, dedupeFilenames } from "./naming.js";
import { extractSegment } from "./splitter.js";
import { createSession, type StoredFile } from "./sessionStore.js";
import { extractPages, hasNoText } from "./textExtraction.js";

const PREVIEW_CHARS = 220;

/** Thrown when the uploaded PDF has no extractable text (likely a scan). */
export class NoTextError extends Error {
  constructor() {
    super(
      "No extractable text found. This tool only supports searchable (text-based) PDFs — scanned documents are not supported."
    );
    this.name = "NoTextError";
  }
}

/**
 * Full pipeline for one uploaded PDF, using the calling user's own header
 * list; the resulting session belongs to them. The PDF is processed
 * entirely in memory; only the resulting split files enter the (expiring)
 * session store, and the upload buffer is released when this returns.
 */
export async function processPdf(
  pdfBytes: Uint8Array,
  headers: string[],
  owner: string
): Promise<ProcessResponse> {
  const pages = await extractPages(pdfBytes);
  if (pages.length === 0 || hasNoText(pages)) throw new NoTextError();

  let boundaries = new HeaderRuleDetector(headers).detectBoundaries(pages);
  let mode: ProcessResponse["mode"] = "headers";

  if (boundaries.length === 0) {
    boundaries = new HeadingFallbackDetector().detectBoundaries(pages);
    mode = "fallback";
  }

  // Pages before the first boundary (or the whole PDF when nothing was
  // detected) form an unclassified segment for manual review.
  if (boundaries.length === 0 || boundaries[0].pageIndex > 0) {
    boundaries.unshift({ pageIndex: 0, label: "", unclassified: true });
  }

  const segments = boundaries.map((boundary, i) => ({
    boundary,
    startIndex: boundary.pageIndex,
    endIndex: i + 1 < boundaries.length ? boundaries[i + 1].pageIndex - 1 : pages.length - 1,
  }));

  const filenames = dedupeFilenames(
    segments.map((s) => buildFilename(s.boundary, s.startIndex + 1))
  );

  const source = await PDFDocument.load(pdfBytes);
  const files: StoredFile[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const bytes = await extractSegment(source, segment);
    files.push({
      bytes,
      info: {
        id: randomUUID(),
        filename: filenames[i],
        pageStart: segment.startIndex + 1,
        pageEnd: segment.endIndex + 1,
        previewText: buildPreview(pages[segment.startIndex]),
        sizeBytes: bytes.byteLength,
      },
    });
  }

  const session = createSession(files, owner);
  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    totalPages: pages.length,
    mode,
    files: files.map((f) => f.info),
  };
}

function buildPreview(page: PageText): string {
  const text = page.rawText.replace(/\s+/g, " ").trim();
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
}
