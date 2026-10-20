// Postgres adapter for the TelemetryStore port, using the service role.
// Runs only inside the Deno entrypoints; covered by the DB tests and, from
// Phase 8, by Edge Function integration tests against local Supabase.
import type {
  ConsentRecord,
  CoverageRequest,
  EventBatch,
  Feedback,
  ItemResponses,
} from '@margwise/contracts';
import type { TelemetryStore } from './ports.ts';

// Minimal structural type for the parts of supabase-js used here, so this
// file typechecks in Node without pulling the client into the workspace.
interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}
interface Table {
  insert(rows: unknown): PromiseLike<QueryResult<unknown>>;
  upsert(
    rows: unknown,
    opts: { onConflict: string; ignoreDuplicates: boolean },
  ): PromiseLike<QueryResult<unknown>>;
  select(cols: string): {
    eq(
      col: string,
      value: string,
    ): {
      order(
        col: string,
        opts: { ascending: boolean },
      ): { limit(n: number): PromiseLike<QueryResult<Array<Record<string, unknown>>>> };
      maybeSingle(): PromiseLike<QueryResult<Record<string, unknown>>>;
    };
  };
}
export interface SchemaClient {
  from(table: string): Table;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<QueryResult<unknown>>;
}

function check<T>(result: QueryResult<T>): T | null {
  if (result.error) throw new Error(`telemetry store: ${result.error.message}`);
  return result.data;
}

export function supabaseTelemetryStore(db: SchemaClient): TelemetryStore {
  const ensureSession = async (id: string) =>
    check(await db.from('sessions').upsert({ id }, { onConflict: 'id', ignoreDuplicates: true }));

  return {
    async minorsTelemetryEnabled() {
      const row = check(
        await db
          .from('settings')
          .select('value')
          .eq('key', 'minors_telemetry_enabled')
          .maybeSingle(),
      );
      // Fail closed: a missing or unreadable setting disables telemetry.
      return row?.value === true;
    },
    async latestConsent(sessionId) {
      const rows = check(
        await db
          .from('consents')
          .select('tier, notice_version, teen_assent, deletion_code_hash, consented_at')
          .eq('session_id', sessionId)
          .order('received_at', { ascending: false })
          .limit(1),
      );
      const r = rows?.[0];
      if (!r) return null;
      return {
        sessionId,
        tier: r.tier as 1 | 2,
        noticeVersion: String(r.notice_version),
        teenAssent: Boolean(r.teen_assent),
        deletionCodeHash: String(r.deletion_code_hash),
        consentedAt: String(r.consented_at),
      };
    },
    async recordConsent(c: ConsentRecord) {
      await ensureSession(c.sessionId);
      check(
        await db.from('consents').insert({
          session_id: c.sessionId,
          tier: c.tier,
          notice_version: c.noticeVersion,
          teen_assent: c.teenAssent,
          deletion_code_hash: c.deletionCodeHash,
          consented_at: c.consentedAt,
        }),
      );
    },
    async insertEvents(batch: EventBatch) {
      const rows = batch.events.map(
        ({ type, eventId, sessionId, seq, occurredAt, actor, ...props }) => ({
          event_id: eventId,
          session_id: sessionId,
          seq,
          type,
          occurred_at: occurredAt,
          actor,
          props,
        }),
      );
      check(
        await db.from('events').upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true }),
      );
    },
    async insertResponses(r: ItemResponses) {
      check(
        await db.from('item_responses').insert({
          session_id: r.sessionId,
          arm: r.arm,
          item_values: r.values,
          area_scores: r.areaScores,
          flags: r.flags,
          parent_present: r.parentPresent,
          device_class: r.deviceClass,
          class_year: r.classYear,
          board: r.board,
          subjects: r.subjects,
          city_tier: r.cityTier,
        }),
      );
    },
    async insertCoverageRequest(r: CoverageRequest) {
      check(
        await db
          .from('coverage_requests')
          .insert({ session_id: r.sessionId, kind: r.kind, label: r.label }),
      );
    },
    async insertFeedback({ sessionId, ...answers }: Feedback) {
      check(await db.from('feedback').insert({ session_id: sessionId, answers }));
    },
    async requestDeletion(sessionId) {
      // Record the request, then delete immediately; the 7-day promise (04 §5.2)
      // is a ceiling, and a nightly job retries any request left incomplete.
      check(await db.from('deletion_requests').insert({ session_id: sessionId }));
      check(await db.rpc('delete_session', { p_session_id: sessionId }));
    },
  };
}
