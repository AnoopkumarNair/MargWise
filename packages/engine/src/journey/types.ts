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
  /** Said once the lamp is lit; identical in meaning whatever was chosen (rule 4). */
  lit?: string;
  options: SceneOption[];
}

/** Narrative frame that joins the stops into one mission (docs/journey/story.md). */
export interface Story {
  title: string;
  premise: string;
  mission: string;
  /** Guide lines chosen by how many lamps are lit, never by what was chosen. */
  threads: { first: string; early: string; middle: string; late: string; return: string };
  outro: string;
}

export interface SceneBank {
  version: string;
  story?: Story;
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
