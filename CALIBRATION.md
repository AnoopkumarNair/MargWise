# Calibrating the Night of Lamps instrument

Status on 21 Oct 2026: prototype with face validity only. Nothing below has been done on real students yet.

## What exists
- 60 forced-choice options (15 places x 4), each loaded 1.0 on one RIASEC type and 0.5 on a neighbouring type.
- Engine: multinomial logit with a "keep" option, MAP estimate, N(0,1) prior, beta 1.5, minStops 8, stopZ 1. Marked `uncalibrated`.
- Results are ipsative (relative within a person). They rank a person's own interests. They do not compare people.
- Best-case simulation (400 synthetic players with independent, uniformly drawn true profiles who answer with a threshold-and-noise rule, noise 0.8; this is an optimistic check of the engine's own assumptions, not evidence about real students): true top interest recovered 67%, top-3 overlap 84%, rank correlation with truth 0.83, repeat-play rank correlation 0.77, mean 13.9 places, 17% "broad". Real people will do worse. This is a ceiling, not evidence.

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

## Additions after the second independent review (21 Oct 2026)
- O*NET interest figures are 0 to 100 scores of occupation profiles. Pay figures shown for US careers are *medians* from O*NET and BLS, not means.
- Ipsative handling: a student's profile is mean-centred, so a high score means "higher than their own other areas". Do not read profiles as absolute levels or compare students directly.
- Field ranking is standardised against a null distribution of random profiles, so fields with many broad careers do not win by default. Validate the field ranking separately: do students' later choices and counsellor judgements agree with the top fields?
- Power analysis: with 100 students, a convergence correlation of 0.5 has a 95% interval of roughly 0.33 to 0.64. Report intervals, not single numbers, and decide thresholds before looking at data.
- Differential item functioning: check each activity card by board (CBSE, ICSE/ISC, state), urban and rural, and gender, so no card works differently for one group.
- Validity of the O*NET Interest Profiler short form for Indian teenagers is itself not established. Use it as a reference, not as truth, and add counsellor ratings as a second criterion.
- Random-responder null distributions: simulate players who tap at random or always pick the first card and set the "no signal" and "broad" thresholds so they are flagged.
- Controlled-test status: the hosted build is for adult testers, or for minors only with parental agreement collected by the test owner. A verifiable parental consent flow is needed before any wider student use.
