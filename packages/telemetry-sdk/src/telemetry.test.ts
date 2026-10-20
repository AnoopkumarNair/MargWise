import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTelemetry, fetchTransport, MemoryQueueStore, type Transport } from './index.ts';

const SESSION = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';
const HASH = 'f'.repeat(64);
const consent = (tier: 1 | 2, teenAssent = true) => ({
  tier,
  noticeVersion: '2026-10-20',
  teenAssent,
  deletionCodeHash: HASH,
});
const responses = {
  arm: 'game' as const,
  values: Array.from({ length: 60 }, () => 2),
  areaScores: { R: 20, I: 20, A: 20, S: 20, E: 20, C: 20 },
  flags: { straightLining: true, flatProfile: true, lowEngagement: false, highEngagement: false },
  parentPresent: 'no' as const,
  deviceClass: 'mid' as const,
  classYear: 11 as const,
  board: 'CBSE' as const,
  subjectAreas: ['maths', 'sciences', 'languages'] as Array<'maths' | 'sciences' | 'languages'>,
  cityTier: 'metro' as const,
};

function spyTransport(status = 202) {
  const sent: Array<{ path: string; body: unknown }> = [];
  let mode: 'ok' | 'offline' = 'ok';
  let nextStatus = status;
  const transport: Transport = {
    async post(path, body) {
      if (mode === 'offline') throw new TypeError('Failed to fetch');
      sent.push({ path, body: structuredClone(body) });
      return { status: nextStatus };
    },
  };
  return {
    transport,
    sent,
    paths: () => sent.map((s) => s.path),
    offline: () => (mode = 'offline'),
    online: () => (mode = 'ok'),
    respondWith: (s: number) => (nextStatus = s),
  };
}

let ids = 0;
const uuid = () => `00000000-0000-4000-8000-${String(ids++).padStart(12, '0')}`;

function setup(
  opts: { minorsTelemetryEnabled?: boolean; batchSize?: number; status?: number } = {},
) {
  const spy = spyTransport(opts.status);
  const store = new MemoryQueueStore();
  let now = new Date('2026-10-20T10:00:00Z').getTime();
  const telemetry = createTelemetry({
    sessionId: SESSION,
    config: {
      minorsTelemetryEnabled: opts.minorsTelemetryEnabled ?? true,
      batchSize: opts.batchSize ?? 20,
    },
    transport: spy.transport,
    store,
    clock: () => now,
    uuid,
  });
  return { telemetry, spy, store, advance: (ms: number) => (now += ms) };
}

describe('Tier 0 — "Nothing leaves this phone" (04 §6.1, §6.4)', () => {
  it('is the default tier', () => {
    expect(setup().telemetry.tier).toBe(0);
  });

  it('drops events without queueing or sending them', async () => {
    const { telemetry, spy, store } = setup();
    expect(telemetry.track({ type: 'reveal_viewed' })).toBe('dropped');
    await telemetry.flush();
    expect(spy.sent).toEqual([]);
    expect(await store.load()).toEqual({ events: [], pending: [] });
  });

  it('refuses responses, coverage requests and feedback', async () => {
    const { telemetry, spy } = setup();
    expect(await telemetry.submitResponses(responses)).toBe('dropped');
    expect(await telemetry.submitCoverageRequest({ kind: 'country', label: 'France' })).toBe(
      'dropped',
    );
    expect(await telemetry.submitFeedback({ recommend: 9 })).toBe('dropped');
    await telemetry.flush();
    expect(spy.sent).toEqual([]);
  });

  describe('network spy on globalThis.fetch with the real fetch transport', () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 202 }));
    beforeEach(() => vi.stubGlobal('fetch', fetchSpy));
    afterEach(() => {
      vi.unstubAllGlobals();
      fetchSpy.mockClear();
    });

    it('makes zero network requests across a full session at Tier 0', async () => {
      const telemetry = createTelemetry({
        sessionId: SESSION,
        config: { minorsTelemetryEnabled: true, batchSize: 1 },
        transport: fetchTransport('https://telemetry.example.test'),
        store: new MemoryQueueStore(),
        clock: () => Date.now(),
        uuid,
      });
      for (let day = 1; day <= 6; day++) {
        telemetry.track({ type: 'day_started', day });
        for (let i = 1; i <= 10; i++)
          telemetry.track({ type: 'item_answered', itemNumber: (day - 1) * 10 + i, undoCount: 0 });
        telemetry.track({ type: 'day_completed', day, durationMs: 50_000 });
      }
      await telemetry.submitResponses(responses);
      await telemetry.submitFeedback({ recommend: 10 });
      await telemetry.flush();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('the same session at Tier 1 does use fetch (the spy is not vacuous)', async () => {
      const telemetry = createTelemetry({
        sessionId: SESSION,
        config: { minorsTelemetryEnabled: true, batchSize: 1 },
        transport: fetchTransport('https://telemetry.example.test'),
        store: new MemoryQueueStore(),
        clock: () => Date.now(),
        uuid,
      });
      await telemetry.setConsent(consent(1, false));
      telemetry.track({ type: 'reveal_viewed' });
      await telemetry.flush();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://telemetry.example.test/telemetry/v1/consent',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://telemetry.example.test/telemetry/v1/events',
        expect.anything(),
      );
    });
  });
});

describe('Consent', () => {
  it('sends the consent record before any event', async () => {
    const { telemetry, spy } = setup();
    await telemetry.setConsent(consent(1, false));
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.flush();
    expect(spy.paths()).toEqual(['/telemetry/v1/consent', '/telemetry/v1/events']);
    expect(spy.sent[0]?.body).toMatchObject({
      sessionId: SESSION,
      tier: 1,
      teenAssent: false,
      consentedAt: '2026-10-20T10:00:00.000Z',
    });
  });

  it('holds events locally until the consent record is accepted (offline at consent time)', async () => {
    const { telemetry, spy, advance } = setup();
    spy.offline();
    await telemetry.setConsent(consent(1));
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.flush();
    expect(spy.sent).toEqual([]);
    spy.online();
    advance(60_000);
    await telemetry.flush();
    expect(spy.paths()).toEqual(['/telemetry/v1/consent', '/telemetry/v1/events']);
  });

  it('rejects Tier 2 without teen assent', async () => {
    const { telemetry } = setup();
    await expect(telemetry.setConsent(consent(2, false))).rejects.toThrow(/teen assent/i);
    expect(telemetry.tier).toBe(0);
  });

  it('downgrading to Tier 0 stops sending immediately and discards the local queue', async () => {
    const { telemetry, spy, store } = setup();
    await telemetry.setConsent(consent(1));
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.setConsent({ tier: 0 });
    await telemetry.flush();
    expect(spy.paths()).toEqual(['/telemetry/v1/consent']);
    expect((await store.load()).events).toEqual([]);
    expect(telemetry.track({ type: 'reveal_viewed' })).toBe('dropped');
  });

  it('downgrading 2 → 1 discards unsent item responses and records the new tier', async () => {
    const { telemetry, spy, advance } = setup();
    await telemetry.setConsent(consent(2));
    spy.offline();
    await telemetry.submitResponses(responses);
    await telemetry.setConsent(consent(1));
    spy.online();
    advance(60_000);
    await telemetry.flush();
    expect(spy.paths()).toEqual(['/telemetry/v1/consent', '/telemetry/v1/consent']);
    expect(spy.sent[1]?.body).toMatchObject({ tier: 1 });
  });
});

describe('Global kill switch for minors telemetry (04 §6.3 — configuration only)', () => {
  it('behaves as Tier 0 even when the Patron chose Tier 2', async () => {
    const { telemetry, spy } = setup({ minorsTelemetryEnabled: false });
    await telemetry.setConsent(consent(2));
    expect(telemetry.track({ type: 'reveal_viewed' })).toBe('dropped');
    expect(await telemetry.submitResponses(responses)).toBe('dropped');
    await telemetry.flush();
    expect(spy.sent).toEqual([]);
  });

  it('a 403 from the server switches the session to Tier 0 and clears the queue', async () => {
    const { telemetry, spy, store } = setup();
    await telemetry.setConsent(consent(1));
    spy.respondWith(403);
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.flush();
    expect(telemetry.tier).toBe(0);
    expect((await store.load()).events).toEqual([]);
  });
});

describe('Closed schemas on the phone', () => {
  it('throws on an unknown field (developer error, caught in tests)', async () => {
    const { telemetry } = setup();
    await telemetry.setConsent(consent(1));
    // @ts-expect-error hover tracking is not an allowed field
    expect(() => telemetry.track({ type: 'reveal_viewed', hoverMs: 10 })).toThrow();
  });

  it('builds the envelope: unique event ids, monotonic seq, clock timestamp', async () => {
    const { telemetry, spy, advance } = setup();
    await telemetry.setConsent(consent(1));
    telemetry.track({ type: 'scene_entered', scene: 'prologue' });
    advance(1000);
    telemetry.track({ type: 'scene_exited', scene: 'prologue', durationMs: 1000 });
    await telemetry.flush();
    const batch = spy.sent[1]?.body as {
      events: Array<{ seq: number; eventId: string; occurredAt: string }>;
    };
    expect(batch.events.map((e) => e.seq)).toEqual([0, 1]);
    expect(new Set(batch.events.map((e) => e.eventId)).size).toBe(2);
    expect(batch.events[1]?.occurredAt).toBe('2026-10-20T10:00:01.000Z');
  });
});

describe('Batching and offline retry', () => {
  it('flushes automatically when the batch size is reached', async () => {
    const { telemetry, spy } = setup({ batchSize: 3 });
    await telemetry.setConsent(consent(1));
    telemetry.track({ type: 'reveal_viewed' });
    telemetry.track({ type: 'reveal_viewed' });
    expect(spy.paths()).toEqual(['/telemetry/v1/consent']);
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.idle();
    expect(spy.paths()).toEqual(['/telemetry/v1/consent', '/telemetry/v1/events']);
  });

  it('sends at most 100 events per request', async () => {
    const { telemetry, spy } = setup({ batchSize: 1000 });
    await telemetry.setConsent(consent(1));
    for (let i = 0; i < 250; i++) telemetry.track({ type: 'reveal_viewed' });
    await telemetry.flush();
    const sizes = spy.sent.slice(1).map((s) => (s.body as { events: unknown[] }).events.length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  it('keeps events persisted while offline and retries with backoff', async () => {
    const { telemetry, spy, store, advance } = setup();
    await telemetry.setConsent(consent(1));
    spy.offline();
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.flush();
    expect((await store.load()).events).toHaveLength(1);

    spy.online();
    await telemetry.flush(); // still inside the backoff window
    expect(spy.paths()).toEqual(['/telemetry/v1/consent']);

    advance(60_000);
    await telemetry.flush();
    expect(spy.paths()).toEqual(['/telemetry/v1/consent', '/telemetry/v1/events']);
    expect((await store.load()).events).toEqual([]);
  });

  it('restores a persisted queue after an app restart', async () => {
    const first = setup();
    await first.telemetry.setConsent(consent(1));
    first.spy.offline();
    first.telemetry.track({ type: 'reveal_viewed' });
    await first.telemetry.flush();

    const spy = spyTransport();
    const restarted = createTelemetry({
      sessionId: SESSION,
      config: { minorsTelemetryEnabled: true, batchSize: 20 },
      transport: spy.transport,
      store: first.store,
      clock: () => new Date('2026-10-20T11:00:00Z').getTime(),
      uuid,
      restoredConsent: { tier: 1, recorded: true },
    });
    await restarted.flush();
    expect(spy.paths()).toEqual(['/telemetry/v1/events']);
  });

  it('drops a batch the server rejects as invalid (400) instead of retrying forever', async () => {
    const { telemetry, spy, store } = setup();
    await telemetry.setConsent(consent(1));
    spy.respondWith(400);
    telemetry.track({ type: 'reveal_viewed' });
    await telemetry.flush();
    expect((await store.load()).events).toEqual([]);
    expect(telemetry.tier).toBe(1);
  });

  it('caps the local queue so a long offline session cannot grow without bound', async () => {
    const { telemetry, spy, store } = setup({ batchSize: 10_000 });
    await telemetry.setConsent(consent(1));
    spy.offline();
    for (let i = 0; i < 1200; i++) telemetry.track({ type: 'reveal_viewed' });
    await telemetry.idle();
    const { events } = await store.load();
    expect(events).toHaveLength(1000);
    expect(events[0]?.seq).toBe(200);
  });
});

describe('Tier-gated payloads', () => {
  it('Tier 1 sends coverage requests and feedback but not item responses', async () => {
    const { telemetry, spy } = setup();
    await telemetry.setConsent(consent(1));
    expect(await telemetry.submitCoverageRequest({ kind: 'country', label: 'France' })).toBe(
      'queued',
    );
    expect(await telemetry.submitFeedback({ recommend: 8 })).toBe('queued');
    expect(await telemetry.submitResponses(responses)).toBe('dropped');
    await telemetry.flush();
    expect(spy.paths()).toEqual([
      '/telemetry/v1/consent',
      '/telemetry/v1/coverage-requests',
      '/telemetry/v1/feedback',
    ]);
  });

  it('Tier 2 sends item responses', async () => {
    const { telemetry, spy } = setup();
    await telemetry.setConsent(consent(2));
    expect(await telemetry.submitResponses(responses)).toBe('queued');
    await telemetry.flush();
    expect(spy.paths()).toContain('/telemetry/v1/responses');
    expect(spy.sent.find((s) => s.path === '/telemetry/v1/responses')?.body).toMatchObject({
      sessionId: SESSION,
      arm: 'game',
    });
  });

  it('rejects an invalid response payload before queueing', async () => {
    const { telemetry } = setup();
    await telemetry.setConsent(consent(2));
    await expect(telemetry.submitResponses({ ...responses, values: [1, 2, 3] })).rejects.toThrow();
  });
});

describe('Deletion (04 §6.1)', () => {
  it('sends a deletion request even after downgrading to Tier 0', async () => {
    const { telemetry, spy } = setup();
    await telemetry.setConsent(consent(1));
    await telemetry.setConsent({ tier: 0 });
    expect(await telemetry.requestDeletion('ABCD-EFGH-JKLM')).toBe('accepted');
    expect(spy.sent.at(-1)).toEqual({
      path: '/telemetry/v1/deletion',
      body: { sessionId: SESSION, deletionCode: 'ABCD-EFGH-JKLM' },
    });
  });

  it('reports failure when offline so the app can ask the family to retry', async () => {
    const { telemetry, spy } = setup();
    spy.offline();
    expect(await telemetry.requestDeletion('ABCD-EFGH-JKLM')).toBe('failed');
  });
});

describe('fetchTransport', () => {
  it('POSTs JSON without credentials or referrer and returns the status', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 202 }));
    const result = await fetchTransport('https://t.example.test', fetchFn).post(
      '/telemetry/v1/events',
      { a: 1 },
    );
    expect(result).toEqual({ status: 202 });
    expect(fetchFn).toHaveBeenCalledWith('https://t.example.test/telemetry/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    });
  });
});
