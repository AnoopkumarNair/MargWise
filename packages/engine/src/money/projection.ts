import type { CurrencyCode, TaxRegimeRules } from '@margwise/contracts';
import { loanSchedule, type LoanInput } from './loans.ts';
import { incomeTax, section129Saving } from './tax.ts';

export interface StudyStage {
  years: number;
  currency: CurrencyCode;
  /** Annual tuition at today's prices, in the stage currency. */
  tuitionAnnual: number;
  /** Annual living cost at today's prices, in the stage currency. */
  livingAnnual: number;
  /** One-time cost at the start of the stage (visa, travel, deposits), today's prices. */
  oneTimeAtStart: number;
}

export interface WorkPhase {
  location: 'india' | 'abroad';
  currency: CurrencyCode;
  /** Annual gross pay a starter earns today, in the work currency. */
  startGrossToday: number;
  /** Nominal annual pay growth once working (career ladder). */
  growth: number;
  /** AI adjustment δ: yearly drag on gross pay growth (03 §3.6). */
  aiDelta: number;
  /** Abroad only: effective tax rate (assumption range per country, 03 §3.6). */
  effectiveTaxRate: number;
  /** Annual living cost in the work location at today's prices. */
  livingAnnualToday: number;
}

export interface PlanInputs {
  startAge: number;
  /** 35 in the alpha (03 §3.1). */
  horizonAge: number;
  /** Years before study starts (e.g. a repeat year for an entrance exam). */
  gapYears: number;
  /** Cost of each gap year in today's INR (coaching, living at home). */
  gapYearCostInr: number;
  stages: StudyStage[];
  work: WorkPhase;
  /** Return-to-India (or policy-shock) switch after some years of work. */
  switchTo?: { afterWorkYears: number; work: WorkPhase };
  inflation: { education: number; general: number; abroad: Partial<Record<CurrencyCode, number>> };
  /** Dated base rates from the release; INR depreciation per year (03 §3.4). */
  fx: { inrPerUnit: Partial<Record<CurrencyCode, number>>; depreciation: number };
  loan?: {
    amount: number;
    annualRate: number;
    tenureYears: number;
    moratoriumMonthsAfterCourse: number;
    serviceInterest: boolean;
    subvention?: LoanInput['subvention'];
  };
  /** Coaching and one-time costs in today's INR, by plan year (1-based). */
  extraCosts: ReadonlyArray<{ year: number; amountInr: number; kind: 'coaching' | 'one_time' }>;
  tax: {
    /** Regime used for the young earner's in-hand pay in India (new regime, 03 §3.6). */
    earner: TaxRegimeRules;
    parentOld: TaxRegimeRules;
    parentRegime: 'new' | 'old' | 'not_sure';
    parentGross: number;
    section129MaxYears: number;
  };
  /** Family discount rate r (03 §3.9). */
  discountRate: number;
}

export interface YearRow {
  /** Plan year, 1-based. */
  year: number;
  age: number;
  phase: 'gap' | 'study' | 'work';
  location: 'india' | 'abroad' | null;
  fx: number;
  studyCost: number;
  loanDisbursed: number;
  outOfPocket: number;
  otherCosts: number;
  gross: number;
  inHand: number;
  livingAfterWork: number;
  loanPayment: number;
  loanInterestPaid: number;
  taxSaving129: number;
  cashFlow: number;
}

export interface Projection {
  years: YearRow[];
  npv: number;
  metrics: {
    totalStudyCost: number;
    totalOutOfPocket: number;
    loanPrincipal: number;
    capitalisedInterest: number;
    emi: number;
    debtFreeAge: number | null;
    /** Largest yearly loan payment ÷ in-hand pay in repayment years; Infinity if a payment falls in a year with no pay. */
    peakEmiShare: number;
    yearsUntilFirstSalary: number;
    returnedToIndia: boolean;
  };
}

/**
 * Deterministic projection of one plan (03 §3.4–3.9): nominal INR per year,
 * t = 1 … H with H = horizonAge − startAge. Prices are "today" in year 1 and
 * inflate from year 2. Loan-financed costs reach the family only through loan
 * payments, never twice. The household is one pot.
 */
export function projectPlan(p: PlanInputs): Projection {
  const H = p.horizonAge - p.startAge;
  const rateOf = (c: CurrencyCode) => {
    if (c === 'INR') return 1;
    const r = p.fx.inrPerUnit[c];
    if (r === undefined) throw new Error(`Missing FX rate for ${c}`);
    return r;
  };
  const fxAt = (c: CurrencyCode, t: number) =>
    c === 'INR' ? 1 : rateOf(c) * (1 + p.fx.depreciation) ** (t - 1);
  const inflationOf = (c: CurrencyCode) =>
    c === 'INR' ? p.inflation.general : (p.inflation.abroad[c] ?? p.inflation.general);
  const grow = (rate: number, t: number) => (1 + rate) ** (t - 1);

  // Timeline
  const studyYears = p.stages.reduce((n, s) => n + s.years, 0);
  const firstStudyYear = p.gapYears + 1;
  const firstWorkYear = p.gapYears + studyYears + 1;
  const stageAt = (t: number) => {
    let start = firstStudyYear;
    for (const s of p.stages) {
      if (t < start + s.years) return { stage: s, first: t === start };
      start += s.years;
    }
    return undefined;
  };

  // Costs per year (before financing)
  const studyCost: number[] = [];
  for (let t = 1; t <= H; t++) {
    const at = t >= firstStudyYear ? stageAt(t) : undefined;
    if (!at) {
      studyCost.push(0);
      continue;
    }
    const { stage, first } = at;
    const local =
      stage.tuitionAnnual * grow(p.inflation.education, t) +
      stage.livingAnnual * grow(inflationOf(stage.currency), t) +
      (first ? stage.oneTimeAtStart * grow(inflationOf(stage.currency), t) : 0);
    studyCost.push(local * fxAt(stage.currency, t));
  }

  // Loan: disbursed at the start of each study year until exhausted.
  const disbursed: number[] = Array.from({ length: H }, () => 0);
  let schedule: ReturnType<typeof loanSchedule> | undefined;
  if (p.loan && p.loan.amount > 0) {
    let remaining = p.loan.amount;
    for (let t = firstStudyYear; t < firstWorkYear && remaining > 0; t++) {
      const take = Math.min(remaining, studyCost[t - 1] as number);
      disbursed[t - 1] = take;
      remaining -= take;
    }
    schedule = loanSchedule({
      disbursements: disbursed
        .map((amount, i) => ({ month: i * 12, amount }))
        .filter((d) => d.amount > 0),
      annualRate: p.loan.annualRate,
      repaymentStartMonth: (firstWorkYear - 1) * 12 + p.loan.moratoriumMonthsAfterCourse,
      tenureMonths: p.loan.tenureYears * 12,
      serviceInterestDuringMoratorium: p.loan.serviceInterest,
      ...(p.loan.subvention ? { subvention: p.loan.subvention } : {}),
    });
  }

  const years: YearRow[] = [];
  let firstInterestYear: number | undefined;
  let returned = false;
  for (let t = 1; t <= H; t++) {
    const phase: YearRow['phase'] =
      t < firstStudyYear ? 'gap' : t < firstWorkYear ? 'study' : 'work';
    const workIndex = t - firstWorkYear;
    const switched =
      p.switchTo !== undefined && phase === 'work' && workIndex >= p.switchTo.afterWorkYears;
    const work = switched && p.switchTo ? p.switchTo.work : p.work;
    if (switched) returned = true;
    // Years worked in the current job (restarts after a switch).
    const k = switched && p.switchTo ? workIndex - p.switchTo.afterWorkYears : workIndex;

    let gross = 0;
    let inHand = 0;
    let livingAfterWork = 0;
    const fx = fxAt(work.currency, t);
    if (phase === 'work') {
      const startYear = t - k;
      gross =
        work.startGrossToday *
        grow(inflationOf(work.currency), startYear) *
        (1 + work.growth - work.aiDelta) ** k;
      inHand =
        work.location === 'india'
          ? gross - incomeTax(gross, p.tax.earner).total
          : gross * (1 - work.effectiveTaxRate) * fx;
      livingAfterWork = work.livingAnnualToday * grow(inflationOf(work.currency), t) * fx;
    }

    const cost = studyCost[t - 1] as number;
    const fromLoan = disbursed[t - 1] as number;
    const outOfPocket = cost - fromLoan;
    const gapCost = phase === 'gap' ? p.gapYearCostInr * grow(p.inflation.general, t) : 0;
    const extra = p.extraCosts
      .filter((e) => e.year === t)
      .reduce((s, e) => s + e.amountInr * grow(p.inflation.general, t), 0);
    const loanRow = schedule?.yearly[t - 1];
    const loanPayment = loanRow?.payment ?? 0;
    const loanInterestPaid = loanRow?.interestPaid ?? 0;
    if (loanInterestPaid > 0 && firstInterestYear === undefined) firstInterestYear = t;
    const taxSaving129 = section129Saving(
      {
        interestPaid: loanInterestPaid,
        parentGross: p.tax.parentGross,
        regime: p.tax.parentRegime,
        yearIndex: firstInterestYear === undefined ? 0 : t - firstInterestYear + 1,
        maxYears: p.tax.section129MaxYears,
      },
      p.tax.parentOld,
    );

    const cashFlow =
      inHand - livingAfterWork - outOfPocket - gapCost - extra - loanPayment + taxSaving129;
    years.push({
      year: t,
      age: p.startAge + t - 1,
      phase,
      location: phase === 'work' ? work.location : null,
      fx,
      studyCost: cost,
      loanDisbursed: fromLoan,
      outOfPocket,
      otherCosts: gapCost + extra,
      gross,
      inHand,
      livingAfterWork,
      loanPayment,
      loanInterestPaid,
      taxSaving129,
      cashFlow,
    });
  }

  const npv = years.reduce((s, y) => s + y.cashFlow / (1 + p.discountRate) ** y.year, 0);
  const repayStartYear = schedule
    ? Math.floor(((firstWorkYear - 1) * 12 + (p.loan?.moratoriumMonthsAfterCourse ?? 0)) / 12) + 1
    : Infinity;
  const emiShares = years
    .filter((y) => y.year >= repayStartYear && y.loanPayment > 0)
    .map((y) => (y.inHand > 0 ? y.loanPayment / y.inHand : Infinity));

  return {
    years,
    npv,
    metrics: {
      totalStudyCost: studyCost.reduce((a, b) => a + b, 0),
      totalOutOfPocket: years.reduce((s, y) => s + y.outOfPocket, 0),
      loanPrincipal: disbursed.reduce((a, b) => a + b, 0),
      capitalisedInterest: schedule?.capitalisedInterest ?? 0,
      emi: schedule?.emi ?? 0,
      debtFreeAge: schedule ? p.startAge + schedule.debtFreeMonth / 12 : null,
      peakEmiShare: emiShares.length ? Math.max(...emiShares) : 0,
      yearsUntilFirstSalary: firstWorkYear - 1,
      returnedToIndia: returned,
    },
  };
}
