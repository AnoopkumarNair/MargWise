import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import { ONET_IPSF } from '../../assessment/instrument.ts';
import { scoreResponses, type Responses, type ResponseValue } from '../../assessment/scoring.ts';
import { createRng, type Rng } from '../../shared/random.ts';
import { step } from '../session.ts';
import { JOURNEY_BANK } from '../bank.ts';
import type { Choice, SceneBank } from '../types.ts';

/**
 * Simulated explorers for tests. Arbitrary made-up numbers (rule 1): a persona
 * is just six "how much does this person like this area" levels in [0, 1].
 * The two responders below use a different noise model from the estimator on
 * purpose (rating + threshold, not softmax), so agreement is not circular.
 */
export type Levels = Record<Riasec, number>;

export const flatLevels = (x: number): Levels =>
  Object.fromEntries(RIASEC_ORDER.map((a) => [a, x])) as Levels;

/** Standard normal via Box–Muller from a seeded RNG. */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Levels for a three-letter code: strong, medium, mild, then three low areas. */
export function levelsForCode(code: readonly [Riasec, Riasec, Riasec]): Levels {
  const levels = flatLevels(0.1);
  const rest = RIASEC_ORDER.filter((a) => !code.includes(a));
  levels[code[0]] = 0.9;
  levels[code[1]] = 0.7;
  levels[code[2]] = 0.5;
  rest.forEach((a, i) => (levels[a] = 0.2 - 0.05 * i));
  return levels;
}

/** All 120 ordered three-letter codes. */
export function allCodes(): Array<[Riasec, Riasec, Riasec]> {
  const out: Array<[Riasec, Riasec, Riasec]> = [];
  for (const a of RIASEC_ORDER)
    for (const b of RIASEC_ORDER)
      for (const c of RIASEC_ORDER) if (a !== b && a !== c && b !== c) out.push([a, b, c]);
  return out;
}

/** Answers the 60 official items: 4·level + noise, rounded to 0–4. */
export function answerIpsf(levels: Levels, seed: number, noise = 0.8): Responses {
  const rng = createRng(seed);
  const out: Responses = {};
  for (const item of ONET_IPSF.items) {
    const v = Math.round(4 * levels[item.area] + noise * gaussian(rng));
    out[item.id] = Math.max(0, Math.min(4, v)) as ResponseValue;
  }
  return out;
}

export const ipsfScores = (levels: Levels, seed: number) =>
  scoreResponses(ONET_IPSF, answerIpsf(levels, seed));

/** Plays the adaptive journey: rate each option with noise, pick every one rated high enough. */
export function playJourney(
  levels: Levels,
  seed: number,
  bank: SceneBank = JOURNEY_BANK,
  noise = 0.8,
  pickAtLeast = 2,
  loveAtLeast = 3.2,
): Choice[] {
  const rng = createRng(seed);
  const choices: Choice[] = [];
  for (let guard = 0; guard < bank.scenes.length + 1; guard++) {
    const s = step(bank, choices);
    if (s.done || !s.scene) break;
    const picked: string[] = [];
    const loved: string[] = [];
    for (const o of s.scene.options) {
      const w = Object.entries(o.loads) as Array<[Riasec, number]>;
      const total = w.reduce((a, [, x]) => a + x, 0);
      const appeal = (4 * w.reduce((a, [k, x]) => a + x * levels[k], 0)) / total;
      const r = appeal + noise * gaussian(rng);
      if (r >= pickAtLeast) picked.push(o.id);
      if (r >= loveAtLeast) loved.push(o.id);
    }
    choices.push({ sceneId: s.scene.id, picked, loved });
  }
  return choices;
}
