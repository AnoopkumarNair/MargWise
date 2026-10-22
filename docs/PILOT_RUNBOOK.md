# Pilot runbook: who does what, in order

Plain version. One school, one counsellor, about 40 students (adults first, then a cleared Class 9 to 12 cohort).

## Before the school (founder, one-off)
1. Freeze a release: `python3 pipeline/run.py --accept`, build, deploy. Note the release id on the footer or at /manifest.json.
2. Get an independent person (education counsellor or you) to run the fact-check batches in the admin page; fix anything marked wrong or outdated; export the ledger.
3. Make **one invite code per school** in Admin > Invite codes (label = school name, use limit = class size plus a few, expiry = end of pilot). The game reads codes from that table, and every student who joins under it is tagged with the school in the Testers tab.
4. Get a signed scope and the parent consent sheet from the school. No minors before this.

## Two ways students take part
| | Self sign-up | Counsellor-led |
| --- | --- | --- |
| Who it is for | Known testers whose parents agreed (friends, family, adults) | Students at the school |
| How they start | Open the site, enter name and the invite code, tick the consent box | The counsellor adds them and starts the game on the counsellor's device |
| Consent | Tick box (self-declared) | Counsellor confirms a signed parent sheet is on file and gives its date; the app will not add the student without it |
| Counsellor sees | Everyone who joined with the school's code | Only the students they added themselves |
| Review blind? | Only if picks were locked before the student reached the results | Always (the game cannot start until the picks are locked) |

## At the school, per student (counsellor-led)
1. **Add the student** on `/counsellor/`: first name, class, consent-sheet tick and date, and whether the sheet also covers follow-up checks. A 6-character student code is made.
2. **Talk first.** Pick your own top 3 fields, add the career you had in mind, say how sure you are, and lock them. They cannot be changed.
3. **Start the game** on the same page and hand over the device. It signs the student in cleanly, wiping any earlier student's session. If the page is refreshed or the connection drops, the student taps **Continue your walk**.
4. **When they finish,** use Print or save as PDF on their results page for the parent copy.
5. **Review.** The page shows your picks beside the app's top 3 and the match count. Open the student's top field in the game and mark each part as right, needs a change, or something missing: subjects, exams, degree and plan B, colleges, abroad, pay, AI. Say whether the student's view changed after the chat and whether you would use this with a real student.
6. **Follow up** at 3, 6 and 12 months, only for students whose consent sheet covers it (the page refuses otherwise): which stream or path the student chose and whether they used the app's suggestions. This is what shows whether the app helped, which day-one agreement cannot. The student notice says follow-up notes (first name, class, notes) are kept for up to 12 months after the test; everything else goes at the end of the test. The end-of-pilot deletion must therefore skip students with follow-up consent until their last follow-up. Have a lawyer check this wording.
7. **Withdrawal.** "Remove" deletes everything about a student (game data, review, follow-ups); the removal is logged without the name.

## Reports
- Counsellor: `Report` on the counsellor page, with a date range, print or CSV. Averages appear only from 5 reviews because fewer is too few to mean anything; the list still shows your own students by name, which you already know.
- Founder: Admin > Counsellor reviews (all schools, CSV, blind-only and "sure"-only match rates, section feedback counts).

## How deep the counsellor checks
The match count only tests the field ranking. The depth (subjects, exams, colleges, abroad, pay, AI) is checked by the section ticks in step 5, for the student's top field, plus the free-text "something wrong" box. Each tick is counted in the admin summary, so a part that is often marked "needs a change" is the first thing to fix. Counsellors are not expected to verify every college or country; a section left unchecked simply is not counted. The fact-check process (docs/REVIEW_PROCESS.md) covers the underlying facts.

## Known limits
- The pilot uses **one counsellor per school**. Two independent counsellors per student would show how much counsellors disagree with each other, but it is a larger ask; the "sure / not sure" flag is used instead.
- The counsellor's picks are an opinion, not ground truth. Follow-ups are the stronger evidence.

## Who verifies what
| What | Who | When |
| --- | --- | --- |
| Facts are correct (exams, fees, pay, AI risk) | Independent reviewer or counsellor, via the admin fact-check batches | Before each release |
| Suggestions are sensible for a real student | School counsellor, using the steps above | During the pilot |
| The scoring maths does not change by accident | Automated tests in CI | Every change |
| Go, iterate or stop | Founder, using the frozen rules | Week 6 |

## Counsellor page (built)
- Page: `/counsellor/`. Each counsellor has a **personal key** (Admin > Counsellor reviews > Create counsellor key; shown once, only its hash is stored) tied to **one school's invite**. They see only that school's students, listed by name with a status, so there is no code typing and no mix-ups. Turn a key off in the admin page at any time. The student invite code is not used for this: it is shared with every student, so it cannot identify a counsellor.
- The student's **student code** (6 characters) also shows on the parent summary page and the results footer, as a fallback.
- Order is enforced by the server: the counsellor locks their own top 3, and only then is the app's top 3 returned. The counsellor name on each review comes from the key, not from typing.
- The founder sees all reviews, average overlap, "would use" counts, flagged facts and the fields most often missed in Admin > Counsellor reviews, with a CSV.

## Setup and teardown checklist
- **Database:** apply `hosting/schema.sql`, then `schema2.sql` to `schema9.sql` once each, in order (the `ALTER` lines fail if run twice).
- **Privacy notice:** the student notice says the school counsellor can see name, completion and results. The parent consent sheet must say the same. Get it checked before minors take part.
- **End of pilot:** delete each student's data in Admin > Testers ("Delete this tester's data", which also removes the counsellor review), or set `RETENTION_DAYS` and run `POST /api/admin?purge=1`. The student notice promises deletion by a stated date, so diarise it and check the audit log (`?audit=1`). Turn off every counsellor key.
- **Lockout:** counsellor and admin wrong-key attempts share one counter per network address, so several typos at one school can lock that address for 15 minutes.

## What the student sees on each field page (explanation panel)
For each suggested field the page shows: the three choices that pointed there (with the stop name and the card), one choice that pointed elsewhere, how the field lines up with the student's types, what is still uncertain (a close neighbour, thin evidence, spread-out choices, interest not ability, US-based data) and what to try next. The effect of each choice is measured by leaving it out and re-scoring the field. The question bank is documented card by card in `docs/QUESTION_MAP.md` (generated, kept current by CI) and the wording audit in `docs/CARD_AUDIT.md`.
