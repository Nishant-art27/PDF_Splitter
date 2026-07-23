/** Text content of a single PDF page, prepared for boundary detection. */
export interface PageText {
  /** Zero-based page index in the source PDF. */
  pageIndex: number;
  /**
   * Normalized text lines of the page, top to bottom
   * (trimmed, whitespace collapsed, uppercased).
   */
  lines: string[];
  /** The same lines without normalization (original casing preserved). */
  rawLines: string[];
  /** Raw (un-normalized) text of the page, used for previews. */
  rawText: string;
}

/** A detected start of a new logical document. */
export interface Boundary {
  /** Zero-based index of the page where the new document starts. */
  pageIndex: number;
  /**
   * Label describing the document, e.g. the matched header ("L I R")
   * or a detected section heading. Empty when the page is unclassified.
   */
  label: string;
  /** Case number if one was found near the label, e.g. "9388/16". */
  caseNumber?: string;
  /** True when the page could not be classified at all. */
  unclassified: boolean;
}

/**
 * Strategy interface for locating document boundaries in a PDF.
 *
 * The rest of the application only depends on this contract, so the
 * rule-based header matcher can later be swapped for (or combined with)
 * an OCR-backed or ML-backed detector without touching the pipeline.
 */
export interface BoundaryDetector {
  /**
   * Inspect all pages and return the boundaries found, in page order.
   * Returning an empty array means this detector found nothing and the
   * pipeline may fall back to another detector.
   */
  detectBoundaries(pages: PageText[]): Boundary[];
}

/** One output PDF produced by splitting. */
export interface SplitFile {
  id: string;
  filename: string;
  /** One-based page numbers in the source PDF (inclusive). */
  pageStart: number;
  pageEnd: number;
  previewText: string;
  sizeBytes: number;
}

/** Result of processing an uploaded PDF, as returned to the client. */
export interface ProcessResponse {
  sessionId: string;
  /** Epoch milliseconds when the session (and its files) expire. */
  expiresAt: number;
  totalPages: number;
  /** Which detection strategy produced the split. */
  mode: "headers" | "fallback";
  files: SplitFile[];
}
