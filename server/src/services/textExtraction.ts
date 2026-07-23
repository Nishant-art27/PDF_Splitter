import path from "node:path";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageText } from "../types.js";

// Font data bundled with pdfjs-dist, needed to read PDFs that use the 14
// standard fonts without embedding them (common in generated documents).
const require = createRequire(import.meta.url);
const STANDARD_FONT_DATA_URL = path.join(
  path.dirname(require.resolve("pdfjs-dist/package.json")),
  "standard_fonts/"
);

/** Normalize a line for matching: trim, collapse whitespace, uppercase. */
export function normalizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Extract per-page text from a searchable PDF using pdfjs-dist.
 *
 * pdf.js returns positioned text fragments, not lines, so fragments are
 * grouped into visual lines by their Y coordinate (top of page first)
 * and ordered left-to-right within each line.
 */
export async function extractPages(pdfBytes: Uint8Array): Promise<PageText[]> {
  // pdf.js takes ownership of the buffer it is given (it transfers it to
  // its worker), which would leave the caller's copy detached/zeroed for
  // the later pdf-lib split — so hand it a private copy.
  const doc = await getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;

  try {
    const pages: PageText[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      // Group fragments into lines keyed by rounded Y position.
      // transform = [scaleX, skewY, skewX, scaleY, x, y]
      const lineMap = new Map<number, { x: number; str: string }[]>();
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const y = item.transform[5] as number;
        const x = item.transform[4] as number;
        // Tolerance of ~2.5pt: fragments within the same visual line often
        // differ slightly in Y (superscripts, font changes).
        let key: number | undefined;
        for (const existing of lineMap.keys()) {
          if (Math.abs(existing - y) <= 2.5) {
            key = existing;
            break;
          }
        }
        if (key === undefined) key = y;
        const fragments = lineMap.get(key) ?? [];
        fragments.push({ x, str: item.str });
        lineMap.set(key, fragments);
      }

      // PDF Y axis points up, so higher Y = closer to the top of the page.
      const sortedLines = [...lineMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, fragments]) =>
          fragments
            .sort((a, b) => a.x - b.x)
            .map((f) => f.str)
            .join(" ")
        );

      const rawLines = sortedLines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
      pages.push({
        pageIndex: i - 1,
        lines: rawLines.map(normalizeLine),
        rawLines,
        rawText: sortedLines.join("\n"),
      });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/** True when the PDF has effectively no extractable text (likely scanned). */
export function hasNoText(pages: PageText[]): boolean {
  const totalChars = pages.reduce((sum, p) => sum + p.rawText.replace(/\s/g, "").length, 0);
  return totalChars < 20;
}
