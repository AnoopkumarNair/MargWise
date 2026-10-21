import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import { invert, solve } from './linalg.ts';
import type { Choice, Scene, SceneBank, SceneOption } from './types.ts';

/**
 * Choice-model constants (UNCALIBRATED, like ASSESSMENT_CONFIG): they change
 * only with Anu's approval after the validation study in docs/journey/design.md.
 */
export const JOURNEY_CONFIG = {
  status: 'uncalibrated',
  /** Sharpness of the logistic pick model: P(pick) = σ(β·w·θ + bias). */
  beta: 1.5,
  /** Baseline log-odds of picking ("like") an option with no leaning; most stops yield 1–2 picks. */
  bias: -0.5,
  /** Baseline log-odds of "loving" an option (a second, stronger tap); rarer than a pick. */
  loveBias: -2,
  /** Prior standard deviation of each area's latent interest. */
  priorSd: 1,
  /** Fewest stops before the journey may end early. */
  minStops: 8,
  /** The journey ends early when every in-code vs out-of-code gap is at least this many SEs. */
  stopZ: 1,
  /** Range of θ (max − min) below which (simulations: real codes ≥ 1.75 at p10, uniform play ≤ 1.3 at p90) the profile counts as flat ("broad interests"). */
  flatRange: 1.5,
  /** ≥ this share of "none of these" → low-engagement note. */
  noneShare: 0.5,
  /** Position bias: this share of picks in one display slot (with ≥ 6 picks). */
  positionBiasShare: 0.8,
  /** θ → 0–40 pseudo-score used only to reuse the interest-code tie rule. */
  scoreCentre: 20,
  scoreScale: 8,
} as const;

export type Theta = Record<Riasec, number>;
export type Config = typeof JOURNEY_CONFIG;

const AREAS = RIASEC_ORDER;
const vec = (o: SceneOption['loads']): number[] => AREAS.map((a) => o[a] ?? 0);
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((s, x, i) => s + x * (b[i] as number), 0);

export function sceneById(bank: SceneBank, id: string): Scene {
  const s = bank.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stop ${id}`);
  return s;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** P(pick) for each option of a stop; options are picked independently ("pick any"). */
export function pickProbabilities(
  scene: Scene,
  theta: readonly number[],
  config: Config,
  level: 'pick' | 'love' = 'pick',
): number[] {
  const bias = level === 'pick' ? config.bias : config.loveBias;
  return scene.options.map((o) => sigmoid(config.beta * dot(vec(o.loads), theta) + bias));
}

export interface Posterior {
  theta: Theta;
  /** Posterior covariance (6×6, R-I-A-S-E-C order). */
  cov: number[][];
}

const toTheta = (v: readonly number[]): Theta =>
  Object.fromEntries(AREAS.map((a, i) => [a, v[i] as number])) as Theta;

/** Information matrix of one stop at θ: β² Σ p(1−p) w wᵀ, over the like and love taps. */
function sceneInfo(scene: Scene, theta: readonly number[], config: Config): number[][] {
  const ws = scene.options.map((o) => vec(o.loads));
  const levels = (['pick', 'love'] as const).map((l) => pickProbabilities(scene, theta, config, l));
  return AREAS.map((_, r) =>
    AREAS.map(
      (_, c) =>
        config.beta ** 2 *
        levels.reduce(
          (acc, p) =>
            acc +
            ws.reduce(
              (s, w, j) =>
                s + (p[j] as number) * (1 - (p[j] as number)) * (w[r] as number) * (w[c] as number),
              0,
            ),
          0,
        ),
    ),
  );
}

/** MAP estimate by damped Newton; the log-posterior is concave so this converges. */
export function estimate(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): Posterior {
  const prior = 1 / config.priorSd ** 2;
  let theta = new Array<number>(6).fill(0);
  const hessianAt = (t: number[]) => {
    const h = AREAS.map((_, r) => AREAS.map((_, c) => (r === c ? prior : 0)));
    for (const ch of choices) {
      const info = sceneInfo(sceneById(bank, ch.sceneId), t, config);
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++) {
          const row = h[r] as number[];
          row[c] = (row[c] as number) + ((info[r] as number[])[c] as number);
        }
    }
    return h;
  };
  for (let iter = 0; iter < 50; iter++) {
    const grad = theta.map((t) => -prior * t);
    for (const ch of choices) {
      const scene = sceneById(bank, ch.sceneId);
      for (const id of [...ch.picked, ...ch.loved])
        if (!scene.options.some((o) => o.id === id))
          throw new Error(`Unknown option ${id} in ${ch.sceneId}`);
      if (ch.loved.some((id) => !ch.picked.includes(id)))
        throw new Error(`A loved option must also be picked in ${ch.sceneId}`);
      for (const [level, chosen] of [
        ['pick', ch.picked],
        ['love', ch.loved],
      ] as const) {
        const p = pickProbabilities(scene, theta, config, level);
        scene.options.forEach((o, j) => {
          const y = chosen.includes(o.id) ? 1 : 0;
          const w = vec(o.loads);
          for (let k = 0; k < 6; k++)
            grad[k] = (grad[k] as number) + config.beta * (y - (p[j] as number)) * (w[k] as number);
        });
      }
    }
    const step = solve(hessianAt(theta), grad);
    theta = theta.map((t, k) => t + (step[k] as number));
    if (Math.max(...step.map(Math.abs)) < 1e-9) break;
  }
  return { theta: toTheta(theta), cov: invert(hessianAt(theta)) };
}

/** z-gap between two areas' interest: (θi − θj) / SE of the difference. */
function gapZ(post: Posterior, i: number, j: number): number {
  const at = (r: number, c: number) => (post.cov[r] as number[])[c] as number;
  const v = at(i, i) + at(j, j) - 2 * at(i, j);
  return (
    (post.theta[AREAS[i] as Riasec] - post.theta[AREAS[j] as Riasec]) /
    Math.sqrt(Math.max(v, 1e-12))
  );
}

/** Smallest in-code vs out-of-code gap (SEs); the journey may end once this is ≥ stopZ. */
export function codeSeparation(post: Posterior): number {
  const order = AREAS.map((_, i) => i).sort(
    (a, b) => post.theta[AREAS[b] as Riasec] - post.theta[AREAS[a] as Riasec] || a - b,
  );
  const inCode = order.slice(0, 3);
  const out = order.slice(3);
  return Math.min(...inCode.flatMap((i) => out.map((j) => gapZ(post, i, j))));
}

/**
 * Next stop: the unanswered one whose outcome is expected to tell us most,
 * tr(Σ·I) (posterior covariance times the stop's information). Ties go to the
 * earlier stop so the order is reproducible.
 */
export function nextScene(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
  posterior?: Posterior,
): Scene | null {
  const answered = new Set(choices.map((c) => c.sceneId));
  const left = bank.scenes.filter((s) => !answered.has(s.id));
  if (left.length === 0) return null;
  const post = posterior ?? estimate(bank, choices, config);
  const theta = AREAS.map((a) => post.theta[a]);
  let best: Scene | null = null;
  let bestScore = -Infinity;
  for (const scene of left) {
    const info = sceneInfo(scene, theta, config);
    let score = 0;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++)
        score += ((post.cov[r] as number[])[c] as number) * ((info[c] as number[])[r] as number);
    if (score > bestScore + 1e-12) {
      best = scene;
      bestScore = score;
    }
  }
  return best;
}

export function shouldStop(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
  posterior?: Posterior,
): boolean {
  if (choices.length >= bank.scenes.length) return true;
  if (choices.length < config.minStops) return false;
  return codeSeparation(posterior ?? estimate(bank, choices, config)) >= config.stopZ;
}
