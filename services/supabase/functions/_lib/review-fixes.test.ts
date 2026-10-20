import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDeletionRequest } from './deletion-request.ts';
import { MAX_BODY_BYTES } from './http.ts';
import { MemoryTelemetryStore } from './memory-store.ts';
import type { Deps } from './ports.ts';
import { handleTelemetryIngest } from './telemetry-ingest.ts';
import { cachedFlag, clientIp, sha256Hex, windowRateLimiter } from './util.ts';

const SESSION = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';
const BASE = 'https://ref.supabase.co/functions/v1/telemetry-ingest';
let store: MemoryTelemetryStore;
let deps: Deps;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  handleTelemetryIngest(
    new Request(`${BASE}/${path}`, { method: 'POST', body: JSON.stringify(body), headers }),
    deps,
  );
const consentBody = async (tier: 1 | 2, code: string) => ({
  sessionId: SESSION,
  tier,
  noticeVersion: 'v1',
  teenAssent: true,
  deletionCodeHash: await sha256Hex(code),
  consentedAt: '2026-10-20T10:00:00Z',
});
const del = (code: string) =>
  handleDeletionRequest(
    new Request('https://x/deletion-request', {
      method: 'POST',
      body: JSON.stringify({ sessionId: SESSION, deletionCode: code }),
    }),
    deps,
  );

beforeEach(() => {
  store = new MemoryTelemetryStore();
  deps = {
    store,
    rateLimiter: windowRateLimiter({ limit: 1000, windowMs: 60_000, now: () => 0 }),
    sha256: sha256Hex,
  };
});

describe('deletion code is fixed per session (review #6)', () => {
  it('a later consent with a different deletion code is refused (409)', async () => {
    expect((await post('consent', await consentBody(1, 'AAAA-BBBB-CCCC'))).status).toBe(202);
    const hijack = await post('consent', await consentBody(1, 'ZZZZ-ZZZZ-ZZZZ'));
    expect(hijack.status).toBe(409);
    expect((await del('ZZZZ-ZZZZ-ZZZZ')).status).toBe(404);
  });

  it('a tier change with the same code is accepted and the original code still deletes', async () => {
    await post('consent', await consentBody(2, 'AAAA-BBBB-CCCC'));
    expect((await post('consent', await consentBody(1, 'AAAA-BBBB-CCCC'))).status).toBe(202);
    expect((await del('AAAA-BBBB-CCCC')).status).toBe(202);
  });

  it('the in-memory store really deletes the session’s rows (so handler tests can see it)', async () => {
    await post('consent', await consentBody(1, 'AAAA-BBBB-CCCC'));
    await post('feedback', { sessionId: SESSION, recommend: 5 });
    await post('events', {
      sessionId: SESSION,
      events: [
        {
          type: 'reveal_viewed',
          eventId: '1c2d3e4f-5a6b-4c7d-8e9f-000000000001',
          sessionId: SESSION,
          seq: 0,
          occurredAt: '2026-10-20T10:00:00Z',
          actor: 'teen',
        },
      ],
    });
    expect(store.events.size).toBe(1);
    await del('AAAA-BBBB-CCCC');
    expect(store.events.size).toBe(0);
    expect(store.consents).toEqual([]);
    expect(store.feedback).toEqual([]);
  });
});

describe('rate limiting (review #7)', () => {
  it('limits before any database call', async () => {
    deps.rateLimiter = windowRateLimiter({ limit: 0, windowMs: 60_000, now: () => 0 });
    const spy = vi.spyOn(store, 'minorsTelemetryEnabled');
    expect((await post('feedback', { sessionId: SESSION, recommend: 1 })).status).toBe(429);
    expect(spy).not.toHaveBeenCalled();
  });

  it('uses the proxy-added (right-most) X-Forwarded-For hop, so a spoofed left-most entry does not reset the bucket', async () => {
    deps.rateLimiter = windowRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
    const other = (i: number) => `9f8e7d6c-5b4a-4392-8170-${String(i).padStart(12, '0')}`;
    await post(
      'feedback',
      { sessionId: other(1), recommend: 1 },
      { 'x-forwarded-for': '1.1.1.1, 203.0.113.7' },
    );
    const res = await post(
      'feedback',
      { sessionId: other(2), recommend: 1 },
      { 'x-forwarded-for': '2.2.2.2, 203.0.113.7' },
    );
    expect(res.status).toBe(429);
  });

  it('clientIp prefers the platform header, then the right-most hop', () => {
    expect(
      clientIp(
        new Headers({ 'cf-connecting-ip': '198.51.100.1', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }),
      ),
    ).toBe('198.51.100.1');
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('2.2.2.2');
    expect(clientIp(new Headers())).toBeUndefined();
  });

  it('evicts the oldest live windows when every window is still live', () => {
    const rl = windowRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0, maxKeys: 10 });
    for (let i = 0; i < 25; i++) rl.allow(`k${i}`);
    expect(rl.size()).toBeLessThanOrEqual(10);
  });

  it('evicts expired windows so memory stays bounded', () => {
    let t = 0;
    const rl = windowRateLimiter({ limit: 1, windowMs: 1000, now: () => t, maxKeys: 100 });
    for (let i = 0; i < 100; i++) rl.allow(`k${i}`);
    t = 5000;
    for (let i = 0; i < 50; i++) rl.allow(`n${i}`);
    expect(rl.size()).toBeLessThanOrEqual(100);
  });
});

describe('cachedFlag (kill switch read at most once per TTL)', () => {
  it('caches the value for the TTL', async () => {
    let t = 0;
    const read = vi.fn(async () => true);
    const flag = cachedFlag(read, 10_000, () => t);
    await flag();
    await flag();
    expect(read).toHaveBeenCalledTimes(1);
    t = 10_001;
    await flag();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('bodies without a session id', () => {
  it('a JSON array body is a schema violation, not a crash', async () => {
    expect((await post('events', [])).status).toBe(400);
  });
});

describe('body size (review #20)', () => {
  it('rejects by Content-Length before reading the body', async () => {
    const req = new Request(`${BASE}/events`, {
      method: 'POST',
      body: '{}',
      headers: { 'content-length': String(MAX_BODY_BYTES + 1) },
    });
    const text = vi.spyOn(req, 'text');
    expect((await handleTelemetryIngest(req, deps)).status).toBe(413);
    expect(text).not.toHaveBeenCalled();
  });
});
