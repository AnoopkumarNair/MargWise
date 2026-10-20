import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  explainMatch,
  matchBand,
  matchCareers,
  pearson,
  teenView,
  traitFit,
  type Profile,
} from './matching.ts';

const P = (R: number, I: number, A: number, S: number, E: number, C: number): Profile => ({
  R,
  I,
  A,
  S,
  E,
  C,
});

// Fixture vectors only (arbitrary values, not O*NET data; rule 1).
const TEEN_ARTISTIC = P(10, 5, 38, 30, 20, 8);
const SOFTWARE_LIKE = P(2.5, 6.5, 2.5, 2.0, 2.5, 5.0);

describe('pearson (03 §2.5, hand-computed cases from 03 §2.6)', () => {
  it('r = +1 for a positive linear transform', () => {
    const u = P(10, 20, 30, 40, 5, 15);
    expect(pearson(u, P(21, 41, 61, 81, 11, 31))).toBeCloseTo(1, 12);
  });

  it('r = −1 for a negative linear transform', () => {
    const u = P(10, 20, 30, 40, 5, 15);
    expect(pearson(u, P(40, 30, 20, 10, 45, 35))).toBeCloseTo(-1, 12);
  });

  it('Artistic-high / Investigative-low teen vs a software-like profile is clearly negative (hand-computed)', () => {
    expect(pearson(TEEN_ARTISTIC, SOFTWARE_LIKE)).toBeCloseTo(HAND.teenVsSoftware.r, 6);
  });

  it('is undefined (null) when either profile is flat', () => {
    expect(pearson(P(20, 20, 20, 20, 20, 20), SOFTWARE_LIKE)).toBeNull();
    expect(pearson(TEEN_ARTISTIC, P(3, 3, 3, 3, 3, 3))).toBeNull();
  });

  const area = () => fc.double({ min: 0, max: 40, noNaN: true });
  const profile = fc
    .tuple(area(), area(), area(), area(), area(), area())
    .map(([R, I, A, S, E, C]) => P(R, I, A, S, E, C));
  const spread = (p: Profile) =>
    Math.max(...Object.values(p)) - Math.min(...Object.values(p)) > 1e-6;

  it('property: shift and positive-scale invariant (03 §2.6)', () => {
    fc.assert(
      fc.property(
        profile,
        profile,
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        (u, v, shift, scale) => {
          fc.pre(spread(u) && spread(v));
          const moved = Object.fromEntries(
            Object.entries(u).map(([k, x]) => [k, x * scale + shift]),
          ) as Profile;
          return Math.abs((pearson(moved, v) as number) - (pearson(u, v) as number)) < 1e-9;
        },
      ),
    );
  });

  it('property: symmetric and bounded in [−1, 1]', () => {
    fc.assert(
      fc.property(profile, profile, (u, v) => {
        fc.pre(spread(u) && spread(v));
        const r = pearson(u, v) as number;
        return r >= -1 && r <= 1 && Math.abs(r - (pearson(v, u) as number)) < 1e-12;
      }),
    );
  });
});

describe('traitFit = ½(1 + r)', () => {
  it.each([
    [-1, 0],
    [0, 0.5],
    [0.5, 0.75],
    [1, 1],
  ])('r %d → %d', (r, fit) => {
    expect(traitFit(r)).toBe(fit);
  });
});

describe('matchBand', () => {
  it.each([
    [0.5, 'strong'],
    [0.4999, 'mixed'],
    [0, 'mixed'],
    [-0.0001, 'weak'],
    [-1, 'weak'],
  ] as const)('r %d → %s', (r, band) => {
    expect(matchBand(r, false)).toBe(band);
  });

  it('flat profile → unclear regardless of r', () => {
    expect(matchBand(0.9, true)).toBe('unclear');
  });

  it('undefined r → unclear', () => {
    expect(matchBand(null, false)).toBe('unclear');
  });
});

describe('explainMatch (two largest positive contributions, largest negative)', () => {
  it('names shared leanings and what may not suit (hand-computed)', () => {
    expect(explainMatch(TEEN_ARTISTIC, SOFTWARE_LIKE)).toEqual({
      shared: HAND.teenVsSoftware.shared,
      mismatch: HAND.teenVsSoftware.mismatch,
    });
  });

  it('returns nothing to explain for a flat profile', () => {
    expect(explainMatch(P(1, 1, 1, 1, 1, 1), SOFTWARE_LIKE)).toEqual({
      shared: [],
      mismatch: null,
    });
  });

  it('property: mean of contributions equals r (decomposition is exact)', () => {
    const u = P(12, 30, 8, 25, 17, 3);
    const v = P(4.1, 5.9, 2.2, 3.3, 2.8, 4.4);
    const zs = (p: Profile) => {
      const xs = Object.values(p);
      const m = xs.reduce((a, b) => a + b, 0) / 6;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / 6);
      return Object.fromEntries(Object.entries(p).map(([k, x]) => [k, (x - m) / sd])) as Profile;
    };
    const zu = zs(u);
    const zv = zs(v);
    const sum = (Object.keys(u) as Array<keyof Profile>).reduce((a, k) => a + zu[k] * zv[k], 0);
    expect(sum / 6).toBeCloseTo(pearson(u, v) as number, 12);
  });
});

describe('matchCareers', () => {
  const careers = [
    { careerId: 'fixture-software', values: SOFTWARE_LIKE },
    { careerId: 'fixture-design', values: P(2.0, 3.0, 6.8, 4.0, 3.5, 2.0) },
  ];

  it('ranks by r and attaches band, fit and explanation', () => {
    const [first, second] = matchCareers(TEEN_ARTISTIC, careers, false);
    expect(first?.careerId).toBe('fixture-design');
    expect(first?.band).toBe('strong');
    expect(second?.band).toBe('weak');
    expect(second?.traitFit).toBeCloseTo(traitFit(HAND.teenVsSoftware.r), 6);
  });

  it('a flat profile makes every match unclear but keeps every hall visitable (all careers returned)', () => {
    const result = matchCareers(TEEN_ARTISTIC, careers, true);
    expect(result.map((m) => m.band)).toEqual(['unclear', 'unclear']);
    expect(result).toHaveLength(2);
  });
});

/**
 * Hand-computed with population z-scores by the independent Python script in
 * docs/golden/assessment-hand-cases.md. Not produced by this code.
 */
const HAND = {
  teenVsSoftware: { r: -0.7139019319481968, shared: ['R'], mismatch: 'I' },
};

describe('teenView (rule 5: bands, explanations and code only)', () => {
  it('drops r and TraitFit so teen screens cannot show numbers', () => {
    const [match] = matchCareers(
      TEEN_ARTISTIC,
      [{ careerId: 'fixture-software', values: SOFTWARE_LIKE }],
      false,
    );
    const view = teenView(match as NonNullable<typeof match>);
    expect(view).toEqual({
      careerId: 'fixture-software',
      band: 'weak',
      shared: ['R'],
      mismatch: 'I',
    });
    expect(JSON.stringify(view)).not.toMatch(/\d\.\d/);
  });
});
