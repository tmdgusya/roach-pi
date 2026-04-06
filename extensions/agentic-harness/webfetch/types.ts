export type ExtractionMethod = "readability" | "full" | "raw";

export interface ExtractedArticle {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string | null;
  dir: string;
  siteName: string | null;
  lang: string | null;
}

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

export interface WebFetchDetails {
  url: string;
  method: ExtractionMethod;
  bytes: number;
  contentType: string;
  cached: boolean;
  duration: number;
}
