import { describe, expect, it } from 'vitest';
import { NEW_REGIME_FIXTURE, OLD_REGIME_FIXTURE } from './fixtures.ts';
import { projectPlan, type PlanInputs } from './projection.ts';

/** Minimal India plan: one study year, then work to age 35. Fixture numbers only. */
const base = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  startAge: 17,
  horizonAge: 35,
  gapYears: 0,
  gapYearCostInr: 0,
  stages: [
    { years: 1, currency: 'INR', tuitionAnnual: 100_000, livingAnnual: 50_000, oneTimeAtStart: 0 },
  ],
  work: {
    location: 'india',
    currency: 'INR',
    startGrossToday: 600_000,
    growth: 0,
    aiDelta: 0,
    effectiveTaxRate: 0,
    livingAnnualToday: 200_000,
  },
  inflation: { education: 0, general: 0, abroad: {} },
  fx: { inrPerUnit: {}, depreciation: 0 },
  extraCosts: [],
  tax: {
    earner: NEW_REGIME_FIXTURE,
    parentOld: OLD_REGIME_FIXTURE,
    parentRegime: 'new',
    parentGross: 1_100_000,
    section129MaxYears: 8,
  },
  discountRate: 0.07,
  ...over,
});

describe('projectPlan — cash flows and NPV (03 §3.9)', () => {
  it('matches the hand-computed NPV of the minimal plan (docs/golden/money-hand-cases.md)', () => {
    const p = projectPlan(base());
    expect(p.years).toHaveLength(18);
    expect(p.years[0]?.cashFlow).toBe(-150_000);
    expect(p.years[1]?.cashFlow).toBe(400_000);
    expect(p.npv).toBeCloseTo(3509616.072287794, 4);
    expect(p.metrics.yearsUntilFirstSalary).toBe(1);
  });

  it('inflates tuition by education inflation and living by general inflation, from year 2', () => {
    const p = projectPlan(
      base({
        stages: [
          {
            years: 2,
            currency: 'INR',
            tuitionAnnual: 100_000,
            livingAnnual: 50_000,
            oneTimeAtStart: 0,
          },
        ],
        inflation: { education: 0.08, general: 0.05, abroad: {} },
      }),
    );
    expect(p.years.slice(0, 2).map((y) => y.studyCost)).toEqual([150_000, 160_500]);
  });

  it('starts pay at today’s value inflated to the first work year, then grows by (growth − δ) on gross', () => {
    const p = projectPlan(
      base({
        stages: [
          { years: 2, currency: 'INR', tuitionAnnual: 0, livingAnnual: 0, oneTimeAtStart: 0 },
        ],
        inflation: { education: 0, general: 0.05, abroad: {} },
        work: {
          location: 'india',
          currency: 'INR',
          startGrossToday: 600_000,
          growth: 0.06,
          aiDelta: 0.01,
          effectiveTaxRate: 0,
          livingAnnualToday: 0,
        },
      }),
    );
    expect(p.years[2]?.gross).toBeCloseTo(661_500, 6);
    expect(p.years[17]?.gross).toBeCloseTo(1375210.9906806205, 4);
  });

  it('in-hand pay in India is gross minus income tax under the earner’s regime', () => {
    const p = projectPlan(
      base({
        work: {
          location: 'india',
          currency: 'INR',
          startGrossToday: 2_475_000,
          growth: 0,
          aiDelta: 0,
          effectiveTaxRate: 0,
          livingAnnualToday: 0,
        },
      }),
    );
    expect(p.years[1]?.inHand).toBeCloseTo(2_475_000 - 312_000, 6);
  });

  it('converts abroad costs and pay to INR on the depreciating FX path', () => {
    const p = projectPlan(
      base({
        stages: [
          { years: 1, currency: 'EUR', tuitionAnnual: 1_000, livingAnnual: 0, oneTimeAtStart: 500 },
        ],
        work: {
          location: 'abroad',
          currency: 'EUR',
          startGrossToday: 10_000,
          growth: 0,
          aiDelta: 0,
          effectiveTaxRate: 0.3,
          livingAnnualToday: 0,
        },
        fx: { inrPerUnit: { EUR: 100 }, depreciation: 0.02 },
      }),
    );
    expect(p.years[0]?.studyCost).toBeCloseTo(1_500 * 100, 6);
    expect(p.years[1]?.inHand).toBeCloseTo(10_000 * 0.7 * 102, 6);
  });

  it('a loan replaces out-of-pocket cost; repayment enters only through the loan payment (never twice)', () => {
    const p = projectPlan(
      base({
        loan: {
          amount: 100_000,
          annualRate: 0.1,
          tenureYears: 5,
          moratoriumMonthsAfterCourse: 12,
          serviceInterest: false,
        },
      }),
    );
    expect(p.years[0]?.outOfPocket).toBe(50_000);
    expect(p.years[0]?.loanPayment).toBe(0);
    expect(p.metrics.loanPrincipal).toBe(100_000);
    expect(p.metrics.capitalisedInterest).toBeCloseTo(100_000 * 0.1 * 2, 6);
    const paid = p.years.reduce((t, y) => t + y.loanPayment, 0);
    expect(paid).toBeGreaterThan(120_000);
    expect(p.metrics.debtFreeAge).toBe(17 + 2 + 5);
  });

  it('Section 129 saving applies under the old regime only (03 §3.8)', () => {
    const loan = {
      amount: 100_000,
      annualRate: 0.1,
      tenureYears: 5,
      moratoriumMonthsAfterCourse: 12,
      serviceInterest: false,
    };
    const newRegime = projectPlan(base({ loan }));
    const oldRegime = projectPlan(base({ loan, tax: { ...base().tax, parentRegime: 'old' } }));
    expect(newRegime.years.every((y) => y.taxSaving129 === 0)).toBe(true);
    const firstPaid = oldRegime.years.findIndex((y) => y.loanInterestPaid > 0);
    const y = oldRegime.years[firstPaid];
    expect(y?.taxSaving129).toBeCloseTo((y?.loanInterestPaid ?? 0) * 0.312, 6);
    expect(oldRegime.npv).toBeGreaterThan(newRegime.npv);
  });

  it('peak EMI share is the largest loan payment ÷ in-hand pay in repayment years', () => {
    const p = projectPlan(
      base({
        loan: {
          amount: 100_000,
          annualRate: 0.1,
          tenureYears: 5,
          moratoriumMonthsAfterCourse: 12,
          serviceInterest: false,
        },
      }),
    );
    const shares = p.years.filter((y) => y.loanPayment > 0).map((y) => y.loanPayment / y.inHand);
    expect(p.metrics.peakEmiShare).toBeCloseTo(Math.max(...shares), 10);
  });

  it('gap years (repeat year) add cost and delay the first salary', () => {
    const p = projectPlan(base({ gapYears: 1, gapYearCostInr: 80_000 }));
    expect(p.years[0]?.otherCosts).toBe(80_000);
    expect(p.metrics.yearsUntilFirstSalary).toBe(2);
  });

  it('return to India switches location, pay and living after the abroad years', () => {
    const p = projectPlan(
      base({
        work: {
          location: 'abroad',
          currency: 'EUR',
          startGrossToday: 10_000,
          growth: 0,
          aiDelta: 0,
          effectiveTaxRate: 0,
          livingAnnualToday: 0,
        },
        fx: { inrPerUnit: { EUR: 100 }, depreciation: 0 },
        switchTo: {
          afterWorkYears: 3,
          work: {
            location: 'india',
            currency: 'INR',
            startGrossToday: 700_000,
            growth: 0,
            aiDelta: 0,
            effectiveTaxRate: 0,
            livingAnnualToday: 0,
          },
        },
      }),
    );
    expect(p.years.slice(1, 4).every((y) => y.location === 'abroad')).toBe(true);
    expect(p.years[4]?.location).toBe('india');
    expect(p.years[4]?.gross).toBe(700_000);
    expect(p.metrics.returnedToIndia).toBe(true);
  });

  it('extra costs (coaching, one-time) are today’s INR inflated to their year', () => {
    const p = projectPlan(
      base({
        inflation: { education: 0, general: 0.1, abroad: {} },
        extraCosts: [{ year: 2, amountInr: 10_000, kind: 'coaching' }],
      }),
    );
    expect(p.years[1]?.otherCosts).toBeCloseTo(11_000, 6);
  });

  it('rejects an FX rate missing for a foreign currency', () => {
    expect(() =>
      projectPlan(
        base({
          stages: [
            { years: 1, currency: 'USD', tuitionAnnual: 1, livingAnnual: 0, oneTimeAtStart: 0 },
          ],
        }),
      ),
    ).toThrow(/FX rate for USD/);
  });
});
