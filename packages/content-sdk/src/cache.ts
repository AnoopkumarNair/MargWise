/**
 * Persistent store for release files. The browser app injects an IndexedDB or
 * Cache Storage implementation; tests use the in-memory one.
 */
export interface ContentCache {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}

export class MemoryContentCache implements ContentCache {
  readonly #store = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.#store.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.#store.set(key, structuredClone(value));
  }
}
