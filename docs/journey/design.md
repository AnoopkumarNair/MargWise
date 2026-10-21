# Journey instrument (game-native interest sensing)

Status: DRAFT prototype, approved in principle by Anu (D-047). Uncalibrated.

## What it is

A walk across a map. At each stop the traveller sees four short activities and taps what they
would enjoy: once = "I'd do this", twice = "I'd love this", none = fine. Each activity carries
hidden loadings on the six interest areas (primary 1, one hexagon neighbour 0.5), so one tap
informs several areas. An adaptive estimator picks the next stop and ends the walk early
(8–15 stops, not 60) when the top three areas are separated from the rest.

## Model

Latent interest θ (six numbers). P(pick) = σ(β·w·θ + bias), P(love) = σ(β·w·θ + loveBias), each
option independent. MAP estimate by damped Newton with a Gaussian prior. Next stop maximises
tr(Σ·I). All constants live in `JOURNEY_CONFIG`, status `uncalibrated`.

## Design invariants (tested)

- 15 stops = every 4-subset of the six areas once: each area is primary 10×, secondary 10×, each
  pair shares 6 stops.
- No option, place or setup text names an area, the source instrument or "assessment".
- Display order of options is seeded per session, so slot carries no meaning; position bias is
  detected.
- Rule 4: no contingent feedback (the map's fog lifts a fixed amount per stop), no area hints,
  undo always available.
- Rule 5: teen results show a compass (top three lit), bands and explanations only.

## How we test it against the 60-item questionnaire

Simulated explorers (made-up levels, rule 1) answer both the 60 official items and the game. The
two responders use a different noise model from the estimator, so agreement is not circular.
Covered: every ordered three-letter code (120) × seeds, every single-area explorer, every ordered
pair of areas, uninformative play (flat, nothing picked, everything picked, random, always-first),
planted-fault meta-test (estimator with two areas swapped is rejected).

## What the tests cannot prove

They prove the estimator and the bank's structure. They cannot prove that an activity such as
"take the engine apart" really signals the Builder area; that needs expert review of every option
and the calibration study (consented sample plays the game and also answers the 60 items; compare
codes, then set thresholds). Until then results are labelled exploratory.

## Known limits of the draft

- 15 stops with a simulated top-three agreement of about 80–85%; a larger bank raises this (the
  engine takes any bank). Top-1 reorderings inside the true top three are the main error; a stranger
  area taking first place was 1 in 360 runs.
- Shape only: area levels are relative, and "broad interests" uses a spread threshold.
