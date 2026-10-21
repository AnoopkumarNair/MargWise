import { matchCareers, type CareerMatch, type Profile } from '../assessment/matching.ts';

export interface CareerVector {
  careerId: string;
  values: Profile;
}

/**
 * Career paths for a journey profile. The profile always has a shape, so every
 * path gets a band; how sure the walk is lives in `JourneyResult.confidence`.
 */
export function careerPaths(profile: Profile, careers: readonly CareerVector[]): CareerMatch[] {
  return matchCareers(profile, [...careers], false);
}

export interface DreamComparison {
  /** Paths the traveller named that the walk also lights (strong or mixed). */
  lined: string[];
  /** Paths the traveller named that the walk points away from (weak). */
  pulls: string[];
  /** Strong paths the traveller did not name (at most three). */
  newDoors: string[];
}

/** "Predict, then reveal": compares paths named before the reveal with what the walk showed. */
export function compareDreams(
  dreamIds: readonly string[],
  matches: readonly CareerMatch[],
): DreamComparison {
  const band = new Map(matches.map((m) => [m.careerId, m.band]));
  const named = [...new Set(dreamIds)].filter((id) => band.has(id));
  return {
    lined: named.filter((id) => band.get(id) === 'strong' || band.get(id) === 'mixed'),
    pulls: named.filter((id) => band.get(id) === 'weak' || band.get(id) === 'unclear'),
    newDoors: matches
      .filter((m) => m.band === 'strong' && !named.includes(m.careerId))
      .slice(0, 3)
      .map((m) => m.careerId),
  };
}
