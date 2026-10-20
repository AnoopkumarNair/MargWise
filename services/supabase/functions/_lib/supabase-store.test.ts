import { describe, expect, it } from 'vitest';
import { supabaseTelemetryStore, type SchemaClient } from './supabase-store.ts';

const SESSION = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';

/** Records every call and answers reads from canned rows. */
function fakeClient(
  rows: Record<string, Array<Record<string, unknown>>> = {},
  error: string | null = null,
) {
  const calls: Array<{ table: string; op: string; payload?: unknown; opts?: unknown }> = [];
  const result = (data: unknown) =>
    // `never` lets one canned result satisfy every typed query shape in the port.
    Promise.resolve({
      data: (error ? null : data) as never,
      error: error ? { message: error } : null,
    });
  const client: SchemaClient = {
    from(table) {
      return {
        insert: (payload) => (calls.push({ table, op: 'insert', payload }), result(null)),
        upsert: (payload, opts) => (
          calls.push({ table, op: 'upsert', payload, opts }),
          result(null)
        ),
        select: () => ({
          eq: () => ({
            order: () => ({ limit: () => result(rows[table] ?? []) }),
            maybeSingle: () => result(rows[table]?.[0] ?? null),
          }),
        }),
      };
    },
    rpc: (fn, args) => (calls.push({ table: fn, op: 'rpc', payload: args }), result(null)),
  };
  return { client, calls };
}

describe('supabaseTelemetryStore', () => {
  it('reads the kill switch and fails closed when it is missing', async () => {
    expect(
      await supabaseTelemetryStore(
        fakeClient({ settings: [{ value: true }] }).client,
      ).minorsTelemetryEnabled(),
    ).toBe(true);
    expect(
      await supabaseTelemetryStore(
        fakeClient({ settings: [{ value: false }] }).client,
      ).minorsTelemetryEnabled(),
    ).toBe(false);
    expect(await supabaseTelemetryStore(fakeClient().client).minorsTelemetryEnabled()).toBe(false);
  });

  it('maps the latest consent row to the contract shape', async () => {
    const row = {
      tier: 2,
      notice_version: 'v1',
      teen_assent: true,
      deletion_code_hash: 'f'.repeat(64),
      consented_at: '2026-10-20T10:00:00Z',
    };
    const store = supabaseTelemetryStore(fakeClient({ consents: [row] }).client);
    expect(await store.latestConsent(SESSION)).toEqual({
      sessionId: SESSION,
      tier: 2,
      noticeVersion: 'v1',
      teenAssent: true,
      deletionCodeHash: 'f'.repeat(64),
      consentedAt: '2026-10-20T10:00:00Z',
    });
    expect(await supabaseTelemetryStore(fakeClient().client).latestConsent(SESSION)).toBeNull();
  });

  it('creates the session before recording consent', async () => {
    const { client, calls } = fakeClient();
    await supabaseTelemetryStore(client).recordConsent({
      sessionId: SESSION,
      tier: 1,
      noticeVersion: 'v1',
      teenAssent: false,
      deletionCodeHash: 'f'.repeat(64),
      consentedAt: '2026-10-20T10:00:00Z',
    });
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual(['upsert:sessions', 'insert:consents']);
    expect(calls[1]?.payload).toMatchObject({ session_id: SESSION, tier: 1, teen_assent: false });
  });

  it('stores events idempotently with props split from the envelope', async () => {
    const { client, calls } = fakeClient();
    await supabaseTelemetryStore(client).insertEvents({
      sessionId: SESSION,
      events: [
        {
          type: 'hall_visited',
          careerId: 'psy-1',
          eventId: '1c2d3e4f-5a6b-4c7d-8e9f-000000000000',
          sessionId: SESSION,
          seq: 3,
          occurredAt: '2026-10-20T10:00:00Z',
        },
      ],
    });
    expect(calls[0]).toEqual({
      table: 'events',
      op: 'upsert',
      opts: { onConflict: 'event_id', ignoreDuplicates: true },
      payload: [
        {
          event_id: '1c2d3e4f-5a6b-4c7d-8e9f-000000000000',
          session_id: SESSION,
          seq: 3,
          type: 'hall_visited',
          occurred_at: '2026-10-20T10:00:00Z',
          props: { careerId: 'psy-1' },
        },
      ],
    });
  });

  it('maps responses, coverage requests and feedback to snake_case rows', async () => {
    const { client, calls } = fakeClient();
    const store = supabaseTelemetryStore(client);
    await store.insertResponses({
      sessionId: SESSION,
      arm: 'plain',
      values: Array.from({ length: 60 }, () => 1),
      areaScores: { R: 10, I: 10, A: 10, S: 10, E: 10, C: 10 },
      flags: {
        straightLining: true,
        flatProfile: true,
        lowEngagement: true,
        highEngagement: false,
      },
      parentPresent: 'unsure',
      deviceClass: 'low',
      classYear: 11,
      subjectCombination: 'commerce',
      cityTier: 'tier-3',
    });
    await store.insertCoverageRequest({ sessionId: SESSION, kind: 'city', label: 'Indore' });
    await store.insertFeedback({ sessionId: SESSION, recommend: 8, moneyClarity: 4 });
    expect(calls[0]?.payload).toMatchObject({
      session_id: SESSION,
      arm: 'plain',
      parent_present: 'unsure',
      class_year: 11,
      city_tier: 'tier-3',
    });
    expect(calls[1]?.payload).toEqual({ session_id: SESSION, kind: 'city', label: 'Indore' });
    expect(calls[2]?.payload).toEqual({
      session_id: SESSION,
      answers: { recommend: 8, moneyClarity: 4 },
    });
  });

  it('records the deletion request and then deletes the session', async () => {
    const { client, calls } = fakeClient();
    await supabaseTelemetryStore(client).requestDeletion(SESSION);
    expect(calls).toEqual([
      { table: 'deletion_requests', op: 'insert', payload: { session_id: SESSION } },
      { table: 'delete_session', op: 'rpc', payload: { p_session_id: SESSION } },
    ]);
  });

  it('surfaces database errors instead of reporting success', async () => {
    const store = supabaseTelemetryStore(fakeClient({}, 'permission denied').client);
    await expect(
      store.insertCoverageRequest({ sessionId: SESSION, kind: 'city', label: 'x' }),
    ).rejects.toThrow(/permission denied/);
  });
});
