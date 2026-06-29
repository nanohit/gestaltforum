type Entry<T> = { value: T; expiresAt: number };

export class LruCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(
    private readonly maxEntries = 100,
    private readonly ttlMs = 60_000
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

export const articleCache = new LruCache<unknown>(100, 5 * 60_000);
export const publicHtmlCache = new LruCache<{
  body: string;
  status: number;
  headers: Array<[string, string]>;
}>(60, 2 * 60_000);
