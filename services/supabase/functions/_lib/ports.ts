import type {
  ConsentRecord,
  CoverageRequest,
  EventBatch,
  Feedback,
  ItemResponses,
} from '@margwise/contracts';

/** Persistence port. The Deno entrypoints adapt it to Postgres via the service role. */
export interface TelemetryStore {
  minorsTelemetryEnabled(): Promise<boolean>;
  latestConsent(sessionId: string): Promise<ConsentRecord | null>;
  recordConsent(consent: ConsentRecord): Promise<void>;
  /** Idempotent on eventId: retried batches never duplicate rows. */
  insertEvents(batch: EventBatch): Promise<void>;
  insertResponses(responses: ItemResponses): Promise<void>;
  insertCoverageRequest(request: CoverageRequest): Promise<void>;
  insertFeedback(feedback: Feedback): Promise<void>;
  requestDeletion(sessionId: string): Promise<void>;
}

export interface RateLimiter {
  /** Returns false when `key` has exceeded its budget. Keys are never persisted. */
  allow(key: string): boolean;
}

export interface Deps {
  store: TelemetryStore;
  rateLimiter: RateLimiter;
  /** SHA-256 hex. Used for deletion codes and for the (unstored) client-IP rate-limit key. */
  sha256: (text: string) => Promise<string>;
}
