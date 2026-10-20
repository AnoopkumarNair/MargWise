/**
 * Assessment thresholds (03 §2.3–2.5) in one place.
 *
 * STATUS: UNCALIBRATED. These are the provisional values from the spec, not
 * values estimated from Indian students. They change only with Anu's approval
 * after the validation work in 03 §2.8; tests pin them so a change is visible.
 */
export const ASSESSMENT_CONFIG = {
  status: 'uncalibrated',
  /** ≥ this many of 60 identical responses → offer to redo a day. */
  straightLiningMinIdentical: 54,
  /** max − min area score ≤ this → flat profile ("Broad interests right now"). */
  flatProfileMaxRange: 6,
  /** Every area ≤ this → low engagement note. */
  lowEngagementMax: 10,
  /** Every area ≥ this → high engagement note. */
  highEngagementMin: 30,
  /** Area scores within this many points are ties (≈ 1 SE at α ≈ .87). */
  tieWithin: 3,
  /** Pearson r cut-offs for match bands. */
  strongMinR: 0.5,
  mixedMinR: 0,
} as const;

export type AssessmentConfig = typeof ASSESSMENT_CONFIG;
