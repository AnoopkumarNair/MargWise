import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import { ASSESSMENT_CONFIG, type AssessmentConfig } from './config.ts';
import type { AreaScores } from './scoring.ts';

export type Profile = Record<Riasec, number>;
export type MatchBand = 'strong' | 'mixed' | 'weak' | 'unclear';

const values = (p: Profile) => RIASEC_ORDER.map((k) => p[k]);
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Population z-scores over the six areas; `null` when the profile has no spread. */
function zScores(p: Profile): Profile | null {
  const xs = values(p);
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  if (sd === 0) return null;
  return Object.fromEntries(RIASEC_ORDER.map((k) => [k, (p[k] - m) / sd])) as Profile;
}

/**
 * Pearson r over the six RIASEC areas (03 §2.5). Returns `null` when either
 * profile is flat, because r is undefined there; callers show "Unclear".
 */
export function pearson(u: Profile, v: Profile): number | null {
  const zu = zScores(u);
  const zv = zScores(v);
  if (!zu || !zv) return null;
  const r = mean(RIASEC_ORDER.map((k) => zu[k] * zv[k]));
  return Math.max(-1, Math.min(1, r));
}

/** TraitFit = ½(1 + r), 0–1. Shown only on the parent's voyage chart axis. */
export const traitFit = (r: number): number => (1 + r) / 2;

export function matchBand(
  r: number | null,
  flatProfile: boolean,
  config: AssessmentConfig = ASSESSMENT_CONFIG,
): MatchBand {
  if (flatProfile || r === null) return 'unclear';
  if (r >= config.strongMinR) return 'strong';
  if (r >= config.mixedMinR) return 'mixed';
  return 'weak';
}

export interface MatchExplanation {
  /** The two areas with the largest positive contribution z(U)·z(V), largest first. */
  shared: Riasec[];
  /** The area with the most negative contribution, if any ("what may not suit you"). */
  mismatch: Riasec | null;
}

export function explainMatch(u: Profile, v: Profile): MatchExplanation {
  const zu = zScores(u);
  const zv = zScores(v);
  if (!zu || !zv) return { shared: [], mismatch: null };
  const contributions = RIASEC_ORDER.map((k) => ({ k, c: zu[k] * zv[k] }));
  const shared = contributions
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 2)
    .map((x) => x.k);
  const negative = contributions.filter((x) => x.c < 0).sort((a, b) => a.c - b.c)[0];
  return { shared, mismatch: negative?.k ?? null };
}

export interface CareerMatch {
  careerId: string;
  r: number | null;
  traitFit: number | null;
  band: MatchBand;
  explanation: MatchExplanation;
}

/**
 * Matches the explorer's area scores against each career's O*NET OI vector.
 * Sorted by r (highest first); unclear matches last, then by career id.
 */
export function matchCareers(
  scores: AreaScores,
  careers: ReadonlyArray<{ careerId: string; values: Profile }>,
  flatProfile: boolean,
  config: AssessmentConfig = ASSESSMENT_CONFIG,
): CareerMatch[] {
  return careers
    .map(({ careerId, values: v }) => {
      const r = pearson(scores, v);
      return {
        careerId,
        r,
        traitFit: r === null ? null : traitFit(r),
        band: matchBand(r, flatProfile, config),
        explanation: explainMatch(scores, v),
      };
    })
    .sort(
      (a, b) => (b.r ?? -Infinity) - (a.r ?? -Infinity) || a.careerId.localeCompare(b.careerId),
    );
}

/** What a teen screen may show (rule 5, 03 §2.5): band and explanation, no r, no percentages. */
export interface TeenMatchView {
  careerId: string;
  band: MatchBand;
  shared: Riasec[];
  mismatch: Riasec | null;
}

export function teenView(match: CareerMatch): TeenMatchView {
  return {
    careerId: match.careerId,
    band: match.band,
    shared: match.explanation.shared,
    mismatch: match.explanation.mismatch,
  };
}
