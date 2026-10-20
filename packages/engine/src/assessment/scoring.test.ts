import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ASSESSMENT_CONFIG } from './config.ts';
import { ONET_IPSF } from './instrument.ts';
import {
  interestCode,
  qualityFlags,
  scoreResponses,
  type AreaScores,
  type Responses,
} from './scoring.ts';

const ids = ONET_IPSF.items.map((i) => i.id);
const uniform = (v: 0 | 1 | 2 | 3 | 4): Responses => Object.fromEntries(ids.map((id) => [id, v]));
const scores = (s: Partial<AreaScores>): AreaScores => ({
  R: 0,
  I: 0,
  A: 0,
  S: 0,
  E: 0,
  C: 0,
  ...s,
});

describe('scoreResponses (03 §2.1: area score = sum of its 10 items, 0–40)', () => {
  it('all Unsure (2) → 20 per area', () => {
    expect(scoreResponses(ONET_IPSF, uniform(2))).toEqual(
      scores({ R: 20, I: 20, A: 20, S: 20, E: 20, C: 20 }),
    );
  });

  it('scores a known vector exactly', () => {
    // R items 4, I items 0, A items 3, S alternate 4/0, E 1, C 2
    const r: Responses = {};
    for (const item of ONET_IPSF.items) {
      const n = Number(item.id.slice(1));
      r[item.id] = ({ R: 4, I: 0, A: 3, S: n % 2 === 0 ? 4 : 0, E: 1, C: 2 } as const)[item.area];
    }
    expect(scoreResponses(ONET_IPSF, r)).toEqual(
      scores({ R: 40, I: 0, A: 30, S: 20, E: 10, C: 20 }),
    );
  });

  it('uses the instrument item→area map, not presentation order', () => {
    const r = uniform(0);
    r.C10 = 4;
    expect(scoreResponses(ONET_IPSF, r).C).toBe(4);
  });

  it('rejects incomplete, unknown or out-of-range responses', () => {
    const missing = uniform(2);
    delete missing.R1;
    expect(() => scoreResponses(ONET_IPSF, missing)).toThrow(/R1/);
    expect(() => scoreResponses(ONET_IPSF, { ...uniform(2), X1: 2 } as Responses)).toThrow(/X1/);
    expect(() =>
      scoreResponses(ONET_IPSF, { ...uniform(2), R1: 5 } as unknown as Responses),
    ).toThrow(/0–4/);
    expect(() =>
      scoreResponses(ONET_IPSF, { ...uniform(2), R1: 2.5 } as unknown as Responses),
    ).toThrow(/0–4/);
  });

  it('property: every area score is within 0–40 and the total equals the sum of responses', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 60, maxLength: 60 }),
        (values) => {
          const r: Responses = Object.fromEntries(
            ids.map((id, i) => [id, values[i] as 0 | 1 | 2 | 3 | 4]),
          );
          const s = scoreResponses(ONET_IPSF, r);
          const total = Object.values(s).reduce((a, b) => a + b, 0);
          return (
            Object.values(s).every((v) => v >= 0 && v <= 40) &&
            total === values.reduce((a, b) => a + b, 0)
          );
        },
      ),
    );
  });
});

describe('qualityFlags (03 §2.3; thresholds uncalibrated)', () => {
  it('pins the provisional thresholds so any change is deliberate', () => {
    expect(ASSESSMENT_CONFIG).toMatchObject({
      status: 'uncalibrated',
      straightLiningMinIdentical: 54,
      flatProfileMaxRange: 6,
      lowEngagementMax: 10,
      highEngagementMin: 30,
      tieWithin: 3,
      strongMinR: 0.5,
      mixedMinR: 0,
    });
  });

  it('straight-lining at ≥ 54 of 60 identical responses, not at 53', () => {
    const values = (identical: number) =>
      Array.from({ length: 60 }, (_, i) => (i < identical ? 3 : 1));
    expect(qualityFlags(values(54), scores({ R: 20, I: 25 })).straightLining).toBe(true);
    expect(qualityFlags(values(53), scores({ R: 20, I: 25 })).straightLining).toBe(false);
  });

  it('flat profile when max − min ≤ 6, not at 7', () => {
    expect(qualityFlags([], scores({ R: 20, I: 26, A: 20, S: 20, E: 20, C: 20 })).flatProfile).toBe(
      true,
    );
    expect(qualityFlags([], scores({ R: 20, I: 27, A: 20, S: 20, E: 20, C: 20 })).flatProfile).toBe(
      false,
    );
  });

  it('low engagement when every area ≤ 10; high engagement when every area ≥ 30', () => {
    expect(
      qualityFlags([], scores({ R: 10, I: 10, A: 10, S: 10, E: 10, C: 10 })).lowEngagement,
    ).toBe(true);
    expect(
      qualityFlags([], scores({ R: 11, I: 10, A: 10, S: 10, E: 10, C: 10 })).lowEngagement,
    ).toBe(false);
    expect(
      qualityFlags([], scores({ R: 30, I: 30, A: 30, S: 30, E: 30, C: 30 })).highEngagement,
    ).toBe(true);
    expect(
      qualityFlags([], scores({ R: 29, I: 30, A: 30, S: 30, E: 30, C: 30 })).highEngagement,
    ).toBe(false);
  });
});

describe('interestCode (03 §2.4)', () => {
  it('top three areas form the code', () => {
    const c = interestCode(scores({ R: 5, I: 25, A: 38, S: 31, E: 12, C: 8 }));
    expect(c.code).toEqual(['A', 'S', 'I']);
    expect(c.alternatives).toEqual([['A', 'S', 'I']]);
  });

  it.each([
    [2, true],
    [3, true],
    [4, false],
  ])('second and third %d points apart → tie: %s', (gap, tied) => {
    const c = interestCode(scores({ A: 38, S: 30, I: 30 - gap, R: 5, E: 5, C: 5 }));
    expect(c.code).toEqual(['A', 'S', 'I']);
    expect(c.alternatives.map((a) => a.join(''))).toEqual(tied ? ['ASI', 'AIS'] : ['ASI']);
  });

  it('a fourth area within 3 of the third becomes an alternative third letter', () => {
    const c = interestCode(scores({ A: 38, S: 30, I: 20, E: 18, R: 5, C: 5 }));
    expect(c.alternatives.map((a) => a.join(''))).toEqual(['ASI', 'ASE']);
  });

  it('ties are not transitive: 30, 28, 26 → only adjacent swaps', () => {
    const c = interestCode(scores({ A: 30, S: 28, I: 26, R: 0, E: 0, C: 0 }));
    expect(c.alternatives.map((a) => a.join(''))).toEqual(['ASI', 'AIS', 'SAI']);
  });

  it('breaks exact ties by RIASEC order and lists both orders', () => {
    const c = interestCode(scores({ S: 30, E: 30, C: 30, R: 0, I: 0, A: 0 }));
    expect(c.code).toEqual(['S', 'E', 'C']);
    expect(c.alternatives).toHaveLength(6);
  });

  it('property: the code has three distinct areas and is always the first alternative', () => {
    const area = fc.integer({ min: 0, max: 40 });
    fc.assert(
      fc.property(fc.tuple(area, area, area, area, area, area), ([R, I, A, S, E, C]) => {
        const c = interestCode({ R, I, A, S, E, C });
        return new Set(c.code).size === 3 && c.alternatives[0]?.join('') === c.code.join('');
      }),
    );
  });

  it('property: no alternative ranks an area above another that beats it by more than the tie margin', () => {
    const area = fc.integer({ min: 0, max: 40 });
    fc.assert(
      fc.property(fc.tuple(area, area, area, area, area, area), ([R, I, A, S, E, C]) => {
        const s = { R, I, A, S, E, C };
        return interestCode(s).alternatives.every((alt) =>
          alt.every((x, i) =>
            alt.slice(i + 1).every((y) => s[y] - s[x] <= ASSESSMENT_CONFIG.tieWithin),
          ),
        );
      }),
    );
  });
});
