import type { NumericRange } from '@margwise/contracts';

export type Rng = () => number;

/** mulberry32: small, fast, seeded PRNG. Reproducible across runs and devices (03 §3.10). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse-CDF triangular draw over {low, likely, high}. */
export function triangular({ low, likely, high }: NumericRange, rng: Rng): number {
  if (high === low) return low;
  const u = rng();
  const f = (likely - low) / (high - low);
  return u < f
    ? low + Math.sqrt(u * (high - low) * (likely - low))
    : high - Math.sqrt((1 - u) * (high - low) * (high - likely));
}

/** Percentile with linear interpolation between order statistics (q in [0, 1]). */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error('percentile of an empty sample');
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}
