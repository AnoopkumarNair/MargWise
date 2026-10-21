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

/**
 * What the traveller did at a stop. `picked` = tapped once ("I'd do this"),
 * `loved` = tapped twice (a subset of `picked`). Picking nothing is valid.
 */
export interface Choice {
  sceneId: string;
  picked: string[];
  loved: string[];
}
