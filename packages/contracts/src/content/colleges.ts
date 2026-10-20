import { z } from 'zod';
import { CountryCode, NumericRange, Slug } from '../primitives.ts';
import { fact, Provenance, SourcedOnlyProvenance } from '../provenance.ts';

/** Explicit "not reported" marker (01 §5.2). Missing data is never guessed or zero-filled. */
export const NotReported = z.strictObject({ notReported: z.literal(true) });

export function factOrNotReported<T extends z.ZodType>(value: T) {
  return z.union([fact(value), NotReported]);
}

export const Institution = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  type: z.enum(['public', 'private']),
  cityId: Slug,
  country: CountryCode,
  approvals: z.array(
    z.strictObject({
      body: z.enum(['AICTE', 'UGC', 'COA', 'BCI', 'NAAC', 'NBA', 'RCI', 'other']),
      status: z.string(),
      provenance: Provenance,
    }),
  ),
});

export const CourseCode = Slug;

/** Programme registry key: institution + normalised programme code + campus (05 §5.2). */
export const Programme = z.strictObject({
  id: Slug,
  institutionId: Slug,
  courseCode: CourseCode,
  normalisedCode: z.string().min(1),
  campus: z.string().min(1),
  name: z.string().min(1),
  department: z.string().optional(),
  year: z.int().min(2000).max(2100),
  intake: factOrNotReported(z.int().nonnegative()),
  status: z.enum(['active', 'dropped', 'new']),
  entranceTests: z.array(z.string()),
});

export const ProgrammeFee = z.strictObject({
  programmeId: Slug,
  year: z.int().min(2000).max(2100),
  annualInr: factOrNotReported(z.number().nonnegative()),
});

/** Last year's published opening/closing ranks; shown as facts only (no admission prediction, 01 §6). */
export const Cutoff = z
  .strictObject({
    programmeId: Slug,
    year: z.int().min(2000).max(2100),
    round: z.int().min(1),
    quota: z.string().min(1),
    category: z.string().min(1),
    seatPool: z.string().min(1),
    openingRank: z.int().positive(),
    closingRank: z.int().positive(),
    provenance: SourcedOnlyProvenance,
  })
  .refine((c) => c.openingRank <= c.closingRank, {
    message: 'openingRank must be ≤ closingRank',
    path: ['openingRank'],
  });

export const NirfMetric = z.strictObject({
  institutionId: Slug,
  year: z.int().min(2016).max(2100),
  metric: z.enum([
    'rank',
    'band',
    'median_salary_ug',
    'median_salary_pg',
    'intake',
    'placement_rate',
  ]),
  value: factOrNotReported(z.union([z.number(), z.string()])),
});

export const AbroadUniversity = z.strictObject({
  id: Slug,
  country: CountryCode.exclude(['IN']),
  name: z.string().min(1),
  courseCode: CourseCode,
  tuition: fact(NumericRange),
  programmeYears: fact(z.number().positive()),
  language: z.string().min(1),
  admissionSummary: z.string().min(1),
});
