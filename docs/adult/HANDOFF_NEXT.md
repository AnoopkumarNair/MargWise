# Handoff: state at 1 Nov 2026

Branch `ccr-4a84cc2e-h7kisr`, draft PR #20 into `main`. Nothing is deployed. `--accept` has not been run. No SQL has been applied to any remote database.

## Done and tested

| Slice | What | Demo script |
| --- | --- | --- |
| S0 | Frozen contracts, validator, id registry check, migrations, `fakedb`, handler core, flags, data inventory, invariant checker, CI skeleton | none (no screens) |
| S1 | O*NET 31.0 graph, 910 slices, matcher, `/work/` title to roads | `S1_DEMO.md` |
| S3 (moved ahead of S2) | Resume on the device: PDF and DOCX reading, dictionary reader, confirm screen, privacy journey tests | `S3_DEMO.md` |
| S2 (most of it) | Constraints, "Your job today", level labels, flags, bridges stub, drill, "About this data" page, freshness discount, wider Indian dictionary, 15 golden cases | `S2_DEMO.md` |

Matcher is 1.2.0. Contracts are frozen with amendment A1. Owner decisions are in `deviations.md` under Decisions.

## Check set (all green on 30 Oct)

```bash
python3 pipeline/run.py && git diff --exit-code -- data/content.json data/releases/latest.json hosting/functions/api/_claims.json
node --test engine/tests/engine.test.mjs engine/tests/design.test.mjs && python3 engine/reference.py && node hosting/tests/util.test.mjs
node --test 'contracts/tests/*.test.mjs' 'hosting/tests/adult/*.test.mjs' 'matcher/tests/*.test.mjs'
python3 matcher/reference.py && node matcher/tests/version_guard.mjs && node contracts/freeze.mjs
python3 -m unittest discover -s data/graph/tests && python3 pipeline/validate_graph.py --exports
node --test app/adult/tests/unit/*.test.mjs app/adult/tests/intake/*.test.mjs
node .github/scripts/check_vendor_hashes.mjs
cd app/adult/tests && npm ci && node --test --test-concurrency=1 e2e/*.test.mjs privacy/*.e2e.mjs   # MW_E2E_DATA=real for real data
```

CI has never run on GitHub. The first PR run will show whether the workflow works there.

## Open: needs the owner

- **O5** review the dictionary and title lists (`data/graph/raw/abbrev_in.csv` 618 rows, `titles_in.csv` 219 rows, `abbrev_in_unmapped.csv` 85 terms with suggested new nodes).
- **O6** 46 MB of slices sit in history (commit c1f8086). Squash before merging, or accept.
- **O7** Anthropic data is labelled `official` and dated by download day.
- **O9** India pay: (a) approve a SOC-to-NCO division table, (b) wait for the BLS crosswalk, or (c) show no pay. T1.2 is blocked because `www.bls.gov` returns 403.
- **D24 and K1 to K5** matcher questions (pay number meaning, `city_share` format, title seniority, credential catalogue, reset rule for senior people). See `matcher/tests/GOLDEN_TABLE.md`.
- The owner must read the 15 golden cases (BUILD_PLAN T2.4 ASK).
- **D14, D15** confirm the amendment mechanism and git-ignored, packed slices.
- Seed lists for T1.7 (new AI-era roles) and T1.8 (certifications) need real fetched quotes and the owner's approval. Not started.
- Manual checks on Android Chrome, iPhone Safari and a non-Chrome desktop browser.
- S0 owner actions: apply the baseline and `0001` to `margwise-preview` (empty, id in `wrangler.toml`), set `ENVIRONMENT=production`, mark `0000_baseline.sql` applied on the live database without running it, fix the stale Biologist SOC in `content.json` at the next student release.

## Not built yet

- T1.2 crosswalks, PLFS pay band (blocked above).
- T1.7 new roles, T1.8 certifications, T1.9 city clusters (S2 remainder; the last needs no ASK).
- Freshness greying and hiding on real data (slice has no cadence field; needs an owner-approved amendment).
- S4 accounts and saving, S5 on-device suggestions, S6 "Most accurate" AI reading (needs R2 or Hugging Face choice, provider and spend cap), S7 pilot readiness.

## Owner preferences so far

- Resume route is the main flow; title-and-tick is the fallback.
- Do not explain data collection in the UI. Details sit behind one "About this data" link. The O*NET credit, the intake privacy line and the sign-up notice must stay.
- Recommended options have been accepted every time.

## Rules to keep

Never deploy, never apply SQL to the live database, never push to `main`, no scraping of LinkedIn, Indeed or Naukri, no workaround for the BLS block. A contract change needs an owner decision and the amendment mechanism in `contracts/FROZEN.md`.

## Update, 1 Nov 2026

- **S2:** T1.9 city clusters done (`data/graph/raw/cities.json`). T1.7 and T1.8 still wait for fetched quotes and the owner's approval of the seed lists.
- **S4 built and reviewed:** backend T3.1 to T3.7 (`0001_adult.sql`, email sign-in, profile, export, delete, events, metrics), frontend sign-up, log-in, saving and account screens, amendment A2 (email in `complete`), `S4_DEMO.md`, independent Opus review in `S4_REVIEW.md`; both blockers and the should-fix items are fixed. All checks green, e2e 34 pass.
- **Owner answers (recommended options):** O6 squash on merge, O7 keep `official`, O9 show no pay, K1 to K5 keep, D29 amend, D36 log in without an invite (ADR-21), D30 keep.
- **Needs the owner:** approve `app/adult/notice.md` and fill its two blanks (retention period, grievance contact); D38 research opt-out endpoint; open nits in `deviations.md` D42.
- **Deploy order:** apply `0001_adult.sql` to the database BEFORE deploying this code (student queries now read `track`). The owner runs it.
- **Check on a preview deployment:** the Cloudflare `EMAIL` binding and `EMAIL_FROM`, Turnstile under the CSP, `.github/workflows/health-watch.yml` (needs adding; runs `hosting/tools/health_watch.mjs`).
- **Next:** S5 on-device suggestions, then S6, S7; T1.7 and T1.8 once approved.

## Update, 10 Nov 2026 (S5, tier 2 on the device)

- **S5 built:** T4.5. After tier 1, the confirm screen offers "Look for more skills in your resume (downloads 39 MB once, runs on this device)". Only when pressed does the page download the library, runtime, model (`Xenova/all-MiniLM-L6-v2`, int8, pinned) and 109 skill vectors; it then suggests skills the resume only hints at, unticked, each with its source line. Demo script: `S5_DEMO.md`. Decisions D43 to D49 in `deviations.md` (all "proposed").
- **Needs the owner:** D45, the `/work/*` policy gains `'wasm-unsafe-eval'` (nothing else). Without it the model cannot run. Also D43 (library version, published 2026-10-27), D44 (what is embedded; a new O*NET file `Content Model Reference.txt` was added to the raw data), D46 (the model is not in git: the deploy machine must run `python3 app/adult/tools/fetch_model.py` before `python3 app/adult/build.py`; a build without it still works and says tier 2 is off), D47 (threshold 0.40, not 0.55; the table shows tier 2 finds about one implied line in five).
- **New checks** (add to the check set): `python3 data/graph/vec_texts.py --check`; `python3 app/adult/tools/fetch_model.py --check`; `node --test app/adult/tests/intake/tier2.test.mjs app/adult/tests/intake/tier2_model.test.mjs` (the second needs `cd app/adult/tools/embed && npm ci` and the model; under `CI=true` it fails without them); `node --test app/adult/tests/unit/build_tier2.test.mjs`; `e2e/s5.test.mjs` and `e2e/s5_off.test.mjs`. CI: `intake-unit` and `e2e` now fetch and cache the model, and `e2e` builds the graph first.
- **Vectors are made by hand:** `node app/adult/tools/embed/embed_skills.mjs` (needs the model and the tool's packages). `pipeline/run.py` never recomputes them and `validate_graph.py --exports` fails if they go stale. `--accept` carries them into the release and refuses stale ones.
- **For T7.3 (the evaluation harness):** tier 1 is `readResume(text, { skillsIndex, titles, now, occupations })` in `app/adult/intake/read.js`. Tier 2 is `suggestFromText(text, { nowYear, embed, vecs, exclude, roles })` in `app/adult/intake/tier2.js` (or `achievementLines` then `suggest`), with `embed` from `loadNodeEmbedder()` (`app/adult/tools/embed/node_embedder.mjs`) and `vecs` from `decodeVectors(bin, json)`. `app/adult/tests/lib/tier2_eval.mjs` scores suggestions against lines that list what they must or may give.
- **Not done / open:** tested in Chromium only; the manual checks on Android Chrome and iPhone Safari (WebAssembly memory) are still the owner's. The tier 2 fixtures are synthetic and small; real recall and precision are unknown until T7.3.
