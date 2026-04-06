/**
 * Core fetch + convert pipeline for the webfetch tool.
 * Fetches URLs via Node.js built-in fetch, detects content type,
 * extracts article content via Readability, converts to Markdown via Turndown GFM,
 * and caches results in an LRU cache.
 */

import type { CacheEntry, ExtractionMethod, WebFetchDetails } from "./types.js";
import { WebFetchCache } from "./cache.js";
import { extractMainContent, isArticleContent } from "./extractContent.js";
import { getTurndownService } from "./turndown.js";

const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; WebFetchTool/1.0)";

const cache = new WebFetchCache();

function getCacheKey(url: string, options: { raw?: boolean }): string {
  return JSON.stringify({ url, mode: options.raw ? "full" : "auto" });
}

function truncateContent(content: string, maxLength?: number): string {
  if (!maxLength || content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "\n\n... (truncated)";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Fetch a URL and convert its HTML content to Markdown.
 * Uses Readability for article extraction when possible,
 * falls back to full-page Turndown conversion.
 */
export async function fetchUrlToMarkdown(
  url: string,
  options: { raw?: boolean; maxLength?: number; signal?: AbortSignal } = {},
): Promise<{ content: string; details: WebFetchDetails }> {
  const startTime = Date.now();
  const cacheKey = getCacheKey(url, options);

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      content: truncateContent(cached.content, options.maxLength),
      details: {
        url: cached.url,
        method: cached.extractionMethod,
        bytes: cached.bytes,
        contentType: cached.contentType,
        cached: true,
        duration: Date.now() - startTime,
      },
    };
  }

  // Set up abort controller with timeout + optional external signal
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS,
  );

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error("Request was aborted before it started");
    }
    options.signal.addEventListener(
      "abort",
      () => {
        controller.abort();
        clearTimeout(timeoutId);
      },
      { once: true },
    );
  }

  // Fetch the URL
  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Fetch failed: ${message}`);
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";

  // Size pre-check via Content-Length header
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
    throw new Error(
      `Content too large: ${formatBytes(parseInt(contentLength))} exceeds ${formatBytes(MAX_CONTENT_SIZE)} limit`,
    );
  }

  // Binary / non-HTML content
  const isHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml");

  if (!isHtml) {
    const arrayBuf = await response.arrayBuffer();
    const bytes = arrayBuf.byteLength;

    if (bytes > MAX_CONTENT_SIZE) {
      throw new Error(
        `Content too large: ${formatBytes(bytes)} exceeds ${formatBytes(MAX_CONTENT_SIZE)} limit`,
      );
    }

    let textContent: string;
    const isTextual =
      contentType.includes("text/") ||
      contentType.includes("json") ||
      contentType.includes("xml");

    if (isTextual) {
      textContent = new TextDecoder("utf-8").decode(arrayBuf);
    } else {
      textContent = `[Binary content: ${contentType}, ${formatBytes(bytes)}]`;
    }

    const entry: CacheEntry = {
      content: textContent,
      bytes,
      code: response.status,
      codeText: response.statusText,
      contentType,
      extractionMethod: "raw",
      url,
      cachedAt: Date.now(),
    };
    cache.set(cacheKey, entry);

    return {
      content: truncateContent(textContent, options.maxLength),
      details: {
        url,
        method: "raw",
        bytes,
        contentType,
        cached: false,
        duration: Date.now() - startTime,
      },
    };
  }

  // HTML content — convert to Markdown
  const htmlBuffer = await response.arrayBuffer();
  const bytes = htmlBuffer.byteLength;

  if (bytes > MAX_CONTENT_SIZE) {
    throw new Error(
      `Content too large: ${formatBytes(bytes)} exceeds ${formatBytes(MAX_CONTENT_SIZE)} limit`,
    );
  }

  const html = new TextDecoder("utf-8").decode(htmlBuffer);
  let markdown: string;
  let method: ExtractionMethod;

  if (options.raw) {
    // Raw mode: skip Readability, use full Turndown conversion
    const turndown = await getTurndownService();
    markdown = turndown.turndown(html);
    method = "full";
  } else if (isArticleContent(html)) {
    // Try Readability extraction first
    const article = await extractMainContent(html, url);

    if (article) {
      const turndown = await getTurndownService();

      const metadata = [
        article.title && `# ${article.title}`,
        article.byline && `> By ${article.byline}`,
        article.excerpt && `> ${article.excerpt}`,
        (article.title || article.byline || article.excerpt) && "---",
      ]
        .filter(Boolean)
        .join("\n\n");

      const body = turndown.turndown(article.content);
      markdown = metadata ? `${metadata}\n\n${body}` : body;
      method = "readability";
    } else {
      // Readability failed — full-page fallback
      const turndown = await getTurndownService();
      markdown = turndown.turndown(html);
      method = "full";
    }
  } else {
    // Not article-like — full-page Turndown
    const turndown = await getTurndownService();
    markdown = turndown.turndown(html);
    method = "full";
  }

  const entry: CacheEntry = {
    content: markdown,
    bytes: Buffer.byteLength(markdown),
    code: response.status,
    codeText: response.statusText,
    contentType,
    extractionMethod: method,
    url,
    cachedAt: Date.now(),
  };
  cache.set(cacheKey, entry);

  return {
    content: truncateContent(markdown, options.maxLength),
    details: {
      url,
      method,
      bytes: entry.bytes,
      contentType,
      cached: false,
      duration: Date.now() - startTime,
    },
  };
}

/** Clear the URL content cache (useful for testing). */
export function clearCache(): void {
  cache.clear();
}
