import { RIASEC_ORDER, type Riasec } from '@margwise/contracts';
import { invert, solve } from './linalg.ts';
import { FLASKS, type Choice, type Scene, type SceneBank, type SceneOption } from './types.ts';

/**
 * Choice-model constants (UNCALIBRATED, like ASSESSMENT_CONFIG): they change
 * only with Anu's approval after the validation study in docs/journey/design.md.
 */
export const JOURNEY_CONFIG = {
  status: 'uncalibrated',
  /** Sharpness of the choice model: each flask goes to option j with P ∝ exp(β·w_j·θ). */
  beta: 1.5,
  /** Utility of keeping a flask instead of spending it (a mild pull towards saving). */
  keep: 0.5,
  /** Prior standard deviation of each area's latent interest. */
  priorSd: 1,
  /** Fewest stops before the journey may end early. */
  minStops: 8,
  /** The journey ends early when every in-code vs out-of-code gap is at least this many SEs. */
  stopZ: 1,
  /** Separation (SEs) at or above which the result reads "clear"; below it, "close". */
  clearZ: 0.7,
  /** θ range (max − min) below which interests read "broad" (simulations: real codes ≥ 1.54 at p10, uniform play ≤ 1.46 at p90). */
  broadRange: 1.4,
  /** An earlier stop is shown again once this many stops are done, to check consistency. */
  echoAfter: 6,
  /** Overlap of spending between a stop and its echo below which answers are called mixed. */
  echoMinOverlap: 0.5,
  /** Share of stops where nothing was spent at or above which the walk reads low-engagement. */
  noneShare: 0.5,
  /** Position bias: this share of spent flasks in one display slot (with ≥ 6 spent). */
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

/**
 * P(a flask goes to each option) with "keep" last. Each of the FLASKS flasks is
 * an independent draw from this distribution (multinomial, with replacement).
 */
export function flaskProbabilities(
  scene: Scene,
  theta: readonly number[],
  config: Config,
): number[] {
  const u = [...scene.options.map((o) => config.beta * dot(vec(o.loads), theta)), config.keep];
  const max = Math.max(...u);
  const e = u.map((x) => Math.exp(x - max));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}

export interface Posterior {
  theta: Theta;
  /** Posterior covariance (6×6, R-I-A-S-E-C order). */
  cov: number[][];
}

const toTheta = (v: readonly number[]): Theta =>
  Object.fromEntries(AREAS.map((a, i) => [a, v[i] as number])) as Theta;

/** Information of one stop at θ: FLASKS · β² (Σ p w wᵀ − m mᵀ). */
function sceneInfo(scene: Scene, theta: readonly number[], config: Config): number[][] {
  const p = flaskProbabilities(scene, theta, config);
  const ws = scene.options.map((o) => vec(o.loads));
  const m = AREAS.map((_, k) => ws.reduce((s, w, j) => s + (p[j] as number) * (w[k] as number), 0));
  return AREAS.map((_, r) =>
    AREAS.map(
      (_, c) =>
        FLASKS *
        config.beta ** 2 *
        (ws.reduce((s, w, j) => s + (p[j] as number) * (w[r] as number) * (w[c] as number), 0) -
          (m[r] as number) * (m[c] as number)),
    ),
  );
}

/** Validates a choice against its stop; returns the flasks spent per option (aligned to the options). */
function counts(scene: Scene, choice: Choice): number[] {
  for (const id of Object.keys(choice.spent))
    if (!scene.options.some((o) => o.id === id))
      throw new Error(`Unknown option ${id} in ${scene.id}`);
  const n = scene.options.map((o) => choice.spent[o.id] ?? 0);
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > FLASKS))
    throw new Error(`Flasks per option must be 0–${FLASKS} in ${scene.id}`);
  if (n.reduce((a, b) => a + b, 0) > FLASKS)
    throw new Error(`More than ${FLASKS} flasks spent in ${scene.id}`);
  return n;
}

/** MAP estimate by damped Newton; the log-posterior is concave so this converges. */
export function estimate(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): Posterior {
  const prior = 1 / config.priorSd ** 2;
  const obs = choices.map((c) => {
    const scene = sceneById(bank, c.echoOf ?? c.sceneId);
    return { scene, n: counts(scene, c) };
  });
  let theta = new Array<number>(6).fill(0);
  const hessianAt = (t: number[]) => {
    const h = AREAS.map((_, r) => AREAS.map((_, c) => (r === c ? prior : 0)));
    for (const { scene } of obs) {
      const info = sceneInfo(scene, t, config);
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
    for (const { scene, n } of obs) {
      const p = flaskProbabilities(scene, theta, config);
      scene.options.forEach((o, j) => {
        const w = vec(o.loads);
        for (let k = 0; k < 6; k++)
          grad[k] =
            (grad[k] as number) +
            config.beta * ((n[j] as number) - FLASKS * (p[j] as number)) * (w[k] as number);
      });
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
 * tr(Σ·I). Ties go to the earlier stop so the order is reproducible.
 */
export function nextScene(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
  posterior?: Posterior,
): Scene | null {
  const answered = new Set(choices.map((c) => c.echoOf ?? c.sceneId));
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
  const fresh = choices.filter((c) => c.echoOf === undefined).length;
  if (fresh >= bank.scenes.length) return true;
  if (fresh < config.minStops) return false;
  return codeSeparation(posterior ?? estimate(bank, choices, config)) >= config.stopZ;
}
