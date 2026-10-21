import { RIASEC_ORDER } from '@margwise/contracts';
import { interestCode, type AreaScores, type InterestCode } from '../assessment/scoring.ts';
import type { Profile } from '../assessment/matching.ts';
import { JOURNEY_CONFIG, estimate, type Config } from './estimate.ts';
import type { Choice, SceneBank } from './types.ts';

export interface JourneyResult {
  /** Latent interests (log-odds scale, mean-free). Profile shape feeds matching. */
  profile: Profile;
  /** 0–40 pseudo-scores used only for the interest-code tie rule. */
  scores: AreaScores;
  code: InterestCode;
  stopsPlayed: number;
  flat: boolean;
  lowEngagement: boolean;
}

const clamp = (x: number) => Math.max(0, Math.min(40, x));

export function journeyResult(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): JourneyResult {
  const { theta } = estimate(bank, choices, config);
  const mean = RIASEC_ORDER.reduce((s, a) => s + theta[a], 0) / 6;
  const profile = Object.fromEntries(RIASEC_ORDER.map((a) => [a, theta[a] - mean])) as Profile;
  const scores = Object.fromEntries(
    RIASEC_ORDER.map((a) => [a, clamp(config.scoreCentre + config.scoreScale * profile[a])]),
  ) as AreaScores;
  const values = RIASEC_ORDER.map((a) => profile[a]);
  const nones = choices.filter((c) => c.picked.length === 0).length;
  return {
    profile,
    scores,
    code: interestCode(scores),
    stopsPlayed: choices.length,
    flat: Math.max(...values) - Math.min(...values) < config.flatRange,
    lowEngagement: choices.length > 0 && nones / choices.length >= config.noneShare,
  };
}
