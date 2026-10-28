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
6. **Follow up** at 3, 6 and 12 months, only for students whose consent sheet covers it (the page refuses otherwise): which stream or path the student chose and whether they used the app's suggestions. This is what shows whether the app helped, which day-one agreement cannot. The student notice says follow-up notes (first name, class, notes) are kept for up to 12 months after the test; everything else goes at the end of the test, which `?endpilot=1` does. Have a lawyer check this wording.
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
- **Database:** apply `hosting/schema.sql`, then `schema2.sql` to `schema12.sql` once each, in order (the `ALTER` lines fail if run twice). **Apply the schema before deploying the code**: `join.js` writes `testers.ret_hash`, so sign-ups fail if the column is missing.
- **Privacy notice:** the student notice says the school counsellor can see name, completion and results. The parent consent sheet must say the same. Get it checked before minors take part.
- **End of pilot:** run `POST /api/admin?endpilot=1`. It deletes every student's game data and counsellor review, and deletes students without follow-up consent completely. Students whose consent sheet covers follow-ups keep only first name, class, consent date and follow-up notes, as the student notice says. Counsellor keys stay active until the last follow-up, then turn them off. A single student's data can be removed any time in Admin > Testers ("Delete this tester's data") or by the counsellor ("Remove"). Check the result in the audit log (`?audit=1`). The student notice promises deletion by a stated date, so diarise it and check the audit log (`?audit=1`). Turn off every counsellor key.
- **Lockout:** admin and counsellor wrong-key attempts have separate counters per network address (30 wrong keys in 15 minutes locks that address out of that area only).

## What the student sees on each field page (explanation panel)
For each suggested field the page shows: the three choices that pointed there (with the stop name and the card), one choice that pointed elsewhere, how the field lines up with the student's types, what is still uncertain (a close neighbour, thin evidence, spread-out choices, interest not ability, US-based data) and what to try next. The effect of each choice is measured by leaving it out and re-scoring the field. The question bank is documented card by card in `docs/QUESTION_MAP.md` (generated, kept current by CI) and the wording audit in `docs/CARD_AUDIT.md`.

## Shared devices
A counsellor-led sign-in lasts 6 hours. After 30 idle minutes the game asks "Is this still <name>?" when it is loaded again; a tab left open and untouched is not re-checked, so the counsellor should press Not you? or start the next student from the counsellor page. Do not use the same browser profile for several students at once.

## Pilot item analysis
Admin `?itemstats=1` shows how often each card is picked and the share of oil spent on each screen position (about 25 percent each is expected). A strong position effect or a card picked far more or less than the others is a wording problem to review after the pilot, not during it.

## Testing the hosted site on tablets and desktops
`app/tests/hosted_tablet.mjs` plays the whole game on the live site at five tablet viewports (iPad and Android tablet, portrait and landscape), saves a screenshot of every screen, and flags any control outside the viewport or any horizontal scroll. It needs a valid invite code for the site (create a throw-away code in Admin > Invite codes, and delete the test students afterwards): `SITE=https://margwise.byteheaven.in/ CODE=<code> OUT=/tmp/shots node app/tests/hosted_tablet.mjs`. Layout: phones keep one column; from 700px wide the reading and result screens widen to up to 1040px with 2 to 3 columns, and the art scenes stay a portrait stage with the scene's own art blurred behind the sides.

# Adult

This section is for the adult app at `/work/`. The owner runs every step that touches production. Agents write and update this text. Lines marked TODO(owner) need your input.

Never apply SQL to the live database from an agent session. Never push to `main` from an agent session.

## 1. Releasing the graph
1. Read `CHANGES.md` and the graph change report.
2. Check that `python3 pipeline/check_registry.py` passes.
3. Run `python3 pipeline/run.py --accept` for the graph (TODO(owner): confirm the exact accept command once the graph pipeline exists).
4. Rebuild and check the release id appears in the app and in `manifest.json`.
5. Tag the commit `graph-<release_id>`.
6. The last 3 releases stay served. Older ones stay in git tags.

## 2. Migrations
Migrations only add. They are never rolled back. Run the `wrangler` and `sqlite3` commands from `hosting/` (where `wrangler.toml` is) and the `node` commands from the repo root. Use `npx wrangler@4` so the Wrangler version is fixed. The database names come from `hosting/wrangler.toml`: the live database is the one named there, today `margwise-test`; preview will be `margwise-preview` once you create it.
1. List what is applied, first on preview, then on production:
   - `npx wrangler@4 d1 migrations list margwise-preview --remote`
   - `npx wrangler@4 d1 migrations list margwise-test --remote`

   Without `--remote`, Wrangler lists the local copy on your computer, not the real database.
2. Rehearse on a local copy of the production export:
   - `npx wrangler@4 d1 export margwise-test --remote --output prod.sql` (this file holds personal data: keep it on your computer and delete it afterwards).
   - Load it: `sqlite3 prod.sqlite < prod.sql`. Apply the new migration files to `prod.sqlite` with `sqlite3`.
3. Apply to preview: `npx wrangler@4 d1 migrations apply margwise-preview --remote`. Run the smoke test (section 3).
4. Apply to production: `npx wrangler@4 d1 migrations apply margwise-test --remote`. Then take a fresh export as in step 2 and run the invariant checker on it: `node hosting/tools/check_invariants.mjs --db hosting/prod.sqlite`. The checker needs a SQLite file, or the `.sql` file from `wrangler d1 export` (it loads that into memory itself): `node hosting/tools/check_invariants.mjs --db hosting/prod.sql`.

**First time on production: compare the schema, then mark the baseline as applied without running it.** `0000_baseline.sql` describes tables that already exist in production. Every statement in it is `CREATE ... IF NOT EXISTS`, so running it would not change existing tables or rows. The real risk is different: it would hide schema drift. If a production table differs from the baseline, the `IF NOT EXISTS` statement skips it silently, and the database looks migrated when it is not.
1. Compare the production schema with the baseline. Export the schema only (`npx wrangler@4 d1 export margwise-test --remote --no-data --output prod-schema.sql`), load the baseline into an empty database (`sqlite3 base.sqlite < migrations/0000_baseline.sql`) and the export into another (`sqlite3 prod-schema.sqlite < prod-schema.sql`), then compare the tables, columns and indexes of the two. Any difference must be explained before you go on. TODO(owner): record the result here.
2. Record `0000_baseline.sql` as applied without running it. TODO(owner): write the exact command and check it on preview first (the `d1_migrations` table records applied names).
3. Run `npx wrangler@4 d1 migrations list margwise-test --remote`. It must show `0000_baseline.sql` as applied and nothing else pending except new files.

**Settings to check after a deploy.** Emails are only really sent when `ENVIRONMENT=production` is set on the production deployment (or `EMAIL_DRY_RUN=0`). Without it, emails stay in dry-run mode. Health shows this as `flags.email_dry_run`; on production it must be `false`.

## 3. Deploying
1. Deploy to preview first. Run the end-to-end suite against the preview URL.
2. Deploy to production. TODO(owner): list the deploy command and project name.
3. Smoke test: the health endpoint, sign-up with your own address, roads for a test title, export and delete of a test account.
4. Confirm the feature switches in the health output match what you intend.

## 4. Rollback
1. Use the Pages rollback to the previous deployment.
2. Do not roll back migrations. Fix forward.
3. Stored profiles stay valid after a graph rollback because ids are stable.

## 5. Rotating a key
1. Add the new key version.
2. Deploy.
3. Wait out the overlap period. TODO(owner): set the overlap length.
4. Remove the old version.
5. If a key may have leaked: rotate at once and set `tok_after` so older sign-in tokens stop working.

## 6. Incidents and breaches
**Severity.** TODO(owner): define levels, for example: 1 = personal data exposed or site down; 2 = a feature broken; 3 = a cosmetic or data error.

**First steps.**
1. Contain: switch off the feature, rotate keys, or take the page down.
2. Assess: was personal data read, changed or lost? Which people? Which fields?
3. Decide whether to notify. Write the decision and the reason down.

**Breach notice (DPDP).** TODO(owner): add the steps and deadlines after the lawyer's review.

**Post-mortem template.**
- Timeline: what happened and when.
- Cause.
- The fix.
- The test or invariant that now stops it happening again.

## 7. Support
- Every adult page shows the `help@` address. TODO(owner): set the address.
- Reply within 3 working days.
- Keep a short FAQ built from real questions.
- Data requests (see, correct, delete) use the same self-service tools as users. Log each one. Never log the person's data in the log.

## 8. Routine checks
TODO(owner): choose the days. A starting point:
- Weekly: look at the error log and the health endpoint. Check the support inbox.
- Monthly: run the invariant checker on production. Check that the last 3 graph releases are served.
- Before each release: CI is green and `docs/adult/deviations.md` is current.
- Yearly: review key ages, the privacy notice and the vendored libraries (`hosting/public/vendor/VERSIONS.md`).
