import { RIASEC_ORDER } from '@margwise/contracts';
import { interestCode, type AreaScores, type InterestCode } from '../assessment/scoring.ts';
import type { Profile } from '../assessment/matching.ts';
import { JOURNEY_CONFIG, codeSeparation, estimate, type Config } from './estimate.ts';
import { consistency, type Consistency } from './session.ts';
import { FLASKS, type Choice, type SceneBank } from './types.ts';

/** How sure the walk is about the top three: clear, close (some of them were near), or broad. */
export type Confidence = 'clear' | 'close' | 'broad';

export interface JourneyResult {
  /** Latent interests (log-odds scale, mean-free). Profile shape feeds matching. */
  profile: Profile;
  /** 0–40 pseudo-scores used only for the interest-code tie rule. */
  scores: AreaScores;
  code: InterestCode;
  stopsPlayed: number;
  confidence: Confidence;
  /** Nothing was spent at half the stops or more. */
  lowEngagement: boolean;
  consistency: Consistency;
}

const clamp = (x: number) => Math.max(0, Math.min(40, x));

export function journeyResult(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): JourneyResult {
  const post = estimate(bank, choices, config);
  const { theta } = post;
  const mean = RIASEC_ORDER.reduce((s, a) => s + theta[a], 0) / 6;
  const profile = Object.fromEntries(RIASEC_ORDER.map((a) => [a, theta[a] - mean])) as Profile;
  const scores = Object.fromEntries(
    RIASEC_ORDER.map((a) => [a, clamp(config.scoreCentre + config.scoreScale * profile[a])]),
  ) as AreaScores;
  const separation = choices.length === 0 ? 0 : codeSeparation(post);
  const values = RIASEC_ORDER.map((a) => theta[a]);
  const range = Math.max(...values) - Math.min(...values);
  const none = choices.filter((c) => Object.values(c.spent).every((n) => n === 0)).length;
  return {
    profile,
    scores,
    code: interestCode(scores),
    stopsPlayed: choices.filter((c) => c.echoOf === undefined).length,
    confidence:
      range < config.broadRange ? 'broad' : separation >= config.clearZ ? 'clear' : 'close',
    lowEngagement: choices.length > 0 && none / choices.length >= config.noneShare,
    consistency: consistency(choices, config),
  };
}

export { FLASKS };
