# Final pre-merge review: PR #4 (counsellor-led mode, follow-up fixes, explanation panel, card rewrites)

Branch `claude/wizardly-thompson-cx3yeh` at `14ecf22`, compared with `origin/main`. This review checks the fixes made since `docs/reviews/opus_review_pr4.md`, any regressions they caused, the new explanation panel, the card text, and the docs.

## How I checked

**Test suite.** All of these pass:
- `node --test engine/tests/engine.test.mjs engine/tests/design.test.mjs`: 11 tests, 0 failures. The worst single-stop influence on the top field is 0.20.
- `python3 engine/reference.py`: 2274 checks, 0 mismatches.
- `python3 pipeline/validate.py`: 0 errors, 0 warnings.
- `node engine/tools/question_map.mjs --check`: the map is current.
- `node hosting/tests/util.test.mjs`: passes.

**Build.** I ran `app/build.py` in a clean worktree. Its output is byte-identical to the committed `app/dist/index.html` and `hosting/public/index.html`, and the manifest's `page_sha256` matches.

**Local server.** I ran `npx wrangler@3 pages dev` with a fresh D1:
- `schema.sql` through `schema9.sql` all apply cleanly.
- Setup: schools A and B; counsellors CA and CA2 at school A and CB at school B; self-signup and counsellor-led students.
- I stopped the server with `fuser -k 8793/tcp`.

**Explanation panel.** I ran a node harness that copies `whyField` and `fieldFits` exactly. It covers 60 simulated journeys, with all 16 fields opened in each (960 field pages).

**Cards.** A script checked `data/story2.json` against the engine bank and against `data/releases/story2.json`.

## Status of the previous findings

| Prior | Status | Evidence |
|---|---|---|
| H1 credential in URL | **Fixed** | The `?t=&k=&n=` handler is gone from the game page. `counsellor.js:23` writes `margwise.tester` into same-origin `localStorage` and goes to `/`. No token or name appears in any URL. This works under the `/counsellor/*` CSP (`script-src 'self'`, external JS only). |
| M1 report leaks other counsellor's review | **Fixed** | The LEFT JOIN now adds `AND (? OR r.counsellor_id = ?)` (review.js:34, 47). Verified: after CA2 reviewed a self-signup student, CA's JSON, CSV and list show no baseline, match or use values. There is a side effect, covered in N1. |
| M2 app result = latest `fields` | **Fixed for blind reviews** | Verified: a led student's first result was `med,sci,law`, then a replay posted `arts,des,media`. GET and review both used the first result, and after the review the stored `app_top` is returned. Non-blind reviews behave differently, see N6. |
| M3 any counsellor can remove or follow up | **Fixed** | review.js:81. Verified 403 for CA on CA2's student, both for a review and for picks only. Admin can still remove. Removing an unreviewed self-signup is still allowed for any counsellor at the school, which looks intended. |
| M4 suppression claim | **Fixed** | The code comment, the API note and Runbook "Reports" now say averages need 5 reviews for statistical reasons, not privacy. |
| M5 follow-ups vs deletion promise | **Partly fixed** | Follow-up consent is now recorded and enforced (verified 400 without it). The retention promise is still not implementable, see N3. |
| M6 resume lost or stranded | **Mostly fixed** | The walk is wiped only when the student changes. Led sign-in now lasts 6 h, and the walk is cleared at `toReveal` rather than `toDreams`. The remaining edges are in N7. |
| L1 invalid consent date | **Partly fixed** | `2026-99-99`, `2026-02-30` and dates in the future are rejected (verified). There is still no lower bound: `1990-01-01` was accepted. |
| L2 stale resume button | **Partly fixed** | See N7. |
| L3 undo not saved | **Fixed** | `saveWalk()` is now called after both `M.undo` calls. |
| L4 orphaned students on deactivation | **Not addressed** | It is still undocumented. |
| L5, L6 | Unchanged | UX only. |
| L7 name in URL | **Fixed** | Same change as H1. |
| L8 object URL leak | **Fixed** | `revokeObjectURL` is now called after 2 s. |

## New findings

### Medium

**N1. Operator-precedence bug in the counsellor page.**
- Where: `hosting/public/counsellor/counsellor.js:14`.
- What happens: the new code is written as
  ```js
  $('fuPast').textContent=(j.followupOk===false?'…':'')+(j.followups&&j.followups.length)?'Saved: '+j.followups.map(…):'No follow-ups yet.';
  ```
  `+` binds tighter than `?:`, so the condition is always a non-empty string such as `"0"`, `"undefined"` or the warning text. Verified in node:
  - The panel always reads `Saved: ` (blank). "No follow-ups yet." and the no-consent warning never appear.
  - For a `taken` student the response has no `followups`, so `.map` throws `TypeError`. The callback dies after `$('fu').hidden=false`, so the "Another counsellor already saved picks" message never shows and the follow-up form is visible.
- How it combines with the M1 fix: CA's list now shows CA2's reviewed student as `ready for you`, because the LEFT JOIN returns no review row. CA opens it and gets a silent, half-rendered screen. The server still refuses the writes (403), so no data is exposed.
- `followupOk` is also returned only in the `state:'new'` response (review.js:55). Once picks are saved, the page cannot tell that follow-ups are not allowed.
- Fix:
  - Write it as `… + ((j.followups&&j.followups.length) ? … : …)`.
  - Return `followupOk` in every GET response.
  - Hide `#fu` when `followupOk` is false or the state is `taken`.
  - In the list query, add a flag such as `EXISTS(SELECT 1 FROM reviews WHERE tester_id=t.id AND counsellor_id<>?) AS other`, so the list can say "with another counsellor".

**N2. The explanation panel often tells a student that their *strongest* field "rests on a small amount of evidence", and the sentence is ungrammatical.**
- Where: `app/night-of-lamps.html:1295-1318`.
- Cause: the field score is a percentile clamped to [0, 1] (`refPct`) plus small terms. For a clear top field (scores of about 1.0 to 1.1) or a clear bottom field, leaving one choice out often leaves the percentile clamped. The difference `d` is then about `.002·Δraw`, which is below the `.012` threshold.
- Measured over 960 simulated field pages:
  - The **#1 field had zero "supporters" in 9 of 60 journeys** and only 1 to 2 in another 17. So about 43% of top fields show the "thin evidence" warning.
  - All 58 zero-supporter pages had clamped scores (≥ 0.81 or ≤ 0.15).
- With zero supporters the student reads both of these:
  - "No single choice stands out; this comes from the overall shape of your choices."
  - "**Only a couple of of your 13 choices pointed here**, so this rests on a small amount of evidence." This has a doubled "of" and is false: the count is 0, not "a couple".
- Fix:
  - Run the leave-one-out on the unclamped quantity, either `raw` or `refPct` without clamping (extrapolate at the ends). Base "thin evidence" on that.
  - Write the zero case as its own sentence.
  - Until this is fixed, consider shipping the panel collapsed (it is `open` by default).

**N3. The follow-up retention promise cannot be kept with the tools that exist.**
- Where: `app/night-of-lamps.html:482`, `docs/PILOT_RUNBOOK.md:26` and `:57`.
- The notice says that with follow-up consent the counsellor keeps "your first name, class and their later notes for up to 12 months after the test, **and nothing else**". But:
  - Follow-ups hang off the `testers` row.
  - Admin delete, `remove` and `purgeOld` all delete the events, review, follow-ups and tester together.
  - Nothing deletes the events and review while keeping the follow-ups.
- So the runbook's "skip students with follow-up consent" keeps *all* of their game data past 31 January 2027, which contradicts "nothing else".
- The teardown step still says "Turn off every counsellor key", and that also blocks the 12-month follow-up.
- Also:
  - The sentence appears only on the self-signup gate. `followup_ok` is never set for self-signups, so it never applies to anyone who reads it.
  - Led students never see the notice; that is covered by the parent sheet.
- Fix: add an admin action that deletes `events` and `reviews` for testers with `followup_ok=1` at the end of the test. Then reword the teardown step: keep the keys of counsellors with outstanding follow-ups. Or drop "and nothing else" until that action exists.

**N4. Some rewritten cards now mix interest types.**
- Where: `data/story2.json`.
- In trying to make Creator cards "help with the scene's problem", two A cards became functional or engineering design:
  - s02-A "Sketch a new arch shape **that might be safer**…" (A 1.0 / I 0.5). It now competes with s02-I and s02-R on the same structural-safety problem. Three of the four cards are engineering.
  - s07-A "Draw up a boat for the crossing **that may not float the first time**" reads as R/I design.
- One C card reads as Helper: s05-C "Count everyone through the pass **so no one is left behind**".
- s04-I lost "and why" ("Test apple blends to find which one tastes best"), so it reads as a taste test rather than an investigation.
- These labels also reach students now, through the panel: "you picked 'Sketch a new arch shape that might be safer' (Creator)".
- Fix: put the expressive element back in the A cards, for example "Sketch a more beautiful arch for the old bridge, though most first ideas get thrown out". For s05-C use "keep the line in order". For s04-I restore "and work out why".

### Low

**N5. Panel line-level accuracy.**
- Where: `night-of-lamps.html:1309`.
- A stop where the student chose "keep my oil" has no cards, but it can still rank as a supporter. It renders as "**Salt Harbour:** you picked ." This happened on 81 of 2,440 lines in the simulation, and it can happen in the real game because passing is allowed.
- In 26% of "pointed here" lines, none of the cited cards has a main type in the field's areas. The fallback then shows all cards, for example "(Helper)" under Engineering. This is technically true (an effect of the choice ranking) but confusing for a teenager.
- Fix: skip choices with no cards. When no card matches the field, say "picking this over the other cards here moved you towards this area".

**N6. `appTop` for non-blind reviews.**
- Where: review.js:26-29.
- Verified: a self-signup student finished before the baseline (`law,arch,med`) and replayed after it (`arts,des,media`). GET and review then used the *replay*. For a non-blind review the result the student had already seen is the natural comparison, and a replay changes it, which is the M2 problem in reverse.
- These reviews are excluded from the headline rate, so the impact is small.
- Fix: when `blind=0`, use the last result before `baseline_at`.

**N7. Resume and stale-session edges.**
- `STALE_LED` is evaluated only at page load (line 663). In a tab left open after a led student finishes, a later student can tap "Walk the road again" without any prompt, and their events go to the first student.
  - The ARCHITECTURE line "after 30 idle minutes the game asks … before anything is recorded" overstates this.
  - The review is safe because of the M2 fix. Admin `walks`, `places` and feedback are not.
  - Fix: re-check idle time in `startWalk`, `resumeWalk` and on `visibilitychange`.
- The resume click sets `#welcomeBack` hidden (line 1754). That also hides "Not you?" for the rest of the tab.
  - If the student taps "Take the lantern" instead of resuming, the old "Continue your walk (n lamps)" button and its stale snapshot survive to the next `show('welcome')`.
  - Fix: remove only the button, and repaint `paintTester()` on `show('welcome')`.
- `clearWalk()` runs at `toReveal` (line 1168), but `fields` is tracked later, in `toDoors`. A refresh on the reveal screen loses the whole walk.
  - Fix: clear the walk after `track('fields')`.

**N8. Panel cost and analytics.**
- Each field open re-scores about 13 journeys. That takes about 30 ms median (p95 49 ms) in node on a desktop; I estimate 150 to 300 ms on a low-end Android, on the tap.
- It is recomputed on every open. Fix: cache per field id and render after the page has painted.
- `why_open` is tracked on every render (the panel is open by default). It duplicates `field_open` and does not measure opens; track the `toggle` event instead.
- "The puzzle results … do not change this order" (line 1318) is hard-coded. Make it conditional on `APT_NUDGE`.

**N9. The R cards share one cost type.**
- Every Builder card's cost is physical hardship or isolation, for example "alone on the ridge, in freezing wind", "heavy work in the heat" and "crawling under it".
- CARD_AUDIT round 2 already names this cost as a cue. The added risk for an Indian Class 9 to 12 audience, where a parent is often beside the student, is that girls under-pick R, which steers them away from engineering and trades.
- No gender is collected, so this cannot be monitored. Track it as a pilot question.

**N10. Small server and data items.**
- No lower bound on the consent date (L1 remainder).
- The 403 text "Another counsellor reviewed this student" also appears when the other counsellor has only saved picks.
- `schema9` does not backfill, and there is no way to set `followup_ok` after a student is added (for example, when a parent signs later).
- Follow-ups are impossible for self-signup students. That is fine, but the runbook does not say so.
- L4 is still undocumented.

**N11. Docs that contradict the code.**
- `docs/QUESTION_MAP.md` section 5 (generator `question_map.mjs`) says "120 simulated journeys". `design.test.mjs` uses 60.
- `docs/ARCHITECTURE.md:216` says "48 cards in 12 stops were rewritten". Compared with `main`, 51 card texts changed (48 plus s04-I, s11-E and s12-S). It is not the 59 stated in the brief.
- `docs/CARD_AUDIT.md:32` points to `/tmp/qa/phase2_rewrites.json`. The data is in `docs/audit/card_rewrites.json`.
- `docs/PILOT_RUNBOOK.md:23` (step 3) does not mention the "Is this still <name>? / Yes, I am …" step after an idle reload.
- The runbook end-of-pilot step contradicts 12-month follow-ups (see N3).

## Verified OK

**Scoping:**
- CB (school B) gets 404 for school A students.
- The blind order holds: `start` returns 409 before picks are saved, and the app's result is returned only to the review owner.
- Consent is required. Admin cannot add students.

**Follow-up consent:**
- Enforced on the server, 400 without it (verified for a led student without consent and for a self-signup student).
- The checkbox reaches `followup_ok`.

**Calendar-valid consent date:** the round-trip check `toISOString().slice(0,10) === on` works.

**localStorage handoff:**
- The keys `margwise.tester`, `margwise.walk` and `margwise.save` match what the game reads.
- `at: now` means a fresh start is never stale.
- When the student is the same, the walk is kept, so the counsellor can restart and the student can resume.
- Blocked storage shows an error.

**STALE_LED flow on reload:**
- "Is this still X?" hides `#begin` and the resume button until confirmed.
- "Not you?" flushes, clears TK and opens the gate. `paintTester` restores `#begin`.
- The name is written with `textContent` only.

**Explanation panel injection and robustness:**
- Card text, place names and next steps go through `esc()`. `NAME` and the uncertainty strings are constants.
- In 960 simulated pages nothing threw. Empty choices, echo choices (skipped, and removed together with their original) and missing scenes or options (filtered) are all handled. `journeyResult` is wrapped in `try`.

**Leave-one-out mechanics:** removing a choice also removes its echo, and the sign convention is correct. N2 is about clamping, not about the method.

**Card data:**
- All 15 scenes and 60 option ids map. The option id suffix equals the primary load in every case, so `applyStory` and the generator agree.
- `data/releases/story2.json` is identical to `data/story2.json`.
- Every card is 90 characters or fewer, and no stop has a duplicated first word.
- There are 10 main cards per type.
- Nothing is offensive or gendered in wording. Names and settings suit an Indian audience.

**CI:** the new test and map steps are wired into `build-check.yml`. The `why_open` validator was added to `event.js`.

## Recommendation

**MERGE, after two small code fixes:**
1. **N1**: one line in `counsellor.js`, plus returning `followupOk` in every response. Without it the counsellor page breaks for any student another counsellor has taken, and the follow-up consent warning never shows.
2. **N2**: fix the "a couple of of" sentence, and base the "thin evidence" flag on unclamped scores. Or ship the panel collapsed or flagged off until that is done. As it stands, it tells many students that their clearest match is weakly supported.

**Before minors with follow-up consent are enrolled:** resolve N3, either with a partial-deletion tool or by rewording the notice and the runbook.

**Before the pilot (content, cheap):** fix N4.

Everything else is Low and can follow in a later PR.
