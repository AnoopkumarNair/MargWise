import type { RateLimiter } from './ports.ts';

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fixed-window limiter held in isolate memory. Keys (session ids, IP hashes) are never persisted. */
export function windowRateLimiter(opts: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start > opts.windowMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= opts.limit;
    },
  };
}
