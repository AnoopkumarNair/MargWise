import type { ConsentRecord, TelemetryEvent } from '@margwise/contracts';

/** A queued non-event payload (responses, coverage request, feedback). */
export interface PendingPayload {
  path: string;
  body: unknown;
  minTier: 1 | 2;
}

export interface QueueState {
  events: TelemetryEvent[];
  pending: PendingPayload[];
  /** Consent record not yet accepted by the server (survives restarts). */
  consent?: ConsentRecord;
}

/** Durable on-device queue. The web app injects an IndexedDB implementation. */
export interface QueueStore {
  load(): Promise<QueueState>;
  save(state: QueueState): Promise<void>;
}

export class MemoryQueueStore implements QueueStore {
  #state: QueueState = { events: [], pending: [] };

  async load(): Promise<QueueState> {
    return structuredClone(this.#state);
  }

  async save(state: QueueState): Promise<void> {
    this.#state = structuredClone(state);
  }
}
