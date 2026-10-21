# Margwise "Night of Lamps": independent review 3 (21 Oct 2026)

Scope: branch `claude/wizardly-thompson-cx3yeh` (HEAD 19ea93c), the built page `scratchpad/site/index.html` (no gate), the hosted build `scratchpad/deploy/public/index.html` (served locally, with `/api/*` mocked), and `hosting/functions/api/*`. I changed no repo files. My scripts and outputs are in `scratchpad/rv3/`: `cov.mjs`, `bias.mjs`, `fit.mjs`, `disp.mjs`, `rnd.mjs`, `nullchk.mjs`, `nudge.mjs`, `ui1.mjs`/`ui2.mjs`/`walk.mjs` (real-UI walks), `fin.mjs` (frame sampler), `a11y.mjs`, `gate.mjs`, `xss.mjs`, `dbl.mjs`, `contrast.mjs`/`contrast.py`. Viewport is 390x844 throughout.

## Answer to the owner's question first ("I played randomly twice and got the same results")

No state leaks from one walk to the next. `startWalk()` re-rolls `SEED` and resets `choices`, `slots`, `apt` and `lockDone`. I ran six real-UI walks in one page session:
- Two random walks gave different results: Thinker/Helper/Persuader with psy, health, pub, and Organiser/Creator/Helper with media, hos, des.
- Two walks with the same choices gave identical scene order, radar polygon and fields, but different card layouts.
- Two "always tap the first card" walks gave different results because the layout changes.
- Leftover DOM was clean each time: 0 sparks, trails or drops, and 1 art layer on.

Random tapping still looks the same for three reasons:
1. The radar is a small, near-regular blob. The median spread is 0.29 of the radius.
2. "Close calls" text appears in 87–99% of random walks.
3. The field ranking pulls toward the same few fields (see B1). Two random walks share at least 1 of their top-3 fields 44% of the time, and at least 2 fields 20% of the time. Media, arts, sports and design dominate.

So the result is not frozen. It is weakly informative and pulled toward the same fields.

---

## Blocker (for a student release)

### B1. The field ranking is structurally skewed, and the "calibrated null" does not do what the docs claim
- **What:** some fields almost never come first, whatever the trait combination, and others over-surface.
- **Evidence:**
  - **All 120 ordered top-3 triples, ideal profiles** (`fit.mjs`, profile 1.8/1.0/0.4, others −0.9):
    - Top-1 field counts: media 23, spo 15, hos 14, arts 11, psy 10; sci 1, law 1, health 2, eng 3, mar 3.
    - Top-3 counts: media 42 and arts 38, against tec 7 and sci 13. A uniform spread would be 7.5 for top-1 and 22.5 for top-3.
  - **Same triples, played through the engine with a "both flasks on best card" player** (`cov.mjs`): eng is top-1 in 0 of 120, law 1, com 3, sci 3; media 18, hos 17.
  - **Random tappers** (`rnd.mjs`, 1,000 walks): top-3 share is arts 38%, spo 31%, des 30%, media 29%; sci 6%, eng 8%, agr 9%.
  - **The baked null does not match its own method** (`nullchk.mjs`, 3,000 isotropic profiles):
    - `content.fieldNull` was baked from random-tapper walks (`scratchpad/nullcal.mjs`), not from random profiles.
    - It differs from a fresh null. For example, eng is baked m .123 / sd .357 against fresh .022 / .443; voc .156 against .068; mar sd .290 against .365.
    - Even with the baked null, isotropic profiles give media 34% and arts 31% top-3, against tec 9% and sci 10% (target 18.75%).
  - CALIBRATION.md says the null standardisation means "fields with many broad careers do not win by default". The data contradicts this.
- **Suggested fix:**
  - Rank fields by a field centroid (mean O*NET vector of its careers, unweighted) compared with the profile's top-3. Or use the max-career r with per-field rank-uniformisation: an empirical CDF from the same null, not a z-score.
  - Re-run until top-1 and top-3 are near uniform over the 120 triples.
  - Add the 120-triple coverage table as a CI check.
  - Fix the CALIBRATION.md sentence.

### B2. No verifiable parental consent for minors
- **What:** the hosted gate's consent is self-attested and asked twice.
- **Evidence:**
  - The checkbox reads "I am 18 or older, or my parent or guardian knows about this and agrees". The popup reads "Yes, a parent has agreed or is with me".
  - The child taps both, and `join.js` accepts `consent: true`.
  - CALIBRATION.md itself says "A verifiable parental consent flow is needed before any wider student use".
- **Suggested fix:**
  - Use a parent-initiated invite: the parent receives a link and confirms.
  - Write a DPDP-style notice that names the data actually collected (see M8).
  - Keep the hosted build adult-only until this exists.

---

## Major

### M1. The finale gives away the result, then ends with a hard cut
- **Evidence:**
  - `fin.mjs` samples each frame after "Show my interest shape". `show('reveal')` runs first, then `playFinale()` fades `#finale` in over 0.9 s while `#veil` fades out over 0.56 s.
  - The reveal screen shows through at about 30% (finale .42 and veil .46 at 341 ms; .58 and .20 at 466 ms; .70 and .05 at 583 ms).
  - `rv3/spoiler.png`, taken at 330 ms, shows "Your top three: Helper, Thinker, Persuader" and the radar readable behind the lighthouse.
  - On "See your shape", `leave()` sets the finale to `display:none` immediately. The reveal starts at opacity 0 (frame at 53 ms: finale 0, reveal 0), so the screen goes blank before the reveal slides in.
  - Focus ends on `BODY`.
- **Suggested fix:**
  - Start the finale before calling `show('reveal')`: render the reveal hidden, and add `.on` to it only in `leave()`.
  - Give the finale `opacity:1` from frame 0 (no `fnin` fade), or fade the finale out over the reveal in `leave()`.
  - Focus `#revealLine` after the transition.

### M2. The invite gate fails open
- **Evidence:**
  - `join.js` checks the code only when `need || act.n > 0`.
  - `config.js` returns `needsCode:false` under the same condition.
  - If no `INVITE_CODE` secret is set (the admin UI supports "No master code is set") and the owner turns off every invite code to close the test, anyone who loads the page can join with any name. The gate then hides the code field.
- **Suggested fix:** add an explicit `OPEN_SIGNUP` flag that defaults to false. Otherwise always require a valid code, and return 403 when no code is active.

### M3. Random and one-note players get confident results
- **Evidence** (`cov.mjs`, 500 walks per policy):
  - **One flask on each of two random cards:** 27.6% get "no signal" and 99% get "broad".
  - **Both flasks on one random card each place:** only 5% get "no signal" and 55.8% "broad". About 39% get a "close" or "clear" result with the full lighthouse finale and chips 1-2-3.
  - **Single-trait players** (spend only on one trait's cards, `fit.mjs`):
    - Positions 2 and 3 come from noise. S-only gives SRC, C-only CSI, I-only ICS. The non-chosen traits sit in a narrow band (about −0.45 to −0.8). `code.alternatives` lists 12–20 tied triples.
    - Yet the finale shows "1 Helper 2 Builder 3 Organiser" as fact.
    - I-only and C-only get `confidence:'clear'`.
  - **Contradictory note text.** A real-UI first-card tapper (`ui_pos0.out`) sees in one note: "Most of your oil went to the same position… may say more about where you tapped… **Your top three stood out clearly.**"
- **Suggested fix:**
  - Set the "no signal" and "broad" thresholds from simulated random and positional players, as CALIBRATION.md step 4 already says. Target at least 90% of random tappers flagged.
  - When `alternatives.length > 1`, show only the untied leaders in the finale and radar badges. For example, "1 Helper, then a tie".
  - Suppress "stood out clearly" when `biased` is true.

### M4. The puzzle nudge has a large effect from very few items, and is silently dropped for short walks
- **Evidence:**
  - **Effect size** (`nudge.mjs`, 120 clear profiles):
    - "Words strong, the rest weak" changes the top-1 field in 26 of 120 (22%) and the top-3 set in 38 (32%).
    - Numbers + Patterns: 19 and 30. Shapes only: 15 and 26.
    - The effect comes from 2 items per area. One of them tests the vocabulary item "ephemeral", which favours English-medium students.
    - CALIBRATION.md's "at most about 0.35 SD" is true per field, but the relative swing between two fields reaches 0.7 SD. "Nudge a little" understates it.
  - **Short walks lose the round-8 locks:**
    - `advance()` checks `s.done` before showing the round-8 lock, so 8-place walks never get the second Shapes and Patterns items.
    - 43 of 120 clear walks end at 8 places (`bias.mjs`).
    - In the real UI (`ui_pos0.out`, pos00) the walk ended at 8 places with only 6 locks. The puzzle card shows only Numbers and Words, and `aptScores().n < 4` turns the nudge off.
    - Clear-profile students and broad-profile students are therefore treated differently.
- **Suggested fix:**
  - Halve the nudge, or show it as a separate "puzzle hint" line instead of reordering fields, until there are norms.
  - Move the locks to places 2, 3, 5 and 7 so every walk gets all 8 items.
  - Replace "ephemeral" with a non-lexical reasoning item.

### M5. India pay on field pages is misleadingly uniform and sits under the wrong heading
- **Evidence:**
  - 55 of 83 careers show the same "India: … about ₹38,466 a month (PLFS 2025)". This includes doctor, dentist, nurse, physicist, lawyer and engineer (`content.json` `in`).
  - Airline Pilot shows ₹26,175, the same as Chef and Photographer.
  - Police Officer and Cabin Crew show ₹15,541.
  - The step titled "First jobs and pay in India" contains no first-job pay. It shows the national graduate average (₹32,683) and the all-education 25–29 average (₹20,860), identical for all 16 fields.
  - The voc note says "These careers are well paid and in demand", while the same page shows ₹16,773 for its careers.
- **Suggested fix:**
  - Drop per-career India pay until there are occupation-level sources.
  - Rename the step "Pay in India (broad averages)" and say outright that it is not specific to the field.
  - Delete "well paid" from voc.

### M6. Browser and Android back leaves the app and loses the result
- **Evidence:** there is no `pushState`, `popstate` or `hashchange` anywhere in the source. The only back control is the HUD button. On a phone, the system back gesture from the reveal, doors, field or parent page exits the site, and the result is gone because it is not saved in the hosted build.
- **Suggested fix:** push a history entry per view, handle `popstate` by calling the HUD-back logic, and keep the last result in `sessionStorage`.

### M7. Tester identity sticks to shared school devices
- **Evidence:**
  - `localStorage['margwise.tester']` keeps `{id, token, name}` with no expiry.
  - The next student on the same lab PC or family phone sees "Hello, Asha" and their events go into Asha's record unless they notice "Not you?".
  - Tokens never expire (`sign(id)` has no timestamp).
- **Suggested fix:**
  - Use `sessionStorage`, or expire after 24 h.
  - Ask "Are you Asha?" before each walk.
  - Add a timestamp to the HMAC and reject old tokens.

### M8. More data is collected than the gate says, and the retention promise is not implemented
- **What the gate says:** "your name, the choices you make in the game, your results and any feedback you write".
- **What is actually stored** (`event.js` validators, live payload captured in `gate.mjs`):
  - Puzzle correctness and response time per item (`apt.items`). This is ability data, while the gate says "not a test of ability".
  - Class, board and stream leaning.
  - Per-place decision time and card order.
  - Viewport size.
  - Self-ratings.
  - JS error messages.
  - An HMAC of the IP address, kept 24 h in `joins`.
- **Retention:** "delete … about 31 January 2027" is not implemented anywhere. There is no TTL or scheduled job. The only path is a manual per-tester DELETE.
- **Suggested fix:** list these items in the gate text, add a scheduled purge (Cron Trigger) or a dated `DELETE` in the runbook, and log the deletion.

### M9. The fact-check workflow misses the riskiest content
- **Evidence:**
  - `claims_json.py` covers only `exams`, `degree`, `pick`, `verify` and `subjects`, plus one PLFS line.
  - It omits everything in `abroad.json`: fees, visa rules, salary figures and scholarships, which are the most volatile numbers. It also omits the new `backup` (plan B) and `compare` texts, `early`, `note`, the career-to-PLFS-group mapping and US pay.
  - 22 of the 169 tasks are fragments or non-claims, for example "Check the current rules for each." or "Commerce is the usual choice."
  - 16 tasks are `verify` disclaimers.
  - 10 tasks have no URL, and 8 are duplicates.
- **Suggested fix:** generate tasks from abroad rows (one per figure with its `src`), plan B and compare. Drop sentences under 40 characters and anything starting with "Check" or "Confirm". De-duplicate.

### M10. The abroad figures have internal errors and the "checked" wording overclaims
- **Evidence:**
  - **UK living cost:** `lo: 10539` is £1,171 × 9 months, the visa maintenance period, but it is shown as "a year". It also feeds the totals, which understates them by about 25%.
  - **Badges are inconsistent:**
    - Canada tuition: undergraduate is "Guide" but graduate is "Official", from the same StatCan release.
    - Canada living is "Estimate" although C$23,448 is the IRCC figure.
    - Australia undergraduate tuition is "Guide" with an empty `src`.
  - **Wording:** the lead says "Figures are ranges from public sources, checked on 2026-10-21". Yet 8 rows are "Estimate = our estimate, not checked", several with no source.
  - **Open Doors note:** "new enrolments fell 17% in fall 2025" sits under an India-specific sentence, but the 17% is the all-countries figure.
  - **Route A:** the line "a longer stay can help with work visas and settling" frames settling as a benefit of the route. The disclaimers elsewhere are fine.
- **Suggested fix:**
  - Use 12 months, or label the row "for 9 months".
  - Tie badges to the source type automatically: govt URL means Official.
  - Change the lead to "Ranges from public sources and our estimates (marked)".
  - Rewrite the Route A line as "a longer stay gives more time to look for work. It does not guarantee a visa".

---

## Minor

1. **The doors note points to cards that do not exist.** The text says "lean on the **Not clear** cards". `FIT` labels are defined (src.html:1255) but never rendered. This appears for every cautious result (all random walks in `ui1.out`). **Fix:** delete the clause, or render the fit pills.
2. **Story text contradicts the choices** (`story2.json`). Keeper lines show "whatever was chosen", but:
   - s01 Captain Rao: "That engine has not purred like that in years." This rewards the R option even after the player painted a sign or comforted children.
   - s15 Mayor Farida: "All the lamps are lit." s15 appeared 3rd in 2 of the 6 single-trait walks I logged.
   - Chapter II at place 4 says "Somewhere ahead, a girl with a ferry lantern…", but Ila already introduced herself at place 3.
   - Chapter III says "the last piece of the note", but the note is never shown. `META.note` and `frag` are computed and unused (src.html:1104).
   - **Fix:** make keeper lines option-neutral, block s15 before place 12, swap the Ila and Chapter II order, and either show the note fragments or drop the reference.
3. **Keyboard focus reaches the reveal screen behind the finale.** In `dbl.mjs`, Tab+Enter during the finale activates `#openDoors`. `leave()` then re-adds `.on` to reveal, so two screens are on at once (`['reveal','doors']`). **Fix:** make the finale a modal (inert the screens), and in `leave()` call `show('reveal')` instead of toggling classes.
4. **Focus is lost on every view change.** After the About sheet closes with Escape, after abroad → back, and after the finale, focus is on `BODY` (`a11y.mjs`). The gate opens with focus on `BODY`. **Fix:** focus the new screen's `h2` (tabindex −1) in `show()`, return focus to the opener when a sheet closes, and focus `#gName` on gate open.
5. **Attribute injection on the parent page.** `value="'+esc(nm)+'"`, and `esc()` does not escape quotes. A name like `A" autofocus onfocus="…` produces a live `onfocus` attribute (`xss.mjs`). CSP allows `'unsafe-inline'`. This is self-XSS only: the name comes from the user's own gate input or localStorage. **Fix:** build the input with `createElement` and set `.value`.
6. **Join rate limit and code strength:**
   - The 40-per-hour limit is per `cf-connecting-ip`. IPv6 /64 rotation bypasses it, and there is no global failed-attempt cap.
   - Admin-chosen codes can be 4 characters, such as `dps1`.
   - `max_uses` is check-then-increment, not atomic.
   - `SIGN_KEY` falls back to the literal `'missing'` (`_util.js` hmac), so tokens are forgeable if the secret is unset.
   - The admin key has no attempt limit.
   - **Fix:** require at least 8 random characters, add a global failure counter, use `UPDATE … WHERE uses < max_uses RETURNING`, fail closed when `SIGN_KEY` is missing, and rate-limit 403s on `/api/admin`.
7. **Tester CSV corrupts negative numbers.** The client-side tester CSV prefixes `'` to every value starting with `-`. The negative `profile_*` scores (about half of them) become text and break analysis. **Fix:** apply the formula guard only to free-text columns (name, comment), or only when the value is not a number.
8. **`/admin/claims.json` is a public static file** with `field_key`s. This contradicts the admin UI's "the field names stay here". **Fix:** serve it from the admin API behind the key, or drop the keys from the static file.
9. **PLFS attribution.** The field page cites "(PLFS 2025, MoSPI press note)" for the graduate, postgraduate and age-band averages. The PIB note (PRID 2246009, which I checked) has only the male ₹24,217 and female ₹18,353 figures. The other numbers come from India Labour Observatory's processing of unit-level data. **Fix:** cite the ILO tables as the source and MoSPI as the underlying survey.
10. **The "Compare colleges" text is the same NIRF boilerplate for all 16 fields.** NIRF has no ranking for design, hospitality, sports, performing arts, maritime, ITI or polytechnic. "Ask the exam body for last year's cut-offs" is wrong for JEE and NEET: JoSAA and MCC publish closing ranks. **Fix:** write per-field pointers, for example DG Shipping's approved-institute list for maritime, JoSAA/MCC/state counselling closing ranks, and the UGC fake-university list.
11. **Contrast fails in two places** (`contrast.py`, measured over the real art):
    - The gate footer `.gfine` (12.5px) is 3.54:1.
    - The welcome kicker "Margwise · Light your way" (17px bold, so not large text) is 2.77:1 median and 2.52 worst. It has a text shadow, but still fails AA.
    - Premise, mission and gate body text pass, at 6.3 to 16:1.
12. **About 48% of the generated "near-miss" shape distractors are disconnected shapes** (simulated). They are obvious give-aways that weaken the Shapes item. **Fix:** reject candidates that are not connected.
13. **Lock titles read "The Lock of Numbers (1 of 2)" then "The Lock of Words (2 of 2)".** That reads as two parts of one lock. **Fix:** "Gate 1 of 4 · Lock 1 of 2", or drop the counter.
14. **Reviewer personas do not match their labels.** "Helper, Thinker, Creator" produced Helper, Thinker, **Persuader** (`spoiler.png`). This is fine for a noisy sim, but a reviewer will report it as a bug. **Fix:** label them "aims for …".
15. **gsap loads from cdnjs with no SRI,** and CSP `script-src` allows `'unsafe-inline'` plus the whole of cdnjs. **Fix:** self-host gsap (72 KB) and drop the CDN from CSP.
16. **The schema migrations are not re-runnable.** `schema2.sql` and `schema3.sql` use bare `ALTER TABLE ADD COLUMN`. **Fix:** guard them, or document the order.

## Nit
- All four option cards show the same placeholder flask (`ART.obj` is empty), so nothing visual tells the cards apart.
- The progress line reads "Place 1 of 15 · 7 to 14 more". Simpler: "Place 1 · about 8–15 places".
- Music starts automatically on "Take the lantern" unless muted before. That is awkward in a classroom.
- Going back from reveal to dreams and pressing again replays the full 10 s finale and sends a duplicate `apt` event.
- The beat card pops in under the fading veil (`s_beat1.png`). It looks dimmed for about 0.4 s.
- The lock screen drops the painted scene for a flat gradient, which is the most abrupt context change in the walk.

---

## Transitions walked (real UI, 390x844)

| Transition | What I saw |
|---|---|
| welcome → beat → stop | veil 560 ms, then the beat appears instantly under the veil; OK |
| stop → light → next stop ("walk") | about 2.3 s, then a 0.9 s camera move; the cards fade in 950 ms later; OK. During the 1.5 s busy window, taps are silently ignored and there is no disabled styling |
| stop → lock → stop | veil plus slide-in; the art context disappears (Nit) |
| dreams → finale | **spoiler, M1** |
| finale → reveal | **hard cut to blank, M1** |
| reveal → doors → field → abroad → back → field | veil plus slide-in each time; abroad back returns to field with its scroll position kept; focus is lost (Minor 4) |
| doors → parent → back | OK |
| system back | **exits the app, M6** |

No modal was stuck:
- The beat card has one button.
- The consent popup has "Go back".
- The gate cannot be dismissed, by design.
- The finale has Skip.
- The lock has Skip; HUD back is silently ignored there, which needs a hint.

**Text and voices on the play screens.** Up to five voices appear:
- the narrator's setup line, in a bubble whose firefly icon suggests Jyo
- 15 named keepers, shown inside the same bubble
- Ila, in the beat cards
- chapter cards
- the "old lamplighter" and Jyo, reported second-hand in the lock lead

It is not clear who is speaking: narration and a keeper quote share one bubble.

Proposed cuts:
1. Welcome: reduce the premise and mission (about 95 words) to two sentences: "The lamplighter is gone. Walk the road with Jyo, choose how you'd help each town, and light its lamp."
2. Remove the keeper name and line, or move them to a 1 s caption that is clearly a different speaker.
3. Merge Ila's four beats into the three chapter cards.
4. Lock lead: "A sealed gate. Any key you try is fine."
5. Make the bubble's speaker explicit, with a small "Jyo:" label, or turn it into a plain caption with no icon.

## India-only plan: what a Class 10 parent still misses
- **Fees and total cost:** government against private, MBBS and engineering cost ranges, hostel costs.
- **Funding:** scholarships (NSP, state), education loans.
- **Admission rules:** reservation, domicile and state quotas; the state CET by name.
- **Eligibility:** percentage thresholds (for example 75% or the top-20 percentile for JEE seat allocation) and age limits (NDA 16.5–19.5).
- **Timeline:** registration months for JEE, NEET, CUET and NCHM.
- **Coaching and drop years:** cost, risk and alternatives.
- **Switching paths:** CUET allows cross-stream admission after Class 12; NIOS and open schooling.
- **Job outcomes:** placement data, which NIRF does publish per institute (median salary).
- **Fraud:** UGC and AICTE fake or unapproved institution lists.
- **Practical concerns:** apprenticeship stipends for the voc route; safety, distance and language of instruction.

---

## Verified OK
- **Card layout is unbiased.** `M.displayOptions` is a seeded Fisher–Yates. Over 2,000 seeds × 15 scenes, each trait sits in each position about 4,900–5,140 times. Each scene shows all 24 orders, and the same seed gives the same order. Positional tappers get varied results across seeds: 98–105 distinct codes over 300 seeds, and their top-1 traits spread across all six.
- **Random tappers reach every result.** 500 walks per policy give 103–116 distinct ordered codes and all 20 unordered top-3 sets.
- **Trait coverage is balanced.** Each trait is primary on 10 cards and secondary 5 times.
- **Recovery is good when the player is consistent.** Exact top-3 recovery is 75.8% (both flasks on the best card) and the top-1 trait is right 100% of the time. With "split" play the top-3 set is right 79%. There is a mild R/I bias in third place (R or I inserted 17 times against 2–3 for the others).
- **No persistence bug between walks** (see the first section). Ties fall back to R,I,A,S,E,C order only when all scores are equal, and that case is hidden as "no signal".
- **Spending nothing gives "no signal".** Over 15 places, "Walk the road again" appears and no finale plays.
- **Abroad has a single entry point.** The only entry is `#fAbroad` on the field page. There is no entry on welcome, reveal, doors or parent, and field → abroad → back works. Medicine suppresses the 4+2 total, and the loan-repayment and "never guaranteed" wording is present.
- **The puzzle answer keys are correct.** ₹320, 24 s, 3; shine/cook/short-lived; B, →, 18. All three shapes are chiral (mirror ≠ rotation).
- **Server basics are sound:**
  - All SQL is bound.
  - The admin check fails closed when `ADMIN_KEY` is unset.
  - The admin UI escapes HTML everywhere (`esc` or `textContent`).
  - The server CSV guards against formula injection.
  - Generated invite codes have about 40 bits of entropy.
  - Event types are allow-listed and sizes capped.
  - No secrets are in the repo or its git history.
- **Reduced motion is handled:** a global CSS override, plus JS that skips the veil, walk, GSAP and finale timeline.
- **The feedback sheet has a puzzle rating;** the admin shows invite source labels, the fact-check batch export and import, and an "applied" marker.
- **English only.**
- **The PLFS male and female averages match the PIB press note.**

## Verdict
- **(a) Adult controlled testers now: yes, after M2 (closing the fail-open gate, a one-line change) and ideally M1.** Tell testers that field order is known to over-surface media, arts, sports and hospitality, so their "sounds like me" ratings are not misread. Use the pilot to collect data for M3 and M4.
- **(b) Class 9–12 students with parental consent: not yet.** These must be done first:
  - B1: an unbiased, validated field ranking.
  - B2: verifiable parental consent, plus a notice listing the actual data (M8) and real deletion.
  - M3: flag random and positional players.
  - M5: fix the India pay content.
  - M6: back-button handling.
  - M7: shared-device identity.
  - Fact-check coverage of abroad and plan B (M9).
