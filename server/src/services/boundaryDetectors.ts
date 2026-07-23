import type { Boundary, BoundaryDetector, PageText } from "../types.js";
import { normalizeLine } from "./textExtraction.js";
import { findCaseNumber } from "./naming.js";

/** How many lines from the top of a page are inspected for a header. */
const TOP_LINES_TO_INSPECT = 10;

/**
 * Rule-based detector: a page starts a new document when one of the
 * configured classification headers appears at the start of one of its
 * top lines.
 */
export class HeaderRuleDetector implements BoundaryDetector {
  private readonly headers: string[];

  constructor(headers: string[]) {
    // Normalize the same way page text is normalized, and prefer longer
    // headers first so "CC NI ACT" wins over a hypothetical "CC" entry.
    this.headers = [...new Set(headers.map(normalizeLine).filter((h) => h.length > 0))].sort(
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
    for (const line of topLines) {
      for (const header of this.headers) {
        if (!this.lineStartsWithHeader(line, header)) continue;
        return {
          pageIndex: page.pageIndex,
          label: header,
          caseNumber: findCaseNumber(line) ?? findCaseNumber(topLines.join(" ")),
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
