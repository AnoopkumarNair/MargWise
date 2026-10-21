import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { pearson, matchBand, type Profile } from '../assessment/matching.ts';
import { ONET_IPSF } from '../assessment/instrument.ts';
import { interestCode, scoreResponses } from '../assessment/scoring.ts';
import { JOURNEY_BANK } from './bank.ts';
import {
  JOURNEY_CONFIG,
  codeSeparation,
  estimate,
  nextScene,
  pickProbabilities,
  shouldStop,
} from './estimate.ts';
import { invert, solve } from './linalg.ts';
import { journeyResult } from './result.ts';
import { displayOptions, positionBias, step, undo } from './session.ts';
import type { Choice, Scene, SceneOption } from './types.ts';
import { neighbours, pureAreaViolations, swapAreas } from './fixtures/audit.ts';
import {
  allCodes,
  flatLevels,
  gaussian,
  ipsfScores,
  levelsForCode,
  playJourney,
} from './fixtures/personas.ts';
import { createRng } from '../shared/random.ts';

// The simulations replay thousands of adaptive journeys; coverage instrumentation slows them.
vi.setConfig({ testTimeout: 120_000 });

const bank = JOURNEY_BANK;
const primary = (o: { loads: Partial<Record<Riasec, number>> }): Riasec =>
  RIASEC_ORDER.find((a) => o.loads[a] === 1) as Riasec;
const secondary = (o: { loads: Partial<Record<Riasec, number>> }): Riasec =>
  RIASEC_ORDER.find((a) => o.loads[a] === 0.5) as Riasec;
const same = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();

describe('stop bank design (docs/journey/design.md)', () => {
  it('has 15 stops of 4 options, every 4-subset of the six areas exactly once', () => {
    expect(bank.scenes).toHaveLength(15);
    const subsets = bank.scenes.map((s) => s.options.map(primary).sort().join(''));
    expect(new Set(subsets).size).toBe(15);
    for (const s of bank.scenes) {
      expect(s.options).toHaveLength(4);
      expect(new Set(s.options.map(primary)).size).toBe(4);
    }
  });

  it('is balanced: each area is primary 10×, secondary 10×, and each pair shares 6 stops', () => {
    for (const a of RIASEC_ORDER) {
      const all = bank.scenes.flatMap((s) => s.options);
      expect(all.filter((o) => primary(o) === a)).toHaveLength(10);
      expect(all.filter((o) => secondary(o) === a)).toHaveLength(10);
    }
    for (const a of RIASEC_ORDER)
      for (const b of RIASEC_ORDER) {
        if (a >= b) continue;
        const together = bank.scenes.filter((s) => {
          const p = s.options.map(primary);
          return p.includes(a) && p.includes(b);
        });
        expect(together).toHaveLength(6);
      }
  });

  it('every option loads exactly one primary (1) and one hexagon-neighbour secondary (0.5)', () => {
    for (const o of bank.scenes.flatMap((s) => s.options)) {
      expect(Object.keys(o.loads)).toHaveLength(2);
      expect(neighbours(primary(o))).toContain(secondary(o));
    }
  });

  it('has unique ids and texts, ids carry the primary area, and no option text names an area or the source', () => {
    const opts = bank.scenes.flatMap((s) => s.options);
    expect(new Set(opts.map((o) => o.id)).size).toBe(60);
    expect(new Set(opts.map((o) => o.text)).size).toBe(60);
    for (const o of opts) expect(o.id.endsWith(`-${primary(o)}`)).toBe(true);
    const leak =
      /realistic|investigative|artistic|social|enterprising|conventional|riasec|holland|o\*net|interest|assess|test of|score|career/i;
    for (const s of bank.scenes) {
      for (const text of [s.place, s.setup, ...s.options.map((o) => o.text)])
        expect(text, text).not.toMatch(leak);
    }
  });

  it('keeps option lengths within a stop comparable so length is not a hint', () => {
    for (const s of bank.scenes) {
      const lens = s.options.map((o) => o.text.length);
      expect(Math.max(...lens) - Math.min(...lens), s.id).toBeLessThanOrEqual(30);
    }
  });
});

describe('estimator', () => {
  const only = (sceneId: string, optionId: string, love = false): Choice[] => [
    { sceneId, picked: [optionId], loved: love ? [optionId] : [] },
  ];

  it('with no answers returns the prior (all zero) and unit-scale uncertainty', () => {
    const post = estimate(bank, []);
    for (const a of RIASEC_ORDER) expect(post.theta[a]).toBe(0);
    expect((post.cov[0] as number[])[0]).toBeCloseTo(JOURNEY_CONFIG.priorSd ** 2, 12);
  });

  it('exhaustive: picking any one option of any stop makes its primary area the single highest, and positive', () => {
    for (const s of bank.scenes)
      for (const o of s.options) {
        const t = estimate(bank, only(s.id, o.id)).theta;
        const p = primary(o);
        expect(t[p], `${o.id} is positive`).toBeGreaterThan(0);
        for (const a of RIASEC_ORDER.filter((x) => x !== p))
          expect(t[p], `${o.id} vs ${a}`).toBeGreaterThan(t[a]);
      }
  });

  it('exhaustive: loving an option moves its primary area up further than picking it', () => {
    for (const s of bank.scenes)
      for (const o of s.options) {
        const picked = estimate(bank, only(s.id, o.id)).theta[primary(o)];
        const loved = estimate(bank, only(s.id, o.id, true)).theta[primary(o)];
        expect(loved, o.id).toBeGreaterThan(picked);
      }
  });

  it('exhaustive: skipping an option never raises an area above where picking it puts it', () => {
    for (const s of bank.scenes)
      for (const o of s.options) {
        const skipped = estimate(bank, [{ sceneId: s.id, picked: [], loved: [] }]).theta;
        const picked = estimate(bank, only(s.id, o.id)).theta;
        expect(picked[primary(o)], o.id).toBeGreaterThan(skipped[primary(o)]);
      }
  });

  it('is independent of the order the stops were answered in (property)', () => {
    const arb = fc.shuffledSubarray(bank.scenes, { minLength: 3, maxLength: 12 }).chain((scenes) =>
      fc.tuple(
        fc.constant(scenes),
        fc.array(fc.subarray([0, 1, 2, 3]), {
          minLength: scenes.length,
          maxLength: scenes.length,
        }),
        fc.integer({ min: 0, max: 1000 }),
      ),
    );
    fc.assert(
      fc.property(arb, ([scenes, picks, seed]) => {
        const choices: Choice[] = scenes.map((s, i) => {
          const picked = (picks[i] as number[]).map((k) => (s.options[k] as { id: string }).id);
          return { sceneId: s.id, picked, loved: picked.slice(0, 1) };
        });
        const rng = createRng(seed);
        const shuffled = [...choices].sort(() => rng() - 0.5);
        const a = estimate(bank, choices).theta;
        const b = estimate(bank, shuffled).theta;
        return RIASEC_ORDER.every((k) => Math.abs(a[k] - b[k]) < 1e-6);
      }),
      { numRuns: 40 },
    );
  });

  it('rejects unknown stops, unknown options, and a love that was not picked', () => {
    expect(() => estimate(bank, [{ sceneId: 'nope', picked: [], loved: [] }])).toThrow(
      /Unknown stop/,
    );
    expect(() => estimate(bank, [{ sceneId: 's01', picked: ['x'], loved: [] }])).toThrow(
      /Unknown option/,
    );
    expect(() => estimate(bank, [{ sceneId: 's01', picked: [], loved: ['s01-R'] }])).toThrow(
      /must also be picked/,
    );
  });

  it('pick probabilities are valid and rise with the loaded area', () => {
    const scene = bank.scenes[0] as Scene;
    const low = pickProbabilities(scene, [0, 0, 0, 0, 0, 0], JOURNEY_CONFIG);
    const high = pickProbabilities(scene, [2, 0, 0, 0, 0, 0], JOURNEY_CONFIG);
    for (const p of [...low, ...high]) expect(p).toBeGreaterThan(0);
    expect(high[0]).toBeGreaterThan(low[0] as number);
    expect(pickProbabilities(scene, [0, 0, 0, 0, 0, 0], JOURNEY_CONFIG, 'love')[0]).toBeLessThan(
      low[0] as number,
    );
  });
});

describe('journey session', () => {
  it('chooses the same next stop for the same answers and never repeats a stop', () => {
    const choices: Choice[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const a = nextScene(bank, choices);
      expect(a?.id).toBe(nextScene(bank, choices)?.id);
      expect(seen.has((a as Scene).id)).toBe(false);
      seen.add((a as Scene).id);
      choices.push({ sceneId: (a as Scene).id, picked: [], loved: [] });
    }
    expect(nextScene(bank, choices)).toBeNull();
    expect(shouldStop(bank, choices)).toBe(true);
  });

  it('never ends before the minimum number of stops and ends by the last stop', () => {
    for (const seed of [1, 2, 3]) {
      const choices = playJourney(levelsForCode(['A', 'S', 'I']), seed);
      expect(choices.length).toBeGreaterThanOrEqual(JOURNEY_CONFIG.minStops);
      expect(choices.length).toBeLessThanOrEqual(bank.scenes.length);
    }
    expect(step(bank, []).done).toBe(false);
  });

  it('undo drops the last answer and always works (rule 4)', () => {
    const c: Choice[] = [
      { sceneId: 's01', picked: [], loved: [] },
      { sceneId: 's02', picked: [], loved: [] },
    ];
    expect(undo(c).map((x) => x.sceneId)).toEqual(['s01']);
    expect(undo([])).toEqual([]);
  });

  it('displays options in a seeded order that is a permutation, stable, and varies by seed and stop', () => {
    const scene = bank.scenes[0] as Scene;
    const a = displayOptions(scene, 7).map((o) => o.id);
    expect([...a].sort()).toEqual(scene.options.map((o) => o.id).sort());
    expect(displayOptions(scene, 7).map((o) => o.id)).toEqual(a);
    const orders = new Set(
      Array.from({ length: 30 }, (_, s) =>
        displayOptions(scene, s)
          .map((o) => o.id)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(10);
    // Every slot gets every area about equally often across stops (no slot carries meaning).
    const slotCounts = RIASEC_ORDER.map(() => [0, 0, 0, 0]);
    for (let seed = 0; seed < 200; seed++)
      for (const s of bank.scenes)
        displayOptions(s, seed).forEach((o, slot) => {
          const row = slotCounts[RIASEC_ORDER.indexOf(primary(o))] as number[];
          row[slot] = (row[slot] as number) + 1;
        });
    for (const row of slotCounts) {
      const total = row.reduce((x, y) => x + y, 0);
      for (const n of row) expect(n / total).toBeGreaterThan(0.2);
    }
  });

  it('flags position bias when nearly every pick is in the same display slot', () => {
    const seed = 5;
    const biased: Choice[] = bank.scenes.slice(0, 10).map((s) => {
      const first = (displayOptions(s, seed)[0] as SceneOption).id;
      return { sceneId: s.id, picked: [first], loved: [] };
    });
    expect(positionBias(bank, biased, seed)).toBe(true);
    expect(positionBias(bank, biased.slice(0, 3), seed)).toBe(false);
    const varied = playJourney(levelsForCode(['E', 'S', 'C']), 4);
    expect(positionBias(bank, varied, seed)).toBe(false);
  });
});

describe('no cross-matching: a single-interest explorer ends with that interest first', () => {
  it('every area, 30 seeds each', () => {
    expect(
      pureAreaViolations(
        bank,
        Array.from({ length: 30 }, (_, i) => i + 1),
      ),
    ).toEqual([]);
  });

  it('META: the audit rejects an estimator whose loadings have two areas swapped (planted fault)', () => {
    const wrong = swapAreas(bank, 'R', 'E');
    const seeds = Array.from({ length: 5 }, (_, i) => i + 1);
    expect(pureAreaViolations(bank, seeds, wrong).length).toBeGreaterThanOrEqual(10);
    expect(pureAreaViolations(bank, seeds)).toEqual([]);
  });

  it('two-interest explorers: both interests land in the top three (all 30 ordered pairs, 6 seeds)', () => {
    let total = 0;
    let hit = 0;
    let outsideFirst = 0;
    for (const a of RIASEC_ORDER)
      for (const b of RIASEC_ORDER) {
        if (a === b) continue;
        for (let seed = 1; seed <= 6; seed++) {
          const levels = flatLevels(0.1);
          levels[a] = 0.9;
          levels[b] = 0.75;
          const code = journeyResult(bank, playJourney(levels, seed)).code.code;
          total++;
          if (code.slice(0, 3).includes(a) && code.slice(0, 3).includes(b)) hit++;
          if (code[0] !== a && code[0] !== b) outsideFirst++;
        }
      }
    expect(hit / total).toBeGreaterThanOrEqual(0.95);
    expect(outsideFirst / total).toBeLessThanOrEqual(0.02);
  });
});

describe('journey vs the 60-item questionnaire, every ordered three-letter code (120 × 3 seeds)', () => {
  const rows = allCodes().flatMap((code) =>
    [1, 2, 3].map((seed) => {
      const levels = levelsForCode(code);
      const game = journeyResult(bank, playJourney(levels, seed));
      const ipsf = interestCode(ipsfScores(levels, seed + 100)).code;
      return { code, game, ipsf };
    }),
  );
  const rate = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length / rows.length;

  it('the questionnaire itself recovers every simulated code (the yardstick is sound)', () => {
    expect(rate((r) => r.ipsf.join() === r.code.join())).toBe(1);
  });

  it('game top interest agrees with the questionnaire at least 75% of the time', () => {
    expect(rate((r) => r.game.code.code[0] === r.ipsf[0])).toBeGreaterThanOrEqual(0.75);
  });

  it('game top three (as a set) agree with the questionnaire at least 80% of the time', () => {
    expect(rate((r) => same(r.game.code.code, r.ipsf))).toBeGreaterThanOrEqual(0.8);
  });

  it('when the game disagrees on the top interest it only reorders the true top three (no stranger takes first place) in ≥ 99% of runs', () => {
    expect(
      rate((r) => r.game.code.code[0] === r.code[0] || r.code.includes(r.game.code.code[0])),
    ).toBeGreaterThanOrEqual(0.99);
  });

  it('plays well under 60 prompts: on average at most 14 stops of 4 options', () => {
    const avg = rows.reduce((s, r) => s + r.game.stopsPlayed, 0) / rows.length;
    expect(avg).toBeLessThanOrEqual(14);
  });

  it('career match bands from the game profile agree with the questionnaire profile for at least 80% of (explorer, career) pairs', () => {
    // Made-up career interest vectors (arbitrary values, rule 1), one per code family.
    const careers: Profile[] = allCodes()
      .filter((_, i) => i % 8 === 0)
      .map((c) => {
        const l = levelsForCode(c);
        return Object.fromEntries(RIASEC_ORDER.map((a) => [a, 100 * l[a]])) as Profile;
      });
    let agree = 0;
    let total = 0;
    for (const { code, game } of rows.filter((_, i) => i % 6 === 0)) {
      const ipsfProfile = Object.fromEntries(
        RIASEC_ORDER.map((a) => [a, levelsForCode(code)[a]]),
      ) as Profile;
      for (const career of careers) {
        const a = matchBand(pearson(game.profile, career), game.flat);
        const b = matchBand(pearson(ipsfProfile, career), false);
        total++;
        if (a === b) agree++;
      }
    }
    expect(agree / total).toBeGreaterThanOrEqual(0.8);
  });

  it('questionnaire scores for the same personas are a sanity floor: scoring accepts the simulated answers', () => {
    const s = scoreResponses(ONET_IPSF, {
      ...Object.fromEntries(ONET_IPSF.items.map((i) => [i.id, 2])),
    } as never);
    expect(Object.values(s).every((x) => x === 20)).toBe(true);
  });
});

describe('no hallucinated confidence: uninformative play does not produce a confident code', () => {
  const flatCount = (make: (seed: number) => Choice[]) =>
    Array.from({ length: 30 }, (_, i) => journeyResult(bank, make(i + 1))).filter((r) => r.flat)
      .length;

  it('someone who likes everything equally is shown as broad interests', () => {
    expect(
      flatCount((seed) => playJourney(flatLevels(0.5), seed, bank, 0.3)),
    ).toBeGreaterThanOrEqual(27);
  });

  it('real interest profiles are rarely mistaken for broad interests (≤ 5% of 360 runs)', () => {
    const wrongly = allCodes()
      .flatMap((c) => [1, 2, 3].map((s) => journeyResult(bank, playJourney(levelsForCode(c), s))))
      .filter((r) => r.flat);
    expect(wrongly.length / 360).toBeLessThanOrEqual(0.05);
  });

  it('someone who picks nothing is flat and marked low engagement', () => {
    const none = bank.scenes.map((s) => ({ sceneId: s.id, picked: [], loved: [] }));
    const r = journeyResult(bank, none);
    expect(r.flat).toBe(true);
    expect(r.lowEngagement).toBe(true);
  });

  it('someone who picks and loves everything is flat', () => {
    const all = bank.scenes.map((s) => ({
      sceneId: s.id,
      picked: s.options.map((o) => o.id),
      loved: s.options.map((o) => o.id),
    }));
    expect(journeyResult(bank, all).flat).toBe(true);
  });

  it('random tapping is mostly flat or noisy, never a stable single-area result', () => {
    const tops = new Map<Riasec, number>();
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const choices: Choice[] = bank.scenes.map((s) => {
        const picked = s.options.filter(() => rng() < 0.4).map((o) => o.id);
        return { sceneId: s.id, picked, loved: picked.filter(() => rng() < 0.3) };
      });
      const r = journeyResult(bank, choices);
      tops.set(r.code.code[0], (tops.get(r.code.code[0]) ?? 0) + 1);
    }
    // No single area wins a large share of random runs.
    expect(Math.max(...tops.values()) / 60).toBeLessThan(0.4);
  });

  it('always picking the option shown first is detected as position bias', () => {
    const seed = 3;
    const c: Choice[] = bank.scenes.map((s) => ({
      sceneId: s.id,
      picked: [(displayOptions(s, seed)[0] as SceneOption).id],
      loved: [],
    }));
    expect(positionBias(bank, c, seed)).toBe(true);
  });

  it('reports code separation as a number that grows as more consistent answers arrive', () => {
    const lv = levelsForCode(['I', 'A', 'S']);
    const ch = playJourney(lv, 2);
    expect(codeSeparation(estimate(bank, ch))).toBeGreaterThan(
      codeSeparation(estimate(bank, ch.slice(0, 2))),
    );
  });
});

describe('result', () => {
  it('has a mean-free profile and pseudo-scores within 0–40', () => {
    const r = journeyResult(bank, playJourney(levelsForCode(['R', 'I', 'C']), 9));
    const mean = RIASEC_ORDER.reduce((s, a) => s + r.profile[a], 0) / 6;
    expect(mean).toBeCloseTo(0, 12);
    for (const a of RIASEC_ORDER) {
      expect(r.scores[a]).toBeGreaterThanOrEqual(0);
      expect(r.scores[a]).toBeLessThanOrEqual(40);
    }
    expect(r.code.code[0]).toBe('R');
  });
});

describe('linear algebra helpers', () => {
  it('solves and inverts a known system', () => {
    expect(
      solve(
        [
          [2, 0],
          [0, 4],
        ],
        [2, 8],
      ),
    ).toEqual([1, 2]);
    const inv = invert([
      [4, 7],
      [2, 6],
    ]);
    expect((inv[0] as number[])[0]).toBeCloseTo(0.6, 12);
    expect((inv[1] as number[])[0]).toBeCloseTo(-0.2, 12);
  });
  it('rejects a singular matrix', () => {
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow(/Singular/);
  });
  it('gaussian draws are roughly standard normal', () => {
    const rng = createRng(1);
    const xs = Array.from({ length: 4000 }, () => gaussian(rng));
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
    expect(Math.abs(m)).toBeLessThan(0.08);
    expect(Math.abs(v - 1)).toBeLessThan(0.1);
  });
});
