import type { CompareBounds } from '@margwise/contracts';
import type { z } from 'zod';

type Bounds = Pick<
  z.infer<typeof CompareBounds>,
  'npvP50' | 'npvP10' | 'peakEmiShare' | 'yearsToFirstSalary'
>;
type Bound = { min: number; max: number };

/** The six priorities ranked separately by the teen and by the parent (03 §3.11). */
export const PRIORITIES = [
  'fit',
  'moneyP50',
  'safetyP10',
  'debtPressure',
  'distance',
  'yearsToFirstSalary',
] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface PlanOutcome {
  planId: string;
  /** TraitFit 0–1. */
  fit: number;
  npvP50: number;
  npvP10: number;
  /** Peak EMI ÷ in-hand pay (P50). */
  peakEmiShare: number;
  distance: 'home' | 'other_indian_city' | 'abroad';
  yearsToFirstSalary: number;
}

/** Rank-order-centroid weights: w_k = (1/n) Σ_{i=k..n} 1/i. */
export function rocWeights(n: number): number[] {
  return Array.from({ length: n }, (_, k) => {
    let s = 0;
    for (let i = k + 1; i <= n; i++) s += 1 / i;
    return s / n;
  });
}

/** Fixed-range normalisation to 0–1 (clamped); `lower` inverts so higher is always better. */
export function normalise(
  value: number,
  { min, max }: Bound,
  direction: 'higher' | 'lower',
): number {
  const x = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return direction === 'higher' ? x : 1 - x;
}

const DISTANCE_SCORE = { home: 1, other_indian_city: 0.5, abroad: 0 } as const;

function normalised(plan: PlanOutcome, bounds: Bounds): Record<Priority, number> {
  return {
    fit: normalise(plan.fit, { min: 0, max: 1 }, 'higher'),
    moneyP50: normalise(plan.npvP50, bounds.npvP50, 'higher'),
    safetyP10: normalise(plan.npvP10, bounds.npvP10, 'higher'),
    debtPressure: normalise(plan.peakEmiShare, bounds.peakEmiShare, 'lower'),
    distance: DISTANCE_SCORE[plan.distance],
    yearsToFirstSalary: normalise(plan.yearsToFirstSalary, bounds.yearsToFirstSalary, 'lower'),
  };
}

export interface LensScore {
  score: number;
  contributions: Record<Priority, number>;
}

function lensScore(values: Record<Priority, number>, ranking: readonly Priority[]): LensScore {
  if (
    ranking.length !== PRIORITIES.length ||
    new Set(ranking).size !== PRIORITIES.length ||
    !PRIORITIES.every((p) => ranking.includes(p))
  ) {
    throw new Error('A ranking must be a permutation of the six priorities');
  }
  const weights = rocWeights(ranking.length);
  const contributions = Object.fromEntries(
    ranking.map((p, i) => [p, (weights[i] as number) * values[p]]),
  ) as Record<Priority, number>;
  return { score: Object.values(contributions).reduce((a, b) => a + b, 0), contributions };
}

/**
 * Scores every plan under the teen's and the parent's rankings. The two lenses
 * are returned side by side and never averaged (03 §3.11).
 */
export function compareLenses(
  plans: readonly PlanOutcome[],
  rankings: { teen: readonly Priority[]; parent: readonly Priority[] },
  bounds: Bounds,
): Array<{ planId: string; teen: LensScore; parent: LensScore }> {
  return plans.map((plan) => {
    const values = normalised(plan, bounds);
    return {
      planId: plan.planId,
      teen: lensScore(values, rankings.teen),
      parent: lensScore(values, rankings.parent),
    };
  });
}
