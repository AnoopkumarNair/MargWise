# Six-week pilot plan (decision, not just a demo)

Purpose: decide GO, ITERATE or STOP on a school-first, low-touch career exploration workflow. Two tracks run together: (A) commercial, would a school pay; (B) product, can students complete it and name a next step. The pilot cannot prove long-term career outcomes or the validity of the ranking. Thresholds are frozen before any data is seen and revised only in a written next version.

Owner for every line below: the founder, unless a name is added here.

| Week | Actions | Output and gate |
| --- | --- | --- |
| 0 | Freeze engine and content version (accept a release). Label results "areas to explore". Puzzle nudge stays off. P0 items fixed. Draft consent notice, data inventory and research scripts | Versioned baseline, pre-registered metrics, no open P0 |
| 1 | Contact 20 schools in one reachable area. Target 5 buyer and 3 counsellor interviews. Ask about the current process, budget owner, alternatives. Do not pitch first | Ranked pain points, named budget owner. Continue only if a recurring problem is confirmed |
| 2 | 3 counsellors review 8 to 12 synthetic profiles (blind: they choose fields first, then see Margwise). 20 to 30 fact checks to 1 or 2 reviewers. Send two price points to matched schools | Disagreement log, claim defect list, two written pilot proposals |
| 3 | 30 to 50 adult testers run the whole journey. Fix critical UX defects. Run the automated suite | Completion, time, errors, comprehension. Regression report |
| 4 | Signed pilot scope and data-handling agreement with one school. Legal and privacy review. Train one coordinator. No real minors before this gate | Signed scope, consent workflow |
| 5 | One or two cleared cohorts. Compare with a wait-list or the school's current resource where possible | Completion, comprehension, exploration breadth, next steps, staff effort |
| 6 | Analyse against the frozen thresholds. Decide | GO, ITERATE or STOP memo with limits, price and the buyer's renewal decision |

## Frozen decision rules

| Track | Measure | Rule |
| --- | --- | --- |
| Commercial | Qualified buyer interviews and paid conversion | After 20 qualified outreach attempts: at least 8 substantive interviews, 2 written pilot proposals, 1 paid pilot. If every prospect only wants free access, change the offer or segment |
| Usability | Completion and time | At least 70% finish without help; median time at or below 20 minutes (check by device) |
| Comprehension | Can the user say what the result means and one next step | At least 80% name a concrete next step and understand the result is exploratory |
| Trust and content | Critical claim errors | Zero unresolved critical or high-impact factual errors in checked claims |
| Model QA | Handling of random, positional and flat players | Flag at least 90% as cautious while keeping false caution on consistent profiles low |
| Reliability (later) | Test-retest after 2 to 3 weeks | Profile-rank correlation 0.70 or more and top-three overlap 0.70 or more, as hypotheses |
| Unit economics | Onboarding and support effort | Record minutes, human review cost, cost per completed student. Do not scale if effort grows linearly with students |
| Renewal | The buyer's real annual decision | A signed annual order or a written reason for no is stronger evidence than satisfaction scores |

## Kill criteria

Stop or change the offer if, after Week 2, no school budget owner is willing to pay anything for the workflow, or if counsellors in the blind review would not use the output with a real student even after the wording fixes.

## What the pilot must not claim

That the tool selects the right career or predicts success; that a counsellor's impression is psychometric validation; causal impact from one unrandomised cohort; adult findings as adolescent validity.


## Version freeze and think-aloud (added after the storyline review)
- **Freeze before data collection:** record the release id (`/manifest.json`), the engine hash, `data/fieldbias.json` and the card wording as the pilot version. Changes during the pilot are logged with the reason and tested as a separate version afterwards.
- **Think-aloud (8 to 12 students, one counsellor, 20 minutes):** before play, ask the student to explain in their own words what the two flasks mean. At three stops, ask why they chose their cards and what each card meant. Then show the same activity in plain neutral wording (without the story and cost clause) and ask whether their choice would change. Record cards that were misread, cards chosen because they sounded kind, clever or brave, and any stop they did not understand or remember afterwards.
- **Item pass criteria (set in advance):** at least 80 percent can explain the flask mechanic; no card is chosen in more than 70 percent or fewer than 10 percent of showings; oil share by screen position stays between 20 and 30 percent; at most 10 percent of think-aloud choices change under neutral wording.
