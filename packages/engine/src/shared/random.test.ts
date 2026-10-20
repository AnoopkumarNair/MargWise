import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, percentile, triangular } from './random.ts';

describe('createRng (seeded, reproducible)', () => {
  it('same seed → same sequence; different seed → different sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c())).not.toEqual(seqA);
  });

  it('values lie in [0, 1) with a sensible mean', () => {
    const rng = createRng(7);
    const xs = Array.from({ length: 20000 }, () => rng());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeCloseTo(0.5, 1);
  });
});

describe('triangular', () => {
  it('stays within [low, high] and returns the point for a degenerate range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e6 }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (seed, low, width, mode) => {
          const rng = createRng(seed);
          const range = { low, likely: low + width * mode, high: low + width };
          const x = triangular(range, rng);
          return x >= low - 1e-9 && x <= low + width + 1e-9;
        },
      ),
    );
    expect(triangular({ low: 5, likely: 5, high: 5 }, createRng(1))).toBe(5);
  });

  it('has the triangular mean (low + likely + high) / 3', () => {
    const rng = createRng(11);
    const range = { low: 0, likely: 2, high: 10 };
    const xs = Array.from({ length: 40000 }, () => triangular(range, rng));
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeCloseTo(4, 1);
  });
});

describe('percentile (linear interpolation, sorted copy)', () => {
  it('matches hand values', () => {
    const xs = [5, 1, 3, 2, 4];
    expect(percentile(xs, 0.5)).toBe(3);
    expect(percentile(xs, 0.1)).toBeCloseTo(1.4, 12);
    expect(percentile(xs, 0.9)).toBeCloseTo(4.6, 12);
    expect(xs).toEqual([5, 1, 3, 2, 4]);
  });

  it('property: P10 ≤ P50 ≤ P90 (03 §3.10 guarantee)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e9, max: 1e9, noNaN: true }), { minLength: 1, maxLength: 200 }),
        (xs) => {
          return (
            percentile(xs, 0.1) <= percentile(xs, 0.5) && percentile(xs, 0.5) <= percentile(xs, 0.9)
          );
        },
      ),
    );
  });

  it('rejects an empty sample', () => {
    expect(() => percentile([], 0.5)).toThrow();
  });
});
