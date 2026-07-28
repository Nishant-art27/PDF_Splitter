import type { Boundary } from "../types.js";

/** Strip characters that are invalid in filenames on common platforms. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Name for a page that could not be classified, per spec. */
export function unclassifiedFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `not done ${yyyy}-${mm}-${dd}.pdf`;
}

/**
 * Build the output filename for a document segment: the full heading
 * followed by the source page range.
 *
 * "31 Cr. Case 8295/2025" spanning source pages 44-45 becomes
 * "31 Cr. Case 8295_2025 (44-45).pdf" (slashes are invalid in
 * filenames, so they become underscores).
 */
export function buildFilename(boundary: Boundary, pageStart: number, pageEnd: number): string {
  if (boundary.unclassified || boundary.label === "") {
    return unclassifiedFilename();
  }
  const pages = pageStart === pageEnd ? `${pageStart}` : `${pageStart}-${pageEnd}`;
  return sanitizeFilename(`${boundary.label} (${pages})`) + ".pdf";
}

/** Ensure every filename in the list is unique by appending " (n)". */
export function dedupeFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    return name.replace(/\.pdf$/i, ` (${count + 1}).pdf`);
  });
}

/** Extract a case number like "9388/16" from a text line, if present. */
export function findCaseNumber(text: string): string | undefined {
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? `${match[1]}/${match[2]}` : undefined;
}
