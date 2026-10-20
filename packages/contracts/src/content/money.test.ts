import { describe, expect, it } from 'vitest';
import { sourcedProv } from './fixtures.ts';
import { FxRate, LoanScheme, TaxRegimeRules, TaxRules } from './money.ts';

// Arbitrary fixture slabs: the real slabs live in content releases (rule 1).
const regime = {
  regime: 'new',
  slabs: [
    { from: 0, to: 100, rate: 0 },
    { from: 100, to: 200, rate: 0.1 },
    { from: 200, to: null, rate: 0.2 },
  ],
  standardDeduction: 10,
  rebate: { maxTaxableIncome: 150, maxRebate: 5 },
  cessRate: 0.04,
  section129Allowed: false,
};

describe('TaxRegimeRules', () => {
  it('accepts contiguous ascending slabs ending open-ended', () => {
    expect(TaxRegimeRules.safeParse(regime).success).toBe(true);
  });

  it('rejects a gap between slabs', () => {
    const gap = {
      ...regime,
      slabs: [
        { from: 0, to: 100, rate: 0 },
        { from: 150, to: null, rate: 0.1 },
      ],
    };
    expect(TaxRegimeRules.safeParse(gap).success).toBe(false);
  });

  it('rejects a first slab that does not start at 0', () => {
    const late = { ...regime, slabs: [{ from: 10, to: null, rate: 0 }] };
    expect(TaxRegimeRules.safeParse(late).success).toBe(false);
  });

  it('rejects a bounded last slab (income above it would be untaxed)', () => {
    const bounded = { ...regime, slabs: [{ from: 0, to: 100, rate: 0 }] };
    expect(TaxRegimeRules.safeParse(bounded).success).toBe(false);
  });

  it('rejects an open-ended slab that is not last', () => {
    const early = {
      ...regime,
      slabs: [
        { from: 0, to: null, rate: 0 },
        { from: 100, to: null, rate: 0.1 },
      ],
    };
    expect(TaxRegimeRules.safeParse(early).success).toBe(false);
  });

  it('rejects rates outside 0–1', () => {
    const bad = { ...regime, slabs: [{ from: 0, to: null, rate: 30 }] };
    expect(TaxRegimeRules.safeParse(bad).success).toBe(false);
  });
});

describe('TaxRules', () => {
  it('requires both regimes for the tax year', () => {
    const rules = {
      taxYear: '2026-27',
      regimes: [regime],
      provenance: sourcedProv({ unit: 'tax_rules' }),
    };
    expect(TaxRules.safeParse(rules).success).toBe(false);
    const both = {
      ...rules,
      regimes: [regime, { ...regime, regime: 'old', section129Allowed: true }],
    };
    expect(TaxRules.safeParse(both).success).toBe(true);
  });

  it('rejects a malformed tax year', () => {
    const rules = {
      taxYear: '2026',
      regimes: [regime, { ...regime, regime: 'old' }],
      provenance: sourcedProv(),
    };
    expect(TaxRules.safeParse(rules).success).toBe(false);
  });
});

describe('LoanScheme', () => {
  const scheme = {
    id: 'fixture-scheme',
    lender: 'Fixture Bank',
    title: 'Fixture scheme',
    applies: 'india',
    rate: {
      value: { low: 0.07, likely: 0.075, high: 0.08 },
      provenance: sourcedProv({ unit: 'ratio_per_year' }),
    },
    moratorium: {
      kind: 'course_plus_months',
      months: 12,
      provenance: sourcedProv({ unit: 'months' }),
    },
    concessions: [],
    collateralFreeUpTo: null,
    userConfirmUrl: 'https://example.gov.in/list',
  };

  it('accepts a scheme whose rate is a ratio range', () => {
    expect(LoanScheme.safeParse(scheme).success).toBe(true);
  });

  it('rejects rates expressed as percent (e.g. 7.5 instead of 0.075)', () => {
    const pct = { ...scheme, rate: { ...scheme.rate, value: { low: 7, likely: 7.5, high: 8 } } };
    expect(LoanScheme.safeParse(pct).success).toBe(false);
  });

  it('accepts "to confirm" moratorium terms as an explicit state, not a made-up number', () => {
    const tbc = { ...scheme, moratorium: { kind: 'to_confirm', note: 'Confirm with lender' } };
    expect(LoanScheme.safeParse(tbc).success).toBe(true);
  });
});

describe('FxRate', () => {
  it('requires a positive INR-per-unit rate with provenance', () => {
    const fx = {
      currency: 'USD',
      inrPerUnit: { value: 1, provenance: sourcedProv({ unit: 'inr_per_unit' }) },
    };
    expect(FxRate.safeParse(fx).success).toBe(true);
    expect(FxRate.safeParse({ ...fx, inrPerUnit: { ...fx.inrPerUnit, value: 0 } }).success).toBe(
      false,
    );
  });

  it('rejects INR as a foreign currency', () => {
    const fx = { currency: 'INR', inrPerUnit: { value: 1, provenance: sourcedProv() } };
    expect(FxRate.safeParse(fx).success).toBe(false);
  });
});

describe('TaxRegimeRules — empty slab', () => {
  it('rejects a slab whose upper bound equals its lower bound', () => {
    const empty = {
      ...regime,
      slabs: [
        { from: 0, to: 0, rate: 0 },
        { from: 0, to: null, rate: 0.1 },
      ],
    };
    expect(TaxRegimeRules.safeParse(empty).success).toBe(false);
  });
});
