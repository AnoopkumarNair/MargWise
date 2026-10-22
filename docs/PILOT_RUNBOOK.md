# Pilot runbook: who does what, in order

Plain version. One school, one counsellor, about 40 students (adults first, then a cleared Class 9 to 12 cohort).

## Before the school (founder, one-off)
1. Freeze a release: `python3 pipeline/run.py --accept`, build, deploy. Note the release id on the footer or at /manifest.json.
2. Get an independent person (education counsellor or you) to run the fact-check batches in the admin page; fix anything marked wrong or outdated; export the ledger.
3. Make **one invite code per school** in Admin > Invite codes (label = school name, use limit = class size plus a few, expiry = end of pilot). The game reads codes from that table, and every student who joins under it is tagged with the school in the Testers tab.
4. Get a signed scope and the parent consent sheet from the school. No minors before this.

## At the school (counsellor, per student)
1. **Talk first.** The student signs up with the school's code. The counsellor talks to them for 15 to 20 minutes, then **locks their own top 3 on `/counsellor/` before the student plays**. The page records whether the picks were locked before the student reached the results ("blind"). Only blind reviews count towards the headline match rate; the rest are reported separately.
2. **Student plays** (about 15 minutes) and saves or prints the parent summary. The summary shows the app's result, so the counsellor should not open it before step 1 is locked.
3. **Compare.** The counsellor opens the summary and records: how many of the app's top 3 fields match their own, whether the app missed something important, and whether any fact looked wrong.
4. **Report back to the founder** (the part to streamline): one form per student, not a meeting. See below.

## How the counsellor reports back (now built, see the last section)
A "Counsellor review" page in the admin area, one short form per student:
- Student code (shown on the student's summary page) and the school.
- Step 1, **locked with a timestamp before the app result is shown**: counsellor's own top 3 fields.
- Step 2: the app's top 3 appear. Counsellor ticks: matches (0 to 3), "app missed something important" (free text), "a fact looked wrong" (free text and which field), "would I use this with a real student?" (yes / with changes / no).
- The founder gets one CSV and one summary: average top-3 overlap, the fields most often missed, every flagged fact, and a yes/no count. Flagged facts go straight into the claims ledger; missed fields feed the question and balance fixes.
Until this page exists, use a shared spreadsheet with the same columns.

## After (founder, weekly)
- Fix the top three problems found; rebuild; accept a new release; tell the counsellor what changed.
- Judge against the frozen rules in PILOT_PLAN.md: 70% finish, 80% name a next step, zero unresolved critical fact errors, and the counsellor's "would use it" answers.

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
- **Database:** apply `hosting/schema.sql`, then `schema2.sql` to `schema7.sql` once each, in order (the `ALTER` lines fail if run twice).
- **Privacy notice:** the student notice says the school counsellor can see name, completion and results. The parent consent sheet must say the same. Get it checked before minors take part.
- **End of pilot:** delete each student's data in Admin > Testers ("Delete this tester's data", which also removes the counsellor review), or set `RETENTION_DAYS` and run `POST /api/admin?purge=1`. The student notice promises deletion by a stated date, so diarise it and check the audit log (`?audit=1`). Turn off every counsellor key.
- **Lockout:** counsellor and admin wrong-key attempts share one counter per network address, so several typos at one school can lock that address for 15 minutes.
