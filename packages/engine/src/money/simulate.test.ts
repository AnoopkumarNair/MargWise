import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NEW_REGIME_FIXTURE, OLD_REGIME_FIXTURE } from './fixtures.ts';
import { SANITY_LIMITS, simulatePlan, type PlanSpec } from './simulate.ts';

/** Paths of every number in a value that is NaN or ±Infinity. */
function nonFiniteNumbers(value: unknown, path = '$'): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonFiniteNumbers(v, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => nonFiniteNumbers(v, `${path}.${k}`));
  return [];
}

const pt = (x: number) => ({ low: x, likely: x, high: x });
const rng3 = (l: number, m: number, h: number) => ({ low: l, likely: m, high: h });

/** Fixture plan: B.Tech-like India route then work. Numbers are arbitrary test data. */
const spec = (over: Partial<PlanSpec> = {}): PlanSpec => ({
  startAge: 17,
  horizonAge: 35,
  stages: [
    {
      years: 4,
      currency: 'INR',
      tuitionAnnual: rng3(150_000, 200_000, 300_000),
      livingAnnual: rng3(80_000, 100_000, 140_000),
      oneTimeAtStart: pt(0),
    },
  ],
  work: {
    location: 'india',
    currency: 'INR',
    startGrossToday: rng3(500_000, 900_000, 1_800_000),
    growth: rng3(0.05, 0.08, 0.12),
    aiDelta: rng3(0, 0.005, 0.02),
    effectiveTaxRate: pt(0),
    livingAnnualToday: rng3(200_000, 250_000, 300_000),
  },
  fallbackWork: {
    location: 'india',
    currency: 'INR',
    startGrossToday: rng3(300_000, 450_000, 700_000),
    growth: rng3(0.04, 0.06, 0.08),
    aiDelta: pt(0),
    effectiveTaxRate: pt(0),
    livingAnnualToday: rng3(150_000, 200_000, 250_000),
  },
  scenarios: { fallback: 0.2, repeatYear: 0.1, returnToIndia: 0, policyShock: 0 },
  repeatYearCostInr: rng3(100_000, 150_000, 250_000),
  inflation: { education: rng3(0.06, 0.08, 0.1), general: pt(0.04), abroad: {} },
  fx: { inrPerUnit: {}, depreciation: rng3(0.01, 0.02, 0.04) },
  extraCosts: [],
  tax: {
    earner: NEW_REGIME_FIXTURE,
    parentOld: OLD_REGIME_FIXTURE,
    parentRegime: 'new',
    parentGross: 1_500_000,
    section129MaxYears: 8,
  },
  discountRate: 0.07,
  ...over,
});

describe('simulatePlan — seeded Monte Carlo (03 §3.10)', () => {
  it('is reproducible for a seed and changes with the seed', () => {
    const a = simulatePlan(spec(), { draws: 300, seed: 1 });
    const b = simulatePlan(spec(), { draws: 300, seed: 1 });
    const c = simulatePlan(spec(), { draws: 300, seed: 2 });
    expect(b.npv).toEqual(a.npv);
    expect(c.npv).not.toEqual(a.npv);
  });

  it('collapses to the deterministic NPV when every input is a point and only the core scenario is possible', () => {
    const s = spec({
      stages: [
        {
          years: 4,
          currency: 'INR',
          tuitionAnnual: pt(200_000),
          livingAnnual: pt(100_000),
          oneTimeAtStart: pt(0),
        },
      ],
      work: {
        location: 'india',
        currency: 'INR',
        startGrossToday: pt(900_000),
        growth: pt(0.08),
        aiDelta: pt(0.005),
        effectiveTaxRate: pt(0),
        livingAnnualToday: pt(250_000),
      },
      scenarios: { fallback: 0, repeatYear: 0, returnToIndia: 0, policyShock: 0 },
      inflation: { education: pt(0.08), general: pt(0.04), abroad: {} },
      fx: { inrPerUnit: {}, depreciation: pt(0.02) },
    });
    const r = simulatePlan(s, { draws: 50, seed: 3 });
    expect(r.npv.p10).toBeCloseTo(r.deterministic.npv, 6);
    expect(r.npv.p90).toBeCloseTo(r.deterministic.npv, 6);
  });

  it('draws one scenario per simulation with the stated probabilities', () => {
    const r = simulatePlan(spec(), { draws: 5000, seed: 9 });
    expect(r.scenarioShares.fallback).toBeCloseTo(0.2, 1);
    expect(r.scenarioShares.repeatYear).toBeCloseTo(0.1, 1);
    expect(r.scenarioShares.core).toBeCloseTo(0.7, 1);
  });

  it('property: P10 ≤ P50 ≤ P90 for any seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        const { npv } = simulatePlan(spec(), { draws: 60, seed });
        return npv.p10 <= npv.p50 && npv.p50 <= npv.p90;
      }),
      { numRuns: 25 },
    );
  });

  it('rejects scenario probabilities that exceed 1 in total', () => {
    expect(() =>
      simulatePlan(
        spec({ scenarios: { fallback: 0.6, repeatYear: 0.6, returnToIndia: 0, policyShock: 0 } }),
        { draws: 10, seed: 1 },
      ),
    ).toThrow(/probabilit/);
  });

  it('reports the share of futures ending with a return to India for abroad plans', () => {
    const abroad = spec({
      stages: [
        {
          years: 2,
          currency: 'EUR',
          tuitionAnnual: pt(3_000),
          livingAnnual: pt(11_000),
          oneTimeAtStart: pt(1_000),
        },
      ],
      work: {
        location: 'abroad',
        currency: 'EUR',
        startGrossToday: rng3(40_000, 50_000, 60_000),
        growth: pt(0.03),
        aiDelta: pt(0),
        effectiveTaxRate: rng3(0.3, 0.35, 0.4),
        livingAnnualToday: pt(14_000),
      },
      returnToIndia: {
        afterWorkYears: 3,
        work: {
          location: 'india',
          currency: 'INR',
          startGrossToday: pt(1_200_000),
          growth: pt(0.07),
          aiDelta: pt(0),
          effectiveTaxRate: pt(0),
          livingAnnualToday: pt(300_000),
        },
      },
      scenarios: { fallback: 0, repeatYear: 0, returnToIndia: 0.3, policyShock: 0.1 },
      policyShock: { extraCostInr: pt(500_000), workRightsYears: 1 },
      fx: { inrPerUnit: { EUR: 95 }, depreciation: rng3(0.01, 0.02, 0.04) },
      inflation: { education: pt(0.03), general: pt(0.04), abroad: { EUR: pt(0.02) } },
    });
    const r = simulatePlan(abroad, { draws: 3000, seed: 4 });
    // Policy shock with limited work rights also ends in India.
    expect(r.returnShare).toBeCloseTo(0.4, 1);
  });

  it('reports peak EMI ÷ in-hand at P50 and the share of futures above 40%', () => {
    const r = simulatePlan(
      spec({
        loan: {
          amount: 1_000_000,
          annualRate: rng3(0.09, 0.1015, 0.11),
          tenureYears: 10,
          moratoriumMonthsAfterCourse: 12,
          serviceInterest: false,
        },
      }),
      { draws: 500, seed: 5 },
    );
    expect(r.peakEmiShareP50).toBeGreaterThan(0);
    expect(r.shareFuturesEmiAbove40).toBeGreaterThanOrEqual(0);
    expect(r.shareFuturesEmiAbove40).toBeLessThanOrEqual(1);
  });

  it('runs 4 plans × 1000 draws within the budget (03 §3.10 says < 400 ms on the floor device; CI smoke ≤ 2 s)', () => {
    // Engine code has no timer types (purity); the test reads the global clock.
    const clock = (globalThis as unknown as { performance: { now(): number } }).performance;
    const start = clock.now();
    for (let i = 0; i < 4; i++) simulatePlan(spec(), { draws: 1000, seed: i });
    expect(clock.now() - start).toBeLessThan(2000);
  });
});

describe('sanity limits (03 §3.12)', () => {
  it('pins the spec limits', () => {
    expect(SANITY_LIMITS).toEqual({
      npvP50Min: -20_000_000,
      npvP50Max: 100_000_000,
      maxEmiShare: 1,
    });
  });

  it('flags "check inputs" when P50 NPV is outside −₹2 crore … +₹10 crore', () => {
    const rich = spec({
      work: { ...spec().work, startGrossToday: pt(50_000_000) },
      scenarios: { fallback: 0, repeatYear: 0, returnToIndia: 0, policyShock: 0 },
    });
    expect(simulatePlan(rich, { draws: 20, seed: 1 }).checkInputs).toContain('npv_out_of_range');
  });

  it('flags EMI above 100% of in-hand pay, and never reports Infinity', () => {
    const r = simulatePlan(
      spec({
        work: { ...spec().work, startGrossToday: pt(100_000) },
        loan: {
          amount: 5_000_000,
          annualRate: pt(0.12),
          tenureYears: 5,
          moratoriumMonthsAfterCourse: 0,
          serviceInterest: false,
        },
        stages: [
          {
            years: 4,
            currency: 'INR',
            tuitionAnnual: pt(1_500_000),
            livingAnnual: pt(0),
            oneTimeAtStart: pt(0),
          },
        ],
      }),
      { draws: 20, seed: 1 },
    );
    expect(r.checkInputs).toContain('emi_exceeds_in_hand');
    expect(Number.isFinite(r.peakEmiShareP50)).toBe(true);
    expect(Number.isFinite(r.deterministic.metrics.peakEmiShare)).toBe(true);
    expect(nonFiniteNumbers(r)).toEqual([]);
  });

  it('flags negative costs or pay', () => {
    const r = simulatePlan(spec({ work: { ...spec().work, startGrossToday: rng3(-1, 0, 1) } }), {
      draws: 5,
      seed: 1,
    });
    expect(r.checkInputs).toContain('negative_input');
  });
});
