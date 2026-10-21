import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { matchBand, pearson, type CareerMatch, type Profile } from '../assessment/matching.ts';
import { interestCode } from '../assessment/scoring.ts';
import { createRng } from '../shared/random.ts';
import { JOURNEY_BANK } from './bank.ts';
import { careerPaths, compareDreams } from './dreams.ts';
import {
  JOURNEY_CONFIG,
  codeSeparation,
  estimate,
  flaskProbabilities,
  nextScene,
  shouldStop,
} from './estimate.ts';
import { invert, solve } from './linalg.ts';
import { journeyResult } from './result.ts';
import { consistency, displayOptions, positionBias, step, undo } from './session.ts';
import { FLASKS, type Choice, type Scene, type SceneOption } from './types.ts';
import { neighbours, pureAreaViolations, swapAreas } from './fixtures/audit.ts';
import {
  allCodes,
  flatLevels,
  gaussian,
  ipsfScores,
  levelsForCode,
  playJourney,
  spendFlasks,
} from './fixtures/personas.ts';

// The simulations replay thousands of adaptive journeys; coverage instrumentation slows them.
vi.setConfig({ testTimeout: 300_000 });

const bank = JOURNEY_BANK;
const primary = (o: { loads: Partial<Record<Riasec, number>> }): Riasec =>
  RIASEC_ORDER.find((a) => o.loads[a] === 1) as Riasec;
const secondary = (o: { loads: Partial<Record<Riasec, number>> }): Riasec =>
  RIASEC_ORDER.find((a) => o.loads[a] === 0.5) as Riasec;
const same = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();
const spend = (sceneId: string, spent: Record<string, number>): Choice => ({ sceneId, spent });

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
    const all = bank.scenes.flatMap((s) => s.options);
    for (const a of RIASEC_ORDER) {
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

  it('has unique ids and texts, ids carry the primary area, and no text names an area or the source', () => {
    const opts = bank.scenes.flatMap((s) => s.options);
    expect(new Set(opts.map((o) => o.id)).size).toBe(60);
    expect(new Set(opts.map((o) => o.text)).size).toBe(60);
    for (const o of opts) expect(o.id.endsWith(`-${primary(o)}`)).toBe(true);
    const leak =
      /realistic|investigative|artistic|social|enterprising|conventional|riasec|holland|o\*net|interest|assess|test of|score|career/i;
    for (const s of bank.scenes)
      for (const text of [s.place, s.setup, ...s.options.map((o) => o.text)])
        expect(text, text).not.toMatch(leak);
  });

  it('tells one story that holds in any visiting order, favours no option, and names no area or source', () => {
    const story = bank.story;
    if (!story) throw new Error('bank has no story');
    const leak =
      /realistic|investigative|artistic|social|enterprising|conventional|riasec|holland|o\*net|interest|assess|test of|score|career/i;
    // stops arrive in an adaptive order, so no line may say where in the walk it belongs
    const order = /\b(first|last|final|next|again|nearly|almost done|begin|end of)\b/i;
    const lines = [
      story.title,
      story.premise,
      story.mission,
      story.outro,
      ...Object.values(story.threads).flat(),
    ];
    for (const text of lines) {
      expect(text.length, text).toBeGreaterThan(10);
      expect(text, text).not.toMatch(leak);
    }
    for (const [phase, arr] of Object.entries(story.threads)) {
      expect(arr.length, phase).toBeGreaterThan(0);
      if (phase !== 'first' && phase !== 'return')
        for (const t of arr) expect(t.length).toBeLessThan(110);
    }
    const stop = new Set([
      'their',
      'every',
      'there',
      'about',
      'which',
      'while',
      'would',
      'could',
      'again',
      'other',
    ]);
    const words = (s: string) =>
      (s.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !stop.has(w));
    for (const s of bank.scenes) {
      expect(s.lit?.length ?? 0, s.id).toBeGreaterThan(10);
      for (const text of [s.setup, s.lit ?? '']) {
        expect(text, text).not.toMatch(leak);
        expect(text, `${s.id}: order word in "${text}"`).not.toMatch(order);
      }
      expect(s.setup, s.id).toMatch(/lamp|festival|lantern/i);
      // the closing line describes the town, never an option: it must not reuse an option's own words
      const optionWords = new Set(s.options.flatMap((o) => words(o.text)));
      for (const w of words(s.lit ?? ''))
        expect(optionWords.has(w), `${s.id}: lit line echoes option word "${w}"`).toBe(false);
    }
  });

  it('keeps option lengths within a stop comparable so length is not a hint', () => {
    for (const s of bank.scenes) {
      const lens = s.options.map((o) => o.text.length);
      expect(Math.max(...lens) - Math.min(...lens), s.id).toBeLessThanOrEqual(30);
    }
  });
});

describe('estimator (two lamp-oil flasks per stop)', () => {
  it('with no answers returns the prior (all zero)', () => {
    const post = estimate(bank, []);
    for (const a of RIASEC_ORDER) expect(post.theta[a]).toBe(0);
    expect((post.cov[0] as number[])[0]).toBeCloseTo(JOURNEY_CONFIG.priorSd ** 2, 12);
  });

  it('exhaustive: one flask on any option makes its primary area the single highest, and positive', () => {
    for (const s of bank.scenes)
      for (const o of s.options) {
        const t = estimate(bank, [spend(s.id, { [o.id]: 1 })]).theta;
        const p = primary(o);
        expect(t[p], `${o.id} is positive`).toBeGreaterThan(0);
        for (const a of RIASEC_ORDER.filter((x) => x !== p))
          expect(t[p], `${o.id} vs ${a}`).toBeGreaterThan(t[a]);
      }
  });

  it('exhaustive: both flasks on one option move its primary area further than one flask', () => {
    for (const s of bank.scenes)
      for (const o of s.options) {
        const one = estimate(bank, [spend(s.id, { [o.id]: 1 })]).theta[primary(o)];
        const two = estimate(bank, [spend(s.id, { [o.id]: 2 })]).theta[primary(o)];
        expect(two, o.id).toBeGreaterThan(one);
      }
  });

  it('exhaustive: keeping both flasks never ranks an option above spending on it', () => {
    for (const s of bank.scenes)
      for (const o of s.options) {
        const kept = estimate(bank, [spend(s.id, {})]).theta[primary(o)];
        const spent = estimate(bank, [spend(s.id, { [o.id]: 1 })]).theta[primary(o)];
        expect(spent, o.id).toBeGreaterThan(kept);
      }
  });

  it('exhaustive over one stop: all 15 ways to spend two flasks give a finite estimate that leans to what was chosen', () => {
    const s = bank.scenes[0] as Scene;
    const ids = s.options.map((o) => o.id);
    const plans: Array<Record<string, number>> = [{}];
    for (const a of ids) plans.push({ [a]: 1 }, { [a]: 2 });
    for (const a of ids) for (const b of ids) if (a < b) plans.push({ [a]: 1, [b]: 1 });
    expect(plans).toHaveLength(15);
    for (const spent of plans) {
      const t = estimate(bank, [spend(s.id, spent)]).theta;
      for (const a of RIASEC_ORDER) expect(Number.isFinite(t[a])).toBe(true);
      const chosen = s.options.filter((o) => (spent[o.id] ?? 0) > 0).map(primary);
      const skipped = s.options.filter((o) => !(spent[o.id] ?? 0)).map(primary);
      for (const c of chosen) for (const k of skipped) expect(t[c]).toBeGreaterThan(t[k]);
    }
  });

  it('is independent of the order the stops were answered in (property)', () => {
    const arb = fc.shuffledSubarray(bank.scenes, { minLength: 3, maxLength: 12 }).chain((scenes) =>
      fc.tuple(
        fc.constant(scenes),
        fc.array(fc.integer({ min: 0, max: 3 }), {
          minLength: scenes.length,
          maxLength: scenes.length,
        }),
        fc.array(fc.integer({ min: 0, max: 2 }), {
          minLength: scenes.length,
          maxLength: scenes.length,
        }),
        fc.integer({ min: 0, max: 1000 }),
      ),
    );
    fc.assert(
      fc.property(arb, ([scenes, picks, amounts, seed]) => {
        const choices: Choice[] = scenes.map((s, i) =>
          spend(s.id, {
            [(s.options[picks[i] as number] as SceneOption).id]: amounts[i] as number,
          }),
        );
        const rng = createRng(seed);
        const shuffled = [...choices].sort(() => rng() - 0.5);
        const a = estimate(bank, choices).theta;
        const b = estimate(bank, shuffled).theta;
        return RIASEC_ORDER.every((k) => Math.abs(a[k] - b[k]) < 1e-6);
      }),
      { numRuns: 40 },
    );
  });

  it('rejects unknown stops and options, more than two flasks, and bad counts', () => {
    expect(() => estimate(bank, [spend('nope', {})])).toThrow(/Unknown stop/);
    expect(() => estimate(bank, [spend('s01', { x: 1 })])).toThrow(/Unknown option/);
    expect(() => estimate(bank, [spend('s01', { 's01-R': 2, 's01-I': 1 })])).toThrow(/More than 2/);
    expect(() => estimate(bank, [spend('s01', { 's01-R': 3 })])).toThrow(/0–2/);
    expect(() => estimate(bank, [spend('s01', { 's01-R': 0.5 })])).toThrow(/0–2/);
  });

  it('flask probabilities sum to 1 and rise with the loaded area', () => {
    const scene = bank.scenes[0] as Scene;
    const low = flaskProbabilities(scene, [0, 0, 0, 0, 0, 0], JOURNEY_CONFIG);
    const high = flaskProbabilities(scene, [2, 0, 0, 0, 0, 0], JOURNEY_CONFIG);
    expect(low.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(high[0]).toBeGreaterThan(low[0] as number);
    expect(low).toHaveLength(scene.options.length + 1);
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
      choices.push(spend((a as Scene).id, {}));
    }
    expect(nextScene(bank, choices)).toBeNull();
    expect(shouldStop(bank, choices)).toBe(true);
    expect(step(bank, choices).done).toBe(true);
  });

  it('never ends before the minimum, ends by the last stop, and returns to one earlier stop exactly once', () => {
    for (const seed of [1, 2, 3, 4]) {
      const choices = playJourney(levelsForCode(['A', 'S', 'I']), seed);
      const fresh = choices.filter((c) => c.echoOf === undefined);
      const echoes = choices.filter((c) => c.echoOf !== undefined);
      expect(fresh.length).toBeGreaterThanOrEqual(JOURNEY_CONFIG.minStops);
      expect(fresh.length).toBeLessThanOrEqual(bank.scenes.length);
      expect(echoes).toHaveLength(1);
      const at = choices.findIndex((c) => c.echoOf !== undefined);
      expect(at).toBe(JOURNEY_CONFIG.echoAfter);
      expect(fresh.some((c) => c.sceneId === echoes[0]?.echoOf)).toBe(true);
    }
    expect(step(bank, []).done).toBe(false);
    expect(step(bank, []).echo).toBe(false);
  });

  it('does not return to a stop where nothing was spent', () => {
    const none = bank.scenes.slice(0, 6).map((s) => spend(s.id, {}));
    expect(step(bank, none).echo).toBe(false);
  });

  it('undo drops the last answer and always works (rule 4)', () => {
    const c = [spend('s01', {}), spend('s02', {})];
    expect(undo(c).map((x) => x.sceneId)).toEqual(['s01']);
    expect(undo([])).toEqual([]);
  });

  it('displays options in a seeded order that is a permutation, stable, varied, and slot-neutral', () => {
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

  it('flags position bias when nearly every flask goes to the option shown first', () => {
    const seed = 5;
    const biased: Choice[] = bank.scenes
      .slice(0, 10)
      .map((s) => spend(s.id, { [(displayOptions(s, seed)[0] as SceneOption).id]: 1 }));
    expect(positionBias(bank, biased, seed)).toBe(true);
    expect(positionBias(bank, biased.slice(0, 3), seed)).toBe(false);
    expect(positionBias(bank, playJourney(levelsForCode(['E', 'S', 'C']), 4), seed)).toBe(false);
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

  it('game top interest agrees with the questionnaire at least 80% of the time', () => {
    expect(rate((r) => r.game.code.code[0] === r.ipsf[0])).toBeGreaterThanOrEqual(0.8);
  });

  it('game top three (as a set) agree with the questionnaire at least 78% of the time', () => {
    expect(rate((r) => same(r.game.code.code, r.ipsf))).toBeGreaterThanOrEqual(0.78);
  });

  it('a stranger never takes first place: when top interests differ the game only reorders the true top three', () => {
    expect(
      rate((r) => r.game.code.code[0] === r.code[0] || r.code.includes(r.game.code.code[0])),
    ).toBeGreaterThanOrEqual(0.99);
  });

  it('plays well under 60 prompts: on average at most 14 stops of 4 options (plus one return visit)', () => {
    expect(rows.reduce((s, r) => s + r.game.stopsPlayed, 0) / rows.length).toBeLessThanOrEqual(14);
  });

  it('career bands from the game profile agree with the questionnaire profile for at least 80% of (explorer, career) pairs', () => {
    const careers: Profile[] = allCodes()
      .filter((_, i) => i % 8 === 0)
      .map((c) => {
        const l = levelsForCode(c);
        return Object.fromEntries(RIASEC_ORDER.map((a) => [a, 100 * l[a]])) as Profile;
      });
    let agree = 0;
    let total = 0;
    for (const { code, game } of rows.filter((_, i) => i % 6 === 0)) {
      const ipsfProfile = levelsForCode(code) as Profile;
      for (const career of careers) {
        const a = matchBand(pearson(game.profile, career), false);
        const b = matchBand(pearson(ipsfProfile, career), false);
        total++;
        if (a === b) agree++;
      }
    }
    expect(agree / total).toBeGreaterThanOrEqual(0.8);
  });

  it('confidence labels: real profiles are rarely called broad (≤ 8%)', () => {
    expect(rate((r) => r.game.confidence === 'broad')).toBeLessThanOrEqual(0.08);
  });
});

describe('no hallucinated confidence: uninformative play does not read as a clear result', () => {
  const runs = (make: (seed: number) => Choice[]) =>
    Array.from({ length: 30 }, (_, i) => journeyResult(bank, make(i + 1)));

  it('someone who likes everything equally reads as broad in at least 80% of runs, and rarely as clear', () => {
    const r = runs((seed) => playJourney(flatLevels(0.5), seed));
    expect(r.filter((x) => x.confidence === 'broad').length).toBeGreaterThanOrEqual(24);
    expect(r.filter((x) => x.confidence === 'clear').length).toBeLessThanOrEqual(3);
  });

  it('someone who spends nothing is broad and low-engagement', () => {
    const none = bank.scenes.map((s) => spend(s.id, {}));
    const r = journeyResult(bank, none);
    expect(r.confidence).toBe('broad');
    expect(r.lowEngagement).toBe(true);
  });

  it('someone who always saves everything for later is detected as low engagement', () => {
    const r = runs((seed) => playJourney(flatLevels(0.1), seed));
    expect(r.filter((x) => x.lowEngagement).length).toBeGreaterThanOrEqual(28);
  });

  it('random spending never gives one area a large share of first places', () => {
    const tops = new Map<Riasec, number>();
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const choices: Choice[] = bank.scenes.map((s) => {
        const a = s.options[Math.floor(rng() * 4)] as SceneOption;
        const b = s.options[Math.floor(rng() * 4)] as SceneOption;
        return spend(s.id, a.id === b.id ? { [a.id]: 2 } : { [a.id]: 1, [b.id]: 1 });
      });
      const r = journeyResult(bank, choices);
      tops.set(r.code.code[0], (tops.get(r.code.code[0]) ?? 0) + 1);
    }
    expect(Math.max(...tops.values()) / 60).toBeLessThan(0.4);
  });

  it('always spending on the option shown first is detected as position bias', () => {
    const seed = 3;
    const c: Choice[] = bank.scenes.map((s) =>
      spend(s.id, { [(displayOptions(s, seed)[0] as SceneOption).id]: 1 }),
    );
    expect(positionBias(bank, c, seed)).toBe(true);
  });

  it('code separation is larger on average for a clear explorer than for an indifferent one', () => {
    const mean = (levels: ReturnType<typeof flatLevels>) =>
      Array.from({ length: 20 }, (_, i) =>
        codeSeparation(estimate(bank, playJourney(levels, i + 1))),
      ).reduce((a, b) => a + b, 0) / 20;
    expect(mean(levelsForCode(['R', 'I', 'C']))).toBeGreaterThan(mean(flatLevels(0.5)));
  });
});

describe('contradictions: the return visit', () => {
  const rows = allCodes().filter((_, i) => i % 6 === 0);

  it('flags a contradiction when the explorer answers the return visit as a different person (≥ 50% of 60 runs)', () => {
    let flagged = 0;
    let total = 0;
    for (const code of rows)
      for (let seed = 1; seed <= 3; seed++) {
        const levels = levelsForCode(code);
        const reversed = Object.fromEntries(
          RIASEC_ORDER.map((a, i) => [a, levels[RIASEC_ORDER[5 - i] as Riasec]]),
        ) as typeof levels;
        total++;
        if (journeyResult(bank, playJourney(levels, seed, bank, 0.8, reversed)).consistency.mixed)
          flagged++;
      }
    expect(flagged / total).toBeGreaterThanOrEqual(0.5);
  });

  it('rarely flags a consistent explorer (false alarms ≤ 25% of 360 runs; the note is gentle)', () => {
    let flagged = 0;
    let total = 0;
    for (const code of allCodes())
      for (let seed = 1; seed <= 3; seed++) {
        total++;
        if (journeyResult(bank, playJourney(levelsForCode(code), seed)).consistency.mixed)
          flagged++;
      }
    expect(flagged / total).toBeLessThanOrEqual(0.25);
  });

  it('computes overlap exactly: same spending = 1, half = 0.5, disjoint = 0, not yet asked = unchecked', () => {
    const base = spend('s01', { 's01-R': 1, 's01-I': 1 });
    const echo = (spent: Record<string, number>): Choice => ({
      sceneId: 's01~echo',
      echoOf: 's01',
      spent,
    });
    expect(consistency([base, echo({ 's01-R': 1, 's01-I': 1 })])).toEqual({
      checked: true,
      overlap: 1,
      mixed: false,
    });
    expect(consistency([base, echo({ 's01-R': 1, 's01-A': 1 })]).overlap).toBe(0.5);
    expect(consistency([base, echo({ 's01-R': 1, 's01-A': 1 })]).mixed).toBe(false);
    expect(consistency([base, echo({ 's01-A': 2 })])).toEqual({
      checked: true,
      overlap: 0,
      mixed: true,
    });
    expect(consistency([base]).checked).toBe(false);
  });
});

describe('stated paths vs the walk ("predict, then reveal")', () => {
  const m = (careerId: string, band: CareerMatch['band']): CareerMatch => ({
    careerId,
    r: 0,
    traitFit: 0.5,
    band,
    explanation: { shared: [], mismatch: null },
  });
  const matches = [
    m('a', 'strong'),
    m('b', 'mixed'),
    m('c', 'weak'),
    m('d', 'strong'),
    m('e', 'unclear'),
  ];

  it('splits named paths into lined up and pulling away, and offers up to three new strong doors', () => {
    expect(compareDreams(['a', 'c'], matches)).toEqual({
      lined: ['a'],
      pulls: ['c'],
      newDoors: ['d'],
    });
    expect(compareDreams(['b', 'e', 'zzz', 'b'], matches)).toEqual({
      lined: ['b'],
      pulls: ['e'],
      newDoors: ['a', 'd'],
    });
    expect(compareDreams([], matches).lined).toEqual([]);
  });

  it('careerPaths always gives every path a band (never all "unclear") for a profile with shape', () => {
    const profile = journeyResult(bank, playJourney(flatLevels(0.5), 3)).profile;
    const careers = allCodes()
      .filter((_, i) => i % 15 === 0)
      .map((c, i) => ({
        careerId: `c${i}`,
        values: Object.fromEntries(
          RIASEC_ORDER.map((a) => [a, 100 * levelsForCode(c)[a]]),
        ) as Profile,
      }));
    const paths = careerPaths(profile, careers);
    expect(paths).toHaveLength(careers.length);
    expect(paths.every((p) => p.band === 'unclear')).toBe(false);
  });
});

describe('result and helpers', () => {
  it('has a mean-free profile, pseudo-scores within 0–40, and the intended top interest', () => {
    const r = journeyResult(bank, playJourney(levelsForCode(['R', 'I', 'C']), 9));
    const mean = RIASEC_ORDER.reduce((s, a) => s + r.profile[a], 0) / 6;
    expect(mean).toBeCloseTo(0, 12);
    for (const a of RIASEC_ORDER) {
      expect(r.scores[a]).toBeGreaterThanOrEqual(0);
      expect(r.scores[a]).toBeLessThanOrEqual(40);
    }
    expect(r.code.code[0]).toBe('R');
    expect(r.stopsPlayed).toBeLessThanOrEqual(15);
    expect(FLASKS).toBe(2);
  });

  it('spendFlasks never spends more than two flasks and never on an unknown option', () => {
    const rng = createRng(3);
    for (const s of bank.scenes)
      for (let i = 0; i < 20; i++) {
        const spent = spendFlasks(s, levelsForCode(['R', 'I', 'A']), rng);
        expect(Object.values(spent).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(2);
        for (const id of Object.keys(spent)) expect(s.options.some((o) => o.id === id)).toBe(true);
      }
  });

  it('solves and inverts a known system, and rejects a singular one', () => {
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
