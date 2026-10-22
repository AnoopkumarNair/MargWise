# Fact-check process (who, what, when)

Goal: before every release, every high-risk fact has been checked by a person against an official page, and nothing known to be wrong or out of date ships. Facts are public, so reviewers never see the game or the scoring.

## 1. What gets checked
`pipeline/run.py` builds `claims.json`: about 240 single facts, each with a **stable id**, a **risk level** and the official pages to check.
- **High risk (about 130):** exams and eligibility, degree lengths, abroad fees and rules, India pay, AI-exposure labels. Wrong ones can change a family's decision.
- **Normal risk:** school subjects, plan B text, early-steps advice, "verify" notes.
A verdict follows the claim id. If a statement is edited, its id changes and it needs a new check.

## 2. Roles
| Role | Who | Does |
| --- | --- | --- |
| Coordinator | Founder | Generates the set, hands out batches, loads answers, makes the edits, signs off |
| Reviewer A, B | Two different people (a counsellor, an admissions-aware parent, a final-year student all work). Not the founder | Check facts only. No expertise beyond reading the official page |
| Tie-breaker | A counsellor or the exam body's helpdesk reply | Decides when A and B disagree |

## 3. Cycle (about 1 to 2 hours per reviewer per batch of 12 to 15)
1. **Coordinator:** Admin > Fact checks > Generate a set. Batches of 12. Give high-risk batches to **both** reviewers, normal-risk batches to **one**.
2. **Reviewer:** for each task, open the official page, then record the verdict (correct / wrong / outdated / cannot find), paste the exact words the page says, and the date checked. Rule: no quote, no verdict. If the page cannot be found, write "cannot find" and say where you looked.
3. **Coordinator:** load each CSV (enter the reviewer's name). Report shows: correct, needs change, disagree, unreviewed.
4. **Disagreements and "cannot find":** the tie-breaker settles; record the decision in the notes.
5. **Fix:** edit `data/content.py`, `data/abroad.json` or `data/plfs_2025.json`; run `python3 pipeline/run.py` and read `data/releases/CHANGES.md`. Mark the finding applied.
6. **Gate:** Admin > export ledger (`?claims=ledger`), save as `data/ledger.json`. The pipeline now fails on any claim still marked wrong or outdated. For a pilot release run with `REQUIRE_REVIEWED=1` so it also fails if any high-risk claim has no review.
7. **Release:** `python3 pipeline/run.py --accept`, build, deploy. Write the release id and date in the pilot log.

## 4. Cadence
- Before every release and every school pilot: all high-risk claims (two reviewers).
- Exam notices before admission season; abroad rules quarterly; AI exposure when BLS or the Economic Index updates; PLFS, O*NET yearly; exchange rates monthly.
- Anything a counsellor flags in the pilot form goes in the next cycle immediately.

## 5. Quality of the check itself
- Reviewer sign-off is a name plus a date next to each verdict. No quote means the verdict is not counted.
- Spot-check: the coordinator re-checks 10 percent of "correct" verdicts personally.
- Target for the pilot: 100 percent of high-risk claims reviewed twice, zero unresolved wrong or outdated, normal-risk 100 percent reviewed once.

Reviewer answers never change live content automatically. See `docs/ARCHITECTURE.md`.
