import type {
  ConsentRecord,
  CoverageRequest,
  EventBatch,
  Feedback,
  ItemResponses,
} from '@margwise/contracts';
import type { TelemetryStore } from './ports.ts';

/** In-memory TelemetryStore for tests and local development. */
export class MemoryTelemetryStore implements TelemetryStore {
  consents: ConsentRecord[] = [];
  events = new Map<string, EventBatch['events'][number]>();
  responses: ItemResponses[] = [];
  coverage: CoverageRequest[] = [];
  feedback: Feedback[] = [];
  deletionRequests: string[] = [];
  minorsEnabled = true;

  async minorsTelemetryEnabled() {
    return this.minorsEnabled;
  }
  async latestConsent(sessionId: string) {
    return this.consents.filter((c) => c.sessionId === sessionId).at(-1) ?? null;
  }
  async deletionCodeHash(sessionId: string) {
    return this.consents.find((c) => c.sessionId === sessionId)?.deletionCodeHash ?? null;
  }
  async recordConsent(consent: ConsentRecord) {
    this.consents.push(consent);
  }
  async insertEvents(batch: EventBatch) {
    for (const e of batch.events) if (!this.events.has(e.eventId)) this.events.set(e.eventId, e);
  }
  async insertResponses(r: ItemResponses) {
    this.responses.push(r);
  }
  async insertCoverageRequest(r: CoverageRequest) {
    this.coverage.push(r);
  }
  async insertFeedback(f: Feedback) {
    this.feedback.push(f);
  }
  async requestDeletion(sessionId: string) {
    this.deletionRequests.push(sessionId);
    const keep = <T extends { sessionId: string }>(xs: T[]) =>
      xs.filter((x) => x.sessionId !== sessionId);
    this.consents = keep(this.consents);
    this.responses = keep(this.responses);
    this.coverage = keep(this.coverage);
    this.feedback = keep(this.feedback);
    for (const [id, e] of this.events) if (e.sessionId === sessionId) this.events.delete(id);
  }
}
