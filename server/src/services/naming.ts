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
 * Build the output filename for a document segment.
 *
 * "L I R" + case number "9388/16" starting on source page 1 becomes
 * "L I R 9388_16_Page_1.pdf".
 */
export function buildFilename(boundary: Boundary, pageStart: number): string {
  if (boundary.unclassified || boundary.label === "") {
    return unclassifiedFilename();
  }
  const parts = [boundary.label];
  if (boundary.caseNumber) {
    parts.push(boundary.caseNumber.replace(/\s*\/\s*/g, "_"));
  }
  return sanitizeFilename(`${parts.join(" ")}_Page_${pageStart}`) + ".pdf";
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
