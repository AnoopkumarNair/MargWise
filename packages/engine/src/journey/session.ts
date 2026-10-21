import { createRng } from '../shared/random.ts';
import {
  JOURNEY_CONFIG,
  estimate,
  nextScene,
  sceneById,
  shouldStop,
  type Config,
} from './estimate.ts';
import { FLASKS, type Choice, type Scene, type SceneBank, type SceneOption } from './types.ts';

/** Seeded display order of a stop's options so slot position carries no meaning. */
export function displayOptions(scene: Scene, seed: number): SceneOption[] {
  let h = seed >>> 0;
  for (const ch of scene.id) h = (Math.imul(h ^ ch.charCodeAt(0), 16777619) + 0x9e3779b9) >>> 0;
  const rng = createRng(h);
  const out = [...scene.options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as SceneOption, out[i] as SceneOption];
  }
  return out;
}

/** An echo shows the same options in a different order. */
export const ECHO_SEED_OFFSET = 97;

/** Back/undo: drop the last choice. Always allowed (rule 4). */
export const undo = (choices: readonly Choice[]): Choice[] => choices.slice(0, -1);

export interface Step {
  scene: Scene | null;
  done: boolean;
  /** True when the stop is a return visit to an earlier one (the consistency check). */
  echo: boolean;
}

const isEcho = (c: Choice) => c.echoOf !== undefined;
const mostSpent = (c: Choice) => Math.max(0, ...Object.values(c.spent));

/** The earlier stop worth asking again: the one with the strongest single choice, earliest first. */
function echoCandidate(choices: readonly Choice[]): Choice | undefined {
  const fresh = choices.filter((c) => !isEcho(c));
  let best: Choice | undefined;
  for (const c of fresh) if (!best || mostSpent(c) > mostSpent(best)) best = c;
  return best;
}

export function step(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): Step {
  const fresh = choices.filter((c) => !isEcho(c)).length;
  if (fresh >= bank.scenes.length) return { scene: null, done: true, echo: false };
  if (fresh >= config.echoAfter && !choices.some(isEcho)) {
    const c = echoCandidate(choices);
    if (c && mostSpent(c) > 0)
      return { scene: sceneById(bank, c.sceneId), done: false, echo: true };
  }
  const posterior = estimate(bank, choices, config);
  if (shouldStop(bank, choices, config, posterior)) return { scene: null, done: true, echo: false };
  return { scene: nextScene(bank, choices, config, posterior), done: false, echo: false };
}

export interface Consistency {
  checked: boolean;
  /** Share of flasks that went to the same option the first time and the second, 0–1. */
  overlap: number;
  /** Answers pulled in different directions when the same stop came back. */
  mixed: boolean;
}

export function consistency(
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): Consistency {
  const echo = choices.find(isEcho);
  const first = echo && choices.find((c) => !isEcho(c) && c.sceneId === echo.echoOf);
  if (!echo || !first) return { checked: false, overlap: 1, mixed: false };
  const ids = new Set([...Object.keys(first.spent), ...Object.keys(echo.spent)]);
  let shared = 0;
  for (const id of ids) shared += Math.min(first.spent[id] ?? 0, echo.spent[id] ?? 0);
  const overlap = shared / FLASKS;
  return { checked: true, overlap, mixed: overlap < config.echoMinOverlap };
}

/** Share of spent flasks that landed in the same display slot (position bias check). */
export function positionBias(
  bank: SceneBank,
  choices: readonly Choice[],
  seed: number,
  config: Config = JOURNEY_CONFIG,
): boolean {
  const counts = new Map<number, number>();
  let total = 0;
  for (const c of choices) {
    const scene = sceneById(bank, c.echoOf ?? c.sceneId);
    const shown = displayOptions(scene, seed + (isEcho(c) ? ECHO_SEED_OFFSET : 0));
    shown.forEach((o, slot) => {
      const n = c.spent[o.id] ?? 0;
      if (n === 0) return;
      counts.set(slot, (counts.get(slot) ?? 0) + n);
      total += n;
    });
  }
  if (total < 6) return false;
  return Math.max(...counts.values()) / total >= config.positionBiasShare;
}
