import { beforeEach, describe, expect, it } from 'vitest';
import { handleTelemetryIngest, MAX_BODY_BYTES } from './telemetry-ingest.ts';
import { handleDeletionRequest } from './deletion-request.ts';
import { MemoryTelemetryStore } from './memory-store.ts';
import { sha256Hex, windowRateLimiter } from './util.ts';
import type { Deps } from './ports.ts';

const SESSION = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';
const CODE = 'ABCD-EFGH-JKLM';
const BASE = 'https://ref.supabase.co/functions/v1/telemetry-ingest';

const event = (n = 0) => ({
  type: 'reveal_viewed',
  eventId: `1c2d3e4f-5a6b-4c7d-8e9f-${String(n).padStart(12, '0')}`,
  sessionId: SESSION,
  seq: n,
  occurredAt: '2026-10-20T10:00:00Z',
  actor: 'teen',
});

const responses = {
  sessionId: SESSION,
  arm: 'game',
  values: Array.from({ length: 60 }, () => 2),
  areaScores: { R: 20, I: 20, A: 20, S: 20, E: 20, C: 20 },
  flags: { straightLining: true, flatProfile: true, lowEngagement: false, highEngagement: false },
  parentPresent: 'no',
  deviceClass: 'mid',
  classYear: 12,
  board: 'CBSE',
  subjects: ['english', 'physics', 'chemistry', 'mathematics'],
  cityTier: 'tier-2',
};

let store: MemoryTelemetryStore;
let deps: Deps;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  handleTelemetryIngest(
    new Request(`${BASE}/${path}`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...headers },
    }),
    deps,
  );

async function consent(tier: 1 | 2) {
  const res = await post('consent', {
    sessionId: SESSION,
    tier,
    noticeVersion: '2026-10-20',
    teenAssent: true,
    deletionCodeHash: await sha256Hex(CODE),
    consentedAt: '2026-10-20T10:00:00Z',
  });
  expect(res.status).toBe(202);
}

beforeEach(() => {
  store = new MemoryTelemetryStore();
  deps = {
    store,
    rateLimiter: windowRateLimiter({ limit: 1000, windowMs: 60_000, now: () => 0 }),
    sha256: sha256Hex,
  };
});

describe('telemetry-ingest: request hygiene', () => {
  it('405 for anything but POST', async () => {
    const res = await handleTelemetryIngest(new Request(`${BASE}/events`, { method: 'GET' }), deps);
    expect(res.status).toBe(405);
  });

  it('404 for an unknown route', async () => {
    expect((await post('cursor', {})).status).toBe(404);
  });

  it('400 for malformed JSON', async () => {
    expect((await post('events', '{not json')).status).toBe(400);
  });

  it('413 for an oversized body', async () => {
    expect((await post('events', 'x'.repeat(MAX_BODY_BYTES + 1))).status).toBe(413);
  });

  it('responds without echoing the payload', async () => {
    const res = await post('events', {
      sessionId: SESSION,
      events: [{ ...event(), extra: 'secret-value' }],
    });
    expect(await res.text()).not.toContain('secret-value');
  });

  it('allows CORS preflight', async () => {
    const res = await handleTelemetryIngest(
      new Request(`${BASE}/events`, { method: 'OPTIONS' }),
      deps,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toBe('POST');
  });
});

describe('telemetry-ingest: closed schemas and PII denylist (04 §6.4)', () => {
  beforeEach(() => consent(1));

  it('rejects unknown fields with 400 schema_violation', async () => {
    const res = await post('events', { sessionId: SESSION, events: [{ ...event(), hoverMs: 12 }] });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'schema_violation' });
    expect(store.events.size).toBe(0);
  });

  it('rejects PII-like keys anywhere in the body before schema parsing', async () => {
    const res = await post('feedback', {
      sessionId: SESSION,
      recommend: 9,
      contact: { email: 'a@b.c' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'pii_key', paths: ['contact', 'contact.email'] });
    expect(store.feedback).toEqual([]);
  });

  it('accepts a valid batch and is idempotent on retry', async () => {
    const batch = { sessionId: SESSION, events: [event(0), event(1)] };
    expect((await post('events', batch)).status).toBe(202);
    expect((await post('events', batch)).status).toBe(202);
    expect(store.events.size).toBe(2);
  });
});

describe('telemetry-ingest: consent gating', () => {
  it('403 no_consent for events from a session without a consent record', async () => {
    const res = await post('events', { sessionId: SESSION, events: [event()] });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'no_consent' });
  });

  it('403 for Tier 2 responses at Tier 1', async () => {
    await consent(1);
    expect((await post('responses', responses)).status).toBe(403);
    expect(store.responses).toEqual([]);
  });

  it('stores Tier 2 responses at Tier 2', async () => {
    await consent(2);
    expect((await post('responses', responses)).status).toBe(202);
    expect(store.responses).toHaveLength(1);
  });

  it('a later Tier 1 consent downgrades the session', async () => {
    await consent(2);
    await consent(1);
    expect((await post('responses', responses)).status).toBe(403);
  });

  it('coverage requests and feedback need Tier 1', async () => {
    expect(
      (await post('coverage-requests', { sessionId: SESSION, kind: 'country', label: 'France' }))
        .status,
    ).toBe(403);
    await consent(1);
    expect(
      (await post('coverage-requests', { sessionId: SESSION, kind: 'country', label: 'France' }))
        .status,
    ).toBe(202);
    expect((await post('feedback', { sessionId: SESSION, recommend: 7 })).status).toBe(202);
    expect(store.coverage).toHaveLength(1);
    expect(store.feedback).toHaveLength(1);
  });

  it('rejects a Tier 2 consent without teen assent', async () => {
    const res = await post('consent', {
      sessionId: SESSION,
      tier: 2,
      noticeVersion: 'v',
      teenAssent: false,
      deletionCodeHash: 'f'.repeat(64),
      consentedAt: '2026-10-20T10:00:00Z',
    });
    expect(res.status).toBe(400);
  });
});

describe('telemetry-ingest: minors kill switch (configuration only)', () => {
  it('403 telemetry_disabled for every route, consent included', async () => {
    store.minorsEnabled = false;
    const res = await post('consent', {
      sessionId: SESSION,
      tier: 1,
      noticeVersion: 'v',
      teenAssent: false,
      deletionCodeHash: 'f'.repeat(64),
      consentedAt: '2026-10-20T10:00:00Z',
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'telemetry_disabled' });
    expect(store.consents).toEqual([]);
  });
});

describe('telemetry-ingest: rate limiting', () => {
  it('429 once a session exceeds its budget', async () => {
    deps.rateLimiter = windowRateLimiter({ limit: 2, windowMs: 60_000, now: () => 0 });
    await consent(1);
    expect((await post('events', { sessionId: SESSION, events: [event(1)] })).status).toBe(202);
    expect((await post('events', { sessionId: SESSION, events: [event(2)] })).status).toBe(429);
  });

  it('also limits by hashed client IP across sessions', async () => {
    deps.rateLimiter = windowRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
    const other = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
    const h = { 'x-forwarded-for': '203.0.113.7' };
    await post('feedback', { sessionId: SESSION, recommend: 1 }, h);
    const res = await post('feedback', { sessionId: other, recommend: 1 }, h);
    expect(res.status).toBe(429);
  });
});

describe('windowRateLimiter', () => {
  it('resets after the window', () => {
    let t = 0;
    const rl = windowRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(rl.allow('k')).toBe(true);
    expect(rl.allow('k')).toBe(false);
    t = 1001;
    expect(rl.allow('k')).toBe(true);
  });
});

describe('deletion-request (04 §6.1)', () => {
  const del = (body: unknown) =>
    handleDeletionRequest(
      new Request('https://ref.supabase.co/functions/v1/deletion-request', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      deps,
    );

  it('accepts the correct code and files a deletion request', async () => {
    await consent(1);
    expect((await del({ sessionId: SESSION, deletionCode: CODE })).status).toBe(202);
    expect(store.deletionRequests).toEqual([SESSION]);
  });

  it('404 for a wrong code, without filing anything', async () => {
    await consent(1);
    expect((await del({ sessionId: SESSION, deletionCode: 'ZZZZ-ZZZZ-ZZZZ' })).status).toBe(404);
    expect(store.deletionRequests).toEqual([]);
  });

  it('404 (same response) for an unknown session', async () => {
    const res = await del({ sessionId: SESSION, deletionCode: CODE });
    expect(res.status).toBe(404);
  });

  it('works while the kill switch is on — deletion is always honoured', async () => {
    await consent(1);
    store.minorsEnabled = false;
    expect((await del({ sessionId: SESSION, deletionCode: CODE })).status).toBe(202);
  });

  it('400 for a malformed request', async () => {
    expect((await del({ sessionId: SESSION })).status).toBe(400);
  });

  it('405 for GET', async () => {
    const res = await handleDeletionRequest(new Request('https://x/deletion-request'), deps);
    expect(res.status).toBe(405);
  });
});
