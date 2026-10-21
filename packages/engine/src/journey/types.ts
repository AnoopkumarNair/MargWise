import type { Riasec } from '@margwise/contracts';

/** Hidden loadings: primary area 1, one neighbouring area 0.5 (docs/journey/design.md). */
export type Loads = Partial<Record<Riasec, number>>;

export interface SceneOption {
  id: string;
  text: string;
  loads: Loads;
}

export interface Scene {
  id: string;
  place: string;
  setup: string;
  options: SceneOption[];
}

export interface SceneBank {
  version: string;
  scenes: Scene[];
}

/** Lamp-oil flasks the traveller carries into every stop. */
export const FLASKS = 2;

/**
 * What the traveller did at a stop: flasks spent per option (0–2 each, at most
 * FLASKS in total; unspent flasks are simply kept). `echoOf` marks a second
 * visit to an earlier stop, used to check consistency.
 */
export interface Choice {
  sceneId: string;
  spent: Record<string, number>;
  echoOf?: string;
}
