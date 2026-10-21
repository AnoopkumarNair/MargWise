import { z } from 'zod';
import { CountryCode, CurrencyCode, IsoDate, NumericRange, Slug } from '../primitives.ts';
import { fact, Provenance } from '../provenance.ts';

export const CityTier = z.enum(['metro', 'tier-2', 'tier-3']);

export const City = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  tier: CityTier,
  /** `home` and `other` are user-entered; covered cities carry sourced or assumed costs. */
  kind: z.enum(['home', 'covered', 'other']),
});

export const CostItem = z.enum([
  'rent_shared',
  'food',
  'transport',
  'utilities',
  'misc',
  'health_cover',
  'total',
]);

export const CityCost = z.strictObject({
  cityId: Slug,
  item: CostItem,
  annualInr: fact(NumericRange),
});

export const Country = z.strictObject({
  code: CountryCode.exclude(['IN']),
  name: z.string().min(1),
  currency: CurrencyCode.exclude(['INR']),
});

export const CountryCost = z.strictObject({
  country: CountryCode.exclude(['IN']),
  item: z.enum([
    'tuition_ug',
    'tuition_pg',
    'living',
    'proof_of_funds',
    'health_cover',
    'visa_fee',
    'travel',
    'post_study_visa_fee',
  ]),
  field: z.string().optional(),
  /** Annual (or one-time for fees) amount in the country's currency. */
  amount: fact(NumericRange),
  oneTime: z.boolean(),
});

export const PolicyStatus = z.enum([
  'proposed',
  'announced',
  'in_force',
  'amended',
  'suspended_or_blocked',
  'withdrawn',
]);
export type PolicyStatus = z.infer<typeof PolicyStatus>;

const PolicyEffect = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('one_time_cost'),
    currency: CurrencyCode,
    amount: z.number().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal('annual_cost'),
    currency: CurrencyCode,
    amount: z.number().nonnegative(),
  }),
  z.strictObject({ kind: z.literal('work_rights_months'), months: z.int().min(0) }),
  z.strictObject({ kind: z.literal('informational') }),
]);

/** Country "policy weather" and Indian regulation items with a dated lifecycle (05 §5.3). */
export const CountryPolicy = z
  .strictObject({
    id: Slug,
    country: CountryCode,
    title: z.string().min(1),
    kind: z.enum([
      'student_visa',
      'post_study_work',
      'work_visa',
      'pr_route',
      'fees',
      'regulation',
    ]),
    status: PolicyStatus,
    history: z
      .array(z.strictObject({ status: PolicyStatus, on: IsoDate, provenance: Provenance }))
      .min(1),
    effect: PolicyEffect,
  })
  .superRefine((p, ctx) => {
    const dates = p.history.map((h) => h.on);
    if (dates.some((d, i) => i > 0 && d < (dates[i - 1] as string))) {
      ctx.addIssue({ code: 'custom', message: 'History must be in date order', path: ['history'] });
    }
    if (p.history.at(-1)?.status !== p.status) {
      ctx.addIssue({
        code: 'custom',
        message: 'status must equal the latest history entry',
        path: ['status'],
      });
    }
  });
export type CountryPolicy = z.infer<typeof CountryPolicy>;

/**
 * How the money engine may use a policy item (05 §5.3): only proposed or
 * announced items feed the policy-shock scenario; in-force items change base
 * values; blocked or withdrawn items are shown but never applied.
 */
export function policyAppliesTo(
  status: PolicyStatus,
): 'policy_shock' | 'base_values' | 'display_only' {
  switch (status) {
    case 'proposed':
    case 'announced':
      return 'policy_shock';
    case 'in_force':
    case 'amended':
      return 'base_values';
    case 'suspended_or_blocked':
    case 'withdrawn':
      return 'display_only';
  }
}

export const CareerCountryFit = z.strictObject({
  careerId: Slug,
  country: CountryCode.exclude(['IN']),
  onShortageList: fact(z.boolean()).nullable(),
  commonRoute: z.boolean(),
  recognitionNotes: z.string().min(1),
  postStudyProspects: z.string().min(1),
});
