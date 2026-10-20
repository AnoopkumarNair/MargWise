import { describe, expect, it, vi } from 'vitest';
import { createTelemetry, MemoryQueueStore, type Transport } from './index.ts';

const SESSION = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';
const consent = (tier: 1 | 2) => ({
  tier,
  noticeVersion: 'v1',
  teenAssent: true,
  deletionCodeHash: 'f'.repeat(64),
});
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`;

function make(
  transport: Transport,
  store = new MemoryQueueStore(),
  extra: Partial<Parameters<typeof createTelemetry>[0]> = {},
) {
  let now = 0;
  const t = createTelemetry({
    sessionId: SESSION,
    config: { minorsTelemetryEnabled: true, batchSize: 10_000 },
    transport,
    store,
    clock: () => now,
    uuid,
    ...extra,
  });
  return { t, store, advance: (ms: number) => (now += ms) };
}

describe('withdrawal during an in-flight flush (review #2; rule 6, 04 §6.1)', () => {
  it('sends no further batch once the family chooses Tier 0 mid-flush', async () => {
    const paths: string[] = [];
    let release: () => void = () => {};
    let blockNext = false;
    const transport: Transport = {
      async post(path) {
        paths.push(path);
        if (blockNext && path === '/telemetry/v1/events') {
          blockNext = false;
          await new Promise<void>((r) => (release = r));
        }
        return { status: 202 };
      },
    };
    const { t } = make(transport);
    await t.setConsent(consent(1));
    for (let i = 0; i < 350; i++) t.track({ type: 'reveal_viewed' });
    blockNext = true;
    const flushing = t.flush();
    await vi.waitFor(() => expect(paths.filter((p) => p.endsWith('/events'))).toHaveLength(1));
    const withdrawing = t.setConsent({ tier: 0 });
    release();
    await Promise.all([flushing, withdrawing]);
    expect(paths.filter((p) => p.endsWith('/events'))).toHaveLength(1);
    expect(t.tier).toBe(0);
  });
});

describe('consent given offline survives a restart (review #3)', () => {
  it('persists the pending consent record and sends it after restart', async () => {
    const store = new MemoryQueueStore();
    const offline: Transport = { post: async () => Promise.reject(new TypeError('offline')) };
    const first = make(offline, store);
    await first.t.setConsent(consent(1));
    first.t.track({ type: 'reveal_viewed' });
    await first.t.idle();

    const paths: string[] = [];
    const online: Transport = { post: async (p) => (paths.push(p), { status: 202 }) };
    const second = make(online, store, { restoredConsent: { tier: 1, recorded: false } });
    await second.t.flush();
    expect(paths).toEqual(['/telemetry/v1/consent', '/telemetry/v1/events']);
  });
});

describe('response classification (review #1)', () => {
  it.each([401, 404, 405, 408])(
    'HTTP %d keeps the batch for retry instead of dropping it',
    async (status) => {
      let s = 202;
      const transport: Transport = { post: async () => ({ status: s }) };
      const { t, store } = make(transport);
      await t.setConsent(consent(1));
      s = status;
      t.track({ type: 'reveal_viewed' });
      await t.flush();
      expect((await store.load()).events).toHaveLength(1);
    },
  );

  it.each([400, 413, 422])('HTTP %d drops the invalid batch', async (status) => {
    let s = 202;
    const transport: Transport = { post: async () => ({ status: s }) };
    const { t, store } = make(transport);
    await t.setConsent(consent(1));
    s = status;
    t.track({ type: 'reveal_viewed' });
    await t.flush();
    expect((await store.load()).events).toHaveLength(0);
  });

  it('a 401 on the consent record is retried, not treated as final', async () => {
    let s = 401;
    const paths: string[] = [];
    const transport: Transport = { post: async (p) => (paths.push(p), { status: s }) };
    const { t, advance } = make(transport);
    await t.setConsent(consent(1));
    s = 202;
    advance(60_000);
    await t.flush();
    expect(paths).toEqual(['/telemetry/v1/consent', '/telemetry/v1/consent']);
  });
});

describe('validation does not depend on consent tier (review #13)', () => {
  it('an invalid event throws at Tier 0 too, so bugs surface before families consent', () => {
    const { t } = make({ post: async () => ({ status: 202 }) });
    // @ts-expect-error unknown field
    expect(() => t.track({ type: 'reveal_viewed', hoverMs: 1 })).toThrow();
  });
});

describe('deletion and tier changes are reported to the app (review #15, #16)', () => {
  it('an accepted deletion moves the SDK to Tier 0 and clears its queue', async () => {
    const changes: Array<[number, boolean]> = [];
    const { t, store } = make({ post: async () => ({ status: 202 }) }, new MemoryQueueStore(), {
      onConsentChange: (tier, recorded) => changes.push([tier, recorded]),
    });
    await t.setConsent(consent(1));
    t.track({ type: 'reveal_viewed' });
    expect(await t.requestDeletion('ABCD-EFGH-JKLM')).toBe('accepted');
    expect(t.tier).toBe(0);
    expect(t.track({ type: 'reveal_viewed' })).toBe('dropped');
    expect((await store.load()).events).toEqual([]);
    expect(changes.at(-1)).toEqual([0, false]);
  });

  it('a 403 tells the app, so it does not restore Tier 1 on next launch', async () => {
    const changes: Array<[number, boolean]> = [];
    let s = 202;
    const { t } = make({ post: async () => ({ status: s }) }, new MemoryQueueStore(), {
      onConsentChange: (tier, recorded) => changes.push([tier, recorded]),
    });
    await t.setConsent(consent(1));
    expect(changes.at(-1)).toEqual([1, true]);
    s = 403;
    t.track({ type: 'reveal_viewed' });
    await t.flush();
    expect(changes.at(-1)).toEqual([0, false]);
  });
});
