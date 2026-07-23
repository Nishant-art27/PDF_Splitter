import { PDFDocument } from "pdf-lib";

export interface Segment {
  /** Zero-based, inclusive page range in the source PDF. */
  startIndex: number;
  endIndex: number;
}

/**
 * Copy a page range of the source PDF into a new standalone PDF.
 * Everything happens in memory — nothing touches the filesystem.
 */
export async function extractSegment(source: PDFDocument, segment: Segment): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  const indices: number[] = [];
  for (let i = segment.startIndex; i <= segment.endIndex; i++) indices.push(i);
  const pages = await output.copyPages(source, indices);
  for (const page of pages) output.addPage(page);
  return output.save();
}
