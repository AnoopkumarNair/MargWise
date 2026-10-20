import type { TaxRegimeRules } from '@margwise/contracts';
import { describe, expect, it } from 'vitest';
import { rocWeights } from '../compare/compare.ts';
import { emi, loanSchedule } from '../money/loans.ts';
import { projectPlan, type PlanInputs } from '../money/projection.ts';
import { incomeTax, section129Saving } from '../money/tax.ts';
import golden from './golden-cases.json' with { type: 'json' };

/**
 * Golden cases (03 §3.13). Expected values are spreadsheet formulas in
 * docs/golden/golden-cases.xlsx, independent of this code. Rule 8: never edit
 * an expected value to make a test pass — if a case looks wrong, stop and ask.
 */
type Case = {
  id: string;
  category: string;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
};
const cases = golden.cases as Case[];
const rules = golden.rules as unknown as { new: TaxRegimeRules; old: TaxRegimeRules };

function within(actual: number, expected: number) {
  const tol = Math.max(
    golden.tolerance.absoluteInr,
    Math.abs(expected) * golden.tolerance.relative,
  );
  expect(
    Math.abs(actual - expected),
    `actual ${actual} vs expected ${expected}`,
  ).toBeLessThanOrEqual(tol);
}
const byCategory = (c: string) =>
  cases.filter((x) => x.category === c).map((x) => [x.id, x] as const);
const num = (v: unknown) => v as number;

describe('golden workbook status', () => {
  it('is marked draft until Anu approves it (STOP 2)', () => {
    expect(golden.status).toBe('draft-awaiting-approval');
    expect(cases.length).toBeGreaterThanOrEqual(36);
  });
});

describe.each(byCategory('tax'))('tax %s', (_id, c) => {
  it('matches', () => {
    const base = rules[c.inputs.regime as 'new' | 'old'];
    const r: TaxRegimeRules = {
      ...base,
      rebate: { ...base.rebate, ...(c.inputs.marginalRelief ? { marginalRelief: true } : {}) },
    };
    within(incomeTax(num(c.inputs.gross), r).total, num(c.expected.total));
  });
});

describe.each(byCategory('emi'))('emi %s', (_id, c) => {
  it('matches', () =>
    within(
      emi(num(c.inputs.principal), num(c.inputs.annualRate), num(c.inputs.months)),
      num(c.expected.emi),
    ));
});

describe.each(byCategory('moratorium'))('moratorium %s', (_id, c) => {
  it('matches capitalised interest, principal and EMI', () => {
    const i = c.inputs;
    const subvention =
      i.subvention === 'full'
        ? { kind: 'full' as const }
        : i.subvention === 'rate'
          ? { kind: 'rate_reduction' as const, reduction: num(i.reduction) }
          : undefined;
    const s = loanSchedule({
      disbursements: [
        { month: num(i.d1_month), amount: num(i.d1_amount) },
        { month: num(i.d2_month), amount: num(i.d2_amount) },
      ],
      annualRate: num(i.annual_rate),
      repaymentStartMonth: num(i.repay_month),
      tenureMonths: num(i.tenure_months),
      serviceInterestDuringMoratorium: false,
      ...(subvention ? { subvention } : {}),
    });
    within(s.capitalisedInterest, num(c.expected.capitalised));
    within(s.principalAtRepayment, num(c.expected.principalAtRepayment));
    within(s.emi, num(c.expected.emi));
  });
});

describe.each(byCategory('section129'))('section 129 %s', (_id, c) => {
  it('matches', () => {
    const i = c.inputs;
    const saving = section129Saving(
      {
        interestPaid: num(i.interestPaid),
        parentGross: num(i.parentGross),
        regime: i.regime as 'old' | 'new' | 'not_sure',
        yearIndex: num(i.yearIndex),
        maxYears: num(i.maxYears),
      },
      rules.old,
    );
    within(saving, num(c.expected.saving));
  });
});

describe.each(byCategory('fx'))('fx %s', (_id, c) => {
  it('matches the engine FX path through a one-line projection', () => {
    const year = num(c.inputs.year);
    const p = projectPlan({
      startAge: 17,
      horizonAge: 17 + year,
      gapYears: year - 1,
      gapYearCostInr: 0,
      stages: [
        {
          years: 1,
          currency: 'EUR',
          tuitionAnnual: num(c.inputs.amountLocal),
          livingAnnual: 0,
          oneTimeAtStart: 0,
        },
      ],
      work: {
        location: 'india',
        currency: 'INR',
        startGrossToday: 0,
        growth: 0,
        aiDelta: 0,
        effectiveTaxRate: 0,
        livingAnnualToday: 0,
      },
      inflation: { education: 0, general: 0, abroad: { EUR: 0 } },
      fx: { inrPerUnit: { EUR: num(c.inputs.base) }, depreciation: num(c.inputs.depreciation) },
      extraCosts: [],
      tax: {
        earner: rules.new,
        parentOld: rules.old,
        parentRegime: 'new',
        parentGross: 0,
        section129MaxYears: 8,
      },
      discountRate: 0,
    });
    within(p.years[year - 1]?.studyCost ?? NaN, num(c.expected.inr));
  });
});

describe.each(byCategory('roc'))('%s', (_id, c) => {
  it('matches the spreadsheet weights', () => {
    const expected = c.expected.weights as number[];
    rocWeights(num(c.inputs.n)).forEach((w, k) => expect(w).toBeCloseTo(expected[k] as number, 12));
  });
});

function planFrom(i: Record<string, number>): PlanInputs {
  const stageCurrency = i.stage_currency_fx === 1 ? 'INR' : 'EUR';
  const workCurrency = i.work_fx === 1 ? 'INR' : 'EUR';
  const eurRate = i.stage_currency_fx !== 1 ? i.stage_currency_fx : i.work_fx;
  return {
    startAge: i.start_age as number,
    horizonAge: i.horizon_age as number,
    gapYears: i.gap_years as number,
    gapYearCostInr: i.gap_year_cost_inr as number,
    stages: [
      {
        years: i.stage_years as number,
        currency: stageCurrency,
        tuitionAnnual: i.tuition as number,
        livingAnnual: i.living as number,
        oneTimeAtStart: i.one_time as number,
      },
    ],
    work: {
      location: i.work_india === 1 ? 'india' : 'abroad',
      currency: workCurrency,
      startGrossToday: i.start_gross_today as number,
      growth: i.growth as number,
      aiDelta: i.ai_delta as number,
      effectiveTaxRate: i.effective_tax_rate as number,
      livingAnnualToday: i.living_after_today as number,
    },
    ...((i.switch_after_years as number) < 99
      ? {
          switchTo: {
            afterWorkYears: i.switch_after_years as number,
            work: {
              location: 'india',
              currency: 'INR',
              startGrossToday: i.ret_start_gross_today as number,
              growth: i.ret_growth as number,
              aiDelta: 0,
              effectiveTaxRate: 0,
              livingAnnualToday: i.ret_living_today as number,
            },
          },
        }
      : {}),
    inflation: {
      education: i.infl_education as number,
      general: i.infl_general as number,
      abroad: { EUR: i.infl_stage_local as number },
    },
    fx: {
      inrPerUnit: eurRate === 1 ? {} : { EUR: eurRate as number },
      depreciation: i.fx_depreciation as number,
    },
    ...((i.loan_amount as number) > 0
      ? {
          loan: {
            amount: i.loan_amount as number,
            annualRate: i.loan_rate as number,
            tenureYears: i.loan_tenure_years as number,
            moratoriumMonthsAfterCourse: i.loan_moratorium_months as number,
            serviceInterest: i.loan_serviced === 1,
          },
        }
      : {}),
    extraCosts: [],
    tax: {
      earner: rules.new,
      parentOld: rules.old,
      parentRegime: i.parent_old_regime === 1 ? 'old' : 'new',
      parentGross: i.parent_gross as number,
      section129MaxYears: i.s129_max_years as number,
    },
    discountRate: i.discount_rate as number,
  };
}

describe.each(byCategory('npv'))('deterministic NPV %s (inputs at "likely")', (_id, c) => {
  it('matches the spreadsheet projection', () => {
    within(projectPlan(planFrom(c.inputs as Record<string, number>)).npv, num(c.expected.npv));
  });
});
