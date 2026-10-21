import type { SceneBank } from './types.ts';
import data from './data/scenes-v0.json' with { type: 'json' };

/** Draft stop bank (journey-v1). Wording and loadings await expert review. */
export const JOURNEY_BANK = data as SceneBank;
