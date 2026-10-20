import type { TaxRegimeRules } from '@margwise/contracts';

/**
 * Test-only tax regimes shaped like 03 §3.8. In the app these come from the
 * content release (rule 1); fixtures exist so engine maths can be tested.
 */
export const NEW_REGIME_FIXTURE: TaxRegimeRules = {
  regime: 'new',
  slabs: [
    { from: 0, to: 400000, rate: 0 },
    { from: 400000, to: 800000, rate: 0.05 },
    { from: 800000, to: 1200000, rate: 0.1 },
    { from: 1200000, to: 1600000, rate: 0.15 },
    { from: 1600000, to: 2000000, rate: 0.2 },
    { from: 2000000, to: 2400000, rate: 0.25 },
    { from: 2400000, to: null, rate: 0.3 },
  ],
  standardDeduction: 75000,
  rebate: { maxTaxableIncome: 1200000, maxRebate: 60000 },
  cessRate: 0.04,
  section129Allowed: false,
};

export const OLD_REGIME_FIXTURE: TaxRegimeRules = {
  regime: 'old',
  slabs: [
    { from: 0, to: 250000, rate: 0 },
    { from: 250000, to: 500000, rate: 0.05 },
    { from: 500000, to: 1000000, rate: 0.2 },
    { from: 1000000, to: null, rate: 0.3 },
  ],
  standardDeduction: 50000,
  rebate: { maxTaxableIncome: 500000, maxRebate: 12500 },
  cessRate: 0.04,
  section129Allowed: true,
};
