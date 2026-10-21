import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { findPiiKeysInJsonSchema } from './pii.ts';
import {
  ConsentRecord,
  CoverageRequest,
  DeletionRequest,
  EVENT_TYPES,
  EventBatch,
  Feedback,
  ItemResponses,
  TELEMETRY_SCHEMAS,
  TelemetryEvent,
  TIER_REQUIRED,
} from './schemas.ts';

function openObjectPaths(schema: z.ZodType): string[] {
  const open: string[] = [];
  const visit = (node: unknown, path: string) => {
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}[${i}]`));
    if (!node || typeof node !== 'object') return;
    const s = node as Record<string, unknown>;
    if (s.type === 'object' && s.additionalProperties !== false) open.push(path || '<root>');
    for (const [k, v] of Object.entries(s)) visit(v, `${path}.${k}`);
  };
  visit(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), '');
  return open;
}

const sessionId = '0b9f2a3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';
const env = {
  eventId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  sessionId,
  seq: 0,
  occurredAt: '2026-10-20T10:00:00Z',
  actor: 'teen',
};

describe('Closed schemas (04 §6.4)', () => {
  it.each(Object.entries(TELEMETRY_SCHEMAS))(
    '%s contains no PII-denylisted key',
    (_name, schema) => {
      expect(
        findPiiKeysInJsonSchema(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })),
      ).toEqual([]);
    },
  );

  it.each(Object.entries(TELEMETRY_SCHEMAS))(
    '%s is closed at every object level',
    (_name, schema) => {
      expect(openObjectPaths(schema)).toEqual([]);
    },
  );

  it('the closedness check itself detects an open object (guards against a vacuous test)', () => {
    expect(openObjectPaths(z.strictObject({ inner: z.object({ a: z.string() }) }))).toEqual([
      '.properties.inner',
    ]);
  });

  it('rejects an unknown field on an event', () => {
    expect(TelemetryEvent.safeParse({ ...env, type: 'reveal_viewed', hoverMs: 3 }).success).toBe(
      false,
    );
  });

  it('rejects an unknown event type', () => {
    expect(TelemetryEvent.safeParse({ ...env, type: 'cursor_moved' }).success).toBe(false);
  });
});

describe('Events (02 §10)', () => {
  it('covers every hook in 02 §10', () => {
    expect(EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'scene_entered',
        'scene_exited',
        'day_started',
        'day_completed',
        'item_answered',
        'reveal_viewed',
        'hall_visited',
        'dossier_tab_opened',
        'quest_accepted',
        'quest_completed',
        'voyage_created',
        'report_shared',
        'report_saved',
        'error',
        'lite_mode_changed',
        'session_ended',
      ]),
    );
  });

  it('covers navigation and interaction analytics (D-027)', () => {
    expect(EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'session_started',
        'navigated',
        'control_activated',
        'actor_changed',
        'app_visibility',
      ]),
    );
  });

  it('every event says which family member is active', () => {
    const { actor: _a, ...noActor } = env;
    expect(TelemetryEvent.safeParse({ ...noActor, type: 'reveal_viewed' }).success).toBe(false);
    expect(
      TelemetryEvent.safeParse({ ...env, actor: 'patron', type: 'reveal_viewed' }).success,
    ).toBe(true);
    expect(
      TelemetryEvent.safeParse({ ...env, actor: 'grandparent', type: 'reveal_viewed' }).success,
    ).toBe(false);
  });

  it('navigated records from, to and how — never coordinates', () => {
    expect(
      TelemetryEvent.safeParse({
        ...env,
        type: 'navigated',
        from: 'isles_map',
        to: 'hall',
        via: 'tap',
      }).success,
    ).toBe(true);
    expect(
      TelemetryEvent.safeParse({
        ...env,
        type: 'navigated',
        from: 'isles_map',
        to: 'hall',
        via: 'tap',
        x: 10,
      }).success,
    ).toBe(false);
  });

  it.each(['dial.like', 'map.hall_psy-1', 'ledger.save'])(
    'control_activated accepts developer control id %s',
    (control) => {
      expect(
        TelemetryEvent.safeParse({
          ...env,
          type: 'control_activated',
          scene: 'market_day',
          control,
        }).success,
      ).toBe(true);
    },
  );

  it.each(['Ravi Kumar', 'a@b.c', '9876543210', 'x'.repeat(65)])(
    'control_activated rejects free text like %j',
    (control) => {
      expect(
        TelemetryEvent.safeParse({
          ...env,
          type: 'control_activated',
          scene: 'market_day',
          control,
        }).success,
      ).toBe(false);
    },
  );

  it('item_answered carries the item number and undo count but never the response value (Tier 2 only)', () => {
    expect(
      TelemetryEvent.safeParse({ ...env, type: 'item_answered', itemNumber: 7, undoCount: 1 })
        .success,
    ).toBe(true);
    expect(
      TelemetryEvent.safeParse({
        ...env,
        type: 'item_answered',
        itemNumber: 7,
        undoCount: 1,
        value: 3,
      }).success,
    ).toBe(false);
  });

  it.each([0, 61])('rejects item number %d', (itemNumber) => {
    expect(
      TelemetryEvent.safeParse({ ...env, type: 'item_answered', itemNumber, undoCount: 0 }).success,
    ).toBe(false);
  });

  it('a batch holds 1–100 events for one session', () => {
    const e = { ...env, type: 'reveal_viewed' };
    expect(EventBatch.safeParse({ sessionId, events: [e] }).success).toBe(true);
    expect(EventBatch.safeParse({ sessionId, events: [] }).success).toBe(false);
    expect(
      EventBatch.safeParse({ sessionId, events: Array.from({ length: 101 }, () => e) }).success,
    ).toBe(false);
  });

  it('rejects a batch mixing sessions', () => {
    const other = {
      ...env,
      type: 'reveal_viewed',
      sessionId: '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',
    };
    expect(EventBatch.safeParse({ sessionId, events: [other] }).success).toBe(false);
  });
});

describe('ConsentRecord (04 §6.1)', () => {
  const consent = {
    sessionId,
    tier: 2,
    noticeVersion: '2026-10-20',
    teenAssent: true,
    deletionCodeHash: 'f'.repeat(64),
    consentedAt: '2026-10-20T10:00:00Z',
  };

  it('accepts tiers 1 and 2', () => {
    expect(ConsentRecord.safeParse(consent).success).toBe(true);
    expect(ConsentRecord.safeParse({ ...consent, tier: 1, teenAssent: false }).success).toBe(true);
  });

  it('never accepts tier 0 — nothing is sent at Tier 0', () => {
    expect(ConsentRecord.safeParse({ ...consent, tier: 0 }).success).toBe(false);
  });

  it('rejects tier 2 without teen assent (the teen can say no to Tier 2)', () => {
    expect(ConsentRecord.safeParse({ ...consent, teenAssent: false }).success).toBe(false);
  });
});

describe('ItemResponses (Tier 2, 03 §2.7)', () => {
  const responses = {
    sessionId,
    arm: 'game',
    values: Array.from({ length: 60 }, (_, i) => i % 5),
    areaScores: { R: 20, I: 20, A: 20, S: 20, E: 20, C: 20 },
    flags: {
      straightLining: false,
      flatProfile: false,
      lowEngagement: false,
      highEngagement: false,
    },
    parentPresent: 'no',
    deviceClass: 'mid',
    classYear: 11,
    board: 'CBSE',
    subjectAreas: ['maths', 'sciences', 'languages'],
    cityTier: 'metro',
  };

  it('accepts 60 integer values 0–4 and area scores 0–40', () => {
    expect(ItemResponses.safeParse(responses).success).toBe(true);
  });

  it('carries coarse subject areas only — an exact subject list is rejected (review #9)', () => {
    const { subjectAreas: _a, ...rest } = responses;
    expect(
      ItemResponses.safeParse({
        ...rest,
        subjects: ['psychology', 'painting', 'legal-studies', 'english'],
      }).success,
    ).toBe(false);
    expect(ItemResponses.safeParse({ ...responses, subjectAreas: ['psychology'] }).success).toBe(
      false,
    );
    expect(
      ItemResponses.safeParse({ ...responses, subjectAreas: ['maths', 'maths'] }).success,
    ).toBe(false);
  });

  it('rejects 59 values, a value of 5, or a fractional value', () => {
    expect(
      ItemResponses.safeParse({ ...responses, values: responses.values.slice(1) }).success,
    ).toBe(false);
    expect(
      ItemResponses.safeParse({ ...responses, values: [5, ...responses.values.slice(1)] }).success,
    ).toBe(false);
    expect(
      ItemResponses.safeParse({ ...responses, values: [1.5, ...responses.values.slice(1)] })
        .success,
    ).toBe(false);
  });

  it('rejects area scores above 40', () => {
    expect(
      ItemResponses.safeParse({ ...responses, areaScores: { ...responses.areaScores, R: 41 } })
        .success,
    ).toBe(false);
  });
});

describe('CoverageRequest, Feedback, DeletionRequest', () => {
  it('coverage request labels are ≤ 60 chars', () => {
    const base = { sessionId, kind: 'country', label: 'France' };
    expect(CoverageRequest.safeParse(base).success).toBe(true);
    expect(CoverageRequest.safeParse({ ...base, label: 'x'.repeat(61) }).success).toBe(false);
  });

  it('feedback scores stay in range', () => {
    const fb = {
      sessionId,
      interestFit: 4,
      moneyClarity: 5,
      recommend: 9,
      pricePerception: 'fair',
      decisionImpact: 'confirmed',
    };
    expect(Feedback.safeParse(fb).success).toBe(true);
    expect(Feedback.safeParse({ ...fb, recommend: 11 }).success).toBe(false);
    expect(Feedback.safeParse({ ...fb, interestFit: 0 }).success).toBe(false);
  });

  it('deletion requires the session id and the code', () => {
    expect(DeletionRequest.safeParse({ sessionId, deletionCode: 'ABCD-EFGH-JKLM' }).success).toBe(
      true,
    );
    expect(DeletionRequest.safeParse({ sessionId }).success).toBe(false);
  });
});

describe('TIER_REQUIRED', () => {
  it('only item responses need Tier 2', () => {
    expect(TIER_REQUIRED).toEqual({ events: 1, responses: 2, coverageRequests: 1, feedback: 1 });
  });
});
