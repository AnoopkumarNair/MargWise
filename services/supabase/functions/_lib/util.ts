import type { RateLimiter } from './ports.ts';

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fixed-window limiter held in isolate memory. Keys (session ids, IP hashes)
 * are never persisted. Expired windows are evicted once `maxKeys` is reached,
 * so memory stays bounded under a flood of distinct keys (review #7).
 */
export function windowRateLimiter(opts: {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}): RateLimiter & { size(): number } {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();
  const evict = (t: number) => {
    for (const [k, w] of windows) if (t - w.start > opts.windowMs) windows.delete(k);
    // Still full of live windows: drop the oldest (a Map keeps insertion order).
    for (const k of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(k);
    }
  };
  return {
    allow(key) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start > opts.windowMs) {
        if (!w && windows.size >= maxKeys) evict(t);
        windows.set(key, { start: t, count: 1 });
        return opts.limit > 0;
      }
      w.count += 1;
      return w.count <= opts.limit;
    },
    size: () => windows.size,
  };
}

/**
 * Client IP for rate limiting only (hashed, never stored). Prefers the
 * platform's own header, else the right-most X-Forwarded-For hop, which the
 * platform proxy appends and the client cannot spoof.
 */
export function clientIp(headers: Headers): string | undefined {
  const platform = headers.get('cf-connecting-ip') ?? headers.get('x-real-ip');
  if (platform) return platform.trim();
  const hops = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return hops?.at(-1);
}

/** Caches an async boolean (e.g. the kill switch) for `ttlMs`, so floods don't hit the database. */
export function cachedFlag(
  read: () => Promise<boolean>,
  ttlMs: number,
  now: () => number = Date.now,
): () => Promise<boolean> {
  let value: boolean | undefined;
  let at = -Infinity;
  return async () => {
    if (value === undefined || now() - at > ttlMs) {
      value = await read();
      at = now();
    }
    return value;
  };
}
