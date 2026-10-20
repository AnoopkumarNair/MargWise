import { z } from 'zod';
import { IsoDateTime, Riasec, Slug, Uuid } from '../primitives.ts';
import { Board, SubjectKey } from '../content/subjects.ts';

/**
 * Telemetry contracts (04 §5.2, §6). Every schema is closed (`strictObject`):
 * unknown keys are rejected on the phone and again in the Edge Function.
 * A test fails if any schema gains a key from the PII denylist.
 */

/** Tier 0 is never represented on the wire: at Tier 0 nothing is sent. */
export const ConsentTier = z.union([z.literal(1), z.literal(2)]);
export type ConsentTier = z.infer<typeof ConsentTier>;

export const ConsentRecord = z
  .strictObject({
    sessionId: Uuid,
    tier: ConsentTier,
    noticeVersion: z.string().min(1).max(32),
    teenAssent: z.boolean(),
    /** SHA-256 of the deletion code shown to the family; the code itself never leaves the phone until deletion. */
    deletionCodeHash: z.string().regex(/^[0-9a-f]{64}$/),
    consentedAt: IsoDateTime,
  })
  .refine((c) => c.tier === 1 || c.teenAssent, {
    message: 'Tier 2 requires teen assent',
    path: ['teenAssent'],
  });
export type ConsentRecord = z.infer<typeof ConsentRecord>;

export const Scene = z.enum([
  'welcome',
  'consent',
  'prologue',
  'avatar',
  'market_day',
  'evening',
  'council',
  'isles_map',
  'hall',
  'dossier',
  'harbour_ledger',
  'voyage_planner',
  'voyage_chart',
  'logbook',
  'settings',
  'feedback',
  'plain_questionnaire',
]);

const DurationMs = z
  .int()
  .min(0)
  .max(24 * 60 * 60 * 1000);
const Day = z.int().min(1).max(6);

const envelope = {
  eventId: Uuid,
  sessionId: Uuid,
  /** Monotonic per session; lets the server de-duplicate retried batches. */
  seq: z.int().min(0),
  occurredAt: IsoDateTime,
};

const event = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.strictObject({ type: z.literal(type), ...envelope, ...shape });

export const TelemetryEvent = z.discriminatedUnion('type', [
  event('scene_entered', { scene: Scene }),
  event('scene_exited', { scene: Scene, durationMs: DurationMs }),
  event('day_started', { day: Day }),
  event('day_completed', { day: Day, durationMs: DurationMs }),
  /** No response value here: responses travel only via /responses at Tier 2. */
  event('item_answered', {
    itemNumber: z.int().min(1).max(60),
    undoCount: z.int().min(0).max(100),
  }),
  event('reveal_viewed', {}),
  event('hall_visited', { careerId: Slug }),
  event('dossier_tab_opened', {
    careerId: Slug,
    tab: z.enum([
      'ladder',
      'routes',
      'gates',
      'colleges',
      'abroad',
      'ai_exposure',
      'skills',
      'quests',
      'sources',
    ]),
  }),
  event('quest_accepted', { questId: Slug }),
  event('quest_completed', { questId: Slug }),
  event('voyage_created', {
    planCount: z.int().min(1).max(4),
    hasAbroadStage: z.boolean(),
    usesCustom: z.boolean(),
  }),
  event('report_shared', { method: z.enum(['web_share', 'download', 'print', 'copy_link']) }),
  event('report_saved', { format: z.enum(['pdf', 'image']) }),
  event('error', { code: z.string().regex(/^[a-z0-9_.-]{1,64}$/), scene: Scene.optional() }),
  event('lite_mode_changed', {
    enabled: z.boolean(),
    reason: z.enum(['auto_frame_time', 'data_saver', 'user']),
  }),
  event('session_ended', { durationMs: DurationMs }),
]);
export type TelemetryEvent = z.infer<typeof TelemetryEvent>;
export const EVENT_TYPES = TelemetryEvent.options.map((o) => o.shape.type.value);

export const EventBatch = z
  .strictObject({ sessionId: Uuid, events: z.array(TelemetryEvent).min(1).max(100) })
  .refine((b) => b.events.every((e) => e.sessionId === b.sessionId), {
    message: 'All events must belong to the batch session',
    path: ['events'],
  });
export type EventBatch = z.infer<typeof EventBatch>;

const AreaScore = z.int().min(0).max(40);

export const ItemResponses = z.strictObject({
  sessionId: Uuid,
  arm: z.enum(['game', 'plain']),
  /** 60 values in official item order, each 0–4 (Strongly dislike … Strongly like). */
  values: z.array(z.int().min(0).max(4)).length(60),
  areaScores: z.strictObject(
    Object.fromEntries(Riasec.options.map((k) => [k, AreaScore])) as Record<
      z.infer<typeof Riasec>,
      typeof AreaScore
    >,
  ),
  flags: z.strictObject({
    straightLining: z.boolean(),
    flatProfile: z.boolean(),
    lowEngagement: z.boolean(),
    highEngagement: z.boolean(),
  }),
  parentPresent: z.enum(['yes', 'no', 'unsure']),
  deviceClass: z.enum(['low', 'mid', 'high']),
  classYear: z.union([z.literal(11), z.literal(12)]),
  board: Board,
  /** Canonical subject keys only (no school names); 4–8 per student. */
  subjects: z.array(SubjectKey).min(4).max(8),
  cityTier: z.enum(['metro', 'tier-2', 'tier-3']),
});
export type ItemResponses = z.infer<typeof ItemResponses>;

export const CoverageRequest = z.strictObject({
  sessionId: Uuid,
  kind: z.enum(['career', 'course', 'city', 'country']),
  /** Parent-entered label of the uncovered item, e.g. "France". */
  label: z.string().trim().min(1).max(60),
});
export type CoverageRequest = z.infer<typeof CoverageRequest>;

const Likert5 = z.int().min(1).max(5);

/** In-app feedback (01 §7.2). Structured answers only. */
export const Feedback = z.strictObject({
  sessionId: Uuid,
  interestFit: Likert5.optional(),
  moneyClarity: Likert5.optional(),
  decisionImpact: z.enum(['changed', 'confirmed', 'no_effect', 'unsure']).optional(),
  pricePerception: z.enum(['bargain', 'fair', 'expensive', 'too_expensive']).optional(),
  priceInr: z.int().min(0).max(1_000_000).optional(),
  recommend: z.int().min(0).max(10).optional(),
  dropOffScene: Scene.optional(),
  minutesTaken: z.int().min(0).max(600).optional(),
  mostWanted: z.enum(['career', 'country', 'feature', 'nothing']).optional(),
  usefulSurprise: z.boolean().optional(),
});
export type Feedback = z.infer<typeof Feedback>;

export const DeletionRequest = z.strictObject({
  sessionId: Uuid,
  deletionCode: z
    .string()
    .regex(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/, 'Expected code like ABCD-EFGH-JKLM'),
});
export type DeletionRequest = z.infer<typeof DeletionRequest>;

/** Minimum consent tier for each data endpoint (04 §5.2). */
export const TIER_REQUIRED = {
  events: 1,
  responses: 2,
  coverageRequests: 1,
  feedback: 1,
} as const satisfies Record<string, 1 | 2>;

export const TELEMETRY_SCHEMAS = {
  ConsentRecord,
  TelemetryEvent,
  EventBatch,
  ItemResponses,
  CoverageRequest,
  Feedback,
  DeletionRequest,
} as const;
