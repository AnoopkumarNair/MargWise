import { z } from 'zod';
import { CurrencyCode, FiniteNumber, HttpsUrl, NumericRange, Slug } from '../primitives.ts';
import { fact, Provenance } from '../provenance.ts';

const Ratio = z.number().min(0).max(1);
const Inr = FiniteNumber.refine((n) => n >= 0, 'Must be ≥ 0');

export const TaxSlab = z.strictObject({
  from: Inr,
  /** Exclusive upper bound in INR; `null` for the open-ended top slab. */
  to: Inr.nullable(),
  rate: Ratio,
});

/**
 * One regime's rules (03 §3.8). Values arrive in the content release so a
 * Budget change is a data update, not a code change (rule 1).
 */
export const TaxRegimeRules = z
  .strictObject({
    regime: z.enum(['new', 'old']),
    slabs: z.array(TaxSlab).min(1),
    standardDeduction: Inr,
    rebate: z.strictObject({
      maxTaxableIncome: Inr,
      maxRebate: Inr,
      /**
       * Marginal relief just above the rebate limit: tax payable is capped at
       * the income above `maxTaxableIncome`. Whether it applies is a sourced fact.
       */
      marginalRelief: z.boolean().optional(),
    }),
    cessRate: Ratio,
    /** Section 129 (ex-80E) education-loan interest deduction applies under this regime. */
    section129Allowed: z.boolean(),
  })
  .superRefine(({ slabs }, ctx) => {
    if (slabs[0]?.from !== 0)
      ctx.addIssue({ code: 'custom', message: 'First slab must start at 0', path: ['slabs', 0] });
    slabs.forEach((slab, i) => {
      const isLast = i === slabs.length - 1;
      if (isLast && slab.to !== null)
        ctx.addIssue({
          code: 'custom',
          message: 'Last slab must be open-ended',
          path: ['slabs', i],
        });
      if (!isLast) {
        const next = slabs[i + 1];
        if (slab.to === null)
          ctx.addIssue({
            code: 'custom',
            message: 'Only the last slab may be open-ended',
            path: ['slabs', i],
          });
        else if (next && next.from !== slab.to)
          ctx.addIssue({
            code: 'custom',
            message: 'Slabs must be contiguous',
            path: ['slabs', i + 1],
          });
        if (slab.to !== null && slab.to <= slab.from)
          ctx.addIssue({ code: 'custom', message: 'Slab must be non-empty', path: ['slabs', i] });
      }
    });
  });
export type TaxRegimeRules = z.infer<typeof TaxRegimeRules>;

export const TaxRules = z
  .strictObject({
    taxYear: z.string().regex(/^\d{4}-\d{2}$/, 'Expected tax year like 2026-27'),
    regimes: z.array(TaxRegimeRules).length(2),
    /** Years the Section 129 deduction may be claimed from the first year of interest payment. */
    section129MaxYears: z.int().positive().optional(),
    provenance: Provenance,
  })
  .refine((r) => new Set(r.regimes.map((x) => x.regime)).size === 2, {
    message: 'Both new and old regimes are required',
    path: ['regimes'],
  });
export type TaxRules = z.infer<typeof TaxRules>;

const Moratorium = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('course_plus_months'),
    months: z.int().min(0),
    provenance: Provenance,
  }),
  z.strictObject({
    kind: z.literal('earlier_of_course_plus_months_or_job_plus_months'),
    courseMonths: z.int().min(0),
    jobMonths: z.int().min(0),
    provenance: Provenance,
  }),
  /** Terms not yet confirmed with the lender (e.g. SBI premier, 01 §9). Shown as such, never filled in. */
  z.strictObject({ kind: z.literal('to_confirm'), note: z.string().min(1) }),
]);

export const LoanScheme = z.strictObject({
  id: Slug,
  lender: z.string().min(1),
  title: z.string().min(1),
  applies: z.enum(['india', 'abroad', 'both']),
  /** Annual rate as a ratio range (0.0690 = 6.90%). */
  rate: fact(
    NumericRange.refine(
      (r) => r.low >= 0 && r.high <= 0.5,
      'Rate must be a ratio between 0 and 0.5',
    ),
  ),
  moratorium: Moratorium,
  concessions: z.array(
    z.strictObject({
      kind: z.enum(['girl_student', 'interest_serviced', 'other']),
      rateReduction: fact(z.number().min(0).max(0.05)),
      note: z.string().optional(),
    }),
  ),
  collateralFreeUpTo: fact(Inr).nullable(),
  subvention: z
    .strictObject({
      description: z.string().min(1),
      incomeCeilingInr: fact(Inr),
      loanCeilingInr: fact(Inr).optional(),
      rateDuringMoratorium: fact(Ratio).optional(),
      certainty: z.enum(['possible_not_guaranteed', 'entitlement']),
    })
    .optional(),
  /** Official page where the family confirms list membership (03 §3.5). */
  userConfirmUrl: HttpsUrl,
});
export type LoanScheme = z.infer<typeof LoanScheme>;

export const FxRate = z.strictObject({
  currency: CurrencyCode.exclude(['INR']),
  inrPerUnit: fact(z.number().positive()),
});
export type FxRate = z.infer<typeof FxRate>;

/** Editable defaults shown in the Assumptions drawer (03 §3.2, §3.4, §3.9). */
export const MoneyDefaults = z.strictObject({
  inflationIndia: fact(NumericRange),
  inflationEducation: fact(NumericRange),
  inrDepreciation: fact(NumericRange),
  discountRate: fact(z.number().min(0).max(0.3)),
  loanTenureYears: fact(z.strictObject({ default: z.int(), min: z.int(), max: z.int() })),
  simulations: z.int().min(100).max(10000),
});

/** Fixed normalisation bounds for the compare engine, frozen per release (03 §3.11). */
const Bound = z
  .strictObject({ min: FiniteNumber, max: FiniteNumber })
  .refine((b) => b.min < b.max, 'Bound min must be < max');

export const CompareBounds = z.strictObject({
  npvP50: Bound,
  npvP10: Bound,
  peakEmiShare: Bound,
  yearsToFirstSalary: Bound,
  computedAt: z.iso.datetime({ offset: true }),
});
