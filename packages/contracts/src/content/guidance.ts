import { z } from 'zod';
import { IsoDate, NumericRange, Slug } from '../primitives.ts';
import { fact, Provenance, SourcedOnlyProvenance } from '../provenance.ts';

export const ExamDate = z.discriminatedUnion('status', [
  z.strictObject({
    examId: Slug,
    event: z.enum([
      'registration_opens',
      'registration_closes',
      'exam',
      'result',
      'counselling',
      'application_opens',
      'application_closes',
    ]),
    date: IsoDate,
    status: z.literal('official'),
    provenance: SourcedOnlyProvenance,
  }),
  z.strictObject({
    examId: Slug,
    event: z.enum([
      'registration_opens',
      'registration_closes',
      'exam',
      'result',
      'counselling',
      'application_opens',
      'application_closes',
    ]),
    date: IsoDate,
    status: z.literal('expected'),
    basis: z.string().min(1),
  }),
]);
export type ExamDate = z.infer<typeof ExamDate>;

export const Quest = z.strictObject({
  id: Slug,
  careerId: Slug,
  title: z.string().min(1),
  goal: z.string().min(1),
  steps: z.array(z.string().min(1)).min(3).max(5),
  timeNeeded: z.string().min(1),
  whatToNotice: z.string().min(1),
  /** Tap-only reflections: no free text from minors in the alpha (02 §3.4). */
  reflections: z
    .array(
      z.strictObject({
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).min(2).max(6),
      }),
    )
    .length(2),
  safety: z.strictObject({ needsParentHelp: z.boolean() }),
});
export type Quest = z.infer<typeof Quest>;

export const IloGradient = z.enum([
  'not_exposed',
  'gradient_1',
  'gradient_2',
  'gradient_3',
  'gradient_4',
]);

/** Two published lenses shown side by side, never merged into one number (05 §7, ADR 008). */
export const AiExposure = z.strictObject({
  careerId: Slug,
  lensA: z.strictObject({
    source: z.literal('ilo-2025'),
    gradient: IloGradient,
    isco08: z.array(z.string().regex(/^\d{4}$/)).min(1),
    manyToOne: z.boolean(),
    provenance: Provenance,
  }),
  lensB: z
    .strictObject({
      source: z.literal('anthropic-economic-index'),
      releaseDate: IsoDate,
      automationShare: z.number().min(0).max(1),
      augmentationShare: z.number().min(0).max(1),
      provenance: Provenance,
    })
    .refine((b) => b.automationShare + b.augmentationShare <= 1 + 1e-9, 'Shares must sum to ≤ 1'),
  whatsChanging: z.string().min(1),
  skillsThatStay: z.array(z.string().min(1)),
  /** Yearly drag on gross pay growth from the published mapping (03 §3.6); always an assumption. */
  delta: fact(NumericRange).optional(),
});
export type AiExposure = z.infer<typeof AiExposure>;
