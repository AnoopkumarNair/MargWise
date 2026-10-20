import {
  ConsentRecord,
  CoverageRequest,
  DeletionRequest,
  Feedback,
  ItemResponses,
  TelemetryEvent,
  TIER_REQUIRED,
  type ConsentTier,
} from '@margwise/contracts';
import type { PendingPayload, QueueState, QueueStore } from './store.ts';
import type { Transport } from './transport.ts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Envelope = 'eventId' | 'sessionId' | 'seq' | 'occurredAt';
export type EventInput = DistributiveOmit<TelemetryEvent, Envelope>;
type WithoutSession<T> = Omit<T, 'sessionId'>;

export type Tier = 0 | ConsentTier;

export interface TelemetryConfig {
  /** Global switch for minors' telemetry (04 §6.3). `false` makes every session behave as Tier 0. */
  minorsTelemetryEnabled: boolean;
  /** Events queued before an automatic flush. */
  batchSize: number;
}

export interface TelemetryOptions {
  sessionId: string;
  config: TelemetryConfig;
  transport: Transport;
  store: QueueStore;
  clock: () => number;
  uuid: () => string;
  /** Consent state the app persisted from a previous run. */
  restoredConsent?: { tier: Tier; recorded: boolean };
}

export type ConsentInput =
  | { tier: 0 }
  | { tier: ConsentTier; noticeVersion: string; teenAssent: boolean; deletionCodeHash: string };

const MAX_EVENTS_PER_REQUEST = 100;
const MAX_QUEUED_EVENTS = 1000;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

type SendResult = 'sent' | 'rejected' | 'forbidden' | 'retry';

/**
 * Consent-aware telemetry queue (04 §6). Nothing is queued or sent unless the
 * Patron chose Tier 1 or 2 *and* the global switch allows it, and nothing but
 * the consent record is sent until the server has accepted that record.
 */
export function createTelemetry(opts: TelemetryOptions) {
  const { sessionId, config, transport, store, clock, uuid } = opts;
  let chosenTier: Tier = opts.restoredConsent?.tier ?? 0;
  let consentRecorded = opts.restoredConsent?.recorded ?? false;
  let pendingConsent: ConsentRecord | undefined;
  let state: QueueState = { events: [], pending: [] };
  let seq = 0;
  let failures = 0;
  let nextAttemptAt = 0;
  let chain: Promise<void> = Promise.resolve();

  const effectiveTier = (): Tier => (config.minorsTelemetryEnabled ? chosenTier : 0);
  const allows = (minTier: 1 | 2) => effectiveTier() >= minTier;

  function run(job: () => Promise<void>): Promise<void> {
    chain = chain.then(job, job);
    return chain;
  }

  function capQueue() {
    if (state.events.length > MAX_QUEUED_EVENTS)
      state.events = state.events.slice(-MAX_QUEUED_EVENTS);
  }

  run(async () => {
    const saved = await store.load();
    state = {
      events: [...saved.events, ...state.events],
      pending: [...saved.pending, ...state.pending],
    };
    capQueue();
    seq = Math.max(seq, ...state.events.map((e) => e.seq + 1));
  });

  const persist = () => store.save(state);

  async function clearAll() {
    state = { events: [], pending: [] };
    pendingConsent = undefined;
    await persist();
  }

  async function send(path: string, body: unknown): Promise<SendResult> {
    let status: number;
    try {
      ({ status } = await transport.post(path, body));
    } catch {
      return 'retry';
    }
    if (status >= 200 && status < 300) return 'sent';
    if (status === 403) return 'forbidden';
    if (status === 429 || status >= 500) return 'retry';
    return 'rejected';
  }

  function backoff() {
    failures += 1;
    nextAttemptAt = clock() + Math.min(BASE_BACKOFF_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
  }

  /** Handles a non-success result. Returns true if the flush must stop. */
  async function handleFailure(result: Exclude<SendResult, 'sent' | 'rejected'>): Promise<boolean> {
    if (result === 'forbidden') {
      chosenTier = 0;
      consentRecorded = false;
      await clearAll();
    } else {
      backoff();
    }
    return true;
  }

  async function doFlush() {
    if (effectiveTier() === 0 || clock() < nextAttemptAt) return;

    if (!consentRecorded) {
      if (!pendingConsent) return;
      const result = await send('/telemetry/v1/consent', pendingConsent);
      if (result === 'rejected') return;
      if (result !== 'sent') {
        await handleFailure(result);
        return;
      }
      consentRecorded = true;
      pendingConsent = undefined;
    }

    while (state.events.length > 0) {
      const batch = state.events.slice(0, MAX_EVENTS_PER_REQUEST);
      const result = await send('/telemetry/v1/events', { sessionId, events: batch });
      if (result === 'sent' || result === 'rejected') {
        state.events = state.events.slice(batch.length);
        await persist();
      } else if (await handleFailure(result)) return;
    }

    while (state.pending.length > 0) {
      const [next] = state.pending as [PendingPayload];
      if (!allows(next.minTier)) {
        state.pending.shift();
        continue;
      }
      const result = await send(next.path, next.body);
      if (result === 'sent' || result === 'rejected') {
        state.pending.shift();
        await persist();
      } else if (await handleFailure(result)) return;
    }
    failures = 0;
  }

  async function setConsent(input: ConsentInput): Promise<void> {
    if (input.tier === 0) {
      chosenTier = 0;
      consentRecorded = false;
      return run(clearAll);
    }
    const record = ConsentRecord.parse({
      ...input,
      sessionId,
      consentedAt: new Date(clock()).toISOString(),
    });
    return run(async () => {
      chosenTier = record.tier;
      consentRecorded = false;
      pendingConsent = record;
      state.pending = state.pending.filter((p) => p.minTier <= record.tier);
      await persist();
      nextAttemptAt = 0;
      await doFlush();
    });
  }

  function track(input: EventInput): 'queued' | 'dropped' {
    if (!allows(TIER_REQUIRED.events)) return 'dropped';
    const event = TelemetryEvent.parse({
      ...input,
      eventId: uuid(),
      sessionId,
      seq: seq++,
      occurredAt: new Date(clock()).toISOString(),
    });
    state.events.push(event);
    capQueue();
    const full = state.events.length >= config.batchSize;
    run(async () => {
      await persist();
      if (full) await doFlush();
    });
    return 'queued';
  }

  async function enqueue(path: string, body: unknown, minTier: 1 | 2): Promise<'queued'> {
    await run(async () => {
      state.pending.push({ path, body, minTier });
      await persist();
      await doFlush();
    });
    return 'queued';
  }

  async function submitResponses(
    input: WithoutSession<ItemResponses>,
  ): Promise<'queued' | 'dropped'> {
    if (!allows(TIER_REQUIRED.responses)) return 'dropped';
    return enqueue(
      '/telemetry/v1/responses',
      ItemResponses.parse({ ...input, sessionId }),
      TIER_REQUIRED.responses,
    );
  }

  async function submitCoverageRequest(
    input: WithoutSession<CoverageRequest>,
  ): Promise<'queued' | 'dropped'> {
    if (!allows(TIER_REQUIRED.coverageRequests)) return 'dropped';
    return enqueue(
      '/telemetry/v1/coverage-requests',
      CoverageRequest.parse({ ...input, sessionId }),
      TIER_REQUIRED.coverageRequests,
    );
  }

  async function submitFeedback(input: WithoutSession<Feedback>): Promise<'queued' | 'dropped'> {
    if (!allows(TIER_REQUIRED.feedback)) return 'dropped';
    return enqueue(
      '/telemetry/v1/feedback',
      Feedback.parse({ ...input, sessionId }),
      TIER_REQUIRED.feedback,
    );
  }

  /**
   * "Delete my data" is an explicit family action, so it is sent whatever the
   * current tier (the family may have downgraded to Tier 0 first).
   */
  async function requestDeletion(deletionCode: string): Promise<'accepted' | 'failed'> {
    const body = DeletionRequest.parse({ sessionId, deletionCode });
    return (await send('/telemetry/v1/deletion', body)) === 'sent' ? 'accepted' : 'failed';
  }

  return {
    get tier(): Tier {
      return effectiveTier();
    },
    setConsent,
    track,
    submitResponses,
    submitCoverageRequest,
    submitFeedback,
    requestDeletion,
    flush: () => run(doFlush),
    /** Resolves once queued persistence and flush work has finished. */
    idle: () => run(async () => {}),
  };
}

export type Telemetry = ReturnType<typeof createTelemetry>;
