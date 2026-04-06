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
