import { RIASEC_ORDER, type Instrument, type Riasec } from '@margwise/contracts';
import { ASSESSMENT_CONFIG, type AssessmentConfig } from './config.ts';

export type ResponseValue = 0 | 1 | 2 | 3 | 4;
/** Responses keyed by item id (`R1` … `C10`). */
export type Responses = Record<string, ResponseValue>;
export type AreaScores = Record<Riasec, number>;

/** Area score = sum of the area's 10 item responses, 0–40 (03 §2.1). */
export function scoreResponses(instrument: Instrument, responses: Responses): AreaScores {
  const known = new Set(instrument.items.map((i) => i.id));
  for (const id of Object.keys(responses)) {
    if (!known.has(id)) throw new Error(`Unknown item ${id}`);
  }
  const scores: AreaScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (const item of instrument.items) {
    const v = responses[item.id];
    if (v === undefined) throw new Error(`Missing response for ${item.id}`);
    if (!Number.isInteger(v) || v < 0 || v > 4)
      throw new Error(`Response for ${item.id} must be an integer 0–4`);
    scores[item.area] += v;
  }
  return scores;
}

export interface QualityFlags {
  straightLining: boolean;
  flatProfile: boolean;
  lowEngagement: boolean;
  highEngagement: boolean;
}

/** Pre-result quality checks (03 §2.3). `values` are the 60 responses in any order. */
export function qualityFlags(
  values: readonly number[],
  scores: AreaScores,
  config: AssessmentConfig = ASSESSMENT_CONFIG,
): QualityFlags {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const mostCommon = Math.max(0, ...counts.values());
  const all = Object.values(scores);
  return {
    straightLining: mostCommon >= config.straightLiningMinIdentical,
    flatProfile: Math.max(...all) - Math.min(...all) <= config.flatProfileMaxRange,
    lowEngagement: all.every((s) => s <= config.lowEngagementMax),
    highEngagement: all.every((s) => s >= config.highEngagementMin),
  };
}

export interface InterestCode {
  /** Top three areas, highest first; exact ties broken by R-I-A-S-E-C order. */
  code: [Riasec, Riasec, Riasec];
  /** Every three-letter code the tie margin allows, the main code first (e.g. A-S-I or A-I-S). */
  alternatives: Array<[Riasec, Riasec, Riasec]>;
}

const order = (a: Riasec) => RIASEC_ORDER.indexOf(a);

function* permutations3<T>(xs: readonly T[]): Generator<[T, T, T]> {
  for (const a of xs)
    for (const b of xs) for (const c of xs) if (a !== b && a !== c && b !== c) yield [a, b, c];
}

/**
 * Interest code with ties (03 §2.4). Two areas tie when their scores differ
 * by at most `tieWithin`. An alternative is any ordering of three areas in
 * which no area is placed above one that beats it by more than the margin,
 * and no left-out area beats an included one by more than the margin.
 */
export function interestCode(
  scores: AreaScores,
  config: AssessmentConfig = ASSESSMENT_CONFIG,
): InterestCode {
  const ranked = [...RIASEC_ORDER].sort((a, b) => scores[b] - scores[a] || order(a) - order(b));
  const code = ranked.slice(0, 3) as [Riasec, Riasec, Riasec];
  const margin = config.tieWithin;
  const third = scores[code[2]];
  const candidates = ranked.filter((a) => scores[a] >= third - margin);

  const valid: Array<[Riasec, Riasec, Riasec]> = [];
  for (const alt of permutations3(candidates)) {
    const ordered = alt.every((x, i) =>
      alt.slice(i + 1).every((y) => scores[y] - scores[x] <= margin),
    );
    const leftOutOk = RIASEC_ORDER.filter((a) => !alt.includes(a)).every((out) =>
      alt.every((x) => scores[out] - scores[x] <= margin),
    );
    if (ordered && leftOutOk) valid.push(alt);
  }
  valid.sort((p, q) => {
    for (let i = 0; i < 3; i++) {
      const d =
        scores[q[i] as Riasec] - scores[p[i] as Riasec] ||
        order(p[i] as Riasec) - order(q[i] as Riasec);
      if (d !== 0) return d;
    }
    return 0;
  });
  return { code, alternatives: valid };
}
