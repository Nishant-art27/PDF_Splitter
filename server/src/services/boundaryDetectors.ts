import type { Boundary, BoundaryDetector, PageText } from "../types.js";
import { normalizeLine } from "./textExtraction.js";
import { findCaseNumber } from "./naming.js";

/** How many lines from the top of a page are inspected for a header. */
const TOP_LINES_TO_INSPECT = 10;

/**
 * Normalize for header comparison: on top of the regular line
 * normalization, drop dots and commas so "Cr. Case" matches the
 * configured header "CR CASE" and "Ct. Cases" matches "CT CASES".
 */
function matchKey(text: string): string {
  return normalizeLine(text).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Court headings are prefixed with a serial number in the daily cause
 * list ("31 Cr. Case 8295/2025") — up to 4 digits so amounts like
 * "20000/-" in body text can never be mistaken for a serial.
 */
const SERIAL_RE = /^(\d{1,4}) (.+)$/;

/**
 * The full heading on a raw line: optional serial number, the header
 * text, and the case number(s) — "31 Cr. Case 8295/2025", including
 * multi-part numbers like "35 Cr. Case 52/2v/2012 531316/2016". Stops
 * before any trailing party names on the same line.
 */
const HEADING_RE = /^(?:\d{1,4}\s+)?.*?\d+(?:\s*\/\s*\w+)+(?:\s+\d+(?:\s*\/\s*\w+)+)*/;

/** Pull the heading (serial + header + case number) out of a raw line. */
function extractHeading(rawLine: string): string | null {
  const match = rawLine.match(HEADING_RE);
  if (!match) return null;
  // Drop stray standalone slashes ("Ct. Cases / 29677/2025") but keep
  // the ones inside case numbers ("8295/2025").
  return match[0].replace(/\s+\/\s+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Rule-based detector: a page starts a new document when one of the
 * configured classification headers appears at the start of one of its
 * top lines, optionally preceded by a cause-list serial number.
 */
export class HeaderRuleDetector implements BoundaryDetector {
  private readonly headers: string[];

  constructor(headers: string[]) {
    // Normalize the same way page text is normalized, and prefer longer
    // headers first so "CC NI ACT" wins over a hypothetical "CC" entry.
    this.headers = [...new Set(headers.map(matchKey).filter((h) => h.length > 0))].sort(
      (a, b) => b.length - a.length
    );
  }

  detectBoundaries(pages: PageText[]): Boundary[] {
    const boundaries: Boundary[] = [];
    for (const page of pages) {
      const match = this.matchPage(page);
      if (match) boundaries.push(match);
    }
    return boundaries;
  }

  private matchPage(page: PageText): Boundary | null {
    const topLines = page.lines.slice(0, TOP_LINES_TO_INSPECT);
    for (let i = 0; i < topLines.length; i++) {
      const line = matchKey(topLines[i]);
      const serialMatch = line.match(SERIAL_RE);
      for (const header of this.headers) {
        let serial: string | undefined;
        if (this.lineStartsWithHeader(line, header)) {
          // header at the very start of the line
        } else if (serialMatch && this.lineStartsWithHeader(serialMatch[2], header)) {
          serial = serialMatch[1];
        } else {
          continue;
        }
        const rawLine = page.rawLines[i] ?? topLines[i];
        const caseNumber = findCaseNumber(rawLine) ?? findCaseNumber(topLines.join(" "));
        // Prefer the document's own heading text (original casing, case
        // number included); fall back to what was matched.
        const label =
          extractHeading(rawLine) ?? [serial, header, caseNumber].filter(Boolean).join(" ");
        return {
          pageIndex: page.pageIndex,
          label,
          caseNumber,
          unclassified: false,
        };
      }
    }
    return null;
  }

  /**
   * The header must be a whole-token prefix of the line: "CA" matches
   * "CA 123/20" but not "CASE STATUS REPORT".
   */
  private lineStartsWithHeader(line: string, header: string): boolean {
    if (!line.startsWith(header)) return false;
    const next = line.charAt(header.length);
    return next === "" || !/[A-Z0-9]/.test(next);
  }
}

/**
 * Fallback detector for PDFs without any legal classification header:
 * treats short, all-caps top lines as section headings. Deliberately
 * conservative — a wrong split is worse than no split.
 */
export class HeadingFallbackDetector implements BoundaryDetector {
  detectBoundaries(pages: PageText[]): Boundary[] {
    const boundaries: Boundary[] = [];
    for (const page of pages) {
      const heading = this.detectHeading(page);
      if (heading !== null) {
        boundaries.push({ pageIndex: page.pageIndex, label: heading, unclassified: false });
      }
    }
    return boundaries;
  }

  private detectHeading(page: PageText): string | null {
    // Use the un-normalized line: normalized lines are already uppercased,
    // which would make the "is it ALL CAPS?" heading test meaningless.
    const first = page.rawLines[0];
    if (!first) return null;
    const letters = first.replace(/[^A-Za-z]/g, "");
    const looksLikeHeading =
      first.length >= 3 &&
      first.length <= 60 &&
      letters.length >= 3 &&
      first === first.toUpperCase() &&
      !/[.]{2,}|,$/.test(first);
    return looksLikeHeading ? page.lines[0] : null;
  }
}
