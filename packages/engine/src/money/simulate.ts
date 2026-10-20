import type { CurrencyCode, NumericRange } from '@margwise/contracts';
import { createRng, percentile, triangular, type Rng } from '../shared/random.ts';
import {
  projectPlan,
  type PlanInputs,
  type Projection,
  type StudyStage,
  type WorkPhase,
} from './projection.ts';

type R = NumericRange;

export interface WorkSpec {
  location: WorkPhase['location'];
  currency: CurrencyCode;
  startGrossToday: R;
  growth: R;
  aiDelta: R;
  effectiveTaxRate: R;
  livingAnnualToday: R;
}

export interface StageSpec {
  years: number;
  currency: CurrencyCode;
  tuitionAnnual: R;
  livingAnnual: R;
  oneTimeAtStart: R;
}

/** Scenario probabilities (03 §3.7). Core = 1 − the sum. All visible and editable. */
export interface ScenarioProbabilities {
  fallback: number;
  repeatYear: number;
  returnToIndia: number;
  policyShock: number;
}
export type Scenario = 'core' | keyof ScenarioProbabilities;

export interface PlanSpec {
  startAge: number;
  horizonAge: number;
  stages: StageSpec[];
  work: WorkSpec;
  /** Adjacent role with its own pay range (03 §3.7 "Fallback"). */
  fallbackWork: WorkSpec;
  /** Abroad plans: pay and living if the graduate returns to India. */
  returnToIndia?: { afterWorkYears: number; work: WorkSpec };
  /** A dated proposed/announced policy item (05 §5.3) applied with its probability. */
  policyShock?: { extraCostInr?: R; workRightsYears?: number };
  scenarios: ScenarioProbabilities;
  repeatYearCostInr: R;
  inflation: { education: R; general: R; abroad: Partial<Record<CurrencyCode, R>> };
  fx: { inrPerUnit: Partial<Record<CurrencyCode, number>>; depreciation: R };
  loan?: Omit<NonNullable<PlanInputs['loan']>, 'annualRate'> & { annualRate: R };
  extraCosts: PlanInputs['extraCosts'];
  tax: PlanInputs['tax'];
  discountRate: number;
}

/** 03 §3.12. Methodology limits, not facts. */
export const SANITY_LIMITS = {
  npvP50Min: -20_000_000,
  npvP50Max: 100_000_000,
  maxEmiShare: 1,
} as const;

/** Shares above this are reported at this value and flagged (never Infinity). */
const EMI_SHARE_CAP = 10;

export type CheckInput = 'npv_out_of_range' | 'emi_exceeds_in_hand' | 'negative_input';

export interface SimulationResult {
  deterministic: Projection;
  npv: { p10: number; p50: number; p90: number };
  peakEmiShareP50: number;
  shareFuturesEmiAbove40: number;
  returnShare: number;
  scenarioShares: Record<Scenario, number>;
  draws: number;
  seed: number;
  checkInputs: CheckInput[];
}

const likely = (r: R) => r.likely;

function work(w: WorkSpec, pick: (r: R) => number): WorkPhase {
  return {
    location: w.location,
    currency: w.currency,
    startGrossToday: pick(w.startGrossToday),
    growth: pick(w.growth),
    aiDelta: pick(w.aiDelta),
    effectiveTaxRate: pick(w.effectiveTaxRate),
    livingAnnualToday: pick(w.livingAnnualToday),
  };
}

/** Builds concrete inputs for one scenario, sampling each range with `pick`. */
export function buildInputs(
  spec: PlanSpec,
  scenario: Scenario,
  pick: (r: R) => number,
): PlanInputs {
  const stages: StudyStage[] = spec.stages.map((s) => ({
    years: s.years,
    currency: s.currency,
    tuitionAnnual: pick(s.tuitionAnnual),
    livingAnnual: pick(s.livingAnnual),
    oneTimeAtStart: pick(s.oneTimeAtStart),
  }));
  const extraCosts = [...spec.extraCosts];
  let switchTo: PlanInputs['switchTo'];
  const studyYears = spec.stages.reduce((n, s) => n + s.years, 0);
  const gapYears = scenario === 'repeatYear' ? 1 : 0;

  if (scenario === 'returnToIndia' && spec.returnToIndia) {
    switchTo = {
      afterWorkYears: spec.returnToIndia.afterWorkYears,
      work: work(spec.returnToIndia.work, pick),
    };
  }
  if (scenario === 'policyShock' && spec.policyShock) {
    if (spec.policyShock.extraCostInr) {
      extraCosts.push({
        year: gapYears + studyYears + 1,
        amountInr: pick(spec.policyShock.extraCostInr),
        kind: 'one_time',
      });
    }
    if (spec.policyShock.workRightsYears !== undefined && spec.returnToIndia) {
      switchTo = {
        afterWorkYears: spec.policyShock.workRightsYears,
        work: work(spec.returnToIndia.work, pick),
      };
    }
  }

  const abroadInflation: PlanInputs['inflation']['abroad'] = {};
  for (const [c, r] of Object.entries(spec.inflation.abroad))
    abroadInflation[c as CurrencyCode] = pick(r as R);

  return {
    startAge: spec.startAge,
    horizonAge: spec.horizonAge,
    gapYears,
    gapYearCostInr: scenario === 'repeatYear' ? pick(spec.repeatYearCostInr) : 0,
    stages,
    work: work(scenario === 'fallback' ? spec.fallbackWork : spec.work, pick),
    ...(switchTo ? { switchTo } : {}),
    inflation: {
      education: pick(spec.inflation.education),
      general: pick(spec.inflation.general),
      abroad: abroadInflation,
    },
    fx: { inrPerUnit: spec.fx.inrPerUnit, depreciation: pick(spec.fx.depreciation) },
    ...(spec.loan ? { loan: { ...spec.loan, annualRate: pick(spec.loan.annualRate) } } : {}),
    extraCosts,
    tax: spec.tax,
    discountRate: spec.discountRate,
  };
}

function drawScenario(p: ScenarioProbabilities, rng: Rng): Scenario {
  const u = rng();
  let acc = 0;
  for (const s of ['fallback', 'repeatYear', 'returnToIndia', 'policyShock'] as const) {
    acc += p[s];
    if (u < acc) return s;
  }
  return 'core';
}

function hasNegative(spec: PlanSpec): boolean {
  const ranges: R[] = [
    spec.repeatYearCostInr,
    ...spec.stages.flatMap((s) => [s.tuitionAnnual, s.livingAnnual, s.oneTimeAtStart]),
    ...[
      spec.work,
      spec.fallbackWork,
      ...(spec.returnToIndia ? [spec.returnToIndia.work] : []),
    ].flatMap((w) => [w.startGrossToday, w.livingAnnualToday]),
  ];
  return ranges.some((r) => r.low < 0) || spec.extraCosts.some((e) => e.amountInr < 0);
}

const finiteShare = (x: number) =>
  Number.isFinite(x) ? Math.min(x, EMI_SHARE_CAP) : EMI_SHARE_CAP;

/**
 * Seeded Monte Carlo over one plan (03 §3.10): `draws` simulations, each with
 * triangular draws for every ranged input, one scenario by probability and its
 * own FX path. Returns P10/P50/P90 family NPV and the 03 §3.1 outputs.
 */
export function simulatePlan(
  spec: PlanSpec,
  opts: { draws: number; seed: number },
): SimulationResult {
  const probs = Object.values(spec.scenarios);
  if (probs.some((p) => p < 0 || p > 1) || probs.reduce((a, b) => a + b, 0) > 1 + 1e-9) {
    throw new Error('Scenario probabilities must each be within 0–1 and sum to at most 1');
  }
  const rng = createRng(opts.seed);
  const pick = (r: R) => triangular(r, rng);
  const npvs: number[] = [];
  const shares: number[] = [];
  const counts: Record<Scenario, number> = {
    core: 0,
    fallback: 0,
    repeatYear: 0,
    returnToIndia: 0,
    policyShock: 0,
  };
  let returned = 0;

  for (let i = 0; i < opts.draws; i++) {
    const scenario = drawScenario(spec.scenarios, rng);
    counts[scenario] += 1;
    const projection = projectPlan(buildInputs(spec, scenario, pick));
    npvs.push(projection.npv);
    shares.push(finiteShare(projection.metrics.peakEmiShare));
    if (projection.metrics.returnedToIndia) returned += 1;
  }

  const deterministic = projectPlan(buildInputs(spec, 'core', likely));
  deterministic.metrics.peakEmiShare = finiteShare(deterministic.metrics.peakEmiShare);
  const npv = {
    p10: percentile(npvs, 0.1),
    p50: percentile(npvs, 0.5),
    p90: percentile(npvs, 0.9),
  };
  const peakEmiShareP50 = percentile(shares, 0.5);

  const checkInputs: CheckInput[] = [];
  if (npv.p50 < SANITY_LIMITS.npvP50Min || npv.p50 > SANITY_LIMITS.npvP50Max)
    checkInputs.push('npv_out_of_range');
  if (
    peakEmiShareP50 > SANITY_LIMITS.maxEmiShare ||
    deterministic.metrics.peakEmiShare > SANITY_LIMITS.maxEmiShare
  )
    checkInputs.push('emi_exceeds_in_hand');
  if (hasNegative(spec)) checkInputs.push('negative_input');

  return {
    deterministic,
    npv,
    peakEmiShareP50,
    shareFuturesEmiAbove40: shares.filter((s) => s > 0.4).length / opts.draws,
    returnShare: returned / opts.draws,
    scenarioShares: Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v / opts.draws]),
    ) as Record<Scenario, number>,
    draws: opts.draws,
    seed: opts.seed,
    checkInputs,
  };
}
