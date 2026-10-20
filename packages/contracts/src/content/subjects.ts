import { z } from 'zod';
import { Slug } from '../primitives.ts';
import { SourcedOnlyProvenance } from '../provenance.ts';

/** School boards covered in the alpha (decision D-024). More boards are data, not code. */
export const Board = z.enum(['CBSE', 'CISCE']);
export type Board = z.infer<typeof Board>;

/**
 * Canonical subject key shared across boards, e.g. `mathematics`, `psychology`,
 * `legal-studies`. Each board's own code and name live in the catalogue.
 */
export const SubjectKey = Slug;
export type SubjectKey = z.infer<typeof SubjectKey>;

/**
 * Coarse subject areas. Research telemetry carries only these, never the exact
 * subject list, so an unusual mix cannot single out a student (review #9).
 */
export const SubjectArea = z.enum([
  'maths',
  'sciences',
  'computing',
  'commerce-economics',
  'humanities-social',
  'arts-design',
  'languages',
]);
export type SubjectArea = z.infer<typeof SubjectArea>;

/** A board's official Class 11–12 subject. Catalogue facts come from the board (sourced only). */
export const Subject = z.strictObject({
  key: SubjectKey,
  area: SubjectArea,
  board: Board,
  boardCode: z.string().min(1).max(16),
  name: z.string().min(1),
  kind: z.enum(['language', 'core', 'elective', 'skill']),
  provenance: SourcedOnlyProvenance,
});
export type Subject = z.infer<typeof Subject>;

/** The subjects a student actually takes in Class 11–12. */
export const SubjectSet = z
  .strictObject({
    board: Board,
    subjects: z.array(SubjectKey).min(4).max(8),
  })
  .refine((s) => new Set(s.subjects).size === s.subjects.length, {
    message: 'Duplicate subject',
    path: ['subjects'],
  });
export type SubjectSet = z.infer<typeof SubjectSet>;

/**
 * Eligibility rule over subjects: every key in `allOf`, and at least one key
 * from each `anyOf` group. An empty rule means any combination qualifies.
 */
export const SubjectRequirement = z.strictObject({
  allOf: z.array(SubjectKey),
  anyOf: z.array(z.array(SubjectKey).min(1)),
  minAggregatePercent: z.number().min(0).max(100).optional(),
});
export type SubjectRequirement = z.infer<typeof SubjectRequirement>;

export const GateStatus = z.enum(['OPEN', 'BRIDGE', 'LOCKED']);
export type GateStatus = z.infer<typeof GateStatus>;

/**
 * Route eligibility (01 §4.3). The engine evaluates the rule against the
 * student's SubjectSet: met → OPEN; unmet → `whenUnmet`. Always sourced.
 */
export const Gate = z
  .strictObject({
    routeId: Slug,
    /** Omitted = applies to every board. */
    board: Board.optional(),
    requirement: SubjectRequirement,
    whenUnmet: GateStatus.exclude(['OPEN']),
    /** What closes the gap (e.g. a bridge course or exam). Required for BRIDGE. */
    bridgeNote: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1),
    provenance: SourcedOnlyProvenance,
  })
  .refine((g) => g.whenUnmet !== 'BRIDGE' || g.bridgeNote !== undefined, {
    message: 'A BRIDGE gate needs a bridgeNote',
    path: ['bridgeNote'],
  });
export type Gate = z.infer<typeof Gate>;
