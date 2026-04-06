/**
 * Shared type definitions for the webfetch tool.
 */

/** Extraction method used to convert content to markdown */
export type ExtractionMethod = "readability" | "full" | "raw";

/** Result of Mozilla Readability content extraction */
export interface ExtractedArticle {
  title: string;
  content: string;       // HTML body content
  textContent: string;   // Plain text
  length: number;
  excerpt: string;
  byline: string | null;
  dir: string;
  siteName: string | null;
  lang: string | null;
}

/** Cached entry for a fetched URL */
export interface CacheEntry {
  content: string;
  bytes: number;
  code: number;
  codeText: string;
  contentType: string;
  extractionMethod: ExtractionMethod;
  url: string;
  cachedAt: number;
}

/** Structured details returned with tool result for TUI rendering */
export interface WebFetchDetails {
  url: string;
  method: ExtractionMethod;
  bytes: number;
  contentType: string;
  cached: boolean;
  duration: number;
}
