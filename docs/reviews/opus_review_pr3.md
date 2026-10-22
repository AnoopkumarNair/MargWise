# Independent review of PR #3 (claude/wizardly-thompson-cx3yeh vs origin/main)

Scope: only `git diff origin/main` (28 files). Reviewer: Claude Opus 5.5. No code changed by this review.

## What I ran
- `node --test engine/tests/engine.test.mjs`: 8/8 pass.
- `python3 pipeline/validate.py`: 0 errors, 0 warnings.
- `node hosting/tests/util.test.mjs`: pass.
- I ran the CI steps from `.github/workflows/build-check.yml` in a scratch clone: `RAW_STRICT=1 pipeline/run.py` gave no drift in content.json, latest.json or claims.json. `app/build.py` built cleanly. `engine/reference.py` ran 2274 checks with 0 mismatches. Only `hosting/public/manifest.json` (built_at) changes, and CI does not check that file.
- I wrote my own scripts to check the field offsets across 8 seeds, on random non-ideal profiles, and by first RIASEC letter. Results are under M5.
- Note: this diff has no `.github/` changes. The "CI changes" in the brief must have landed earlier.

---

## High

### H1. The privacy notice says only the Margwise team sees student data. School counsellors now see it too.
- `app/night-of-lamps.html:466` tells students: "Only the Margwise team can see it."
- `hosting/functions/api/review.js:30-34`: every counsellor key returns the name of every student in that school, and whether each student has finished.
- `review.js:41`: after a counsellor saves a baseline, the endpoint also returns the student's app top 3.
- Failure scenario: a Class 9 student (or the parent who agreed) is told the data stays with the Margwise team. Their school counsellor then reads the student's name and career result. This is a consent misstatement involving minors.
- Fix:
  - Update the in-game notice and the parent consent sheet so they say the student's school counsellor will see the name, completion status and top fields.
  - Optionally let the student opt in to counsellor review.
  - Do this before any minors use it.

### H2. "Order is enforced by the server" overstates what the code guarantees. The counsellor can easily see the app's answer before locking their picks.
- The student code is printed in two places:
  - the results footer (`#scLine`, right under the top 3 field cards);
  - the parent summary, which lists the top 5 "Areas to explore" (`night-of-lamps.html` paintParent/paintCode).
- The counsellor page asks for "a student code (from the student's summary page)".
- `PILOT_RUNBOOK.md` "At the school" step 3 says "The counsellor opens the summary". Step 1's baseline is on paper.
- So the server only proves the picks reached the database before the API returned the app top 3. It does not prove the counsellor had not already seen the result.
- Failure scenario: the counsellor reads the code off the summary, sees "Areas to explore: Engineering, Technology…", then enters those as their "own" picks. Overlap is inflated, and it is the headline pilot metric.
- Fix:
  1. At baseline time, store whether the student already had a `fields` event: `blind = NOT EXISTS(fields event with ts < now)`. Report overlap separately for blind and non-blind reviews.
  2. Runbook: the counsellor locks picks in `/counsellor/` before the student starts playing. Use the "my students" list, not the summary page.
  3. Move the code off the results and summary screens (for example to the welcome-back line), or show it before results.
  4. Soften the claim in PILOT_RUNBOOK.md.

## Medium

### M1. Counsellor reviews survive tester deletion and the retention purge
- `admin.js:120-123` (DELETE tester) and `_util.js` `purgeOld` delete `events` and `testers` but not `reviews`.
- A review row holds the student code, the counsellor's baseline and free-text notes about the student ("missed", "wrong", "notes").
- The admin Reviews tab uses an inner JOIN on testers, so orphan rows vanish from the UI but stay in D1 indefinitely.
- Failure scenario: a parent asks for deletion. The tester is deleted, but the counsellor's notes about that child remain.
- Fix: add `DELETE FROM reviews WHERE tester_id = ?` (and the `IN (SELECT …)` form in `purgeOld`) to both batches.

### M2. Retention is off, but the student notice promises deletion "about 31 January 2027"
- README and ARCHITECTURE now correctly say automatic deletion is off.
- The student-facing text (`night-of-lamps.html:467`) still promises a deletion date.
- The manual purge (`?purge=1`) deletes only rows older than `RETENTION_DAYS || 90` days. Nothing deletes everyone at the end of the pilot.
- `PILOT_RUNBOOK.md` has no step for end-of-pilot deletion.
- Failure scenario: students who join in December 2026 are still stored in March 2027.
- Fix:
  - Add an end-of-pilot step to the runbook, for example set `RETENTION_DAYS=1` and purge, or add an admin "purge all before date X".
  - Or set `RETENTION_DAYS` in production to match the promise.

### M3. Any counsellor in the school can take over another counsellor's review, and gets the app result without a blind baseline
- `review.js:37-41` and `55-61` never compare `reviews.counsellor_id` with `me.id`.
- `reviews.tester_id` is UNIQUE, so each student can have only one review.
- Failure scenario:
  1. Counsellor A locks picks.
  2. Counsellor B opens the same student: the GET returns A's baseline and the app top 3, so B was never blind.
  3. B submits the review against A's baseline. The CSV shows A's name.
- Fix:
  - Allow a review submit only when `counsellor_id = me.id` (admin excepted).
  - Return the baseline and appTop only to the counsellor who owns the review.
  - If several counsellors per student are wanted, key reviews on `(tester_id, counsellor_id)`.

### M4. The new migrations are not documented, and the endpoints fail without them
- `schema5.sql` and `schema6.sql` are not mentioned in any doc. ARCHITECTURE still says "Apply hosting/schema4.sql once".
- Without them, `/api/review` and Admin > Counsellor reviews throw "no such table" (a 500 error with no message).
- `schema6.sql`'s `ALTER TABLE … ADD COLUMN` fails if it is run twice.
- Fix: add "apply schema5.sql then schema6.sql once" to ARCHITECTURE and PILOT_RUNBOOK.

### M5. Field offsets: the validation claims are overstated, the change shifts misfit onto A- and S-first students, and the effect cannot be audited later
**The "held-out" seeds are not independent profiles.** `lib.mjs idealProfiles` always uses the same 120 RIASEC target orderings. The seed only changes journey noise (mean absolute trait difference 0.355 between seeds 4000 and 7777). This is a robustness check against noise, not a held-out set of new profiles. On the positive side, 240 random non-ideal profiles also improved: max/fair fell from 2.33 to 1.53. So the balancing does generalise.

Measured max/fair ratio (wins of the top field divided by a fair share), without and with offsets:

| Seed | Without offsets | With offsets |
| --- | --- | --- |
| 4000 (train) | 2.53 | 1.20 |
| 5000 (train) | 1.87 | 1.60 |
| 100 | 2.27 | 1.47 |
| 7777 | 2.27 | 1.60 |
| 1 | 2.67 | 1.73 |
| 12345 | 1.87 | 1.33 |
| 99999 | 2.13 | 1.73 |
| 31337 | 2.00 | 1.33 |

ARCHITECTURE says "about 1.2 to 1.6". Held-out seeds reach 1.73, and 1.2 comes from a training seed.

**The objective is a design choice, not a truth.** "Every field wins its fair share" means equal first places across 16 fields. Only 3 fields carry A (des, media, arts). Forcing equal shares takes wins away from Artistic-first students. Top field contains the student's first letter, out of 20 profiles per letter:

| First letter | Seed 7777 (without → with) | Seed 100 (without → with) |
| --- | --- | --- |
| A | 18 → 14 | 20 → 16 |
| S | 17 → 12 | 17 → 16 |
| R | 12 → 17 | 16 → 19 |

Overall first-letter agreement is roughly unchanged (91 → 89 and 97 → 103). So this is a redistribution of error, not a clear gain.

**The effect is large.** Offsets reach ±0.20 on a 0-1 percentile scale. The offsets change the top-3 set in 65 of 120 profiles at seed 7777. The pilot's counsellor overlap will therefore largely measure this offset decision.

**The test is close to circular.** `engine.test.mjs` checks the same quantity the fit optimised, with thresholds (≤1.9, ≤1 zero-win field) chosen after seeing the result. It is a fine regression guard. Note that with 120 draws over 16 fields, a max/fair of about 1.6-1.7 is near pure sampling noise, so the guard cannot show "balanced" beyond noise.

**The effect cannot be checked later.** The `fields` event logs biased scores with no release id or offset version. Later pilot analysis cannot reliably recover the unbiased order to test whether the offsets helped.

**The staleness key is narrow.** `fieldbias.json` is keyed only on `fieldRefKey` (careers and fields). Changes to the engine, the journey bank or refcal leave the offsets silently stale. The ranking test catches gross staleness only.

Fix:
- Log `release_id` (and the raw percentile scores) in the `fields` event.
- Reword "held-out validated" to "robust to journey noise on the same 120 target profiles".
- Document the per-letter trade-off in ARCHITECTURE/CALIBRATION.
- Consider a softer target, for example a share proportional to how many target profiles each field's area set covers, or shrinking the offsets by half.
- Fix the test comment: it says seeds 100 and 7777 are checked, but only 7777 is.

### M6. REVIEW_PROCESS.md describes a process the code cannot run
| The doc says | The code does |
| --- | --- |
| "Give high-risk batches to both reviewers, normal-risk batches to one" | `admin.js` `claims=generate` shuffles all 239 claims (132 high, 107 normal) into mixed batches. The CSV has no risk column. |
| "No quote means the verdict is not counted" | `claims=upload` accepts a verdict with an empty `says`, and the ledger counts it. |
| "Tie-breaker settles; record the decision in the notes" | There is no notes field. A tie-break is just another review. The report's status uses the set of all verdicts, so the item stays "disagree" forever. The ledger takes the latest row by id, so whichever CSV is uploaded last wins, not the tie-breaker. |
| "100 percent of high-risk claims reviewed twice" | Nothing checks this. `REQUIRE_REVIEWED` checks for at least one review. |

Fix: either change the doc or add the features: a risk filter on generate, a `says` requirement, and a "decision" verdict type that overrides earlier ones.

## Low

### L1. Races
- Two concurrent baseline POSTs both pass the `ex` check, and the second INSERT fails on UNIQUE. That is an unhandled exception, so a raw 500.
- Two concurrent review POSTs both run the UPDATE, last write wins, and both get `ok`.
- Fix:
  - Use `INSERT … ON CONFLICT DO NOTHING` and check `meta.changes`.
  - Use `UPDATE … WHERE tester_id = ? AND reviewed_at IS NULL` and check `meta.changes === 1`, else return 409.

### L2. The shared `admin_fail` counter
- Counsellor key failures count toward the admin lockout and the reverse (per hashed IP).
- Failure scenario: on a school NAT, 8 counsellor typos in 15 minutes lock out every counsellor (and the founder, if on site) at that address.
- `review.js` never prunes `admin_fail`; only an admin failure does. Failure IP hashes can therefore outlive the "24 hours" stated in the notice (these are counsellor IPs, but the spirit is the same).
- The key is not trimmed, so a pasted trailing space counts as a failure.
- Fix:
  - Use a separate counter, or a `kind` column.
  - Prune in `review.js`.
  - `.trim()` the key.

### L3. Student-code collisions
- `findTester` requires the 6-hex prefix to be globally unique across all schools.
- A collision with any other tester makes both students unreachable by code (404), while the "my students" list still shows them. Clicking that row then fails.
- Probability is small for the pilot: about N/16.7M per student; about a 3% chance of any pair at 1,000 testers, about 50% at 5,000.
- Fix: filter by `invite_id` in SQL first (counsellor scope), then require uniqueness. Or store the code as a column with a uniqueness check at join time.

### L4. Pick and result validation
- Picks are checked only against `/^[a-z]{2,8}$/`, not against the real field ids. A typo or tampered id silently scores 0 overlap.
- `appTop` comes from a client-posted `fields` event (any strings up to 12 characters). This is informational: only the student's own token can write it.

### L5. Docs inconsistencies
- `PILOT_RUNBOOK.md` contradicts itself. It has "How the counsellor reports back (to build next) … Until this page exists, use a shared spreadsheet" and also "Counsellor page (built)".
- ARCHITECTURE's "Admin sign-in locks out an address after 8 wrong keys" does not mention that counsellor attempts share the counter.

### L6. Ordering edge case
`appTop` uses `ORDER BY id DESC`. An old `fields` event flushed late from an offline queue after a newer walk would become "latest". This is rare.

---

## Verified OK
- **Cross-school isolation.** A counsellor key can reach only testers with `invite_id = counsellor.invite_id`. Testers on the master code (`invite_id` NULL) are admin-only.
  - A missing student and a student in another school get the same 404, so codes from other schools cannot be enumerated.
  - Enumeration within the school is moot, because the list endpoint already returns those codes.
- **Counsellor keys.** About 74 bits (15 characters from a 31-character alphabet; the modulo bias is negligible).
  - Generated with `crypto.getRandomValues`.
  - Only the SHA-256 is stored, and a fast hash is fine at this entropy.
  - Shown once.
  - Turning a key off takes effect on the next request.
  - The counsellor name on reviews comes from the key.
- **Server-side order logic.** The GET returns `baseline`/`appTop` only after a review row exists. A review needs an existing baseline, needs `reviewed_at` NULL, and recomputes `appTop` on the server. My objection is H2, not the code path.
- **`fields` semantics.** The logged `order` is exactly the displayed top 3 (`fits.slice(0,3)`). `APT_NUDGE = false`. The lean note does not reorder. The parent summary uses the same `state.fits`.
- **Overlap.** Picks are forced to 3 distinct values. The server's o3/o6 and the client's "n of 3 match" agree.
- **XSS and CSP.**
  - The counsellor page and the new admin code use `textContent` and `createElement` only.
  - `/counsellor/*` CSP is `script-src 'self'` with no inline script. Pages merges it with the global `'unsafe-inline'` policy as a second, stricter policy.
  - CSV export guards against formula injection (`csvCell`).
  - `fields.json` is public but contains only field names.
- **Retention code** (`purgeOld`): opt-in unless `RETENTION_DAYS` is set; force falls back to 90. README and ARCHITECTURE match the code. M2 is about the student notice.
- **Build and CI.**
  - `build.py` emits `counsellor/fields.json` from the accepted release (in sync with the committed file).
  - `extras.py` drops stale offsets with a warning.
  - The ranking test would fail without offsets (no offsets gives 2.27 > 1.9 at seed 7777), so a silent drop is caught.
  - All CI steps pass locally.
