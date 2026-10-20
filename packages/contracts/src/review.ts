import { z } from 'zod';
import { Confidence } from './provenance.ts';
import { IsoDateTime, Slug, Uuid } from './primitives.ts';

export const Severity = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof Severity>;

/** Review target time per severity (05 §8). `null` = next release. */
export const SEVERITY_TARGET_HOURS = {
  critical: 48,
  high: 168,
  medium: 336,
  low: null,
} as const satisfies Record<Severity, number | null>;

export const ChangeKind = z.enum([
  'value_changed',
  'value_added',
  'value_removed',
  'programme_added',
  'programme_dropped',
  'programme_renamed',
  'programme_moved',
  'intake_changed',
  'fee_changed',
  'institution_relocated',
  'approval_changed',
  'policy_status_changed',
  'calendar_date_changed',
]);

const Json: z.ZodType<unknown> = z.json();

export const Extraction = z
  .strictObject({
    /** Extractor id and version, e.g. `sbi-rates-table@1` or `llm:loan-scheme@1`. */
    extractor: z.string().regex(/^[a-z0-9:-]+@\d+$/),
    method: z.enum(['parser', 'llm']),
    snapshotId: Uuid,
    /** Verbatim quote; for LLM output it has already passed the string-match check against the snapshot. */
    quote: z.string().trim().min(1),
    locator: z.string().optional(),
    confidence: Confidence,
  })
  .refine((e) => e.method !== 'llm' || e.confidence !== 'high', {
    message: 'LLM extractions are at most medium confidence until a reviewer approves them',
    path: ['confidence'],
  });

export const ChangeEvent = z.strictObject({
  id: Uuid,
  sourceId: Slug,
  kind: ChangeKind,
  entity: z.string().regex(/^[a-z_]+$/),
  entityKey: z.string().min(1),
  field: z.string().min(1),
  oldValue: Json.nullable(),
  newValue: Json.nullable(),
  severity: Severity,
  detectedAt: IsoDateTime,
  extraction: Extraction,
});
export type ChangeEvent = z.infer<typeof ChangeEvent>;

export const ReviewStream = z.enum([
  'psychology',
  'tech-ai',
  'commerce-business',
  'design',
  'law',
  'finance',
  'abroad',
  'general',
]);

export const ReviewTask = z.strictObject({
  id: Uuid,
  changeEventId: Uuid,
  stream: ReviewStream,
  severity: Severity,
  status: z.enum(['pending', 'approved', 'edited', 'rejected']),
  createdAt: IsoDateTime,
  dueBy: IsoDateTime.nullable(),
});
export type ReviewTask = z.infer<typeof ReviewTask>;

export const ReviewDecision = z
  .strictObject({
    taskId: Uuid,
    decision: z.enum(['approve', 'edit', 'reject']),
    note: z.string().trim().min(1).optional(),
    editedValue: Json.optional(),
    reviewer: z.string().min(1),
    decidedAt: IsoDateTime,
  })
  .refine((d) => d.decision === 'approve' || d.note !== undefined, {
    message: 'A note is required to edit or reject',
    path: ['note'],
  })
  .refine((d) => d.decision !== 'edit' || d.editedValue !== undefined, {
    message: 'Edit requires editedValue',
    path: ['editedValue'],
  });
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const Role = z.enum(['owner', 'reviewer', 'viewer']);
