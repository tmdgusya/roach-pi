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
    this.detachNode(node);
    this.addToHead(node);
  }

  private addToHead(node: CacheNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private detachNode(node: CacheNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
  }

  private removeNode(node: CacheNode): void {
    this.detachNode(node);
    this.map.delete(node.key);
  }
}
