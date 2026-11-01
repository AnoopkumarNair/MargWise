# Handoff: state at 30 Oct 2026

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
