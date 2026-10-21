import { createRng } from '../shared/random.ts';
import { JOURNEY_CONFIG, estimate, nextScene, shouldStop, type Config } from './estimate.ts';
import type { Choice, Scene, SceneBank, SceneOption } from './types.ts';

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

/** Back/undo: drop the last choice. Always allowed (rule 4). */
export const undo = (choices: readonly Choice[]): Choice[] => choices.slice(0, -1);

export interface Step {
  scene: Scene | null;
  done: boolean;
}

export function step(
  bank: SceneBank,
  choices: readonly Choice[],
  config: Config = JOURNEY_CONFIG,
): Step {
  if (choices.length >= bank.scenes.length) return { scene: null, done: true };
  const posterior = estimate(bank, choices, config);
  if (shouldStop(bank, choices, config, posterior)) return { scene: null, done: true };
  return { scene: nextScene(bank, choices, config, posterior), done: false };
}

/** Share of picks that landed in the same display slot (position bias check). */
export function positionBias(
  bank: SceneBank,
  choices: readonly Choice[],
  seed: number,
  config: Config = JOURNEY_CONFIG,
): boolean {
  const counts = new Map<number, number>();
  let total = 0;
  for (const c of choices) {
    const scene = bank.scenes.find((s) => s.id === c.sceneId) as Scene;
    displayOptions(scene, seed).forEach((o, slot) => {
      if (!c.picked.includes(o.id)) return;
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
      total++;
    });
  }
  if (total < 6) return false;
  return Math.max(...counts.values()) / total >= config.positionBiasShare;
}
