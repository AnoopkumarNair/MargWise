# Calibrating the Night of Lamps instrument

Status on 21 Oct 2026: prototype with face validity only. Nothing below has been done on real students yet.

## What exists
- 60 forced-choice options (15 places x 4), each loaded 1.0 on one RIASEC type and 0.5 on a neighbouring type.
- Engine: multinomial logit with a "keep" option, MAP estimate, N(0,1) prior, beta 1.5, minStops 8, stopZ 1. Marked `uncalibrated`.
- Results are ipsative (relative within a person). They rank a person's own interests. They do not compare people.
- Best-case simulation (400 synthetic players who answer exactly as the model assumes, noise 0.8): true top interest recovered 67%, top-3 overlap 84%, rank correlation with truth 0.83, repeat-play rank correlation 0.77, mean 13.9 places, 17% "broad". Real people will do worse. This is a ceiling, not evidence.

## Steps
0. Freeze v0.1 (items, loads, engine config). Fix the weak items. Write down pass criteria before collecting data.
1. Usability and item pilot, 30 to 50 testers (the hosted test). Collect walk data, six self-ratings, overall "sounds like me", feedback. Check completion, time per place, option pick-rates (flag >85% or <5%), position bias, per-person rank correlation between walk profile and own ratings. Interview 5 to 8 students, think-aloud, on item wording.
2. Criterion validity, 100+ students, Class 9 to 12, mixed boards, genders, cities. Same students take an established inventory (O*NET Interest Profiler short form). Targets set in step 0, for example median convergent r >= 0.5 per type. Test the RIASEC circumplex order. Test gender differential item functioning.
3. Test-retest, 50+ students, 2 to 3 weeks apart. Target profile rank correlation >= 0.7 and top-3 overlap >= 0.7.
4. Calibrate the engine on data: beta, prior, stopping rule (stop on target precision, not a fixed z), "broad" and "no signal" thresholds from the distribution of random responders and real data. Re-run the simulation with real response patterns.
5. Content validity: panel of 3 counsellors rate each option against its intended type (target CVI >= 0.8).
6. Outcome follow-up: stream and course chosen, and satisfaction, at 6 and 12 months.
7. Governance: parental consent, ethics advice, DPDP compliance, content refresh every admission cycle.

## Who
A part-time psychometrician, a counsellor panel, 3 to 5 partner schools with consent, a named owner for school-path facts.

## Earliest honest claim
After steps 1 to 3 pass: "interest snapshot with known reliability". "Fit" or "strong match" language should wait for step 6 evidence.
