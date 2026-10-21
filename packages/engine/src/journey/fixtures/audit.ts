import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import { journeyResult } from '../result.ts';
import type { Loads, SceneBank } from '../types.ts';
import { flatLevels, playJourney } from './personas.ts';

/**
 * Cross-matching audit: a persona who likes exactly one area (0.9, the rest
 * 0.1) must end with that area first, for every area and every seed. Returns
 * a description of each violation (empty = clean).
 */
export function pureAreaViolations(
  bank: SceneBank,
  seeds: readonly number[],
  /** What the estimator believes the loadings are; differs from `bank` only in a planted-fault test. */
  believed: SceneBank = bank,
): string[] {
  const out: string[] = [];
  for (const area of RIASEC_ORDER) {
    for (const seed of seeds) {
      const levels = flatLevels(0.1);
      levels[area] = 0.9;
      const top = journeyResult(believed, playJourney(levels, seed, bank)).code.code[0];
      if (top !== area) out.push(`${area} persona (seed ${seed}) ended with ${top} first`);
    }
  }
  return out;
}

/** A copy of the bank in which two areas' labels are swapped in every loading (planted fault). */
export function swapAreas(bank: SceneBank, x: Riasec, y: Riasec): SceneBank {
  const out = JSON.parse(JSON.stringify(bank)) as SceneBank;
  for (const s of out.scenes)
    for (const o of s.options) {
      const swapped: Loads = {};
      for (const [k, v] of Object.entries(o.loads) as Array<[Riasec, number]>)
        swapped[k === x ? y : k === y ? x : k] = v;
      o.loads = swapped;
    }
  return out;
}

/** Hexagon neighbours: each area's two adjacent areas (R-I-A-S-E-C-R). */
export function neighbours(area: Riasec): [Riasec, Riasec] {
  const i = RIASEC_ORDER.indexOf(area);
  return [RIASEC_ORDER[(i + 5) % 6] as Riasec, RIASEC_ORDER[(i + 1) % 6] as Riasec];
}
