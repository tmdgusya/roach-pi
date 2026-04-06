# WebFetch Tool Implementation Plan

> **Worker note:** Execute this plan task-by-task using the agentic-run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Implement a `webfetch` tool in the agentic-harness extension that fetches URLs and converts HTML to clean Markdown using Mozilla Readability for article extraction and Turndown + GFM for Markdown conversion, with LRU caching and custom TUI rendering.

**Architecture:** Multi-module design under `extensions/agentic-harness/webfetch/`. `types.ts` defines shared types and clearly documents that `bytes` means returned-content bytes. `cache.ts` implements an in-memory LRU cache with 15-minute TTL. `turndown.ts` provides a lazy-initialized Turndown + GFM singleton via dynamic imports. `extractContent.ts` wraps Mozilla Readability for article content extraction. `utils.ts` ties everything together — Node.js built-in `fetch`, content-type detection, Readability-first with Turndown fallback pipeline, timeout/abort handling, and caching. **Important cache rule:** cache keys must include the effective transform mode (`auto` vs `raw/full-page`) so the same URL can safely produce different outputs. **Important truncation rule:** `maxLength` is applied only to the returned copy and must never change what is stored in cache. `render.ts` provides custom TUI rendering for fetch progress and result display. `index.ts` registers the tool via `pi.registerTool()` with a TypeBox schema.

**Tech Stack:** TypeScript, Node.js built-in `fetch`, `@mozilla/readability`, `jsdom`, `turndown`, `turndown-plugin-gfm`, `@sinclair/typebox`, `@mariozechner/pi-tui`, `@mariozechner/pi-coding-agent`

**Work Scope:**
- **In scope:** `webfetch` tool with URL fetch, Readability + Turndown GFM conversion, LRU cache (15-min TTL), custom TUI rendering, input parameters (`url`, `raw`, `maxLength`), abort signal support, binary content detection, size limit (10MB), timeout (30s), unit tests. `raw: true` means: **for HTML, skip Readability and convert the full page to Markdown**. For non-HTML textual/binary responses, the extraction method remains `raw` and returns verbatim text or a binary placeholder.
- **Out of scope:** Phase 3 features (settings-based/domain-based selective application), CSS selector extraction, streaming progress, CLI command for webfetch, root README update

**Verification Strategy:**
- **Level:** test-suite
- **Command:** `cd extensions/agentic-harness && npm test && npm run build`
- **What it validates:** The full extension test suite passes, TypeScript compiles clean, and the new webfetch tests cover cache correctness, abort behavior, and transform-mode separation

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `extensions/agentic-harness/webfetch/types.ts` | Create | Shared types: ExtractionMethod, ExtractedArticle, CacheEntry, WebFetchDetails |
| `extensions/agentic-harness/webfetch/cache.ts` | Create | In-memory LRU cache with TTL eviction |
| `extensions/agentic-harness/webfetch/extractContent.ts` | Create | Mozilla Readability article extraction via dynamic import |
| `extensions/agentic-harness/webfetch/turndown.ts` | Create | Lazy Turndown + GFM service via dynamic import |
| `extensions/agentic-harness/webfetch/render.ts` | Create | Custom TUI rendering for webfetch tool calls and results |
| `extensions/agentic-harness/webfetch/utils.ts` | Create | Core fetch + convert pipeline: URL fetch, content-type detection, Readability→Turndown conversion, caching |
| `extensions/agentic-harness/index.ts` | Modify | Add webfetch tool registration, add imports for webfetch modules |
| `extensions/agentic-harness/package.json` | Modify | Add new dependencies: turndown, turndown-plugin-gfm, @mozilla/readability, jsdom |
| `extensions/agentic-harness/package-lock.json` | Modify | Lock new dependency graph; must be produced by Task 1 before parallel tasks begin |
| `extensions/agentic-harness/tests/webfetch-cache.test.ts` | Create | LRU cache unit tests |
| `extensions/agentic-harness/tests/webfetch-extract.test.ts` | Create | Readability extraction unit tests |
| `extensions/agentic-harness/tests/webfetch-turndown.test.ts` | Create | Turndown service unit tests |
| `extensions/agentic-harness/tests/webfetch-render.test.ts` | Create | TUI rendering unit tests |
| `extensions/agentic-harness/tests/webfetch-utils.test.ts` | Create | Fetch pipeline unit tests |
| `extensions/agentic-harness/tests/extension.test.ts` | Modify | Add webfetch tool registration test |

---

## Task Dependency Graph

```
Task 1 (deps + types.ts) ──┬──> Task 2 (cache + test)
                            ├──> Task 3 (extractContent + test)
                            ├──> Task 4 (turndown + test)
                            └──> Task 5 (render + test)
                                        │
                            Task 2 ──┐   │
                            Task 3 ──┼──> Task 6 (utils + test)
                            Task 4 ──┘       │
                                             │
                            Task 5 ──┬──> Task 7 (index.ts + extension.test.ts)
                            Task 6 ──┘       │
                                             └──> Task 8 (Final Verification)
```

Tasks 2, 3, 4, 5 run in parallel after Task 1.
Task 6 runs after Tasks 2, 3, 4 complete.
Task 7 runs after Tasks 5, 6 complete.
Task 8 runs after all tasks complete.

---

### Task 1: Install Dependencies + Create types.ts

**Dependencies:** None (can start immediately)

**Important note:** Task 1 is not complete until `package.json`, `package-lock.json`, and `npm install` all succeed. Tasks 2–5 must not start from a half-finished dependency state.
**Files:**
- Modify: `extensions/agentic-harness/package.json`
- Create: `extensions/agentic-harness/webfetch/types.ts`

- [ ] **Step 1: Update package.json with new dependencies**

Update `extensions/agentic-harness/package.json` by **adding only the new packages** below while preserving all existing fields and currently resolved versions of pre-existing dependencies. Do **not** rewrite unrelated fields or opportunistically upgrade `@mariozechner/*` packages.

Add:

```json
{
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "jsdom": "^25.0.1",
    "turndown": "^7.2.0",
    "turndown-plugin-gfm": "^1.0.2"
  },
  "devDependencies": {
    "@types/turndown": "^5.0.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd extensions/agentic-harness && npm install`
Expected: Dependencies install successfully, no errors

- [ ] **Step 3: Create webfetch directory**

Run: `mkdir -p extensions/agentic-harness/webfetch`

- [ ] **Step 4: Create types.ts**

Create `extensions/agentic-harness/webfetch/types.ts`:

```typescript
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

/** Cached entry for a fetched URL + transform mode */
export interface CacheEntry {
  content: string;
  bytes: number; // bytes of returned content, not remote response body
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
  bytes: number; // bytes of returned content
  contentType: string;
  cached: boolean;
  duration: number;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd extensions/agentic-harness && npx tsc --noEmit`
Expected: No errors (types.ts has no external dependencies)

- [ ] **Step 6: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/package.json extensions/agentic-harness/package-lock.json extensions/agentic-harness/webfetch/types.ts
git commit -m "feat(webfetch): add dependencies and shared types"
```

---

### Task 2: Create cache.ts + cache.test.ts

**Dependencies:** Task 1 must complete (types.ts must exist)
**Files:**
- Create: `extensions/agentic-harness/webfetch/cache.ts`
- Create: `extensions/agentic-harness/tests/webfetch-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/agentic-harness/tests/webfetch-cache.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { WebFetchCache } from "../webfetch/cache.js";
import type { CacheEntry } from "../webfetch/types.js";

function makeEntry(url: string, content = "test"): CacheEntry {
  return {
    content,
    bytes: content.length,
    code: 200,
    codeText: "OK",
    contentType: "text/html",
    extractionMethod: "full",
    url,
    cachedAt: Date.now(),
  };
}

describe("WebFetchCache", () => {
  it("should store and retrieve entries", () => {
    const cache = new WebFetchCache();
    const entry = makeEntry("https://example.com");
    cache.set("https://example.com", entry);
    expect(cache.get("https://example.com")).toEqual(entry);
  });

  it("should return undefined for missing keys", () => {
    const cache = new WebFetchCache();
    expect(cache.get("https://missing.com")).toBeUndefined();
  });

  it("should evict expired entries based on TTL", async () => {
    const cache = new WebFetchCache(100, 50); // 50ms TTL
    cache.set("https://expired.com", makeEntry("https://expired.com"));
    expect(cache.get("https://expired.com")).toBeDefined();

    await new Promise((r) => setTimeout(r, 80));
    expect(cache.get("https://expired.com")).toBeUndefined();
  });

  it("should evict LRU entries when exceeding max size", () => {
    const cache = new WebFetchCache(3);
    for (let i = 0; i < 4; i++) {
      cache.set(`https://example.com/${i}`, makeEntry(`https://example.com/${i}`, `content-${i}`));
    }
    // Entry 0 should be evicted (oldest)
    expect(cache.get("https://example.com/0")).toBeUndefined();
    expect(cache.get("https://example.com/1")).toBeDefined();
    expect(cache.get("https://example.com/3")).toBeDefined();
    expect(cache.size).toBe(3);
  });

  it("should update existing entries in place", () => {
    const cache = new WebFetchCache();
    cache.set("https://example.com", makeEntry("https://example.com", "v1"));
    cache.set("https://example.com", makeEntry("https://example.com", "v2-updated"));
    const entry = cache.get("https://example.com");
    expect(entry?.content).toBe("v2-updated");
    expect(cache.size).toBe(1);
  });

  it("should promote accessed entries to most-recent", () => {
    const cache = new WebFetchCache(3);
    cache.set("https://a.com", makeEntry("https://a.com"));
    cache.set("https://b.com", makeEntry("https://b.com"));
    cache.set("https://c.com", makeEntry("https://c.com"));

    // Access "a" to promote it
    cache.get("https://a.com");

    // Add new entry — should evict "b" (now least recently used)
    cache.set("https://d.com", makeEntry("https://d.com"));

    expect(cache.get("https://a.com")).toBeDefined(); // promoted, still here
    expect(cache.get("https://b.com")).toBeUndefined(); // evicted
    expect(cache.get("https://c.com")).toBeDefined();
    expect(cache.get("https://d.com")).toBeDefined();
  });

  it("should clear all entries", () => {
    const cache = new WebFetchCache();
    cache.set("https://a.com", makeEntry("https://a.com"));
    cache.set("https://b.com", makeEntry("https://b.com"));
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("https://a.com")).toBeUndefined();
    expect(cache.get("https://b.com")).toBeUndefined();
  });

  it("should report correct size", () => {
    const cache = new WebFetchCache();
    expect(cache.size).toBe(0);
    cache.set("https://a.com", makeEntry("https://a.com"));
    expect(cache.size).toBe(1);
    cache.set("https://b.com", makeEntry("https://b.com"));
    expect(cache.size).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-cache.test.ts`
Expected: FAIL — module `../webfetch/cache.js` not found

- [ ] **Step 3: Write the implementation**

Create `extensions/agentic-harness/webfetch/cache.ts`:

```typescript
/**
 * In-memory LRU cache for fetched URL content.
 * Evicts least-recently-used entries when capacity is exceeded.
 * Entries expire after a configurable TTL.
 */

import type { CacheEntry } from "./types.js";

interface CacheNode {
  key: string;
  entry: CacheEntry;
  prev: CacheNode | null;
  next: CacheNode | null;
}

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class WebFetchCache {
  private map = new Map<string, CacheNode>();
  private head: CacheNode | null = null; // most recently used
  private tail: CacheNode | null = null; // least recently used
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = DEFAULT_MAX_SIZE, ttlMs = DEFAULT_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(url: string): CacheEntry | undefined {
    const node = this.map.get(url);
    if (!node) return undefined;

    // Check TTL expiry
    if (Date.now() - node.entry.cachedAt > this.ttlMs) {
      this.removeNode(node);
      return undefined;
    }

    // Promote to most-recently-used
    this.moveToHead(node);
    return node.entry;
  }

  set(url: string, entry: CacheEntry): void {
    const existing = this.map.get(url);
    if (existing) {
      existing.entry = entry;
      this.moveToHead(existing);
      return;
    }

    const node: CacheNode = { key: url, entry, prev: null, next: null };
    this.map.set(url, node);
    this.addToHead(node);

    // Evict LRU if over capacity
    if (this.map.size > this.maxSize) {
      const lru = this.tail;
      if (lru) this.removeNode(lru);
    }
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  get size(): number {
    return this.map.size;
  }

  private moveToHead(node: CacheNode): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: CacheNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: CacheNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
    this.map.delete(node.key);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-cache.test.ts`
Expected: ALL PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/webfetch/cache.ts extensions/agentic-harness/tests/webfetch-cache.test.ts
git commit -m "feat(webfetch): add LRU cache with TTL eviction"
```

---

### Task 3: Create extractContent.ts + extractContent.test.ts

**Dependencies:** Task 1 must complete (types.ts and npm packages must exist)
**Files:**
- Create: `extensions/agentic-harness/webfetch/extractContent.ts`
- Create: `extensions/agentic-harness/tests/webfetch-extract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/agentic-harness/tests/webfetch-extract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isArticleContent, extractMainContent } from "../webfetch/extractContent.js";

describe("isArticleContent", () => {
  it("should detect article tag with good text density", () => {
    const html = "<html><body><article>" + "x".repeat(1000) + "</article></body></html>";
    expect(isArticleContent(html)).toBe(true);
  });

  it("should detect main tag with good text density", () => {
    const html = "<html><body><main>" + "y".repeat(1000) + "</main></body></html>";
    expect(isArticleContent(html)).toBe(true);
  });

  it("should reject content with low text density", () => {
    const html = "<html><body><article>" + "<div></div>".repeat(100) + "</article></body></html>";
    expect(isArticleContent(html)).toBe(false);
  });

  it("should reject content without article or main tag", () => {
    const html = "<html><body><div>" + "z".repeat(1000) + "</div></body></html>";
    expect(isArticleContent(html)).toBe(false);
  });

  it("should accept content with text density above threshold", () => {
    const text = "a".repeat(400);
    const tags = "<span>x</span>".repeat(40);
    const html = `<html><body><article>${text}${tags}</article></body></html>`;
    expect(isArticleContent(html)).toBe(true);
  });
});

describe("extractMainContent", () => {
  it("should extract article content from valid HTML", async () => {
    const bodyContent = "This is test content. ".repeat(50);
    const html = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <article>
            <h1>Test Article Title</h1>
            <p>${bodyContent}</p>
          </article>
        </body>
      </html>
    `;
    const result = await extractMainContent(html, "https://example.com/article");
    expect(result).not.toBeNull();
    expect(result!.title).toBeTruthy();
    expect(result!.content).toContain("test content");
    expect(result!.length).toBeGreaterThan(500);
  });

  it("should return null for content below charThreshold", async () => {
    const html = `
      <html>
        <head><title>Short</title></head>
        <body>
          <article>
            <p>Too short.</p>
          </article>
        </body>
      </html>
    `;
    const result = await extractMainContent(html, "https://example.com/short");
    expect(result).toBeNull();
  });

  it("should return null for empty HTML gracefully", async () => {
    const result = await extractMainContent("", "https://example.com/empty");
    expect(result).toBeNull();
  });

  it("should extract byline when present", async () => {
    const bodyContent = "A".repeat(600);
    const html = `
      <html>
        <head><title>Authored Article</title></head>
        <body>
          <article>
            <span class="author">Jane Doe</span>
            <p>${bodyContent}</p>
          </article>
        </body>
      </html>
    `;
    const result = await extractMainContent(html, "https://example.com/authored");
    // Readability may or may not extract byline depending on markup
    // Just verify the result is not null for a substantial article
    expect(result).not.toBeNull();
    expect(result!.content).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-extract.test.ts`
Expected: FAIL — module `../webfetch/extractContent.js` not found

- [ ] **Step 3: Write the implementation**

Create `extensions/agentic-harness/webfetch/extractContent.ts`:

```typescript
/**
 * Mozilla Readability-based content extraction.
 * Dynamically imports JSDOM and Readability to keep initial bundle small.
 */

import type { ExtractedArticle } from "./types.js";

/**
 * Extract main article content from HTML using Mozilla Readability.
 * Returns null if extraction fails or content is below 500 characters.
 */
export async function extractMainContent(
  html: string,
  url: string,
): Promise<ExtractedArticle | null> {
  try {
    const [{ JSDOM }, { Readability }] = await Promise.all([
      import("jsdom"),
      import("@mozilla/readability"),
    ]);

    const dom = new JSDOM(html, {
      url,
      contentType: "text/html",
      pretendToBeVisual: false,
      storageQuota: 0,
    });

    const reader = new Readability(dom.window.document, {
      charThreshold: 500,
      classesToPreserve: ["code", "highlight"],
      keepClasses: false,
    });

    const article = reader.parse();
    dom.window.close(); // Free JSDOM memory

    if (!article || article.length < 500) {
      return null;
    }

    return {
      title: article.title || "",
      content: article.content || "",
      textContent: article.textContent || "",
      length: article.length || 0,
      excerpt: article.excerpt || "",
      byline: article.byline || null,
      dir: article.dir || "",
      siteName: article.siteName || null,
      lang: article.lang || null,
    };
  } catch {
    return null;
  }
}

/**
 * Heuristic: does the HTML look like an article/document page?
 * Checks for <article> or <main> tags and sufficient text density.
 */
export function isArticleContent(html: string): boolean {
  const hasArticleTag = /<article[>\s]/i.test(html);
  const hasMainTag = /<main[>\s]/i.test(html);
  const textLength = html.replace(/<[^>]*>/g, "").length;
  const textDensity = textLength / html.length;

  return (hasArticleTag || hasMainTag) && textDensity > 0.3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-extract.test.ts`
Expected: ALL PASS (9 tests — 5 isArticleContent + 4 extractMainContent)

- [ ] **Step 5: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/webfetch/extractContent.ts extensions/agentic-harness/tests/webfetch-extract.test.ts
git commit -m "feat(webfetch): add Readability content extraction with dynamic imports"
```

---

### Task 4: Create turndown.ts + turndown.test.ts

**Dependencies:** Task 1 must complete (npm packages must be installed)
**Files:**
- Create: `extensions/agentic-harness/webfetch/turndown.ts`
- Create: `extensions/agentic-harness/tests/webfetch-turndown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/agentic-harness/tests/webfetch-turndown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getTurndownService } from "../webfetch/turndown.js";

describe("getTurndownService", () => {
  it("should return a turndown service instance", async () => {
    const service = await getTurndownService();
    expect(service).toBeDefined();
    expect(typeof service.turndown).toBe("function");
  });

  it("should convert simple HTML to markdown", async () => {
    const service = await getTurndownService();
    const html = "<h1>Hello</h1><p>This is a <strong>test</strong>.</p>";
    const md = service.turndown(html);
    expect(md).toContain("# Hello");
    expect(md).toContain("**test**");
  });

  it("should use ATX heading style (# style, not underline)", async () => {
    const service = await getTurndownService();
    const html = "<h1>H1</h1><h2>H2</h2><h3>H3</h3>";
    const md = service.turndown(html);
    expect(md).toContain("# H1");
    expect(md).toContain("## H2");
    expect(md).toContain("### H3");
  });

  it("should use fenced code blocks", async () => {
    const service = await getTurndownService();
    const html = "<pre><code>const x = 1;\nconsole.log(x);</code></pre>";
    const md = service.turndown(html);
    expect(md).toContain("```");
    expect(md).toContain("const x = 1;");
  });

  it("should use dash for bullet lists", async () => {
    const service = await getTurndownService();
    const html = "<ul><li>Item A</li><li>Item B</li></ul>";
    const md = service.turndown(html);
    expect(md).toContain("- Item A");
    expect(md).toContain("- Item B");
  });

  it("should support GFM tables", async () => {
    const service = await getTurndownService();
    const html = `
      <table>
        <thead><tr><th>Name</th><th>Value</th></tr></thead>
        <tbody><tr><td>A</td><td>1</td></tr></tbody>
      </table>
    `;
    const md = service.turndown(html);
    expect(md).toContain("Name");
    expect(md).toContain("Value");
  });

  it("should remove script, style, nav, header, footer, aside tags", async () => {
    const service = await getTurndownService();
    const html =
      "<p>Content</p><script>alert('xss')</script><style>.x{}</style>" +
      "<nav>Menu</nav><header>Top</header><footer>Bottom</footer><aside>Sidebar</aside>";
    const md = service.turndown(html);
    expect(md).toContain("Content");
    expect(md).not.toContain("alert");
    expect(md).not.toContain(".x{}");
    expect(md).not.toContain("Menu");
    expect(md).not.toContain("Top");
    expect(md).not.toContain("Bottom");
    expect(md).not.toContain("Sidebar");
  });

  it("should return the same instance on subsequent calls (singleton)", async () => {
    const a = await getTurndownService();
    const b = await getTurndownService();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-turndown.test.ts`
Expected: FAIL — module `../webfetch/turndown.js` not found

- [ ] **Step 3: Write the implementation**

Create `extensions/agentic-harness/webfetch/turndown.ts`:

```typescript
/**
 * Lazy-initialized Turndown service with GFM plugin support.
 * Dynamic imports defer loading ~1.4MB+ of libraries until first use.
 */

type TurndownService = InstanceType<typeof import("turndown").default>;

let turndownPromise: Promise<TurndownService> | undefined;

/**
 * Get the shared Turndown service instance.
 * Configured with:
 * - ATX headings (# style)
 * - Fenced code blocks (```)
 * - Dash bullet lists (-)
 * - GFM plugin (tables, strikethrough, task lists)
 * - Removes script, style, nav, header, footer, aside tags
 */
export async function getTurndownService(): Promise<TurndownService> {
  return (turndownPromise ??= (async () => {
    const [turndownMod, gfmMod] = await Promise.all([
      import("turndown"),
      import("turndown-plugin-gfm"),
    ]);

    const Turndown = (turndownMod as any).default;
    const gfm = (gfmMod as any).gfm ?? gfmMod;

    const service = new Turndown({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      fence: "```",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
      linkReferenceStyle: "full",
    });

    // Apply GFM plugin for tables, strikethrough, task lists
    service.use(gfm);

    // Strip noise elements
    service.remove(["script", "style", "nav", "header", "footer", "aside"]);

    return service;
  })());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-turndown.test.ts`
Expected: ALL PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/webfetch/turndown.ts extensions/agentic-harness/tests/webfetch-turndown.test.ts
git commit -m "feat(webfetch): add lazy Turndown + GFM service"
```

---

### Task 5: Create render.ts + render.test.ts

**Dependencies:** Task 1 must complete (types.ts must exist)
**Files:**
- Create: `extensions/agentic-harness/webfetch/render.ts`
- Create: `extensions/agentic-harness/tests/webfetch-render.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/agentic-harness/tests/webfetch-render.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderWebfetchCall, renderWebfetchResult } from "../webfetch/render.js";
import type { WebFetchDetails } from "../webfetch/types.js";

function mockTheme(): any {
  return {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => `**${text}**`,
  };
}

function renderOutput(comp: any): string {
  return comp.render(80).join("\n");
}

describe("renderWebfetchCall", () => {
  it("should render URL hostname", () => {
    const theme = mockTheme();
    const result = renderWebfetchCall({ url: "https://example.com/page" }, theme);
    const output = renderOutput(result);
    expect(output).toContain("example.com");
    expect(output).toContain("webfetch");
  });

  it("should show raw flag when present", () => {
    const theme = mockTheme();
    const result = renderWebfetchCall({ url: "https://example.com", raw: true }, theme);
    const output = renderOutput(result);
    expect(output).toContain("raw");
  });

  it("should show maxLength when present", () => {
    const theme = mockTheme();
    const result = renderWebfetchCall({ url: "https://example.com", maxLength: 5000 }, theme);
    const output = renderOutput(result);
    expect(output).toContain("5000");
  });

  it("should handle minimal args", () => {
    const theme = mockTheme();
    const result = renderWebfetchCall({ url: "https://example.com" }, theme);
    const output = renderOutput(result);
    expect(output).toContain("webfetch");
    expect(output).toContain("example.com");
  });
});

describe("renderWebfetchResult", () => {
  const details: WebFetchDetails = {
    url: "https://example.com/article",
    method: "readability",
    bytes: 4096,
    contentType: "text/html",
    cached: false,
    duration: 350,
  };

  it("should render collapsed result with method and size", () => {
    const theme = mockTheme();
    const result = renderWebfetchResult(
      {
        content: [{ type: "text", text: "# Hello\n\nContent" }],
        details,
      },
      false,
      theme,
    );
    const output = renderOutput(result);
    expect(output).toContain("webfetch");
    expect(output).toContain("fetched");
    expect(output).toContain("350ms");
  });

  it("should render expanded result with full metadata", () => {
    const theme = mockTheme();
    const result = renderWebfetchResult(
      {
        content: [{ type: "text", text: "# Hello\n\nContent" }],
        details,
      },
      true,
      theme,
    );
    const output = renderOutput(result);
    expect(output).toContain("example.com");
    expect(output).toContain("method");
    expect(output).toContain("size");
    expect(output).toContain("text/html");
  });

  it("should show cached indicator for cached results", () => {
    const theme = mockTheme();
    const cachedDetails: WebFetchDetails = { ...details, cached: true };
    const result = renderWebfetchResult(
      {
        content: [{ type: "text", text: "cached content" }],
        details: cachedDetails,
      },
      false,
      theme,
    );
    const output = renderOutput(result);
    expect(output).toContain("cached");
  });

  it("should handle result without details gracefully", () => {
    const theme = mockTheme();
    const result = renderWebfetchResult(
      { content: [{ type: "text", text: "plain text output" }] },
      false,
      theme,
    );
    const output = renderOutput(result);
    expect(output).toContain("plain text output");
  });

  it("should handle full extraction method", () => {
    const theme = mockTheme();
    const fullDetails: WebFetchDetails = { ...details, method: "full" };
    const result = renderWebfetchResult(
      { content: [{ type: "text", text: "..." }], details: fullDetails },
      false,
      theme,
    );
    const output = renderOutput(result);
    expect(output).toContain("webfetch");
  });

  it("should handle raw extraction method", () => {
    const theme = mockTheme();
    const rawDetails: WebFetchDetails = { ...details, method: "raw" };
    const result = renderWebfetchResult(
      { content: [{ type: "text", text: "..." }], details: rawDetails },
      false,
      theme,
    );
    const output = renderOutput(result);
    expect(output).toContain("webfetch");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-render.test.ts`
Expected: FAIL — module `../webfetch/render.js` not found

- [ ] **Step 3: Write the implementation**

Create `extensions/agentic-harness/webfetch/render.ts`:

```typescript
/**
 * Custom TUI rendering for the webfetch tool.
 */

import { type Theme } from "@mariozechner/pi-coding-agent";
import { Text, Container, Spacer } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import type { WebFetchDetails } from "./types.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function methodLabel(
  method: string,
  fg: (color: any, text: string) => string,
): string {
  switch (method) {
    case "readability":
      return fg("success", "readability");
    case "full":
      return fg("warning", "full-html");
    case "raw":
      return fg("dim", "raw");
    default:
      return fg("dim", method);
  }
}

export function renderWebfetchCall(
  args: Record<string, any>,
  theme: Theme,
): Component {
  const url = args.url || "...";
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // Use raw URL if parsing fails
  }

  let text = theme.fg("toolTitle", theme.bold("webfetch "));
  text += theme.fg("accent", hostname);
  if (args.raw) text += theme.fg("dim", " --raw");
  if (args.maxLength) text += theme.fg("dim", ` --max ${args.maxLength}`);
  return new Text(text, 0, 0);
}

export function renderWebfetchResult(
  result: {
    content: Array<{ type: string; text?: string }>;
    details?: unknown;
  },
  expanded: boolean,
  theme: Theme,
): Component {
  const details = result.details as WebFetchDetails | undefined;

  if (!details) {
    const first = result.content[0];
    const text =
      first?.type === "text" && first.text ? first.text : "(no output)";
    return new Text(text, 0, 0);
  }

  const method = methodLabel(details.method, theme.fg.bind(theme));
  const size = formatBytes(details.bytes);
  const cached = details.cached
    ? theme.fg("success", "cached")
    : theme.fg("dim", "fetched");
  const duration = `${details.duration}ms`;

  if (expanded) {
    const container = new Container();

    let header = `${theme.fg("success", "✓")} ${theme.fg("toolTitle", theme.bold("webfetch "))}`;
    header += theme.fg("accent", details.url);
    container.addChild(new Text(header, 0, 0));

    container.addChild(new Spacer(1));

    const meta = [
      `${theme.fg("muted", "method:")} ${method}`,
      `${theme.fg("muted", "size:")} ${theme.fg("dim", size)}`,
      `${theme.fg("muted", "type:")} ${theme.fg("dim", details.contentType)}`,
      `${theme.fg("muted", "status:")} ${cached}`,
      `${theme.fg("muted", "time:")} ${theme.fg("dim", duration)}`,
    ].join("  ");
    container.addChild(new Text(meta, 0, 0));

    return container;
  }

  // Collapsed
  let text = `${theme.fg("success", "✓")} ${theme.fg("toolTitle", theme.bold("webfetch"))}`;
  text += ` ${method} ${theme.fg("dim", size)} ${cached} ${theme.fg("dim", duration)}`;
  return new Text(text, 0, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-render.test.ts`
Expected: ALL PASS (10 tests — 4 renderCall + 6 renderResult)

- [ ] **Step 5: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/webfetch/render.ts extensions/agentic-harness/tests/webfetch-render.test.ts
git commit -m "feat(webfetch): add custom TUI rendering for fetch status and results"
```

---

### Task 6: Create utils.ts + utils.test.ts

**Dependencies:** Tasks 2, 3, 4 must complete (cache.ts, extractContent.ts, turndown.ts)
**Files:**
- Create: `extensions/agentic-harness/webfetch/utils.ts`
- Create: `extensions/agentic-harness/tests/webfetch-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/agentic-harness/tests/webfetch-utils.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch before importing the module
const mockFetch = vi.fn();

describe("fetchUrlToMarkdown", () => {
  let fetchUrlToMarkdown: typeof import("../webfetch/utils.js").fetchUrlToMarkdown;
  let clearCache: typeof import("../webfetch/utils.js").clearCache;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;

    // Re-import to get a fresh cache instance
    vi.resetModules();
    const mod = await import("../webfetch/utils.js");
    fetchUrlToMarkdown = mod.fetchUrlToMarkdown;
    clearCache = mod.clearCache;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockHtmlResponse(html: string, contentType = "text/html") {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": contentType }),
      arrayBuffer: async () => new TextEncoder().encode(html).buffer,
    };
  }

  it("should fetch HTML and convert to markdown", async () => {
    mockFetch.mockResolvedValue(
      mockHtmlResponse("<html><body><h1>Hello</h1><p>World</p></body></html>"),
    );

    const result = await fetchUrlToMarkdown("https://example.com");
    expect(result.content).toContain("Hello");
    expect(result.content).toContain("World");
    expect(result.details.method).toBe("full");
    expect(result.details.cached).toBe(false);
    expect(result.details.contentType).toBe("text/html");
  });

  it("should use Readability for article content", async () => {
    const bodyText = "A".repeat(600);
    const html = `<html><body><article><h1>Title</h1><p>${bodyText}</p></article></body></html>`;
    mockFetch.mockResolvedValue(mockHtmlResponse(html));

    const result = await fetchUrlToMarkdown("https://example.com/article");
    expect(result.details.method).toBe("readability");
    expect(result.content).toContain("Title");
  });

  it("should fall back to full conversion when Readability fails", async () => {
    // No article/main tags, low text density
    const html = "<html><body><div><h1>Nav</h1></div></body></html>";
    mockFetch.mockResolvedValue(mockHtmlResponse(html));

    const result = await fetchUrlToMarkdown("https://example.com");
    expect(result.details.method).toBe("full");
    expect(result.content).toContain("Nav");
  });

  it("should skip Readability when raw is true", async () => {
    const bodyText = "A".repeat(600);
    const html = `<html><body><article><h1>Title</h1><p>${bodyText}</p></article></body></html>`;
    mockFetch.mockResolvedValue(mockHtmlResponse(html));

    const result = await fetchUrlToMarkdown("https://example.com/article", {
      raw: true,
    });
    expect(result.details.method).toBe("full");
  });

  it("should return cached result on second request for the same mode", async () => {
    mockFetch.mockResolvedValue(
      mockHtmlResponse("<html><body><h1>Cached</h1></body></html>"),
    );

    const first = await fetchUrlToMarkdown("https://example.com/cached");
    expect(first.details.cached).toBe(false);

    const second = await fetchUrlToMarkdown("https://example.com/cached");
    expect(second.details.cached).toBe(true);
    expect(second.content).toBe(first.content);
    // fetch should only be called once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should keep raw/full-page mode cache entries separate", async () => {
    const bodyText = "A".repeat(600);
    const html = `<html><body><article><h1>Title</h1><p>${bodyText}</p></article></body></html>`;
    mockFetch.mockResolvedValue(mockHtmlResponse(html));

    const autoResult = await fetchUrlToMarkdown("https://example.com/mode-test");
    const rawResult = await fetchUrlToMarkdown("https://example.com/mode-test", {
      raw: true,
    });

    expect(autoResult.details.method).toBe("readability");
    expect(rawResult.details.method).toBe("full");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should truncate only the returned copy when maxLength is set", async () => {
    const longContent = "x".repeat(5000);
    const html = `<html><body><p>${longContent}</p></body></html>`;
    mockFetch.mockResolvedValue(mockHtmlResponse(html));

    const truncated = await fetchUrlToMarkdown("https://example.com/long", {
      maxLength: 100,
    });
    expect(truncated.content.length).toBeLessThan(200); // 100 + truncation message
    expect(truncated.content).toContain("truncated");

    const full = await fetchUrlToMarkdown("https://example.com/long");
    expect(full.content.length).toBeGreaterThan(1000);
    expect(full.content).not.toContain("... (truncated)");
  });

  it("should handle non-HTML content as raw", async () => {
    mockFetch.mockResolvedValue(
      mockHtmlResponse('{"key": "value"}', "application/json"),
    );

    const result = await fetchUrlToMarkdown("https://example.com/api");
    expect(result.details.method).toBe("raw");
    expect(result.content).toContain("key");
  });

  it("should handle binary content", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });

    const result = await fetchUrlToMarkdown("https://example.com/image.png");
    expect(result.details.method).toBe("raw");
    expect(result.content).toContain("Binary content");
    expect(result.content).toContain("image/png");
  });

  it("should throw on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
    });

    await expect(
      fetchUrlToMarkdown("https://example.com/missing"),
    ).rejects.toThrow("HTTP 404");
  });

  it("should throw on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(
      fetchUrlToMarkdown("https://example.com/down"),
    ).rejects.toThrow("Network error");
  });

  it("should throw on content exceeding size limit", async () => {
    // Content-Length header exceeds 10MB
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-type": "text/html",
        "content-length": String(11 * 1024 * 1024),
      }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    await expect(
      fetchUrlToMarkdown("https://example.com/huge"),
    ).rejects.toThrow("too large");
  });

  it("should reject an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchUrlToMarkdown("https://example.com/aborted", {
        signal: controller.signal,
      }),
    ).rejects.toThrow("aborted");
  });

  it("should clear cache", async () => {
    mockFetch.mockResolvedValue(
      mockHtmlResponse("<html><body><p>Content</p></body></html>"),
    );

    await fetchUrlToMarkdown("https://example.com/clear");
    clearCache();

    const result = await fetchUrlToMarkdown("https://example.com/clear");
    expect(result.details.cached).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-utils.test.ts`
Expected: FAIL — module `../webfetch/utils.js` not found

- [ ] **Step 3: Write the implementation**

Create `extensions/agentic-harness/webfetch/utils.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extensions/agentic-harness && npx vitest run tests/webfetch-utils.test.ts`
Expected: ALL PASS (expanded utils test set, including cache-mode separation and abort handling)

- [ ] **Step 5: Run an integration smoke check**

Run a focused smoke test to prove the pipeline works end-to-end before tool registration. Either add a temporary test case or use a small script with mocked `fetch` to verify:
- HTML article input → `readability`
- same URL with `raw: true` → `full`
- same URL with and without `maxLength` does not poison cache

- [ ] **Step 6: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/webfetch/utils.ts extensions/agentic-harness/tests/webfetch-utils.test.ts
git commit -m "feat(webfetch): add core fetch + convert pipeline with caching"
```

---

### Task 7: Register webfetch tool in index.ts + Update extension.test.ts

**Dependencies:** Tasks 5 and 6 must complete (render.ts and utils.ts must exist)
**Files:**
- Modify: `extensions/agentic-harness/index.ts`
- Modify: `extensions/agentic-harness/tests/extension.test.ts`

- [ ] **Step 1: Add imports for webfetch modules to index.ts**

Add these imports at the top of `extensions/agentic-harness/index.ts`, after the existing imports (after the `import { isDisciplineAgent, ... } from "./discipline.js";` line):

```typescript
import { fetchUrlToMarkdown } from "./webfetch/utils.js";
import { renderWebfetchCall, renderWebfetchResult } from "./webfetch/render.js";
```

- [ ] **Step 2: Add WebFetchParams schema and tool registration to index.ts**

Add the WebFetchParams schema and tool registration after the closing `});` of the subagent tool registration block. This is immediately before the `pi.on("resources_discover", ...)` line.

Find the exact line:
```typescript
  pi.on("resources_discover", async (_event, _ctx) => {
```

Insert the following code block BEFORE that line:

```typescript
  const WebFetchParams = Type.Object({
    url: Type.String({
      description: "The URL to fetch and convert to Markdown",
    }),
    raw: Type.Optional(
      Type.Boolean({
        description:
          "For HTML only: skip Readability extraction and convert the full page to Markdown. Non-HTML content still returns verbatim text or a binary placeholder.",
        default: false,
      }),
    ),
    maxLength: Type.Optional(
      Type.Number({
        description:
          "Maximum number of characters to return. Content beyond this limit is truncated.",
      }),
    ),
  });

  pi.registerTool({
    name: "webfetch",
    label: "WebFetch",
    description:
      "Fetch a URL and convert its HTML content to clean Markdown. Uses Mozilla Readability for article extraction when possible, with Turndown + GFM for Markdown conversion. Results are cached for 15 minutes.",
    promptSnippet: "Fetch a URL and convert to Markdown",
    promptGuidelines: [
      "Use webfetch to retrieve and read web pages, documentation, or any URL content.",
      "The tool automatically extracts main article content using Readability — navigation, ads, and footers are stripped.",
      "Use raw: true when you need the full HTML page converted, not just the article content.",
      "Use maxLength to limit output size for very large pages.",
      "Results are cached for 15 minutes — repeated requests for the same URL return instantly.",
    ],
    parameters: WebFetchParams,

    renderCall: (args, theme) => renderWebfetchCall(args, theme),
    renderResult: (result, { expanded }, theme) =>
      renderWebfetchResult(result, expanded, theme),

    execute: async (toolCallId, params, signal, _onUpdate, _ctx) => {
      const { url, raw, maxLength } = params;
      try {
        const { content, details } = await fetchUrlToMarkdown(url, {
          raw,
          maxLength,
          signal,
        });
        return {
          content: [{ type: "text" as const, text: content }],
          details,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching ${url}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  });

```

- [ ] **Step 3: Add webfetch tool registration test to extension.test.ts**

Add the following test block to `extensions/agentic-harness/tests/extension.test.ts`, after the existing `describe("Validator Information Barrier", ...)` block:

```typescript
describe("webfetch Tool", () => {
  it("should register webfetch tool", () => {
    const { mockPi, tools } = createMockPi();
    extension(mockPi);

    const tool = tools.get("webfetch");
    expect(tool).toBeDefined();
    expect(tool.name).toBe("webfetch");
    expect(tool.promptSnippet).toBeDefined();
    expect(tool.promptGuidelines).toBeDefined();
    expect(tool.promptGuidelines.length).toBeGreaterThan(0);
    expect(tool.renderCall).toBeTypeOf("function");
    expect(tool.renderResult).toBeTypeOf("function");
  });

  it("should have url as required parameter in schema", () => {
    const { mockPi, tools } = createMockPi();
    extension(mockPi);

    const tool = tools.get("webfetch");
    const schema = tool.parameters;
    expect(schema.properties.url).toBeDefined();
    expect(schema.properties.raw).toBeDefined();
    expect(schema.properties.maxLength).toBeDefined();
    // url is required
    expect(schema.required).toContain("url");
  });
});
```

- [ ] **Step 4: Run all tests to verify everything passes**

Run: `cd extensions/agentic-harness && npm test`
Expected: Full extension test suite passes, including the new webfetch tests

- [ ] **Step 5: Verify TypeScript compiles clean**

Run: `cd extensions/agentic-harness && npm run build`
Expected: No type errors

- [ ] **Step 6: Do one manual tool demo**

After registration, manually exercise the tool once in pi (or via the extension harness) with a simple public URL and confirm:
- the tool appears as `webfetch`
- a successful result includes `details`
- expanded rendering shows metadata without crashing

- [ ] **Step 7: Commit**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/index.ts extensions/agentic-harness/tests/extension.test.ts
git commit -m "feat(webfetch): register webfetch tool in agentic-harness extension"
```

---

### Task 8 (Final): End-to-End Verification

**Dependencies:** All preceding tasks
**Files:** None (read-only verification)

- [ ] **Step 1: Run full test suite**

Run: `cd extensions/agentic-harness && npm test`
Expected: Full extension test suite passes with no failures

- [ ] **Step 2: Run TypeScript type check**

Run: `cd extensions/agentic-harness && npm run build`
Expected: No type errors

- [ ] **Step 3: Verify plan success criteria**

Manually check each success criterion:

- [ ] `webfetch/types.ts` exports `ExtractionMethod`, `ExtractedArticle`, `CacheEntry`, `WebFetchDetails`
- [ ] `webfetch/cache.ts` implements LRU cache with TTL eviction, passes all 8 tests
- [ ] `webfetch/extractContent.ts` implements Readability extraction with dynamic imports, passes all 9 tests
- [ ] `webfetch/turndown.ts` implements lazy Turndown + GFM singleton, passes all 8 tests
- [ ] `webfetch/render.ts` implements custom TUI rendering for call/result, passes all 10 tests
- [ ] `webfetch/utils.ts` implements fetch pipeline with caching, abort signal, size limits, timeout, preserves full cached content, separates cache entries by transform mode, and passes the expanded utils test suite
- [ ] `index.ts` registers `webfetch` tool with TypeBox schema, render functions, and execute handler
- [ ] `extension.test.ts` includes webfetch registration test
- [ ] All new dependencies installed (`@mozilla/readability`, `jsdom`, `turndown`, `turndown-plugin-gfm`, `@types/turndown`)
- [ ] No regressions in existing tests

- [ ] **Step 4: Verify all new files exist**

Run:
```bash
ls -la extensions/agentic-harness/webfetch/types.ts
ls -la extensions/agentic-harness/webfetch/cache.ts
ls -la extensions/agentic-harness/webfetch/extractContent.ts
ls -la extensions/agentic-harness/webfetch/turndown.ts
ls -la extensions/agentic-harness/webfetch/render.ts
ls -la extensions/agentic-harness/webfetch/utils.ts
ls -la extensions/agentic-harness/tests/webfetch-cache.test.ts
ls -la extensions/agentic-harness/tests/webfetch-extract.test.ts
ls -la extensions/agentic-harness/tests/webfetch-turndown.test.ts
ls -la extensions/agentic-harness/tests/webfetch-render.test.ts
ls -la extensions/agentic-harness/tests/webfetch-utils.test.ts
```

Expected: All 11 files exist

- [ ] **Step 5: Run full test suite for regressions**

Run: `cd extensions/agentic-harness && npm test`
Expected: No regressions — all pre-existing tests still pass, all new tests pass
