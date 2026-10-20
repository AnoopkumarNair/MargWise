import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compareLenses,
  normalise,
  rocWeights,
  type PlanOutcome,
  type Priority,
} from './compare.ts';

describe('rocWeights (rank-order centroid, 03 §3.11)', () => {
  it('six ranks → 0.408, 0.242, 0.158, 0.103, 0.061, 0.028', () => {
    expect(rocWeights(6).map((w) => Number(w.toFixed(3)))).toEqual([
      0.408, 0.242, 0.158, 0.103, 0.061, 0.028,
    ]);
  });

  it('property: weights sum to 1 and strictly decrease', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (n) => {
        const w = rocWeights(n);
        return (
          Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12 &&
          w.every((x, i) => i === 0 || x < (w[i - 1] as number))
        );
      }),
    );
  });
});

describe('normalise (fixed range from the release bounds)', () => {
  it('maps the range to 0–1 and clamps outside it', () => {
    expect(normalise(5, { min: 0, max: 10 }, 'higher')).toBe(0.5);
    expect(normalise(-3, { min: 0, max: 10 }, 'higher')).toBe(0);
    expect(normalise(30, { min: 0, max: 10 }, 'higher')).toBe(1);
  });

  it('inverts for criteria where lower is better', () => {
    expect(normalise(2, { min: 0, max: 10 }, 'lower')).toBeCloseTo(0.8, 12);
  });
});

describe('compareLenses — teen and parent side by side, never averaged', () => {
  const bounds = {
    npvP50: { min: -5_000_000, max: 20_000_000 },
    npvP10: { min: -10_000_000, max: 10_000_000 },
    peakEmiShare: { min: 0, max: 1 },
    yearsToFirstSalary: { min: 0, max: 10 },
  };
  const plans: PlanOutcome[] = [
    {
      planId: 'design-uk',
      fit: 0.9,
      npvP50: 2_000_000,
      npvP10: -3_000_000,
      peakEmiShare: 0.6,
      distance: 'abroad',
      yearsToFirstSalary: 4,
    },
    {
      planId: 'bcom-home',
      fit: 0.4,
      npvP50: 9_000_000,
      npvP10: 4_000_000,
      peakEmiShare: 0,
      distance: 'home',
      yearsToFirstSalary: 3,
    },
  ];
  const teen: Priority[] = [
    'fit',
    'distance',
    'moneyP50',
    'safetyP10',
    'debtPressure',
    'yearsToFirstSalary',
  ];
  const parent: Priority[] = [
    'safetyP10',
    'debtPressure',
    'moneyP50',
    'distance',
    'yearsToFirstSalary',
    'fit',
  ];

  it('scores each plan under each lens separately', () => {
    const result = compareLenses(plans, { teen, parent }, bounds);
    const uk = result.find((r) => r.planId === 'design-uk');
    const home = result.find((r) => r.planId === 'bcom-home');
    expect(uk && home && uk.teen.score > home.teen.score).toBe(false); // distance weighs heavily for this teen
    expect(home && uk && home.parent.score > uk.parent.score).toBe(true);
    expect(Object.keys(uk ?? {}).sort()).toEqual(['parent', 'planId', 'teen']);
  });

  it('explains each score by criterion contribution (weights × normalised values sum to the score)', () => {
    const [first] = compareLenses(plans, { teen, parent }, bounds);
    const sum = Object.values(first?.teen.contributions ?? {}).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(first?.teen.score ?? NaN, 12);
  });

  it('rejects a ranking that is not a permutation of the six priorities', () => {
    expect(() =>
      compareLenses(
        plans,
        { teen: ['fit', 'fit', 'moneyP50', 'safetyP10', 'debtPressure', 'distance'], parent },
        bounds,
      ),
    ).toThrow(/permutation/);
  });

  it('distance is ordinal: home < other Indian city < abroad', () => {
    const one = (distance: PlanOutcome['distance']) =>
      compareLenses(
        [{ ...plans[1], planId: distance, distance } as PlanOutcome],
        {
          teen: ['distance', 'fit', 'moneyP50', 'safetyP10', 'debtPressure', 'yearsToFirstSalary'],
          parent,
        },
        bounds,
      )[0]?.teen.contributions.distance ?? NaN;
    expect(one('home')).toBeGreaterThan(one('other_indian_city'));
    expect(one('other_indian_city')).toBeGreaterThan(one('abroad'));
  });
});
