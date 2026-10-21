import { describe, expect, it } from 'vitest';
import { CurrencyCode, IsoDate, NumericRange, Slug } from './primitives.ts';

describe('NumericRange', () => {
  it('accepts low ≤ likely ≤ high', () => {
    expect(NumericRange.parse({ low: 1, likely: 2, high: 3 })).toEqual({
      low: 1,
      likely: 2,
      high: 3,
    });
  });

  it('accepts a degenerate range (all equal)', () => {
    expect(NumericRange.safeParse({ low: 5, likely: 5, high: 5 }).success).toBe(true);
  });

  it.each([
    [{ low: 3, likely: 2, high: 4 }, 'low > likely'],
    [{ low: 1, likely: 5, high: 4 }, 'likely > high'],
  ])('rejects %o (%s) — 05 §9 release gate rule', (range) => {
    const result = NumericRange.safeParse(range);
    expect(result.success).toBe(false);
  });

  it('rejects non-finite values so NaN/Infinity never reach the engines', () => {
    expect(NumericRange.safeParse({ low: 0, likely: Number.NaN, high: 1 }).success).toBe(false);
    expect(NumericRange.safeParse({ low: 0, likely: 1, high: Infinity }).success).toBe(false);
  });

  it('rejects unknown keys (closed object)', () => {
    expect(NumericRange.safeParse({ low: 0, likely: 1, high: 2, extra: 1 }).success).toBe(false);
  });
});

describe('IsoDate', () => {
  it('accepts a calendar date', () => {
    expect(IsoDate.parse('2026-10-15')).toBe('2026-10-15');
  });

  it.each(['2026-13-01', '2026-02-30', '15/10/2026', '2026-10-15T00:00:00Z'])('rejects %s', (d) => {
    expect(IsoDate.safeParse(d).success).toBe(false);
  });
});

describe('Slug', () => {
  it.each(['psy-1', 'b-tech-cse', 'tec-2'])('accepts %s', (s) => {
    expect(Slug.safeParse(s).success).toBe(true);
  });

  it.each(['PSY 1', '', '-lead', 'trail-', 'a_b'])('rejects %j', (s) => {
    expect(Slug.safeParse(s).success).toBe(false);
  });
});

describe('CurrencyCode', () => {
  it('covers INR and the six alpha countries', () => {
    for (const c of ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD']) {
      expect(CurrencyCode.safeParse(c).success).toBe(true);
    }
  });

  it('rejects lowercase or unknown codes', () => {
    expect(CurrencyCode.safeParse('inr').success).toBe(false);
    expect(CurrencyCode.safeParse('XYZ').success).toBe(false);
  });
});
