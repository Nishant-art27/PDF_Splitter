/** Mirrors the server's response shapes (server/src/types.ts). */

export interface SplitFile {
  id: string;
  filename: string;
  pageStart: number;
  pageEnd: number;
  previewText: string;
  sizeBytes: number;
}

export interface ProcessResponse {
  sessionId: string;
  expiresAt: number;
  totalPages: number;
  mode: "headers" | "fallback";
  files: SplitFile[];
}

export interface HeadersResponse {
  headers: string[];
  defaults: string[];
}
