# Independent review: PR #4 (counsellor-led mode)

Scope: `git diff origin/main` on `claude/wizardly-thompson-cx3yeh` (16 files). I only reviewed the diff. Findings from `opus_review_pr3.md` are not repeated.

## How I checked

- `node --check` on every `hosting/functions/api/*.js` file, `counsellor.js` and the 5 inline scripts of the built `hosting/public/index.html`: all pass.
- `node --test engine/tests/engine.test.mjs` passes (0 fail). `node --test hosting/tests/util.test.mjs` passes. `python3 pipeline/validate.py` reports 0 errors and 0 warnings.
- The built `app/dist/index.html` and `hosting/public/index.html` contain the new code (`saveWalk`, `walk_resume`, `gStart`, the 30-minute expiry). The `page_sha256` in the manifest matches `hosting/public/index.html`.
- I ran `wrangler pages dev` locally on a fresh D1 with `schema.sql` through `schema8.sql` applied in order. All 8 schemas apply cleanly. The setup was 2 schools, 3 counsellors (CA and CA2 at school A, CB at school B), 1 self-signup student and 1 counsellor-led student. I then ran the scenarios quoted below. The server was stopped with `fuser -k 8791/tcp`.

## Findings

### High

**H1. The start link puts a permanent credential in the URL, and replaying the link signs the device in as that student again.**
- Where: `hosting/public/counsellor/counsellor.js:23`, `hosting/functions/api/review.js:74-79`, `app/night-of-lamps.html:661`.
- What happens: `start` returns `sign(t.id)`. This is the same HMAC as the join token. It has no expiry and cannot be revoked; it only stops working when the student is deleted. The counsellor page then navigates to `/?t=<id>&k=<token>&n=<first name>`.
  - `history.replaceState` changes the URL in the address bar. It does not remove the visit from the browser's history, from omnibox suggestions or from Chrome Sync.
  - The full query string also reaches the edge as an ordinary GET, so Cloudflare request logs (and any TLS-inspecting school proxy) can record it.
  - `Referrer-Policy: no-referrer` is set, so referrer leakage is fine.
  - The 30-minute "expiry" is client-side only, and it restarts from `at: Date.now()` every time the link is opened.
- Failure scenario: a shared school laptop. Later, student C picks the old `/?t=...` entry from history or from the address-bar suggestions. The page silently signs C in as student A and wipes the local save and walk. Every event C sends lands on A's record. This also breaks the review (see M2).
- Anyone who copies the link can post events for A indefinitely, and can overwrite A's `fields` result before the counsellor reviews.
- Suggested fix: the counsellor page is on the same origin as the game. It can write `margwise.tester` to `localStorage` itself, wipe `margwise.save` and `margwise.walk`, and then go to `location.href = '/'`. No credential goes in the URL. If a URL hand-off is still wanted:
  - Use a single-use nonce that expires in 5 minutes (stored server-side) and exchange it with a POST for the token.
  - Put it in the `#fragment`, not the query.
  - Make tokens carry an expiry (`sign(id + '.' + exp)`) and check it in `event.js`.

### Medium

**M1. The report leaks another counsellor's locked picks and review to every counsellor at the same school.**
- Where: `review.js:33` (`report`) and `review.js:38`.
- What happens: the report selects every school student with `counsellor_id IS NULL` (all self-signups) and LEFT JOINs `reviews` without `r.counsellor_id = me.id`. `GET ?code` hides the same rows as `taken` (`review.js:55`), so the two rules disagree.
- Verified locally: CA2 baselined and reviewed a self-signup student. `GET ?code` for CA returned `{state:'taken'}`. CA's `?report=csv` then showed CA2's `own_top3 ["med","law","eng"]`, `blind yes`, `app_top3 law arch med`, `match 2` and `would_use yes`. The JSON rows showed `state: reviewed`, `match 2` and `use yes`.
- This is not a blind-order bypass. `app_top` is only stored after a review, and once any review row exists the second counsellor cannot baseline that student.
- Fix: in the report, null out the review columns unless `me.admin || r.counsellor_id = me.id`, for example with `CASE WHEN`. The alternative is to state in the runbook that all counsellors at a school share reviews.

**M2. The app result used for the review is "the latest `fields` event", so a replay or a wrong-student session changes it.**
- Where: `review.js:26-29` (`appTop`, `ORDER BY id DESC`) together with the start flow.
- What happens: after the student finishes, a led session stays signed in. Nothing clears it when results are reached, and the 30-minute check only runs on page load. Any later play on that device or tab posts a new `fields` event as A. Examples: "Walk the road again", the next student using the open tab, or the H1 replay.
- The counsellor's compare screen and the stored `app_top` and `overlap` then reflect the wrong walk.
- Fix: freeze the app result at the first `fields` event after `baseline_at`. For example, select `... AND ts >= ? ORDER BY id ASC LIMIT 1`, or store `app_top` the first time a `fields` event arrives for a baselined student. For led sessions, also drop `margwise.tester` (or show a "Hand back to counsellor" screen) once `fields` is tracked.

**M3. Any counsellor at the school can delete, or add follow-ups to, a self-signup student whose review belongs to another counsellor.**
- Where: `review.js:80-88`. `remove` and `followup` only check `visible()`.
- Verified: CA added a follow-up to the student CA2 had reviewed and then removed that student, which deleted CA2's review. `remove` is irreversible and only leaves `{code, by}` in the audit table.
- Fix: when `ex && ex.counsellor_id !== me.id && !me.admin`, refuse `remove` and `followup`, or send the deletion to admin. If school-wide withdrawal by any counsellor is intended, document it.

**M4. Small-group suppression does not protect anything, and the runbook says it does.**
- Where: `review.js:36-38` and `docs/PILOT_RUNBOOK.md:30`.
- What happens: the totals are hidden below 5 reviews, but the same JSON and CSV list every student by name with `match` and `use`. The page renders them, and the Print button prints them.
- Verified: with `reviewed: 1` the totals were withheld, yet the row `name … match 2, use yes` was returned.
- The claim "so a small class cannot be read off by name" is false.
- Fix: either drop the claim (counsellors already see their own students), or for groups under 5 drop the per-row `match` and `use` from the printable and CSV report.

**M5. Follow-ups at 6 and 12 months contradict the promised deletion date and the end-of-pilot teardown.**
- Where: `docs/PILOT_RUNBOOK.md:26` and `:57`, and the student notice at `app/night-of-lamps.html:480`.
- The notice says data is deleted at about 31 January 2027. The teardown says to delete each student and turn off every counsellor key.
- Follow-ups live under `tester_id` and are purged with the student (`_util.js:29`). A 6- or 12-month follow-up for a student added in October 2026 therefore needs data kept past the promised date, plus a live key.
- Fix: either extend the stated retention and the parent consent wording, or keep follow-ups under a pseudonymous ID that survives the deletion of game data. Update both documents to match.

**M6. Resume is lost whenever a led session is restarted or idles past 30 minutes, and the student is then stranded.**
- Where: `night-of-lamps.html:661-662`.
- The start link always removes `margwise.walk`, even when it restarts the same student. `readWalk` requires a live TK, but TK has a 30-minute idle expiry while the walk lasts 2 hours. After a 30-minute break (a class bell, a long lock puzzle followed by a reload), the page shows the self-signup cover, which asks for an invite code a led student does not have.
- The counsellor's only remedy is Start, and Start wipes the walk. The student replays from lamp 0, and the second set of `walk_start`/`place_done` events is counted again in admin `walks`/`places`.
- The walk is also cleared at `toDreams` (`:1129`). A refresh on the dreams, context or results screens before `fields` is sent loses the whole walk. The runbook says only "if the page is refreshed … tap Continue your walk".
- Fix:
  - Only wipe the walk when `walk.tid !== t`.
  - When an expired TK had `led`, show "Ask your counsellor to restart" rather than the sign-up form.
  - Consider clearing the walk only after `fields` has been tracked.

### Low

**L1. Invalid consent dates are accepted.**
- Where: `review.js:65`. `DATE` only checks the shape and `Date.parse('2026-99-99')` is `NaN`. `NaN > x` is false, so the date passes.
- Verified: `consent_on: '2026-99-99'` was stored, and the audit row says the same.
- There is also no lower bound.
- Fix: `const d = Date.parse(on); if (!Number.isFinite(d) || new Date(d).toISOString().slice(0,10) !== on || d > now + 864e5 || d < now - 400*864e5) reject`.

**L2. A stale "Continue your walk" button survives a resume.**
- Where: `night-of-lamps.html:1717`. The button and its captured `rw` snapshot are painted once, at init.
- After the student resumes and finishes, `again` or `Walk the road again` goes to `show('welcome')`. The old button is still there ("Continue your walk (5 lamps lit)") and it replays the old partial snapshot. Because of M2, that replay then overwrites `fields`.
- Fix: remove the button in `resumeWalk` and `startWalk`, or repaint `paintTester()` on `show('welcome')`.

**L3. Undo does not update the saved walk.**
- Where: `night-of-lamps.html:1098-1115`. The back and undo path changes `state.choices` without calling `saveWalk()`.
- A reload right after an undo restores the undone choice. It corrects itself on the next light.
- Fix: call `saveWalk()` after `M.undo`.

**L4. Students are orphaned when a counsellor is deactivated.**
- Where: `review.js:21`. Led students are visible only to `counsellor_id === me.id`.
- After admin PATCHes the counsellor to inactive, a replacement counsellor at the same school cannot see, review, follow up or withdraw those students. Admin `GET` returns `students: []`, so admin can only reach them through the report or Admin > Testers.
- Fix: document this, or add an admin reassign.

**L5. A save on the device hides the welcome greeting.**
- Where: `paintWelcomeBack` (`night-of-lamps.html:1205`). When an old `margwise.save` exists, "Hello, X / Not you?" and the resume button are not shown. This is rare in hosted mode because the Save button is hidden.

**L6. The return path for the counsellor is awkward.**
- After Start, the counsellor page has navigated away, so the personal key has to be typed again. The game traps Back (`trapBack`), so "come back here" in the runbook means typing `/counsellor/` again. This is a UX issue only.

**L7. The student's first name goes in the URL (`n=`).**
- It is a child's name in browser history and logs (see H1). The page could take it from the stored record instead.

**L8. The counsellor CSV download leaks object URLs.**
- Where: `counsellor.js` `rCsv`. `URL.createObjectURL` is never revoked. This is trivial.

## Verified OK

- **School and counsellor scoping in `findTester` and `visible`.** CB (school B) and CA2 (school A) both got 404 for CA's led student. Other schools' students are never reachable. Admin scope is "everything". Counsellor scope is school self-signups plus their own added students. The list and report SQL implement this correctly: `(? OR (t.invite_id = ? AND (t.counsellor_id IS NULL OR t.counsellor_id = ?)))`, and admin `me.invite_id`/`me.id` being null are harmless.
- **Blind order.**
  - `start` refuses with 409 before a baseline exists (verified).
  - Start is limited to `source='counsellor'` students, so a led student cannot play before the picks are locked, and `blind` is always 1 for them.
  - `GET ?code` returns `appTop` only to the review owner.
  - The report and CSV only carry `app_top` after a review.
  - Admin is unrestricted by design.
  - I found no path to the app's top 3 before locking. M1 is a leak between counsellors, not a blind bypass.
- **Consent enforcement for `addStudent`.**
  - `consent === true` plus a date are required (format only, see L1).
  - Admin cannot add students.
  - There is a 60-per-day cap per counsellor.
  - The audit row has no name.
- **`remove`.** It deletes `events`, `reviews`, `followups` and `testers` in one batch. No other table holds a `tester_id` (`joins`, `claims` and `audit` do not). The audit rows hold only the 6-character code, the counsellor ID or name, and the consent date. After deletion, `event.js` rejects the old token because the tester no longer exists. Admin DELETE and `purgeOld` now also delete `followups`. (D1 Time Travel keeps deleted rows for its window; worth one line in the runbook.)
- **CSV formula injection.** `csvCell` prefixes `'` for leading `= + - @ \t \r` and quotes correctly. Verified: a name of `=HYPERLINK("x")` was output as `"'=HYPERLINK(""x"")"`. The new admin CSV columns go through the same `csvCell`.
- **XSS and CSP.**
  - `counsellor.js` uses only `textContent` and `createElement`, with no inline script, so it is compatible with `script-src 'self'`.
  - In the game page, `TK.name` (now taken from the URL) only reaches `createTextNode` or `input.value`.
  - The new gate cover is static markup.
- **Shared device on "Not you?".** It runs `flush(true)` while TK is still set, then clears the queue. The walk is keyed by `tid`, so a later student cannot resume someone else's walk. The start link wipes `margwise.save` and `margwise.walk`. The event queue is in memory only, so it cannot carry over between page loads. `pagehide` and `visibilitychange` flush before navigation.
- **Resume replay correctness.**
  - `resumeWalk` restores `SEED`, `choices`, `slots`, `apt` and `lockDone`. `saveWalk` runs after each light and after each completed lock, so a half-done lock is not saved and is replayed cleanly. `advance(false)` re-presents a pending lock.
  - Replayed choices do not re-emit `place_done`. Only `walk_resume` is sent, and its validator is present in `event.js`, so nothing is counted twice on the server. The duplicates in M6 come from restarts, not resumes.
  - Numeric keys in `lockDone` survive the JSON round-trip.
- **The `paintWelcomeBack` change.** "Hello / Not you?" now shows on reload when there is no save (exception: L5).
- **schema8.** The ALTERs and the `followups` table apply cleanly after `schema7`. `UNIQUE(tester_id, months)` matches the `ON CONFLICT` upsert. Integer `counsellor_id` compares correctly with `===` in JS (verified).
- **`admin.js` summary.** Section counts only use server-whitelisted keys and values.
- **Docs.** The Architecture and Runbook schema ranges (`schema8`) are accurate. The scope table in the Runbook matches the code, except for the M1 and M4 points.
