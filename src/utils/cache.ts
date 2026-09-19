export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class MetadataCache {
  private store = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlMs: number = 300000) { // default 5 minutes
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string) {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

export const metadataCache = new MetadataCache();
