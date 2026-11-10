# Deviations from the plan

Record each place where the build differs from `SPEC.md`, `BUILD_PLAN.md`, `BACKEND.md` or `TEST_PLAN.md`. The owner reads this list at each slice sign-off. An empty list means no deviations so far.

## Template

Copy this block, one per deviation, newest last.

```
### D<number>. <short title>
- Slice and ticket: <for example S1, T1.4>
- Date: <YYYY-MM-DD>
- Author: <person or agent lane>
- Plan said: <what the document says, with the section>
- We did: <what changed>
- Why: <the reason, in one or two sentences>
- Effect: <on users, data, tests, other tickets>
- Decision: <proposed | accepted by owner on YYYY-MM-DD | rejected, to be reverted>
```

## Decisions

These are design choices the owner makes (DELIVERY, change control). D1 to D6 came out of the S0 review; the owner decided all six on 2026-10-29, and the contracts were then frozen (`contracts/FROZEN.md`). Their ids (D1 to D6) are kept, so the deviations below start at D7. O1 to O4 came out of the S1 review (they were listed under "Awaiting owner decision"); the owner decided them on 2026-10-29, and they keep their O ids.

### D1. Sign-in token format
- Slice and ticket: S0 (F0.1 contracts); used by T3.3 and T3.4
- Date: 2026-10-28, decided 2026-10-29
- Author: S0 fix lane; architect lane
- Plan said: SPEC 9 and BACKEND name a signed token and a signed 30-minute `pending` token, without a byte format. ADR-04 said `v1.<issued-at>.<mac>`.
- We did: BACKEND ADR-20 (ADR-04's token line is marked superseded). Session token `v<keyver>.<tester_id>.<iat>.<mac>`, with the MAC over `adult|tester_id|iat|keyver`, so adult tokens only work for `track=adult`. Pending token `p<keyver>.<email_hash>.<invite_id>.<age_band>.<iat>.<mac>`, with the MAC over `pending|...|keyver` and a key derived from `SIGN_KEY` for this purpose only. MACs are lower-case hex HMAC-SHA256; `iat` is Unix milliseconds. The patterns are in `api/email_verify.response`, `email_complete.request` and `email_complete.response`, with tests that each token is refused where the other is expected.
- Effect: no code yet (`hosting/core/keys.js` is T3.3). The student token in `hosting/functions/api/_util.js` is unchanged.
- Decision: decided by owner 2026-10-29

### D2. Year bands versus levels
- Slice and ticket: S0 (F0.1, `bands.json` `years`)
- Date: 2026-10-28, decided 2026-10-29
- Author: S0 fix lane; architect lane
- Plan said: SPEC 7.2 sets the level thresholds in years (`<2, 2-5, 5-8, 8-12, 12-18, 18+`); SPEC 6 showed `years: "3-7"`.
- We did: role `years` bands are now `0-2, 2-5, 5-8, 8-12, 12-18, 18+` (`0-2` is under 2 years; each band includes its lower bound). Updated `bands.json`, the profile schema and its copies, the examples, the SPEC 6 example (`5-8`) and the SPEC 7.2 text. A test reads the thresholds from SPEC 7.2 and checks they equal the bands and the levels.
- Effect: the app's years question and the matcher use these bands.
- Decision: decided by owner 2026-10-29

### D3. City ids
- Slice and ticket: S0 (F0.1, `bands.json` `city`, `open_to`)
- Date: 2026-10-28, decided 2026-10-29
- Author: S0 fix lane; architect lane
- Plan said: SPEC 5.9 city clusters, without an id format.
- We did: cluster ids are prefixed (`city:blr`, ..., `city:other`) and the band is `city_cluster`. The profile field is still `constraints.city`. `open_to` also allows three choices that are not a city, prefixed `open:` so they can never clash with a city id: `open:india`, `open:remote`, `open:abroad`. Updated `bands.json`, the schemas, the examples and SPEC 5.9 and 6.
- Effect: `data/graph/raw/cities.json` (T1.9) must use the `city:` ids.
- Decision: decided by owner 2026-10-29

### D4. Where `rev` lives
- Slice and ticket: S0 (F0.1, `profile.schema.json`)
- Date: 2026-10-28, decided 2026-10-29
- Author: S0 fix lane; architect lane
- Plan said: profile writes use `rev` (ADR-09); the profile is one JSON document (ADR-06).
- We did: `rev` is removed from the stored profile document; the schema refuses it. It stays in the `profiles` table, in the API wrapper `{rev, data}` and in a conflict's `current`. The server overwrites it on every write. Updated the SPEC 6 example and table, a note in ADR-06, the schemas, the examples and the tests.
- Effect: the app must not put `rev` inside `data`.
- Decision: decided by owner 2026-10-29

### D5. Prompt version on AI calls
- Slice and ticket: S0, for T3.1 (`0001_adult.sql`) and T6.x
- Date: 2026-10-28, decided 2026-10-29
- Author: S0 fix lane; architect lane
- Plan said: SPEC 10 designs `ai_calls (tester_id, day, n, tokens)`, with no prompt version column.
- We did: SPEC 10 adds `prompt_version TEXT` to `ai_calls` (the prompt of the latest call that day, such as `extract_v1`). It is a planned field in `hosting/core/data_inventory.js`, and ADR-17 has a note.
- Effect: T3.1 creates the column in `0001_adult.sql` and flips the inventory entry to live.
- Decision: decided by owner 2026-10-29

### D6. Event shape strategy
- Slice and ticket: S0 (F0.1, `events.schema.json`, `api/event.request.schema.json`)
- Date: 2026-10-28, decided 2026-10-29
- Author: S0 fix lane; architect lane
- Plan said: ADR-08, one events table with typed `data`.
- We did: one strict request schema per type, `contracts/api/event/<type>.request.schema.json`, generated from `events.schema.json` by `contracts/sync.mjs`, and the same schemas in `contracts/event_schemas.js` with `schemaForType(type)` and `checkEvent(body)`. The validator has no `oneOf`, so the handler picks the schema by `type`; an unknown type is `bad_request`. `api/event.request.schema.json` (the union) is removed. Tests show that a field from another type is refused for every type, and that result events still require `job_release` and `matcher_version`. `events.schema.json` stays as the source and as the two-step check for stored events.
- Effect: the T3.x event handler imports `event_schemas.js`.
- Decision: decided by owner 2026-10-29

### O1. "Used" counts 0.85
- Slice and ticket: S1 review, T2.2 to T2.4 (matcher)
- Date: 2026-10-29, decided 2026-10-29
- Author: architect lane, matcher lane
- Plan said: SPEC 7.1, `have(s)` = 1.0 strong, 0.7 used, 0.4 rusty; SPEC 5.8, a valid credential credits at the used level (0.7). Reach thresholds 0.7 and 0.4 (SPEC 7.3). With used at 0.7, a road was close only when nearly every need was ticked or marked strong (D19).
- We did: option (c). Used is 0.85; strong 1.0 and rusty 0.4 are unchanged, and so are the reach thresholds. A valid credential credits at the used level, so 0.85; an expired one at 0.4. Updated SPEC 7.1 and 5.8, `matcher/README.md`, `match.js`, `reference.py`, the skills screen copy ("Used: you do it in your work now; this counts almost as much as Strong") and the golden outputs. Matcher 1.1.0.
- Effect: coverage rises for anyone who ticks Used. A person who ticks everything as Used reaches at most 0.85, so a close move still needs some Strong ratings or near credit. Measured effect in D19.
- Decision: decided by owner 2026-10-29

### O2. Near only from the 3 closest neighbours, at 0.90 or more
- Slice and ticket: S1 review, T1.5 and T2.2
- Date: 2026-10-29, decided 2026-10-29
- Author: architect lane, matcher lane, data lane
- Plan said: SPEC 7.1, `near(s)` = the best `0.5 x sim(k, s) x have(k)` over the person's skills k with `skill_near(k, s) >= 0.5`. O*NET skill vectors are alike for most jobs (D18 item 6), so near lifted coverage a lot (D17).
- We did: the formula stays. A near skill k counts for s only when the pair is among the 3 closest neighbours of s (the skill being credited; ranked by similarity, ties by id) and the similarity is 0.90 or more. The matcher applies the rank and the floor to the pairs it is given (`slice.near` stays the pair source; `opts.near` still overrides it). The export (`data/graph/export.py`, `countable_pairs`) now leaves out the pairs that can never count: under 0.90, or outside the top 3 of both skills. This is a clean change: no contract file changes, and dropping such a pair changes no result (a unit test checks this on random pairs, and a one-off check on 102 old slices with 3 random profiles each gave identical results). `pipeline/validate_graph.py --exports` now checks every near pair is 0.90 to 1. Updated SPEC 5.2, 5.4 and 7.1, TEST_PLAN layer 1, BUILD_PLAN T1.3, `matcher/README.md`, both implementations, `fixtures/near.json` (quality control to LLM evaluation from 0.7 to 0.92, so swdev-qa-near still shows near) and a new golden case `near-rank`.
- Effect: near pairs per slice fell from a median of 527 to 102 (max 662 to 115). Slices are smaller: gzipped max 22,425 to 19,798 bytes, median 19,983 to 17,757; raw median 211,273 to 195,038. Near still lifts coverage on real data (csr-real-near: about 0.2 to 0.27 without near, 0.33 to 0.41 with it), because many O*NET pairs are above 0.90.
- Decision: decided by owner 2026-10-29

### O3. Tool weights capped at the median of the other needs
- Slice and ticket: S1 review, T1.3 and T1.5
- Date: 2026-10-29, decided 2026-10-29
- Author: architect lane, data lane
- Plan said: BUILD_PLAN T1.3, tool `needs` weigh 0.8 (Hot Technology) or 0.6, by rule; the only check was the cap of 10 tools in 40 needs (D18 item 8, D20).
- We did: an export rule in `data/graph/export.py` (`cap_tool_weights`). In each needs list written to a slice (the occupation's own list and each target's list, separately), a tool's weight is at most the median weight of the non-tool needs in that list (for an even count, the mean of the two middle values; 4 decimals). The graph is unchanged: `graph.sqlite` keeps 0.8 and 0.6, and `build_report.json` and the graph release id do not change. Which tools fill the 10 places, and which targets a slice has, do not change either: candidate targets are still ranked with the graph weights (checked: all 910 slices have the same targets and the same need ids as before; only tool weights moved). `export_report.json` now counts the tools: 242,866 of 248,309 tool needs were lowered. Updated SPEC 5.2 and 5.4, BUILD_PLAN T1.3, `matcher/README.md`, the real-shape fixtures (`make_csr_real.py` now also writes `slice_acc_real.json`) and a new golden case `acc-real-tools`. Unit tests in `data/graph/tests/test_units.py`. The hand-built matcher fixtures and the app's dev fixtures keep their made-up weights: the matcher uses weights as given.
- Effect: for a typical list the cap is about 0.33 to 0.50, so a tool now weighs about as much as a middle-ranked skill. The skills screen orders needs by weight, so tools move down the list. A person who ticks only tools gets less coverage (acc-real-tools: 0.29 to 0.35 instead of 0.31 to 0.38).
- Decision: decided by owner 2026-10-29

### O4. Default sliders: short move 3
- Slice and ticket: S1 review, T2.2 and T5.2
- Date: 2026-10-29, decided 2026-10-29
- Author: architect lane, matcher lane, frontend lane
- Plan said: SPEC 7.3 and the SPEC 6 example: every slider 1 except enjoy 0, so AI safety counted as much as coverage and a low-coverage road with little AI use could come before a closer road.
- We did: option (b), stronger. When the profile has no priorities, and when the app starts, the sliders are short move 3, pay 1, AI safety 1, demand 1, enjoy 0. Updated SPEC 6 (example) and 7.3, `match.js` and `reference.py` defaults, `app/adult/state.js` (`DEFAULT_PRIORITIES`, which a unit test keeps equal to the matcher's), the roads screen ("We start with Short move at 3 and the others at 1, so the jobs closest to what you do now come first"), the golden outputs and `GOLDEN_TABLE.md` (its open question is removed). `profile.schema.json` already allows 0 to 5 for each slider, so no contract file changed and none needed an amendment; the only contract-folder changes are `MATCHER_VERSION` in `versions.js`, `versions.json` and the lock (`freeze.mjs --write`, versions only).
- Effect: roads are closer to coverage order by default. For an accountant with 25 needs ticked Used, the top 5 are Tax Examiners and Collectors, and Revenue Agents (stretch 0.52), Tax Preparers (0.49), Budget Analysts (0.48), Insurance Underwriters (0.47) and Financial Examiners (0.46). Under 1.0.1 Tax Preparers was not in the top 5, and Compensation and Benefits Managers (0.42) was fifth.
- Decision: decided by owner 2026-10-29

### O8. S3 (resume on the device) is built before S2
- Slice and ticket: S3 and S2 order, T4.3, T4.6, T4.7
- Date: 2026-10-29, decided 2026-10-29
- Author: owner; recorded by the frontend lane
- Plan said: BUILD_PLAN delivery slices: S1, S2 (deeper labels), S3 (resume on the device).
- We did: the slice table in BUILD_PLAN now lists S3 before S2, with a note. The resume path is the main flow: the welcome screen leads to the intake choice (screen 4: upload, paste, or "No resume: type your job title"), then the confirm screen (screen 6), then the existing roads and road screens. The title-and-tick path is the fallback and is lighter: the occupation's top 12 needs start ticked as Used, 18 are shown first, and "Show all" reveals the rest (up to 40). S3 offers only the on-device way; "Most accurate" is S6. The constraints part of T4.6 is not in S3 (it stays in S2), and credentials are shown but not saved because the graph has no credentials list yet (T1.8 is in S2).
- Why: the owner wants to try the resume path first, and wants a lighter fallback.
- Effect: the S1 e2e test now clicks "No resume: type your job title" after Start, and expects the 12 pre-ticked skills and "Show all" (S1 behaviour otherwise unchanged). The slice names stay S1 to S7 so nothing else in the plan or tests is renumbered.
- Decision: decided by owner 2026-10-29

All four decisions together make matcher 1.1.0 (D23).

## Deviations

### D7. The slice schema lives in contracts/
- Slice and ticket: S0, F0.1
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: BUILD_PLAN and TEST_PLAN name `matcher/slice.schema.json`.
- We did: the one slice schema is `contracts/slice.schema.json`.
- Why: every contract sits in one folder with one validator, one set of examples and one version file.
- Effect: matcher and pipeline tickets must read `contracts/slice.schema.json`. No copy exists under `matcher/`.
- Decision: proposed

### D8. Error codes beyond ADR-09
- Slice and ticket: S0, F0.1 and F0.5
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: ADR-09 lists `rate_limited`, `invalid_code`, `expired`, `conflict`, `not_found`, `bad_request`, `unavailable`. SPEC 9 adds `refused_age`.
- We did: the one list (`ERRORS` in `hosting/core/http.js`, `bands.json` `error_code`, `api/error.schema.json`) also has `too_large` (413), `unauthorized` (401), `forbidden` (403), `refused_age` (403) and `internal` (500). A test checks the three lists are equal.
- Why: the server must be able to answer an oversized body, a missing session, a refused action and its own bug, and every answer must match the error contract.
- Effect: clients handle five more codes. Messages stay safe to show.
- Decision: proposed

### D9. migrations_dir is relative to hosting/
- Slice and ticket: S0, F0.3
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: BACKEND ADR-03 writes `migrations_dir = "hosting/migrations"`.
- We did: `migrations_dir = "migrations"` in `hosting/wrangler.toml`.
- Why: Wrangler reads the path relative to `wrangler.toml`, which is in `hosting/`. A test checks the path resolves to `hosting/migrations`.
- Effect: none on behaviour. Wrangler commands run from `hosting/`.
- Decision: proposed

### D10. Health response shape
- Slice and ticket: S0, F0.5
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: SPEC 9 and BACKEND ADR-10: database reachable, release id, `API_V`, AI enabled, email configured.
- We did: `{ok, db, release, api_v, ai_enabled, email_configured, flags}`. `ai_enabled` is true only when the switch is on and an AI key is set; `flags` holds the four switches (ADR-18). When the database is down the status is 503 and the same body also carries `error: {code: "unavailable", message}`. The environment name is not reported. A test checks the real handler output against the schema for 200 and 503.
- Why: one schema covers both answers, so the monitoring check can read either.
- Effect: the health watcher (`health-watch.yml`, a later slice) reads `ok` and `db`.
- Decision: proposed

### D11. Validator library and versions module
- Slice and ticket: S0, F0.1
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: BACKEND and BUILD_PLAN name `contracts/validate.js` as the validator and `versions.json` as the version file.
- We did: the library is `contracts/validate_lib.js` (no Node imports); `contracts/validate.js` is the command line tool and still works as `node contracts/validate.js <schema> <file>` for Python. Code imports versions from `contracts/versions.js`; `versions.json` mirrors it and a test keeps them equal.
- Why: the server bundle and the browser must not pull in `node:fs` or `node:url`, and JSON import attributes (`with {type: 'json'}`) fail in older Wrangler bundles.
- Effect: browser and server code import `validate_lib.js` and `versions.js`.
- Decision: proposed

### D12. S0 contract fixes without a version bump
- Slice and ticket: S0, review fixes
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: any change in `api/`, `events.schema.json` or `slice.schema.json` bumps `API_V` or `SLICE_V` (contracts/README).
- We did: kept `API_V = 1` and `SLICE_V = 1` while fixing the error codes, the health shape, the email verify forms, the no-@ rule for feedback text and the nickname, and the anchored slice source url.
- Why: no version of these contracts has been released or stored anywhere yet, so there is nothing to migrate.
- Effect: none. From the first release on, every contract change bumps its version.
- Decision: proposed

### D13. Owner decisions D1 to D6 without a version bump, then the freeze
- Slice and ticket: S0, contract freeze
- Date: 2026-10-29
- Author: architect lane
- Plan said: a change to `profile.schema.json` or a band the profile uses bumps `PROFILE_V`; a change in `api/` or `events.schema.json` bumps `API_V` (contracts/README).
- We did: kept `PROFILE_V = 1` and `API_V = 1` while applying D1 to D6, then froze the contracts (`contracts/FROZEN.md`). `contracts/freeze.lock.json` holds a hash of every contract file; `contracts/tests/freeze.test.mjs` fails when one changes without its version, and `node contracts/freeze.mjs --write` refuses to update the lock until the version goes up.
- Why: neither version had been released or stored, so there is nothing to migrate (as in D12). From the freeze on, every contract change bumps its version.
- Effect: none on users. Later slices must bump a version for any contract change.
- Decision: proposed

### D14. S1 amendment A1 to the frozen slice contract, without a version bump
- Slice and ticket: S1, T1.5 and T2.2 (contract change by the architect lane)
- Date: 2026-10-29
- Author: S1 integrator (architect hat)
- Plan said: a change to `slice.schema.json` or to a band bumps `SLICE_V` (contracts/README); `node contracts/freeze.mjs --write` refuses until it is bumped (`contracts/FROZEN.md`).
- We did: by owner decision 2026-10-29 (2), `SLICE_V` stays 1 and the change is additive. `slice.schema.json` gains an optional `near` object (`pairs: [[skill, skill, similarity]]`, `as_of`, `src`, `trust`), and task `ai_mode` gains `used` (AI use seen, no automation/augmentation split), separate from `none` (no use seen) and `unknown` (no data). `bands.json` `ai_task_mode` gains `used`. The validator gains `prefixItems` so the near pair is checked by position. To keep the freeze honest, `freeze.mjs` has an explicit amendment path: `contracts/amendments.json` lists the amendment (id, date, owner decision, files, the versions it keeps), `node contracts/freeze.mjs --write --amend A1` writes the lock only if the changed files are exactly the ones it names, and records it in `freeze.lock.json` so the id cannot be reused. It refuses a slice amendment once a graph release exists. The freeze test checks the lock and the list agree.
- Why: no slice has been released, so nothing stored needs a migration; the owner chose an amendment over a bump.
- Effect: every slice valid before is still valid. The data lane now writes `near` and `used`; the matcher and the app read them.
- Decision: decided by owner 2026-10-29 (amendment mechanism proposed for confirmation)

### D15. Slices are build outputs; --accept stores one compressed pack
- Slice and ticket: S1, T1.5, T1.6, T4.1
- Date: 2026-10-29
- Author: S1 integrator
- Plan said: BUILD_PLAN T1.6: `--accept` copies `slices/` to `data/releases/graph/`; the S1 data commit held `data/graph/slices/` (910 files).
- We did: `data/graph/slices/` is git-ignored and removed from the index (`git rm --cached`); `python3 pipeline/run.py` (or `build_graph.py` then `export.py`) rebuilds it, and `export_report.json` (committed, checked by the CI drift step) holds its hashes and sizes. `--accept` writes `data/releases/graph/<release>/slices.jsonl.xz` (every slice, one per line, xz; about 1.3 MB instead of about 190 MB) plus `skills_index.json`, `titles.json` and a manifest with the pack hash and the slices folder hash. `app/adult/build.py` (release build) unpacks the pack and checks both hashes, then writes plain `.json` into `hosting/public/work/graph/<release>/`, so the web server can gzip it. `hosting/public/work/` is git-ignored (`hosting/.gitignore`), like the student game's `index.html`, so it must be built before each deploy. The release build stamps the graph release id (for example `onet-31-0-6148d5ec`) as the app's release id; before, it used the content release id from `data/releases/manifest.json`, and it read a folder layout that `--accept` never wrote. The app's `manifest.json` holds one folder hash for the slices instead of 910 file hashes.
- Why: full-shape slices are about 210 KB raw each, about 190 MB per release; committed raw they would add that much on every graph change. The pack keeps each release at about 1.3 MB of history.
- Effect: the 46 MB of slices in the earlier S1 commit stay in history; nothing new is added. The deploy step must run `python3 app/adult/build.py` (after `--accept`). CI rebuilds the graph to test it.
- Decision: proposed

### D16. Slice size limit is on the gzipped file; the trim is gone
- Slice and ticket: S1, T1.5 (SPEC 5.3, 5.4; TEST_PLAN layers 1 and 8)
- Date: 2026-10-29
- Author: S1 integrator
- Plan said: "slice files are under 60 KB each". The data lane read it as raw bytes and trimmed every slice to 12 or 16 targets with 20 needs and 30 tasks.
- We did: by owner decision 2026-10-29 (1), the limit is 60,000 bytes gzipped (level 6). Every slice now has the SPEC 5.4 shape: 40 needs, all its tasks (at most 40 in O*NET 31.0), up to 30 targets with 40 needs each (895 slices have 30; 15 have 20 to 28 because there are not more candidates), plus `near`. Gzipped: largest 21,338 bytes, median 19,007. Raw: largest 218,361, median 209,922. The trim ladder stays only as a last resort and is counted in `export_report.json`; no slice uses it. SPEC 5.3/5.4, TEST_PLAN layers 1 and 8 and BUILD_PLAN T1.5/T1.6 now say gzipped. A shared label table inside the slice would cut the raw size, but it removes the per-need `label`, which is not an additive change, so it was left out.
- Why: the browser downloads the gzipped file.
- Effect: roads come from up to 30 targets instead of 12 to 16.
- Decision: decided by owner 2026-10-29

### D17. Matcher reads near from the slice; MATCHER_VERSION stays 1.0.0
- Slice and ticket: S1, T2.2 to T2.4
- Date: 2026-10-29
- Author: S1 integrator
- Plan said: SPEC 7.1 near(); the 1.0.0 matcher took skill_near only from `opts.near`.
- We did: `match.js` and `reference.py` read `slice.near.pairs` when the caller passes no `opts.near` (which still overrides; `{}` turns it off). No golden output changed, so the version stays 1.0.0. A ninth golden case, `csr-real-near`, runs on a real-shape extract of the O*NET 31.0 Customer Service Representatives slice with its near pairs; the two implementations agree to 2 decimals. The version guard lock was rewritten only to add the case.
- Why: owner decision 2026-10-29 (3).
- Effect: with real data, near lifts coverage a lot: in `csr-real-near` it moves roads from 0.18-0.26 to 0.34-0.41. See D19 on why.
- Decision: decided by owner 2026-10-29

### D18. Data lane facts the owner should know (S1 graph)
- Slice and ticket: S1, T1.1 to T1.5
- Date: 2026-10-29
- Author: data lane, logged by the S1 integrator
- Plan said: SPEC 5.1 to 5.5 and BUILD_PLAN T1.1 to T1.5.
- We did, item by item:
  1. **O*NET 31.0 renamed files.** `Skills.txt` is now `Essential Skills.txt` (2.A.*) and `Transferable Skills.txt` (2.B.*); three linking files (`Tasks to DWAs.txt`, `Essential/Transferable Skills to Work Activities.txt`) were added to the SPEC 5.1 list, because they are the only link from tasks to skills for the SPEC 5.5 AI labels (`fetch_onet.py`).
  2. **Technology ids are name slugs** (`tec:microsoft-excel`), not commodity codes: one O*NET commodity code covers many products. Ids are stable while O*NET keeps the product name.
  3. **Financial and Investment Analysts (13-2051.00) has no skill ratings in O*NET 31.0.** It stays a graph node but has no slice; it is not offered on the title screen.
  4. **`data/content.json` holds a stale SOC code**, 19-1020.01 for Biologist (career sci-2). O*NET 31.0 lists 19-1029.04. `data/graph/raw/soc_aliases.csv` maps it; `content.json` is not changed (student data). The owner should correct it at the next student release.
  5. **T1.2 crosswalks are still outstanding.** `www.bls.gov` answered 403 again on 2026-10-29 (the proxy connects; the BLS server refuses the request), so there is no SOC 2018 to 2010 to ISCO-08 chain, no `occ.isco`, and no PLFS pay. Pay stays "not yet measured".
  6. **The skill-vector cosine is weak** at telling occupations apart: 8,017 of 9,100 top-10 neighbours have a cosine that rounds (to 0.05) to 0.90 or more. `close_to` therefore takes O*NET's own related occupations first and adds a cosine pair only at 0.93 or more. skill_near has the same problem (most O*NET elements are needed together everywhere), which is why near lifts coverage so much (D17, D19).
  7. **92 rating pairs that O*NET flags as low precision** are kept, marked `low_precision` on the edge.
  8. **Technology cap:** at most a quarter of a needs list (10 of 40) is technology, so tools do not crowd out skills (all tools weigh 0.6 or 0.8 by rule). Which tools fill the 10 places changed in the S1 review (D20): before, they were picked by weight and then by id, so Customer Service Representatives got Adobe Illustrator and Photoshop.
  9. **AI labels are mostly unknown.** In the slices (all needs of every slice and its targets, after D20), 82.3% have no AI label (knowledge and tools never get one; skills and activities need 3 linked tasks with AI data), 12.7% "people still do this", 4.1% mixed, 0.9% "AI already does much". Tasks: 1,695 `used`, 16,735 `none`, 157 `unknown`. The app shows no AI label for unknown.
  10. **Lists that need the owner's review:** `data/graph/raw/abbrev_in.csv` (144 rows) and `titles_in.csv` (34 rows) were drafted by the data lane; 19 terms in `abbrev_in_unmapped.csv` wait for S2.
  11. **The slice trim is removed** (D16).
- Why: each is a judgement or a gap in the public data.
- Effect: as listed.
- Decision: proposed (items 4, 5 and 10 need the owner)

### D19. Skills screen shows up to 40 needs in groups; most roads are leaps when few skills are ticked
- Slice and ticket: S1, T5.2 (frontend)
- Date: 2026-10-29
- Author: S1 integrator
- Plan said: SPEC 7.1 coverage counts only what the person has; SPEC 7.3 reach thresholds (0.7, 0.4).
- We did: the thresholds are unchanged. The skills screen lists all of the job's top needs (up to 40, before: 25) in four groups (skills, knowledge, work activities, tools), each with a "Tick all" button, and asks the person to tick everything they do ("Your roads are more useful with 15 or more ticked"; an earlier draft said "Most people tick 15 or more", which no data supports, and was changed in the S1 review). It also lists the job's tasks with their AI use ("AI use seen", "No AI use seen", and no label when there is no data).
- Why: with real slices, a person who ticks 10 skills sees only leaps. Measured on five jobs (accountant, software developer, customer service, registered nurse, marketing manager), counting adjacent/stretch/leap of 30 roads, with the slice's near pairs: 10 ticked as used: 0/0/30 for all five; 15 used: 0/0-5/25-30; 25 used: 0/13-30/0-17; 25 strong: 1-4/26-29/0; all 40 strong: 10-28/2-20/0. A skill ticked "used" counts 0.7, so adjacent (0.7) needs almost every need ticked; strong ratings and near do the rest.
- Effect: the owner may want to revisit the thresholds or the "used" value after people tests; nothing changed here.
- Update 2026-10-29, matcher 1.1.0 (owner decisions O1 to O4): measured again on the same five jobs, 30 roads each, with the slice's near pairs. Each profile ticks the job's top N needs by weight (the order of the skills screen before grouping), all at one strength, 5-8 years. adjacent/stretch/leap:

  | Job | 10 Used | 15 Used | 25 Used | 25 Strong | 40 Strong | Used ticks for 1 close or stretch road | for 5 |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Accountant (13-2011.00) | 0/0/30 | 0/1/29 | 0/23/7 | 0/30/0 | 26/4/0 | 14 | 20 |
  | Software developer (15-1252.00) | 0/0/30 | 0/23/7 | 0/26/4 | 2/28/0 | 12/18/0 | 12 | 13 |
  | Customer service (43-4051.00) | 0/1/29 | 0/23/7 | 0/30/0 | 0/30/0 | 18/12/0 | 9 | 11 |
  | Registered nurse (29-1141.00) | 0/0/30 | 0/9/21 | 0/24/6 | 0/30/0 | 6/24/0 | 12 | 14 |
  | Marketing manager (11-2021.00) | 0/0/30 | 0/3/27 | 0/20/10 | 0/29/1 | 18/12/0 | 14 | 17 |

  The same measure with matcher 1.0.1 on the slices before O2 and O3: 10 Used 0/0-1/29-30; 15 Used 0/0-8/22-30; 25 Used 0/10-27/3-20; 25 Strong 0-4/26-29/0-1; 40 Strong 6-25/5-24/0. Fewest Used ticks for 5 close or stretch roads, 1.0.1 then 1.1.0: accountant 17 then 20, software developer 19 then 13, customer service 20 then 11, nurse 14 then 14, marketing manager 17 then 17. So 1.1.0 helps most where tools used to weigh a lot and the job's top needs are skills; it is a little harder for the accountant, whose top needs now hold fewer tools. With all 40 needs Strong, four of the five jobs have more close roads (the nurse has 6 instead of 11); with 25 Strong there are slightly fewer close roads (0-2 instead of 0-4), because tools weigh less and near counts less. Used alone never makes a close move (at most 0.85 of a need). The skills screen nudge now says "Your roads are more useful with 20 or more ticked" (before: 15), because about 20 Used ticks of the top needs gave at least 5 close or stretch roads on all five jobs. A person who ticks other needs than the top ones needs more.
- Decision: proposed

### D20. S1 review fixes to the exports: tool picks, AI labels, tool dates; matcher 1.0.1
- Slice and ticket: S1, T1.5 and T2.4 (review findings B1, S4, S5)
- Date: 2026-10-29
- Author: S1 fix lane
- Plan said: SPEC 5.4 (a slice holds the occupation's top 40 needs); SPEC 5.5 (a skill's AI label is the weighted share of its linked tasks with AI use; 0.5 or more and 0.15 or less); SPEC 7.5 (a golden output changes only with `MATCHER_VERSION`).
- We did:
  1. **Tool picks (B1).** `export.py` filled the 10 tool places of a needs list by weight, then In Demand, then id, so most jobs got their alphabetically first Hot Technologies (Adobe Acrobat, Adobe Creative Cloud, Adobe Illustrator ... for customer service). Now: the job's own O*NET "In Demand" tools first, then a TF-IDF style score, `(jobs in the same SOC minor group, the first 4 digits such as 15-12, that list the tool / jobs in that group) x ln(jobs that list any tool / jobs that list this tool)`, then label, then id. A tool every job lists (Microsoft Office) scores 0 unless the job flags it In Demand. The weights (0.8 Hot Technology, 0.6 other) and the cap of 10 of 40 are unchanged (owner decision O3 below). Before and after, the 10 tools:
     - Software Developers (15-1252.00). Before: AWS, Apache Kafka, Atlassian JIRA, C, CSS, C++, C#, Docker, Git, GitHub. After: AWS, Apache Kafka, C#, Docker, GitHub, Go, Microsoft Azure, Node.js, NoSQL, PostgreSQL.
     - Registered Nurses (29-1141.00). Before: Apache Spark, eClinicalWorks EHR, Epic Systems, Google Docs, Henry Schein Dentrix, Kronos Workforce Timekeeper, MEDITECH, Microsoft Access, Microsoft Excel, Microsoft Office. After: eClinicalWorks EHR, Epic Systems, MEDITECH, Electronic medical record EMR software, HCPCS coding, HMS, Medical condition coding software, Medical procedure coding software, Oracle Taleo, Prognosis ChartAccess.
     - Accountants and Auditors (13-2011.00). Before: Adobe Acrobat, Alteryx, Epic Systems, Google Docs, Intuit QuickBooks, Microsoft Excel, Microsoft Office, Microsoft Outlook, Microsoft PowerPoint, SAP. After: Intuit QuickBooks, Intuit TurboTax, Microsoft Excel, Microsoft Office, Microsoft Outlook, Microsoft PowerPoint, SAP, Fund accounting software, LexisNexis, Tax software.
     - Customer Service Representatives (43-4051.00). Before: Adobe Acrobat, Adobe Creative Cloud, Adobe Illustrator, Adobe Photoshop, Apple macOS, Facebook, Google Docs, Microsoft Excel, Microsoft Office, Microsoft Outlook. After: Adobe Acrobat, Microsoft Excel, Microsoft Office, Microsoft Outlook, Microsoft SharePoint, Zoom, Active Data Online WebChat, Astute Solutions PowerCenter, Austin Logistics CallTech, Austin Logistics Valeo.
     Microsoft Office stays for accountants and customer service because O*NET flags it In Demand for those two jobs. Some picks are still odd (Oracle Taleo, a hiring tool, for nurses): it is O*NET's own list, and the score only orders it.
  2. **AI labels (S4).** A task with no AI data counted as "no AI use", which pushed skills toward "people still do this". Now such a task is unknown and left out of both counts. "Weighted share" is implemented as: for each skill, take the job's tasks linked to it through a detailed work activity (a task linked through two activities counts twice: that is the weighting); keep only the tasks with AI data; the share is the ones with AI use (penetration above 0) divided by those; fewer than 3 such tasks gives unknown. Effect on the 36,350 needs of the 910 slices: people_do 4,635 to 4,591, mixed 1,420 to 1,417, ai_does_much 299 to 303, unknown 29,996 to 30,039 (54 labels moved: 37 people_do to unknown, 6 mixed to unknown, 7 people_do to mixed, 4 mixed to ai_does_much). Over all needs including the road targets: people_do 13.0% to 12.7%, unknown 82.1% to 82.3%. The effect is small because only 157 of 18,613 tasks have no AI data.
  3. **Tool dates (S5).** A tool need's `as_of` is the O*NET release month (`2026-08`), not the date of a rating: O*NET gives tools no rating date. Skill, knowledge and activity needs carry the date of their own rating.
  4. **Matcher 1.0.1.** The golden fixture `matcher/tests/fixtures/slice_csr_real.json` is an extract of the customer service slice, so it was re-extracted (new script `make_csr_real.py`, which reproduces the old file exactly from the old slice). Its tools changed, so the csr-real-near output changed: every road is now a leap (coverage 0.35 to 0.40; before, two were stretches at 0.41 and 0.40). The version guard allows a changed output only with a new version, so `MATCHER_VERSION` went from 1.0.0 to 1.0.1 in `match.js`, `reference.py`, `contracts/versions.js`, `versions.json` and `golden.json`; then `freeze.mjs --write` (versions only, no contract file changed) and `version_guard.mjs --write`. The matcher's rules did not change.
- Why: review findings B1, S4 and S5.
- Effect: slices change (tools and some AI labels), so `export_report.json` hashes change; the graph itself (`build_report.json`, release id `onet-31-0-6148d5ec`) does not. Gzipped slice size: largest 21,338 to 22,425 bytes, median 19,007 to 19,983, still under 60,000. Results and events from now on carry matcher version 1.0.1.
- Decision: proposed

### D21. Freeze history check and code owners
- Slice and ticket: S1 review (finding S6), contracts tooling
- Date: 2026-10-29
- Author: S1 fix lane
- Plan said: FROZEN.md: an amendment is listed in `amendments.json` and recorded in the lock, and `freeze.test.mjs` checks the two agree. Nothing stopped one change from rewriting both.
- We did: `contracts/check_freeze_history.mjs` compares the working tree with `main` (or `origin/main`): amendments only appended and never edited; the lock's recorded amendments likewise; no version goes down; a lock hash change needs a bump of a governing version or a new amendment naming the file; a change without a bump must be additive (no removed property, no new required field, no removed enum or bands value, no removed type, no `additionalProperties: false` added, no tighter min or max); and every amendment's `deviation` entry here names the amendment and has "Decision: decided by owner". It runs in the CI contracts job (fetch-depth 0); under `CI=true` an unreadable `main` fails, locally it warns; a file not yet on `main` is skipped with a warning (true today: `contracts/` is not on `main` yet, so the first real comparison is the PR after this one merges). Tests: `contracts/tests/freeze_history.test.mjs`. `.github/CODEOWNERS` names the owner (`@AnoopkumarNair`) for `contracts/`, `docs/adult/SPEC.md`, `docs/adult/BACKEND.md` and the CODEOWNERS file itself.
- Limits: the additive check compares the same JSON paths only; it does not follow `$ref` and does not judge `pattern`, `format`, `oneOf`/`anyOf`/`allOf` or `prefixItems` changes. The deviation check trusts the text of this file, which has no code owner. CODEOWNERS works only if the owner turns on "Require review from Code Owners" in the branch protection for `main`. The release guard on amendments covers `SLICE_V` only (`freeze.mjs` refuses a slice amendment once `data/releases/graph/latest.json` exists). **A `PROFILE_V` or `API_V` amendment has no release guard until T3.x**, when profiles are stored and the API is deployed: until then nothing in the repository says whether a profile or API version was released.
- Why: review finding S6.
- Effect: none on users. A later contract change needs a bump or an amendment that this check accepts.
- Decision: proposed

### D22. Matcher README: the rating-age discount is not applied in S1; review copy fixes
- Slice and ticket: S1, T2.2 and T5.2 (review findings S1, S2, S3 and nits)
- Date: 2026-10-29
- Author: S1 fix lane
- Plan said: SPEC 5.6 (a need's weight is discounted by the age of its O*NET rating); BUILD_PLAN puts SPEC 5.6 in S2.
- We did:
  1. `matcher/README.md` said the data lane applies the SPEC 5.6 discount before export. It does not: `export.py` writes the weights undiscounted in S1 (`data/graph/freshness.py` has the function, unused by the export). The README now says so, and that every need carries its rating date (tools carry the release month, D20). It also says that `reference.py` shares the open choices with `match.js` (year bands counted from their lower bound; a component equal on every road keeps its raw value), so agreement between them cannot catch those.
  2. App copy. The footer said the guide uses "broad averages for India"; S1 has no India data, so it now says the data is from the United States, with data on where AI is used at work, and that there is no pay or demand data for India yet. The skills screen said "Most people tick 15 or more", which nothing measured; it now says "Your roads are more useful with 15 or more ticked". The roads screen now says coverage counts the skills that matter most for more (it is weighted). A gap reason said a "people still do this" skill "counts for more"; it is only listed higher, and now says so. The footer shows the O*NET version (31.0) in dev builds too (`build.py` writes `onet_version` into `manifest.json` from the slices' release id).
  3. Coverage on screen is floored to a whole percent (`coveragePercent` in `matcher_adapter.js`), so 0.3969, a leap, shows 39% and not 40% next to the Leap badge. A unit test checks every value from 0 to 1 in steps of 0.0001.
  4. `state.js` `checkProfile` fails closed: if the profile schema did not load, the profile is refused and the roads screen shows its error, instead of passing an unchecked profile to the matcher.
  5. `matcher_adapter.js` reads only the 1.0.x result shape (`matcher/result.schema.json`); the code for older draft shapes (`tier`, `gaps` as ids, numeric or array components) is removed.
  6. The e2e tests write screenshots to `app/adult/tests/out/` only, unless `MW_SHOTS=commit`; a real-data run no longer overwrites the committed ones.
- Why: review findings S1 to S3, S7 and nits.
- Effect: copy only, plus the fail-closed check. Open items (CI never run on GitHub, the release build in CI after the first `--accept`, manual checks on Android Chrome, iPhone Safari and a non-Chrome desktop browser) are listed in `docs/adult/S1_DEMO.md`.
- Decision: proposed

### D23. Matcher 1.1.0: owner decisions O1, O2 and O4 in the matcher, O3 and the near filter in the export
- Slice and ticket: S1, T1.5, T2.2 to T2.4, T5.2
- Date: 2026-10-29
- Author: architect, matcher, data and frontend fix lane
- Plan said: SPEC 7.5 and the version guard: a golden output changes only with a new `MATCHER_VERSION`. TEST_PLAN layer 2: `reference.py` and `match.js` agree to 2 decimals.
- We did: `MATCHER_VERSION` 1.0.1 to 1.1.0 in `match.js`, `reference.py`, `contracts/versions.js`, `versions.json`, `golden.json` and `contracts/freeze.lock.json` (`node contracts/freeze.mjs --write`, versions only: no contract file changed). The golden expectations were regenerated with `reference.py` first, then `match.js` was checked against them (all 11 cases, and 500 random profiles, agree to 2 decimals with the same order, reach and gap). `node matcher/tests/version_guard.mjs --write` rewrote the lock for 1.1.0. The 9 existing cases are kept; 2 are new (`near-rank`, `acc-real-tools`). `data/graph/export.py` caps tool weights (O3) and drops near pairs that can never count (O2), so every slice changed and `export_report.json` changed; `graph.sqlite`, `build_report.json` and the graph release id (`onet-31-0-6148d5ec`) did not. The app's dev fixtures (`app/adult/dev/fixtures/`) are hand-written and were not changed; the stand-in matcher there now uses 0.85 and the new defaults. Screenshots in `app/adult/tests/e2e/screenshots/` were taken again (`MW_SHOTS=commit`, real data). `docs/adult/S1_DEMO.md` step 9 now says what to expect with 1.1.0.
- Why: owner decisions O1 to O4.
- Effect: every result and event from now on carries matcher version 1.1.0. Old results (1.0.x) are not comparable and are not stored anywhere yet.
- Decision: proposed

### D24. Matcher 1.2.0: levels, kinds, pay, flags and bridges with the frozen contracts
- Slice and ticket: S2, T2.2 (SPEC 7.2 to 7.4), T2.4, T1.8 (matcher part), T1.9 (flag part), T5.3 (bridges)
- Date: 2026-10-30
- Author: matcher lane
- Plan said: SPEC 7.2 (levels, kinds, experience fit), 7.3 (order with the PLFS pay change; flags `outside_time`, `below_pay_floor`, `needs_relocation`), 7.4 (bridges, greedy, up to 3), 5.8 (expired credentials "renew?"). BUILD_PLAN T2.4: 15 golden cases across 5 families, with a reset, a fork, rusty skills and every road below the pay floor; TEST_PLAN layer 2: a close move and a reset into new AI-era roles.
- We did: `MATCHER_VERSION` 1.1.0 to 1.2.0 in `match.js`, `reference.py`, `contracts/versions.js`, `versions.json`, `golden.json` and `contracts/freeze.lock.json` (`node contracts/freeze.mjs --write`, versions only: no contract file changed, no amendment). Both implementations gained the rules in `matcher/README.md`; `reference.py` wrote every golden expectation first (`--expect`) and `match.js` agrees on all 15 cases and 500 random profiles (order, reach, coverage, gap, kind, target level, fit, flags, pay change, bridges). Result fields were only added (README, "S2 additions"). Four golden cases were added; GOLDEN_TABLE.md has the 15 for the owner. Choices SPEC leaves open, each listed there as a question: K1 kinds for moves the table does not name; K2 reset compares with the target's entry level; K3 any SOC 11- target is a fork for a non-manager (read word for word, "same minor group and SOC 11-" could never hold for a non-manager); K4 `matcher/ladder.json`, a draft table of 4 specialist steps, each an O*NET related occupation in the same minor group at a higher job zone; K5 `outside_time` means the bridges need more than 12 months at the top of the hours band.
- Not possible with the frozen contracts (stubs, see "Fields the matcher needs" below): the title-word level override; a usable city share for `needs_relocation`; a defined numeric pay for `below_pay_floor` on real slices; bridges and `outside_time` on real data (no catalogue yet).
- Fields the matcher needs (for the owner and the architect; nothing here was changed):
  1. `slice.signals[kind=pay_band_in].value` (and on each target): the contract allows string or number but does not say what a number means. The matcher uses a number above 0 as a pay level and compares only the ratio of two occupations. Needed: a decision that the export writes a number (for example the PLFS median monthly earnings of the band, in rupees, one unit per slice) or a separate numeric field. A band name as a string counts as unknown. The pay-floor golden case uses a hand-built slice with numbers, which the schema already allows.
  2. `city_share` (and `remote_share`): the signal table keys on (node, kind, period), so one occupation cannot hold one share per city without a format. The matcher reads a provisional string `"city:blr=0.42,city:hyd=0.31"` and a numeric `remote_share` 0 to 1. Needed: an agreed encoding (or a structured field) before Pipeline B writes city data.
  3. Seniority title word: the profile holds no title text (by design), so the SPEC 7.2 override cannot run in the matcher. Either the app applies it at intake and stores `roles[].level` (and the matcher would then need to read `roles[].level`, which is not in `ALLOWED_INPUT_FIELDS` today), or it stays out. `level.title_override` is always `null`.
  4. Credential catalogue in the slice or the release: SPEC 7.4 needs cost, hours, validity, official link and `teaches`. The slice has no credential block, so the caller passes `opts.credentials` (the catalogue `name` passed as `label`). Needed when T1.8 lands: where the app gets the catalogue (a release file next to the slices is the simplest).
  5. `asked_for` credentials per occupation (the screening note of SPEC 5.8): no slice field; not implemented.
- Why: S2 asks for levels and honest labels, and the contracts are frozen until the owner decides an amendment.
- Effect: results carry 1.2.0. The frontend's adapter keeps working: only fields were added, and `bridges` is still a list of ids or null. Real slices today give kinds, target levels and fit (from job zones); pay, relocation and bridges stay "not yet measured" until their data exists. Some senior people will see "reset" on specialist roads that start lower (K2).
- Decision: proposed

### D25. The rating-age discount is now applied at export (SPEC 5.6 rule 3)
- Slice and ticket: S2, T1.3 (freshness) and T1.5
- Date: 2026-10-30
- Author: data lane
- Plan said: SPEC 5.6 rule 3: a rating's weight is multiplied by `max(0.6, 1 - 0.05 * max(0, age_years - 3))`; BUILD_PLAN puts it in S2. D22 recorded that S1 did not apply it.
- We did: `data/graph/export.py` multiplies the weight of every skill, knowledge and activity need by that factor. The age runs from the edge's own O*NET collection date (`as_of`) to `RATING_REF`, the 15th of the pinned O*NET release month (`onet_release` in `build_report.json`, set from `ONET_RELEASE` in `fetch_onet.py`: 2026-08). It never reads the clock, so a build gives the same bytes on any day (checked: two exports give identical hashes). Order of the steps: discount, then the top-N choice (an old rating now ranks lower), then the tool cap (the O3 median is taken over the discounted weights). Tool needs are not discounted: their `as_of` is the release month (D20), so their age is 0 anyway. The candidate road ranking in the export (`own_w`) uses the discounted weights too, so it compares like with like. The graph keeps the undiscounted weights. `matcher/README.md` now says the matcher must not discount a second time. `export_report.json` gained `rating_age_discount` (reference date, needs written, needs lowered). Tests: `data/graph/tests/test_units.py` `RatingAgeDiscount` (rule, tools, order before top-N, cap on discounted median, real slices against the graph).
- Why: SPEC 5.6 rule 3, and the "Your job today" screen should not treat a 2008 rating like a 2026 one.
- Effect: 534,128 of 874,152 non-tool needs written in the slices (61 percent) are lowered, down to 0.6 of the graph weight; every slice hash changed; no schema change. Gzipped slices: largest 19,798 to 19,774 bytes, median 17,757 to 17,819, total 16.06 to 16.10 MB (limit 60,000 each). Matcher golden outputs are hand-made fixtures and do not change. Real-data road coverage moves slightly (older ratings count less); the owner may want to re-run the D19 table on the next people test.
- Decision: proposed

### D26. Indian dictionary widened: 480 new terms, 185 new titles, `team lead` fixed (T1.5)
- Slice and ticket: S2, T1.5 (Indian abbreviations and titles)
- Date: 2026-10-30
- Author: data lane
- Plan said: BUILD_PLAN T1.5 asks for about 80 terms; SPEC 5.6 rule 4: new nodes only after the founder approves them (trust `observed`); CLAUDE.md: no invented facts.
- We did: (1) `abbrev_in.csv` 144 to 618 rows (480 new, 6 removed), all marked "needs owner review": 267 point at `skl:` ids, 273 at `tec:` ids, 78 at `occ:` ids. They map Indian IT, BPM and BFSI vocabulary (GST, TDS, KYC, AML, Tally, Zendesk, VBA, Six Sigma, Jenkins, Looker, SAP modules, loan, claims, audit and so on), generic resume phrases (communication, problem solving, data analysis) and 11 Hindi phrases onto EXISTING graph ids only. Where only a category node fits (for example Tally to "Financial accounting software", Zendesk to "Help desk software") the note says so. Everyday single words that would fire everywhere (billing, audit, forecasting, compliance, recovery, risk management, sales, research) were tried and dropped after the intake fixtures showed them matching on "SaaS billing product" and "audit of delivery delays". Words that are also plain English are marked "ambiguous" (the intake then needs a tool word near them or a skills list). (2) No node was invented. 85 terms with no suitable node are in `abbrev_in_unmapped.csv`, now with `status` (`no_node` or `broad_node_only`) and a suggested `tec:in-*` or `skl:in-*` id for the founder to approve. (3) `titles_in.csv` 34 to 219 rows: BPM, IT and BFSI titles (process associate and executive with seniority, KYC analyst, credit analyst, underwriter, collections, relationship manager, SDE 1 to 3, QA engineer, L1 and L2 support, scrum master, delivery manager, cloud and DevOps, SAP consultants and more). (4) Review fixes: `team lead` and `team leader` no longer map to Office Supervisors alone; they are removed, and only forms with a domain word map (customer support, voice process, operations, accounts, collections, technical support, QA, development, software team lead; technical lead, tech lead, module lead, project lead). `AML`, `KYC` and `TDS` no longer map to occupations (they are skills, not titles; `KYC analyst` and `AML analyst` are titles). `data engineer` now maps to Database Architects and Software Developers (O*NET's own alternate titles also give it Database Administrators, Statisticians and Data Scientists, so the list shows the first three by id: Database Administrators, Database Architects, Software Developers). (5) `export.py` and `validate_graph.py` compared terms with a Latin-only form that turns every Hindi term into an empty key, so any two Hindi terms looked like a clash; both now fall back to the lower-cased term. No app code was changed.
- Why: the intake fixtures' `outOfDictionary` lists show resumes use terms O*NET does not hold; a reader that misses GST, Tally, KYC or Zendesk looks blind to Indian resumes.
- Effect: `skills_index.json` alt terms 58 to 525 on 198 skills (ambiguous terms 11 to 39), 176 KB gzipped (limit 1.5 MB); `titles.json` 40,419 to 42,310 keys, 337 KB gzipped. Intake fixtures: of the 16 `outOfDictionary` items, 11 are now found (Tally, Tally ERP, GST, TDS, Zendesk, Data Analysis, Looker, Statistics, VBA, Jenkins and the Hindi communication phrase); 5 are not (gRPC, CRM, Typing speed, Content planning, Email campaigns), and are listed in `abbrev_in_unmapped.csv`. All 93 intake tests stay green, and no `mustNotFind` id appears (0 false positives on every fixture). Fixtures were not edited.
- Decision: proposed (the owner reads all of it: O5)

### D27. Pay band (PLFS) is not attached: no career carries a PLFS group
- Slice and ticket: S2, T1.3 (PLFS)
- Date: 2026-10-30
- Author: data lane
- Plan said: BUILD_PLAN T1.3: attach `pay_band_in` through ISCO; "If NCO is missing, attach it only to the 83 careers that already carry PLFS groups."
- We did: nothing yet. The 83 careers in `data/content.json` carry no PLFS group: `data/plfs.py` removes the per-career mapping on purpose ("PLFS gives broad group averages only") and `pipeline/validate.py` fails a build if a career carries one. `plfs_2025.json` holds seven NCO-2015 division averages (INR a month, salaried employees, 2025, trust `secondary`) and no link from an occupation to a division. The T1.2 SOC to ISCO crosswalk is still blocked (bls.gov, D18 item 5). So no occupation can get a band without a new SOC to NCO division mapping, which is a judgement the owner has not approved.
- Why: the fallback in the plan assumes a mapping that the student data removed.
- Effect: pay stays "not yet measured". The frozen slice schema already allows the signal: `kind: pay_band_in`, `period` (up to 20 characters), `value` (string or number), `as_of`, `src` pointing at a `sources` entry (trust `secondary`). What it cannot carry is the division name (up to 40 characters, over the 20 of `period`). See O9.
- Decision: proposed (O9)

### D28. Frontend S2: plain copy for adults (owner decision 2026-10-30), questions, job today, drill
- **Owner decision (2026-10-30, relayed by the orchestrator).** Adults should not see how we collect and collate data. All screens (S1, S2, S3) were simplified:
  - the resume line behind each skill is hidden on the confirm screen; one button, "Where did this come from?", shows them all, and a second tap hides them again;
  - rating dates, "US data", the O*NET version, source lists and "how the score was made" are off the default screens. They are on one "About this data" page (`#/about`), reached from one footer link. On the road page the score table sits in a closed "Why this order?" section;
  - the footer is: the "About this data" link, the O*NET credit (kept, the licence needs it, set small), and the release id in small type;
  - a figure we do not have is left out, not listed as "not yet measured". Two honest exceptions: one short line, "Pay and demand figures are coming.", where pay or demand would be, and the slider note that says those sliders change nothing yet;
  - the privacy line at intake ("Your resume is read in your browser. Nothing leaves your device.") is unchanged and still shown.
  - No figure was made up. The "Pay change" row shows only when the matcher worked one out from two real numbers.
- **Greying and hiding by age (SPEC 5.5) cannot run on real data yet.** The slice has no cadence: `slice.schema.json` has no cadence field and `data/sources.yaml` holds the cadence as prose. `today_model.js` has the rule (`freshness`: greyed above 2x cadence, hidden above 3x; a bare year counts as the end of the year) and a unit test with a fixed "today". The screen uses it only if a source in the slice carries `cadence_months`. Needs from the contract owner: a `cadence_months` number on each slice source (an amendment), filled by the data lane.
- **The constraint notes depend on data we do not have everywhere.** `below_pay_floor` needs numeric pay on both jobs (O9, D27), `needs_relocation` needs `city_share` signals (provisional format, D24), and `outside_time` needs a reviewed credential catalogue, which the app does not pass because none exists yet. So with real data no note shows today. The test fixture carries made-up numbers (`gen_fixture.py`) so the notes are tested.
- **Questions never reorder.** The e2e test answers the six questions, then skips them, and checks that the road order is the same.
- **Drill.** `#/drill/<skill id>` lists the jobs in the loaded slice (the job and its road targets) that need the skill. `#/roads/<occ id>` shows the roads from another job that has its own slice, with the same profile; the browser's back button works because the job is in the address. The profile is not changed, so the person's level still comes from their own roles.
- **Flow.** Confirm (or skills) leads to the questions, then "Your job today", then the roads. Both are optional to read: "Skip these questions" and "See my roads" are one tap each. The button on the confirm and skills screens now says "Continue".

## Awaiting owner decision

Questions from the S1 review that only the owner can answer. Nothing below was changed by an agent. Each lists the reviewer's options. O1 to O4 were decided on 2026-10-29 and moved to "Decisions".

### O5. Review lists
- The question: `data/graph/raw/abbrev_in.csv` (618 rows after D26; 144 in S1) and `titles_in.csv` (219 rows; 34 in S1) were drafted by the data lane and are live in the title search and the resume reader; 85 terms in `abbrev_in_unmapped.csv` wait for new nodes the founder must approve (D18 item 10, D26).
- Options: (a) the owner reviews them before the people test; (b) ship S1 without them (O*NET titles only) until reviewed; (c) keep them, marked as a draft in the demo.

### O6. History squash
- The question: the earlier S1 commit holds 46 MB of slices in git history (D15).
- Options: (a) leave the history as it is; (b) squash the S1 branch before it merges into `main`, so the slices never reach `main`'s history. Rewriting history is the owner's call; agents never force-push.

### O7. Anthropic data: trust level and date
- The question: the Anthropic Economic Index sources are marked `official`, and their `as_of` (2026-10-22) is the date the files were downloaded, not the date of the data.
- Options for trust: (a) keep `official` (Anthropic publishes the data itself); (b) mark it `secondary` or `observed` (it is usage seen on one AI product, not an official statistic). Options for the date: (a) keep the download date and say so; (b) use the release date of the dataset version; (c) show both.

### O9. Pay band: which SOC to PLFS group mapping may the export use?
- The question: PLFS gives seven NCO-2015 division averages (`data/plfs_2025.json`) and no career carries one (D27). Without a mapping there is no `pay_band_in` signal.
- Options: (a) approve a SOC major group to NCO division table written by the data lane (the two systems follow ISCO-08 major groups, so it is mostly one to one, with judgement calls for 15-xxxx IT, 13-xxxx finance and 43-xxxx clerks; each row would be marked for review); (b) wait for the SOC to ISCO to NCO chain when `bls.gov` is reachable (T1.2); (c) show no pay for India until posting data exists.
- Either way the owner should also decide the value format that the matcher needs (D24 item 1): a number of rupees a month, with the division name carried in the source entry or in a coded `period` such as `plfs25-nco2`, since `period` holds 20 characters and the division names are longer.

### Owner answers, 2026-10-30 (all recommended options)
- **O9:** (c) show no pay for India until posting data exists. No workaround for the BLS block.
- **O6:** squash PR #20 when merging. Agents change nothing.
- **O7:** keep `official` and the download date.
- **K1 to K5:** keep the current matcher choices. No version change.
- **T1.9:** `data/graph/raw/cities.json` added, with a test against `contracts/bands.json`.

## S4 backend lane (accounts and saving), 2026-11-01

Written by the backend lane while building T3.1 to T3.7. Nothing below changed a contract except D29, which the owner decided on 2026-11-01 (amendment A2). Each entry says what was built and what the owner or another lane must decide or do.

### D29. The email address is not stored when the account is made
- Slice and ticket: S4, T3.4 (`email_complete`), ADR-04 and ADR-20, SPEC 10 `testers.email`
- Date: 2026-11-01
- Author: backend lane
- Plan said: `testers.email` holds the normalised address, "needed to send codes" and to recompute `email_hash` if `EMAIL_KEY` is rotated (ADR-04). The `pending` token holds only the email hash (ADR-20), and `email_complete.request` has no email field.
- We did: `email/complete` creates the tester with `email` empty, because the address reaches the server only in `email/start` and `email/verify`, and neither is kept (the code table holds hashes only). The address is saved on the first later sign-in by code, from the `email/verify` body (`UPDATE ... WHERE email IS NULL`). Sending a code never needs the stored address, because the person types it every time.
- Why: the frozen contracts give `complete` no way to receive the address, and ADR-20 says the token must not carry it.
- Effect: a person who has signed up but never signed in again has no stored address. If `EMAIL_KEY` is rotated, their hash cannot be recomputed, so they would need a new account or an owner-run merge. Export and delete are unaffected.
- Options for the owner: (a) accept this (default, as built); (b) amend `email_complete.request` to add `email` (the app already holds it), and have the server check that its hash equals the one in `pending` before storing it; (c) never store the address at all (best for privacy; a key rotation then means everyone signs in again by code, and the `email` column stays empty). The backend lane recommends (c) or (b).
- Decision: decided by owner, 2026-11-01: option (b), as amendment A2 (`contracts/amendments.json`, `FROZEN.md`). `email_complete.request` gains `email` (optional in the schema, so the change is additive; the server requires it). `email/complete` compares the keyed hash of the address with the hash in `pending` and refuses a mismatch (`bad_request`, no address in the answer or any log), then stores the normalised address in `testers.email`, as ADR-04 and SPEC 10 say. The pending token still holds no address (ADR-20). The app sends the address it already holds in memory. When the person opens the emailed link on another device, that device never saw the address, so the profile step asks them to type it (the server checks it the same way). The fallback in `email/verify` (save the address at a later code sign-in when `email` is empty) stays for any account made without it; the notice line now says "and a scrambled form of it". Tests: `hosting/tests/adult/email_flow.test.mjs`, `app/adult/tests/unit/account_complete_email.test.mjs`.

### D30. Age gate with a birth year only
- Slice and ticket: S4, T3.4; SPEC 3 and 9
- Date: 2026-11-01
- Author: backend lane
- Plan said: "Birth year first. Under 18: refuse." Only the year is asked, so a person born in (this year - 18) may be 17 or 18.
- We did: `hosting/core/keys.js` lets a person in only when this year minus the birth year is at least 19 (`AGE_GATE_GAP`). The band stored is worked out from the same difference (18-24, 25-34, ...).
- Why: a legal gate for under-18s should err on the side of refusing. The cost is that some 18-year-olds born in the year (this year - 18) are refused until January.
- Effect: the app's own check (screen 1) should use the same rule so the two never disagree. Change the constant to 18 if the owner prefers the other error.
- Decision: owner decided 2026-11-01: keep the year-only rule (gap 19).

### D31. Limits use existing tables, with key prefixes
- Slice and ticket: S4, T3.4
- Date: 2026-11-01
- Author: backend lane
- Plan said: limits per address (3 an hour, 10 a day) in `email_sends (email_hash, day, n)`, per IP bucket and site-wide (SPEC 9, 10). SPEC 10 has one row per address per day.
- We did: the hour limit uses extra `email_sends` rows whose `day` is the hour (`2026-10-31T14`); the purge compares as text, so both kinds go after 7 days. IP bucket limits use `joins (ip, ts)` with the prefix `e:` (start) or `v:` (verify) and a keyed hash of the bucket (`IP_KEY`); wrong admin keys on the metrics page use `admin_fail` with `m:`. The site cap is the day's `codes_sent` counter (`EMAIL_DAILY_CAP`, default 300). No new table or column.
- Why: SPEC 10 is exact, and a migration change needs the architect.
- Effect: the inventory text for `email_sends.day` now says "day or hour". Limits: 20 starts and 60 verifies an hour per IP bucket.
- Decision: proposed

### D32. The release id list: files the app build must publish
- Slice and ticket: S4, T3.5; frontend and data lanes (`app/adult/build.py`)
- Date: 2026-11-01
- Author: backend lane
- Plan said: `PUT` checks ids against "the current release's id list (loaded with `env.ASSETS.fetch` and cached)"; `GET` maps retired ids through the id registry (ADR-05). No file names were fixed.
- We did: `hosting/core/release_ids.js` reads `/work/manifest.json` (`release_id`, `graph.base`), then `<base>ids.json` (`{ids:[...]}`) if present, otherwise `skills_index.json` plus `occupations.json` (both already published) plus an optional `credentials.json`; and an optional `<base>id_registry.json` (a copy of `data/graph/id_registry.json`). Results are cached per release id for 5 minutes. If the ids cannot be read, `PUT` answers `unavailable` (it fails closed).
- Why: no `ids.json`, `id_registry.json` or credential list is published today.
- Effect: (1) until `id_registry.json` is copied into `hosting/public/work/graph/<release>/`, `GET /me/profile` maps nothing and reports nothing. (2) Until a credentials list exists (T1.8), `PUT` rejects every `cred:` id, which matches the confirm screen dropping credentials. Request to the frontend lane: have `app/adult/build.py` copy the registry, and write `ids.json` (every live id, one list) when the data lane supplies it.
- Decision: proposed

### D33. Sliding sessions are renewed in a response header
- Slice and ticket: S4, T3.3 and T3.5; ADR-04 ("refreshed on use at most once a day")
- Date: 2026-11-01
- Author: backend lane
- Plan said: sessions slide and are refreshed on use at most once a day. The response bodies in the contracts have no field for a new token.
- We did: when the token in use is more than a day old, any authenticated adult endpoint adds the response header `x-session-token` with a new token (the old one stays valid until it is 31 days old). The app should replace its stored token when it sees the header. No body changed.
- Effect: the frontend lane must read this header and store the new token. Without it, sessions end 31 days after sign-in.
- Decision: proposed

### D34. Sign-in email: link format, provider call, dry-run printing
- Slice and ticket: S4, T3.4
- Date: 2026-11-01
- Author: backend lane
- Plan said: the code and link are sent through Cloudflare Email Service; `EMAIL_DRY_RUN=1` records the message for tests.
- We did: the link is `<origin>/work/#link=<token>`: the token is in the fragment, so it is never sent to a server or written to a log; `APP_ORIGIN` sets the origin, otherwise the request's own. The app reads the fragment and sends `{link}` to `email/verify`. The real mailer calls `env.EMAIL.send({from, to, subject, text})` with `from` set to `EMAIL_FROM`; the exact call must be checked against Cloudflare's Email Service documentation on the preview deployment, which could not be done here (no network access to a Cloudflare account). The dry run keeps messages in memory only. `EMAIL_DRY_RUN_PRINT=1` also prints the message to the local console, for a manual demo; leave it unset in preview and production.
- Effect: the owner adds an `EMAIL` binding and `EMAIL_FROM` in Cloudflare, and sets `EMAIL_DRY_RUN=0` in production only. The QA lane's browser tests need the code: they should call the handlers directly or set `EMAIL_DRY_RUN_PRINT=1` on a local server.
- Decision: proposed

### D35. Deploy order and a few smaller choices
- Slice and ticket: S4, T3.1 and T3.2; ADR-03 rule 5
- Date: 2026-11-01
- Author: backend lane
- Plan said: "deploy code first, migrate second, for additive changes".
- We did: the student and admin code (T3.2) now reads `testers.track` and `invites.track`, so on the live database `0001_adult.sql` must be applied BEFORE the deploy that carries this code, or every student sign-in and admin page would fail with an unknown-column error. The migration is additive, so the old code keeps working after it. (The new adult endpoints are the reverse: they need the migration too.)
- Smaller choices, for the owner to know: (1) `admin.js ?revoke=<id>` still works on an adult id (it only sets `tok_after`); it is the owner's way to cut a leaked adult session. Every other admin action on an adult id answers "not found". (2) Under-18 refusals are counted only in `under18`; the metrics page reads them from there, so `ops_daily` has no under-18 metric. (3) `ops_daily` keeps day totals, so the 5xx and error rates in `hosting/tools/health_watch.mjs` are rates over the UTC day so far, not over the last hour. (4) Adults get `testers.consent_on` set to the day they accepted the notice (it was students-only); `source` stays empty. (5) The `.github/workflows/health-watch.yml` file is left to the QA lane: it only has to run `node hosting/tools/health_watch.mjs` every 30 minutes with `MARGWISE_URL` and `ADMIN_KEY` secrets and open an issue when the exit code is 1.
- Decision: proposed

## S4 frontend lane (accounts and saving), 2026-11-01

Written by the frontend lane while building T4.2 and T5.4. Nothing below changed a contract. Each entry needs an owner or architect decision.

### D36. Log-in needs the invite code and the birth year
- Slice and ticket: S4, T4.2 (screen 3); `contracts/api/email_start.request.schema.json`
- Date: 2026-11-01
- Author: frontend lane
- Plan said: "Log-in. Email, then the code." (SPEC 8 screen 3).
- We did: `POST /email/start` requires `invite`, `birthYear` and `turnstile` for every address, known or not (the server checks age and invite before it looks the address up). So the log-in screen asks for the birth year, the email and the invite code. The invite code is remembered on the device after a sign-in (localStorage key `mw_adult_invite`, not personal) and filled in from `?c=`. The birth year is asked every time and never kept.
- Effect: a person on a new device must still have their invite code. If the invite is switched off, existing people cannot log in.
- Options: (a) accept (as built); (b) amend `email_start.request` so a known address needs only `email` and `turnstile` (the server would still have to answer the same for unknown addresses; the age check would move to sign-up only). The frontend lane recommends (b) before the pilot opens beyond invited testers.
- Decision: owner decided 2026-11-01: (b) in effect, with no contract change. Existing accounts log in without an active invite; an invite is needed only to create an account. Built in the S4 review fixes (D41, ADR-21).

### D37. Turnstile needs a site key at build time, and the `/work/` policy allows Cloudflare's host
- Slice and ticket: S4, T4.2
- Date: 2026-11-01
- Author: frontend lane
- We did: Turnstile cannot be vendored. `account/turnstile.js` adds Cloudflare's script only on the email step. `hosting/public/_headers` (`/work/*` block only) now starts with `! Content-Security-Policy`, which removes the site-wide policy for `/work/` (without it the site-wide `script-src 'self' 'unsafe-inline'` would block the widget, because every matching block is enforced), then sets the old strict policy plus `https://challenges.cloudflare.com` in `script-src`, `connect-src` and `frame-src`. The site key is public: `TURNSTILE_SITEKEY=<key> python3 app/adult/build.py` writes it into `index.html`. With no key, a `--dev` build has no widget (the server's test setting accepts any token), and a release build shows "Sign-up and log-in are not open yet".
- To check on the preview deployment: that Pages accepts the `!` line and replaces the policy; that the widget loads and verifies (it may need `style-src` or another directive; add it only if the console shows a block). The e2e server (`app/adult/tests/e2e/server.mjs`) now understands `!` lines, as Cloudflare does.
- Decision: proposed

### D38. Research opt-out has no endpoint
- Slice and ticket: S4, T5.4 (screen 12 lists "Research opt-out")
- Date: 2026-11-01
- Author: frontend lane
- Plan said: the account screen has a research opt-out. SPEC 9 has no endpoint that changes `testers.research_ok` after sign-up.
- We did: the account screen says how to change it (write to the contact in the notice; deleting the data also ends it). Nothing is sent.
- Options: add `POST /me/research {research:bool}` (a contract change) or keep this. The frontend lane recommends adding the endpoint; the screen needs one switch.
- Decision: proposed

### D39. The sign-up notice is a draft with two blanks
- Slice and ticket: S4, T4.2 (**ASK**)
- Date: 2026-11-01
- Author: frontend lane
- We did: `app/adult/notice.md` holds the notice and the two tick labels. It has two blanks, `[[retention period]]` and `[[grievance contact]]`. In a real build the page refuses sign-up ("Account sign-up opens soon") while a blank is left; a `--dev` build shows the blanks. The AI paragraph (SPEC 12) is left out because no text is sent to an AI yet (slice S6); it must be added before S6. The line about keeping the email address "or a scrambled form of it" depends on D29 (decided: both are kept).
- Decision: proposed (owner approves the wording and fills the blanks)

### D40. Smaller choices
- Sessions: the token is in localStorage (ADR-04) and replaced when a reply carries `x-session-token` (D33). A refused token (401) is dropped.
- Saving is explicit ("Save to my account"). It also happens once at sign-up when the person came from "Make an account to save". The app never overwrites a saved profile without asking, and never sends events yet (`profile_saved` is not sent; the admin funnel in T7.2 will not show saves until it is).
- `app/adult/build.py` now also writes `ids.json` and, for real data, copies `data/graph/id_registry.json` into the graph folder (D32). The id registry is empty today, so nothing is mapped yet.
- The e2e for S4 runs the real handlers behind a small Node server (`tests/e2e/api_server.mjs`) because `wrangler pages dev` needs network access to start. Run `npx wrangler pages dev hosting/public` with `EMAIL_DRY_RUN=1 EMAIL_DRY_RUN_PRINT=1` for a manual demo.

## S4 review fixes, 2026-11-01

Written while fixing `S4_REVIEW.md`. Nothing here changed a contract or a version number.

### D41. What changed after the S4 review
- **B1** `email/start` sends the email after the reply (`deps.background`, which is Pages `waitUntil`), and answers the same for every address, including when the provider fails (counted in `email_errors`). A missing mailer, or no `APP_ORIGIN` in production, is `unavailable` for every address. Tests: hanging, failing and working providers; equal queries before the reply.
- **B2, S6** `notice.md` now says deleted data can stay in backups for up to 60 days, that Cloudflare runs the site and the human check and sees the IP address, and that the address is kept to find the account at sign-in. The two blanks (`[[retention period]]`, `[[grievance contact]]`) are still the owner's.
- **S1** `defineRoute` runs the daily purge from every adult route except health. A process-local note skips the look-up on later requests the same day.
- **S3** The sliding refresh hands out a token only when `UPDATE ... AND (tok_after IS NULL OR tok_after < <issue time>)` changed a row, and the token carries the issue time read before it.
- **S4** `email/complete` refuses (`unauthorized`) a pending token issued at or before the account's `tok_after`, and one issued at or before a delete of that address. A delete leaves a `del:<keyed hash>` row in `meta` with the time; the purge removes it after one hour (at the latest on the first request of the next day). It is listed in the inventory. Risk left: none that we know of; the row holds only a keyed hash.
- **S5** The screens say nothing about data collection except the privacy line on the welcome screen ("... stays on this page unless you make an account.") and the notice. Hints under the birth year are just "For example 1990."
- **S7** Chosen: avoid, not explain. `email_sends` is purged after 2 days, not 7 (it only has to cover the hour and the day). SPEC 10, the inventory and invariant 5 say 2 days. People who never finish still leave a keyed hash for up to 2 days (and a code row for 24 hours); the inventory says so.
- **S8** `EMAIL_DRY_RUN_PRINT` prints only when `ENVIRONMENT` is unset or `local`.
- **S9** The inventory text is corrected (`testers.email`, `joins.ip`, `email_sends`, `meta`).
- **Nits done:** N1 (repeat path fills `testers.email`), N2 (`APP_ORIGIN` required in production), N4 in part (Cloudflare's test secrets refused in production), N12 (the client no longer sends `idempotency_key`).
- **Decisions recorded:** D30 keep the year-only rule; D36 see ADR-21.

### D42. Open after the S4 review
- **S2 / D36, the screen:** the server no longer needs an active invite to log in, but the log-in screen still asks for the invite code (the contract still requires the field). Let the screen send the remembered code, or any code, and hide the field. Needs a frontend change; no contract change.
- **S2, the answer for a mistyped invite:** a new address with a wrong or expired invite now gets the same message as everyone else and no email. The screen cannot say "that invite is wrong". Accepted, because a different answer would reveal which addresses have accounts.
- **D38** research opt-out endpoint: still open (owner decision, contract change).
- **N3** `SIGN_KEY_PREV_UNTIL` unset keeps the old key for ever; `SIGN_KEY_V` is not checked to be 1 to 999; rotating `SIGN_KEY` also breaks student return codes (add to the runbook).
- **N4** the Turnstile `hostname` and `action` in the reply are not checked.
- **N5** the IP-bucket count and the site-wide cap check are not atomic; bursts can go a little over at pilot scale (accepted, as in D31).
- **N6** the invite claim and the tester INSERT in `email/complete` are separate statements (a thrown INSERT leaves a use claimed).
- **N7** `metrics.js` `safeEqual` returns early on a length mismatch.
- **N8** a student-side guess of an adult invite code gets a distinct message and is not counted in `joins`.
- **N9** the under-18 path is not IP-limited, so the `under18` count can be inflated (low risk).
- **N10** an orphan profile row is possible if `me/delete` commits between `authenticate` and the profile INSERT (invariant 6 would catch it).
- **N11** after it loads, Cloudflare's Turnstile script can read the token in localStorage. Accepted with D37.

## S5 (tier 2: reading with a model on the device), 2026-11-10

Written by the S5 implementation lane for BUILD_PLAN T4.5. Each entry is a proposal the owner approves. Nothing here changed a frozen contract, a version number, the matcher or the engine. Tier 1 is unchanged: tier 2 only adds an offer on the confirm screen, and the person must press it.

### D43. The library: `@huggingface/transformers` 4.3.2, vendored as three files, set to read only this site
- Slice and ticket: S5, T4.5
- Date: 2026-11-10
- Author: S5 implementation lane
- Plan said: "Vendor `@huggingface/transformers` (pinned version)". Vendored libraries go in `hosting/public/vendor/` with exact versions in `VERSIONS.md` (BUILD_PLAN ground rules). No CDNs.
- We did: pinned 4.3.2 (Apache-2.0; npm integrity `sha512-V3+dqf3i...`, checked). We vendor `transformers/transformers.min.js` (587,917 bytes: the library's self-contained browser bundle, which already holds onnxruntime-web 1.31.0-dev.20260914-8d85527a0, the version 4.3.2 pins), `transformers/ort-wasm-simd-threaded.wasm` (14,264,838 bytes) and `transformers/ort-wasm-simd-threaded.mjs` (24,381 bytes), plus `LICENSE`, `LICENSE-onnxruntime` (MIT, from the onnxruntime commit named in the npm package, because the package ships no licence file) and `THIRD_PARTY_NOTICES-onnxruntime.txt`. Rows with SHA-256 are in `VERSIONS.md`, and `.github/scripts/check_vendor_hashes.mjs` already covers them, because it walks the whole folder. `app/adult/intake_embed.js` is the only file that names the library, and it loads it with `import()` only after the person agrees (a static test checks this). It sets `env.allowRemoteModels = false`, a local model path on this site, `numThreads = 1`, `proxy = false` and `useWasmCache = false`, so the library reads nothing from another origin, starts no worker and makes no `blob:` URL (D45).
- Why this runtime: the library's default is the `.asyncify` runtime, which is 26,861,777 bytes. Cloudflare Pages allows 26,214,400 (25 MiB) per file, so it cannot be served. The plain runtime (14.3 MB, 3.7 MB gzipped) does everything the CPU path needs. The other build files (`transformers.web.js` and others) import `onnxruntime-web` by name, which needs a bundler we do not have, so they were not used.
- Why this version: 4.3.2 is the `latest` tag (the earlier 4.3.1 is older). 4.3.2 was published on npm at 2026-10-27 18:15 UTC and vendored on 2026-11-10: exactly 14 days, so it met the two-week habit only on the day. The habit is not a CI check.
- **The runtime inside it is a development (nightly) build** (S5 review S8). The version string is `1.31.0-dev.20260914-8d85527a0`. Every release of the library we looked at pins a development build of `onnxruntime-web`: 4.2.0 pins `1.26.0-dev.20260416-b7804b056c`; 4.3.0, 4.3.1 and 4.3.2 pin `1.31.0-dev.20260914-8d85527a0`. The skill vectors were made with the stable `onnxruntime-node` 1.30.0, so the app and the vector tool do not run the same build (the tests check that the browser and Node give the same numbers on the fixtures).
- **What 4.3.1 is** (npm package read on 2026-11-10): published 2026-10-06 (35 days old); pins the same `onnxruntime-web` development build and `onnxruntime-node` 1.30.0 as 4.3.2; `dist/transformers.min.js` is 586,230 bytes (ours: 587,917). So taking 4.3.1 does not make the runtime stable. The plain (non-asyncify) WebAssembly runtime is the same 14,264,838-byte file, under the 25 MiB (26,214,400 bytes) limit; the asyncify build, which the library prefers, is over it in both. A stable `onnxruntime-web` 1.31.1 exists (published 2026-10-26; its plain wasm is 14,848,852 bytes), but the library's self-contained bundle holds the JavaScript half of the runtime, so swapping only the wasm would mix two builds. We did not try it.
- **Owner: choose** (a) keep 4.3.2 and accept the nightly runtime, with the real-model tests as the guard; (b) take 4.3.1 (no gain on this point, 21 days older); (c) wait for a library release that pins a stable runtime (tier 2 stays off until then; nothing else depends on it). Until you choose, the files stay as they are. `hosting/public/vendor/VERSIONS.md` carries the same text. The bundle also inlines `@huggingface/jinja` (MIT) and `@huggingface/tokenizers` (Apache-2.0); their licence texts were added as `LICENSE-huggingface-jinja` and `LICENSE-huggingface-tokenizers` (new files, listed in `VERSIONS.md`).
- Effect: 15 vendored files in the repository, 14.9 MB of them the runtime. The page loads none of it until a person presses the tier 2 button.
- Decision: proposed (owner approves)

### D44. What is embedded: the 109 skills, knowledge areas and work activities, as "label: O*NET description"; technology names are not
- Slice and ticket: S5, T4.5 (and T1.5, where the plan puts the embedding)
- Date: 2026-11-10
- Author: S5 implementation lane
- Plan said: "Skill descriptions are embedded at export time in T1.5: add `skill_vecs.bin` (int8) and `skill_vecs.json` (ids) to the export." The plan does not say which text. `skills_index.json` has no description field.
- Found: the O*NET files in `data/graph/raw/onet/31.0/` hold no descriptions of elements. The pinned zip (SHA-256 unchanged, `6883548a...`) has `Content Model Reference.txt` with a `Description` for every element, and all 109 non-technology nodes (35 skills, 33 knowledge areas, 41 work activities) have one. We added that file (242,007 bytes, CC BY 4.0, as published) to `data/graph/raw/onet/31.0/`, to `fetch_onet.py`'s list and to `SOURCE.md`. `graph_hash` does not depend on raw files, so nothing else changed.
- We did: recipe `v1-label-onet-description`, in `data/graph/vec_texts.py`: the text of each non-technology entry is "<label>: <O*NET description>". Nothing is invented. The 8,733 technology names are not embedded.
- Evidence for leaving technologies out: embedded as "name (O*NET category)", an everyday sentence matched obscure products: "Wrote queries to pull weekly sales data from the company database" gave Salary.com, Corporatek EnAct Platinum and DaySmart Software 123Pet at 0.49 to 0.51. "Prepared the monthly payroll..." gave payroll products. That would tell a person they use a named product the resume never names. Tier 1 already finds technology names by exact match. Embedding them also costs 3.4 MB.
- Recipes compared on the 8 synthetic fixtures (D47), before the one-sentence-at-a-time change (numbers can be off by about 0.02): label only, label plus alternative names, label plus O*NET description, label plus description plus alternative names. At the best threshold of each, line recall and "fair" precision gave F1 0.40 to 0.46 (for example label only 0.44 recall and 0.44 precision at 0.30; label plus description 0.38 and 0.48 at 0.30, 0.21 and 0.71 at 0.40). The differences are inside the noise of 48 implied lines, so we kept the plan's choice, label plus O*NET description: it is real source text and the easiest to explain. Description alone was also tried and was weaker (measured by id recall only: 0.17 against 0.23 at 0.20). We also tried real O*NET phrases as extra rows (the detailed work activities under each of the 41 activities: id recall 0.23 but fair precision 0.28, against 0.17 and 0.48 for label plus description at 0.30; and, through the skill-to-activity links, also under the 2.A and 2.B skills: id recall 0.04, fair precision 0.13). They find more of the wrong skills, so they were dropped.
- Files: `data/graph/skill_vecs.bin` (41,856 bytes: 109 rows x 384 int8 numbers; each row is the unit vector times 127) and `skill_vecs.json` (2,236 bytes: ids in row order, model, revision, dtype, library version, dims, scale, recipe, the SHA-256 of the texts, `bin_sha256`, date). Made by `app/adult/tools/embed/embed_skills.mjs`, which has its own `package.json` and lock file (onnxruntime-node, for the offline tool and the real-model test only; the app has no npm dependency). Each text is embedded alone (batch of 1), because the model is int8 and a padded batch changed a vector by about 1 percent (cosine 0.993); embedded alone, the browser and Node give the same numbers.
- Offline pipeline: `pipeline/run.py` does not recompute vectors. `pipeline/validate_graph.py --exports` and `python3 data/graph/vec_texts.py --check` (also a CI step) fail when an id is not in `skills_index.json`, when the byte length is not ids x dims, when the recipe is not the current one, when the texts changed since the vectors were made, when `skill_vecs.bin` does not match the `bin_sha256` in the json (a bin altered at the same length), or when the model or revision differs from `tier2_model.json` (S5 review S4; the app/adult build refuses both in every build, release or dev). Tests: `data/graph/tests/test_skill_vecs.py`.
- Release: `graph_release.accept_graph` copies the two files into `data/releases/graph/<release>/` and lists their hashes in the release manifest, but only when they are current; stale vectors stop `--accept`. `app/adult/build.py` verifies those hashes in a release build. The release manifest is not a frozen contract and `skills_index.schema.json` is untouched, so no amendment is needed. The owner has not run `--accept`, and this lane did not.
- Effect: none for people. The vector tool stops if a description is ever missing.
- Decision: proposed (owner approves)

### D45. CSP for `/work/*` gains `'wasm-unsafe-eval'` (needs the owner's or security sign-off)
- Slice and ticket: S5, T4.5. Test layer 4 and the S3 CSP test.
- Date: 2026-11-10
- Author: S5 implementation lane
- Plan said: `/work/*` has a strict policy with no `unsafe-eval` (S1, S3 tests assert it).
- We did: one token added to `script-src` in the `/work/*` block of `hosting/public/_headers`: `script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com`. Nothing else changed: no `unsafe-eval`, no `unsafe-inline`, no `blob:`, no new origin, no change to `worker-src`, `connect-src`, `style-src` or the other blocks (admin, counsellor, the site-wide block).
- Why: onnxruntime-web runs the model as WebAssembly, and Chrome, Firefox and Safari refuse `WebAssembly.compile` and `instantiate` under a policy that has neither `'unsafe-eval'` nor `'wasm-unsafe-eval'`. `'wasm-unsafe-eval'` allows compiling WebAssembly only. `eval()`, `new Function()` and string timers stay blocked (the browser test checks no violation is reported while the model runs, and the CSP test still forbids `'unsafe-eval'` as its own token).
- What it allows, in plain words: a script from this site may compile WebAssembly. Scripts still come only from this site and Turnstile's host. A page-injection bug could therefore run WebAssembly it could not run before, which is a small step up from running JavaScript it already could not run. There is no new way to load code.
- Alternatives considered: (1) No CSP change, and run the model on a server: not allowed (nothing personal leaves the device in this mode). (2) A separate page for tier 2 with its own policy: possible (for example `/work/tier2/` with the relaxed policy only there), but the confirm screen is where the person is, so it would need an iframe or a page change; more code for the same exposure, and `frame-src` would have to open. (3) JavaScript-only model code (no WebAssembly): the library does not offer it. (4) Letting the library use a worker or `blob:` URLs: worse (needs `blob:` in `script-src` and `worker-src`), so we avoided it with one thread, no proxy worker and `useWasmCache = false` (otherwise the library wraps the runtime's JavaScript in a `blob:` URL when the browser is not Chrome). If a browser later refuses the one-thread setup, the fallback is to leave tier 2 off in that browser, not to add `blob:`.
- Tests changed: `s1.test.mjs` and `s3.test.mjs` no longer search for the substring `unsafe-eval` (which `'wasm-unsafe-eval'` contains). They check that the token `'unsafe-eval'` is absent, that `unsafe-inline` and `blob:` are absent, that the only `unsafe` keyword in the policy is `'wasm-unsafe-eval'`, and that Turnstile's host is still the only remote origin.
- Effect: needs the owner's or the security reviewer's yes before deploy. Without it, the `_headers` line goes back and the tier 2 button simply fails with its "could not look" message (the person keeps tier 1).
- Decision: proposed (owner approves)

### D46. The model: `Xenova/all-MiniLM-L6-v2`, int8, pinned by revision and hash, fetched at build time, not committed
- Slice and ticket: S5, T4.5
- Date: 2026-11-10
- Author: S5 implementation lane
- Plan said: "the quantised `all-MiniLM-L6-v2` model files under `hosting/public/work/models/`. Check the file sizes: Cloudflare Pages limits each file to 25 MiB."
- We did: `Xenova/all-MiniLM-L6-v2` at revision `751bff37182d3f1213fa05d7196b954e230abad9` (2025-07-22) from huggingface.co. Licence Apache-2.0: the model card at that revision says `license: apache-2.0`, and it is the ONNX export of `sentence-transformers/all-MiniLM-L6-v2` (also Apache-2.0). The licence text travels with the model files. `app/adult/tools/tier2_model.json` pins the revision, the licence, the source, the retrieval date and the size and SHA-256 of each file: `config.json` 650, `tokenizer.json` 711,661, `tokenizer_config.json` 366, `special_tokens_map.json` 125, `README.md` (the card, 1,767) and `onnx/model_int8.onnx` 22,972,370 bytes (under 26,214,400). `python3 app/adult/tools/fetch_model.py` downloads them into the git-ignored `app/adult/tools/model_cache/` and checks every hash (`--check` is offline); CI caches and fetches it. `python3 app/adult/build.py` copies the checked files into `hosting/public/work/models/<first 12 characters of the revision>/Xenova/all-MiniLM-L6-v2/` (a build output; the revision in the path is D54), stops if any file the site serves is over 25 MiB, and writes the model, revision, licence, the list of files the page downloads and their real total into `manifest.json` (`tier2`). The page shows that total.
- If the model is not in the cache, or a file differs, or the vectors are missing or stale, the build still succeeds, prints "tier 2 ... is NOT in this build: <reason>", and the page does not offer tier 2 (`tier2.available` is false). Tests: `build_tier2.test.mjs` (a tiny fake model, six cases) and `s5_off.test.mjs`.
- The int8 file works and was not replaced: no other variant was tried.
- Sizes: the page downloads 38,606,275 bytes (38.6 MB, shown as "39 MB"): library 587,917 + runtime 14,289,219 (wasm and its loader) = 14,877,136; model files it asks for 23,685,047; vectors 44,092. Gzipped (level 9) the same files are about 20.3 MB (the runtime 3.7 MB, the model 16.2 MB); the number shown is the uncompressed one, which is what a person's data plan counts at worst.
- Why not committed: 23 MB of model weights in git history for ever, and the owner approves what is served.
- Decision: proposed (owner approves)

### D47. The threshold is 0.40, not 0.55; what the fixtures show
- Slice and ticket: S5, T4.5. TEST_PLAN layer 3 (extended). Numbers rewritten after the S5 review (S7) to lead with the strict ones.
- Date: 2026-11-10
- Author: S5 implementation lane; numbers rewritten by the S5 fix lane
- Plan said: "matches above a threshold (start at 0.55, tune on test data) are suggested".
- We did: threshold 0.40, at most 2 suggestions per sentence and 12 in all, in `app/adult/intake/tier2.js` (`DEFAULTS`). Sentences go to the model one at a time. Tuned on 8 synthetic resumes written for this (`app/adult/tests/fixtures/tier2/`, 56 lines, 48 of them implying a skill the line does not name, invented people). Every line lists the ids it **must** give (the one skill the line shows) and the ids that are also **ok** (other readings a careful person would accept, 3 to 4 a line); both were written from the O*NET descriptions before the model first ran. A sentence is much shorter than an O*NET description, so scores are low: the best match is usually 0.3 to 0.5, and 0.55 gives nothing.
- What the measures count:
  - **Strict precision**: of the suggestions made, the share that is the line's `must` skill. **Strict recall**: of the 47 `must` skills the lines show, the share that was suggested. These are the numbers to lead with.
  - **Fair precision** also counts a suggestion as right when it is one of the line's `ok` readings. That is generous: with 3 to 4 accepted ids a line out of 109 skills, a suggestion is "fair" much more often than it is the skill the line shows. **Line recall**: the share of the 48 implied lines that got at least one fair suggestion.
- Table on the 8 fixtures (the browser and Node give identical numbers):

| Threshold | Suggestions a resume | Strict precision | Strict recall | Fair precision | Line recall |
| --- | --- | --- | --- | --- | --- |
| 0.30 | 5.9 | 0.17 (8/47) | 0.17 (8/47) | 0.47 (22/47) | 0.35 (17/48) |
| 0.35 | 3.5 | 0.18 (5/28) | 0.11 (5/47) | 0.57 (16/28) | 0.27 (13/48) |
| **0.40** | **2.3** | **0.22 (4/18)** | **0.09 (4/47)** | **0.72 (13/18)** | **0.21 (10/48)** |
| 0.45 | 1.0 | 0.13 (1/8) | 0.02 (1/47) | 0.75 (6/8) | 0.10 (5/48) |
| 0.50 | 0.5 | 0.25 (1/4) | 0.02 (1/47) | 0.75 (3/4) | 0.04 (2/48) |
| 0.55 | 0.0 | none | 0.00 (0/47) | none | 0.00 (0/48) |

- Honest reading: at 0.40 about one suggestion in five (4 of 18) is exactly the skill the line shows, and tier 2 finds 4 of the 47 skills the lines show (9 percent). Counting the other readings a careful person would accept, 13 of 18 are fair, and one implied line in five gets a fair suggestion. It will help a little and miss most. Suggestions are never ticked for the person, so a wrong one costs a tap, not a wrong profile. We chose 0.40 because it is the lowest threshold where fair precision stays above 0.7 with a few suggestions a resume; 0.30 finds twice the skills (strict recall 0.17) but is right in the strict sense no more often (0.17) and fair about half the time. The fixtures are small, and the threshold was chosen on them, so these numbers are optimistic for real resumes. T7.3 (the owner's 30-resume evaluation) is the real measure.
- Floors in the tests (`tier2_model.test.mjs` in Node and the browser run in `s5.test.mjs`), each the measured number less one suggestion or one line, so a real loss fails and one flipped sentence does not: strict recall at least 0.06 (measured 0.09), strict precision at least 0.16 (0.22), fair precision at least 0.65 (0.72), line recall at least 0.18 (0.21), 1.5 to 3.5 suggestions a resume (2.3). The test prints strict precision, strict recall, fair precision and line recall every run. With the real model in CI the test fails when the model is missing (`CI=true`); on a developer machine it prints a notice.
- After the review fixes (S1, S6): reading Achievements, Awards and Volunteering (D55) does not change these eight-fixture numbers, because they have no such sections. On all 11 fixtures (the 8 and the 3 section fixtures) at 0.40: strict precision 0.23 (5/22), strict recall 0.07 (5/67), fair precision 0.73 (16/22), line recall 0.17 (12/69), 2.0 suggestions a resume.
- Timing, in headless Chromium on this sandbox, files from localhost, after the page yields between sentences (D56): about 17.5 ms a sentence, so 2.1 s for the longest scan (120 sentences) and 7.5 s with the CPU throttled 4 times; the first scan of a visit adds the model start (about 1 s here, 15 s at 4x with the download from localhost). A resume of 6 to 7 sentences takes about 0.1 s. Tier 1 is unchanged (about 170 ms on the dev page sample).
- Decision: proposed (owner approves)

### D48. Where the tier 2 offer sits on the confirm screen, and what it says
- Slice and ticket: S5, T4.5 and T4.6 (SPEC screen 6 defines no place for it)
- Date: 2026-11-10
- Author: S5 implementation lane
- Plan said: nothing. SPEC 3 says the on-device mode is "dictionary plus browser embeddings"; SPEC 8 screen 6 lists roles, skills, chips, credentials and leadership.
- We did: after the jobs and the skills found, before "Add a skill", one section "Look for more skills": "Your resume may hint at skills it does not name. We can look for them." and one button, "Look for more skills in your resume (downloads about 39 MB, runs on this device)" and under it "Your browser usually keeps these files, so next time is quicker. It may remove them to save space." (the word "once" was dropped after the S5 review: it is not always true, D54). The size is the real total from the build (D46). Nothing loads until the person presses it. Then a progress bar, a Cancel button, and "Downloading... 12 MB of 39 MB", then "Reading your resume... 3 of 7 lines". Cancel stops the scan (and the download, if that is what is running), says "Stopped. Your list is as it was. You can start again.", and brings the button back; the tier 1 list is as it was (D56). The answer is a group "You may also have": each skill is not ticked, shows the line of the resume it came from, introduced as "Because of this line in your resume:" (the line does not name the skill, so "From your resume" would be wrong; always visible, unlike the tier 1 lines that sit behind "Where did this come from?", because here the line is the only reason the skill is offered), and when ticked it asks "Used, Strong or Rusty" like any other skill. If the model finds nothing, or a download fails, the screen says "We found nothing more. Your list is as it was." or "We could not look for more skills. Your list is as it was. You can try again." and the tier 1 list and flow are as they were. A person who never presses the button sees no change except the section. Choice is kept for this visit only (the group stays while the confirm model is in memory); nothing is stored. The words follow D28: nothing about how data is collected beyond the download and "runs on this device". A build without tier 2 shows no section.
- The sentences are kept in memory with the confirm model, like the source lines (cut to 300 characters, at most 250), only when the build offers tier 2. No fact comes from the model: it can only name ids that already exist in the graph, and each must be ticked.
- Decision: proposed (owner approves)

### D49. The developer page, and smaller choices
- Slice and ticket: S5, T4.5
- Date: 2026-11-10
- Author: S5 implementation lane
- We did: `app/adult/dev/tiers.html` and `tiers.js` show tier 1 (dictionary skills with their lines) and tier 2 (suggestions with scores) side by side for pasted text, with a threshold and a cap, and a tier 2 button that says it downloads 39 MB. `build.py --dev` writes them to `/work/tiers.html` (at the top of `work/`, because the page reads `manifest.json` and the modules from its own folder, and the policy forbids a `<base>`). A release build does not write them, and a unit test checks that. Tier 1 and tier 2 stay callable from Node for the evaluation harness: `readResume()` in `intake/read.js`, and `achievementLines()`, `suggest()` and `suggestFromText()` in `intake/tier2.js` (with `loadNodeEmbedder()` in `tools/embed/node_embedder.mjs`, and `tests/lib/tier2_eval.mjs` for scoring).
- We also: the library swallows a failed download and waits for ever, so `intake_embed.js` reports a failed or aborted file itself. The `.wasm`, `.onnx` and `.bin` types were added to the e2e static server. `build.py` now also stamps `manifest.json` with `slice: 'S5'`. The confirm screen's "only this visit" choice stores nothing, so no persistence pattern was needed.
- Decision: proposed (owner approves)

### D50. The evaluation harness: what it measures against each SPEC 11 target, and how
- Slice and ticket: S5, T7.3
- Date: 2026-11-10
- Author: S5 evaluation lane
- Plan said: report "precision and recall per tier; role match; redaction misses, listed; time measures", aggregate only.
- We did: `app/adult/tests/eval_intake.mjs`. Precision is suggested and confirmed over suggested; recall is confirmed and suggested over confirmed ("recall of confirmed skills without typing"), both pooled over all people, with the median person beside them. Tier 1 is the dictionary reader. Tier 2 is only the extra skills it adds (tier 1's ids are excluded, as in the app). Combined is the union. The precision target is judged on tier 1 (the skills the app ticks). The recall target is judged on tier 1 and tier 2 together, because a tapped suggestion is not typing; with tier 2 not measured it is judged on tier 1 alone and says so. The role target is "right after at most one edit": the harness reports the first choice being right, and right with one pick from the three offered choices; when 5 or more people have `roleEdits` in their meta files, the target uses those recorded edits instead. The time target uses the median of `secondsToConfirm` from meta files (hand-timed; needs 5). Reader times are measured on the machine that runs it, warm. Everything is aggregate and shown from 5 people up (BUILD_PLAN); with fewer, it prints nothing and exits 2.
- Privacy, as built: it prints counts, rates, medians and fixed words only; it writes nothing; the model runs from the local cache with remote files off; it refuses a folder, or a file that is a link, that resolves inside the repository; errors name no path. A test runs it on the synthetic fixtures in the temp folder and checks that no canary, file name, fixture name, skill id or resume line reaches stdout or stderr.
- Why: the owner needs one command that gives the SPEC 11 intake numbers without anyone reading the resumes in the output.
- Decision: proposed (owner approves)

### D51. Redaction is not measured until S6; the baseline says "contain"
- Slice and ticket: S5, T7.3 (waits for S6, T6.1)
- Date: 2026-11-10
- Author: S5 evaluation lane
- Plan said: report "redaction misses, listed". `redact.js` is T6.1 and does not exist.
- We did: the harness prints "redaction: not measured (arrives with S6)" and the PASS/FAIL line reads NOT MEASURED. It counts how many resumes contain an email, a phone-like number (10 or more digits) or an ID-like number (PAN, or 12 digits), with simple documented patterns in `lib/eval_measures.mjs`, labelled "contain", not "leaked". The patterns are wide (a 12-digit Aadhaar also counts as phone-like). A redactor plugs in by existing as `app/adult/intake/redact.js` with an exported `redact(text)` that returns a string or `{ text }`; the harness then lists misses as "resume #7: 1 email" (category, count, anonymous position) and judges the zero-miss rule. If S6 uses another name or shape, change the one `import` block in the harness. Person-name, employer and college replacement rates (SPEC 11 99% and 95%) need labelled names and are not measured by this ticket.
- Decision: proposed (owner approves)

### D52. No export of the confirmed profile on the no-account path (open item)
- Slice and ticket: S5, T7.3
- Date: 2026-11-10
- Author: S5 evaluation lane
- Plan said: the harness reads "each person's confirmed profile JSON".
- What exists: with an account, `POST /api/v1/me/export` and the "Download my data" button give a file with a `profiles` table (the harness reads that file as it is). Without an account the profile is memory only (S1, S3) and there is no export. We did not build one.
- Effect: for the 30 people the owner either has each make an account and download the data, or writes the profile file by hand from the person's confirmed ticks (shape in `contracts/profile.schema.json`; only `roles` and `skills` ids are read). The download also holds the person's email and other rows: the harness ignores them, but the owner should not keep that file longer than needed. If a small on-device "copy my profile" button is wanted for the pilot, it needs a ticket and the owner's yes.
- Decision: proposed (owner approves)

### D53. PDF and DOCX are read in Node with the vendored libraries
- Slice and ticket: S5, T7.3
- Date: 2026-11-10
- Author: S5 evaluation lane
- We did: `app/adult/tests/lib/eval_files.mjs` imports the vendored `pdf.min.mjs` directly and runs `mammoth.browser.min.js` in a Node `vm` context. No new dependency, no browser. It reuses `MAX_BYTES`, `MAX_PAGES` and `pageText()` from `app/adult/intake_file.js` and copies the join rules and the scan numbers (40 and 120 characters); `eval_harness.test.mjs` fails if those lines change in `intake_file.js`. The text is the same libraries and rules as the browser, not the browser itself; a layout difference between Node and Chromium pdf.js is not expected but was not measured. The pdf.js "cannot load canvas" warnings are silenced.
- Decision: proposed (owner approves)


## S5 review fixes, 2026-11-10

Written while fixing `S5_REVIEW.md`. Nothing here changed a frozen contract, the matcher, the engine or the vendored files. `tier2.js` `VERSION` went from 1 to 2 (it now reads Achievements, Awards and Volunteering, D55). All entries are proposals the owner approves, except where marked.

### D54. What the browser keeps of the model, and where the model is served (S5 review S5)
- Slice and ticket: S5, T4.5
- Date: 2026-11-10
- Author: S5 fix lane
- Plan said: nothing. D48 said the button "downloads 39 MB once". The review found nothing in the headers or the code that backs "once".
- Verified (Chromium 153 through Playwright 1.63, the real build, a test server that applies `_headers` and sends an `ETag` like Cloudflare Pages does, in `app/adult/tests/e2e/s5_robust.test.mjs`):
  - The library DOES keep the model files in the browser's Cache API, in a cache named `transformers-cache`, for same-origin paths too: `config.json`, `tokenizer.json`, `tokenizer_config.json` and `model_int8.onnx` (23.7 MB). On a second visit in the same browser the page asked the server for none of them.
  - The 14.3 MB WebAssembly runtime is NOT in that cache; the page fetches it with an ordinary request every visit. In a browser with a disk cache (a Playwright persistent profile) the second visit sent a conditional request and got 304 with no body. In Playwright's default in-memory profile the second visit downloaded it again (200). So the full 39 MB is not saved on a second visit in every browser; the 23.7 MB of model files are. The library file and the skill vectors are revalidated (304) too.
  - Without a revision in the path, a model update at the same address would have been served from `transformers-cache` for ever (the library never revalidates a file it holds). That was the real risk.
- What changed:
  - The model is served from `/work/models/<first 12 characters of the revision>/<model id>/...` (`app/adult/build.py`; the manifest says `tier2.model_path` and lists the new addresses). A new revision is a new address, so no cache layer can return the old files for it. The page removes the library's copies of older revisions from `transformers-cache` after a successful load (best effort).
  - `hosting/public/_headers` has a new block after `/work/*`: `/work/models/*` with `! Cache-Control` then `Cache-Control: public, max-age=31536000, immutable`. On Cloudflare Pages every matching block applies and a header set twice is joined with ", ", so without the `! Cache-Control` detach line the response would read `no-cache, public, max-age=..., immutable`. (The detach line is the same mechanism the `/work/*` block already uses for its CSP; the e2e server understands it. Not yet seen on a Pages preview: check `curl -I` on a model file after the first preview deploy.) The CSP of `/work/*` is untouched by the new block. The tests check the exact header on the model files and that `/work/manifest.json` is still `no-cache`.
  - The copy no longer says "once": "Look for more skills in your resume (downloads about 39 MB, runs on this device)", and under it "Your browser usually keeps these files, so next time is quicker. It may remove them to save space." After the files are here the button reads "Look for more skills in your resume (runs on this device)".
  - A new e2e checks that each model file is served once in the first visit, that a second visit in the same browser asks the server for no model file, that an old-revision entry in the cache is removed, and the headers.
- Not verified: **Safari** (iPhone and Mac). Safari may remove script-writable storage, which includes the Cache API, after a period of no use, and a private window keeps nothing; the copy says "usually" and "may remove" for that reason. Firefox was not run either. The owner's phone checks should note whether a second visit downloads the model again.
- Decision: proposed (owner approves)

### D55. Achievements, Awards and Volunteering are read; the summary is not (S5 review S6)
- Slice and ticket: S5, T4.5
- Date: 2026-11-10
- Author: S5 fix lane
- Found: `SKIP_SECTIONS` left out `other` (Achievements, Awards, Volunteering, Interests, Languages, References, Strengths, Activities) and `summary`. A fresher whose only real sentences sit under "Achievements" got no offer.
- Measured: three new invented fixtures in `app/adult/tests/fixtures/tier2_sections/` (a fresher with an Achievements and an Awards section; a returner with a summary and a Volunteering section; an experienced head with a three-sentence summary, an award and an achievement; 21 lines that imply a skill). Their `expected.json` files were written from the O*NET descriptions and committed before the model was run on them. The same 8 original fixtures were scored again with each choice. Threshold 0.40, 2 a line:

| Sections read | Fixtures | Suggestions a resume | Strict precision | Strict recall | Fair precision | Line recall |
| --- | --- | --- | --- | --- | --- | --- |
| neither (before) | first 8 | 2.3 | 0.22 (4/18) | 0.09 (4/47) | 0.72 (13/18) | 0.21 (10/48) |
| other only | first 8 | 2.3 | 0.22 (4/18) | 0.09 (4/47) | 0.72 (13/18) | 0.21 (10/48) |
| summary only | first 8 | 2.6 | 0.19 (4/21) | 0.09 (4/47) | 0.57 (12/21) | 0.19 (9/48) |
| both | first 8 | 2.6 | 0.19 (4/21) | 0.09 (4/47) | 0.57 (12/21) | 0.19 (9/48) |
| neither (before) | new 3 | 0.0 | none | 0.00 (0/20) | none | 0.00 (0/21) |
| **other only** | new 3 | 1.3 | 0.25 (1/4) | 0.05 (1/20) | 0.75 (3/4) | 0.10 (2/21) |
| summary only | new 3 | 0.3 | 0.00 (0/1) | 0.00 (0/20) | 0.00 (0/1) | 0.00 (0/21) |
| both | new 3 | 1.3 | 0.25 (1/4) | 0.05 (1/20) | 0.50 (2/4) | 0.05 (1/21) |
| neither (before) | all 11 | 1.6 | 0.22 (4/18) | 0.06 (4/67) | 0.72 (13/18) | 0.14 (10/69) |
| **other only** | all 11 | 2.0 | 0.23 (5/22) | 0.07 (5/67) | 0.73 (16/22) | 0.17 (12/69) |
| both | all 11 | 2.3 | 0.20 (5/25) | 0.07 (5/67) | 0.56 (14/25) | 0.14 (10/69) |

- Choice: read `other`, keep skipping `summary`. Reading `other` adds suggestions and does not lower precision (all 11: strict 0.22 to 0.23, fair 0.72 to 0.73, line recall 0.14 to 0.17). Reading the summary costs fair precision on the original 8 (0.72 to 0.57; the summary lines are generic, for example "Operations manager with nine years in customer support") and gained nothing on the new three. The same pattern held at threshold 0.35. The sample is small (22 suggestions), so this is a direction, not a proof; T7.3 will show more. Education, skills, certificates and personal details stay out, as asked.
- Also: `achievementLines` takes an optional `skipSections` list, so the evaluation can repeat this comparison. `tier2_model.test.mjs` has a test for it.
- Decision: proposed (owner approves)

### D56. The scan stays responsive and can be cancelled; Back and Forward start no second download (S5 review S1, S2, S3)
- Slice and ticket: S5, T4.5
- Date: 2026-11-10
- Author: S5 fix lane
- S1, what changed: `suggest()` in `intake/tier2.js` stays pure and takes two optional hooks: `yieldToUi` (awaited after every sentence; the browser passes `setTimeout(0)`, or a message when the tab is hidden) and `cancelled` (asked before and after every sentence; it throws `Tier2Cancelled`). The confirm box has a Cancel button while a scan runs. Cancel stops the scan within one sentence, and if the download is running it aborts the downloads; the screen says "Stopped. Your list is as it was. You can start again." and the button comes back. Nothing from a stopped scan is shown. If the model is already here, a second press downloads nothing.
- S1, how much work for a long resume: measured per sentence on this sandbox, 17.5 ms unthrottled and 62.5 ms with the CPU throttled 4 times. Real resumes have 5 to 40 sentences; only the 10-page fixture (7 jobs) is above 120 (268 sentences). We chose a cap of 120 sentences (was 250), and when there are more, the newest jobs are kept first (current job, then by end year; sentences outside a dated job come last), kept in resume order. 120 sentences take 2.1 s here and 7.5 s at 4x; the 250 we had took 15.6 s at 4x. On the 10-page fixture the kept 120 are the four newest jobs. This does not change anything for resumes under 120 sentences.
- S1, what is not fixed: the library creates the model session in one long step (about 1 s here) that no page code can break up. The scan itself, and the download, leave the page free. A 4x throttled test asserts that while reading the longest wait of the page was under 1 s (measured 140 to 470 ms), the page painted (89 frames in 7 s), the progress text went up one sentence at a time, Cancel answered in 0.6 s, and the offer was back with the focus on it.
- S2: the visible progress text and the `<progress>` bar change on every chunk and sentence; they are no longer a live region. A separate visually hidden `role="status"` line (`#more-live`) speaks at the start, each time a phase passes another 10 percent, and at the end (`app/adult/announce.js`, unit-tested): 23 announcements for the longest scan, while the visible text changed 184 times.
- S3: the load is memoised at module level (`loading` in `intake_embed.js`), set before the first await and cleared on success, failure or Cancel, so a retry starts again. A confirm screen drawn while a download runs shows it (the bar, the text, Cancel, no live button); when it ends, the button comes back and a scan needs no download. If the screen is drawn for another resume, the old scan is stopped and the download goes on. Note: the intake screen starts a new pick, so Back from the confirm screen drops the reading (as before); "Back, then read the resume again" is the real way to draw the screen again, and that is what the e2e does with the download held back by the test server (each model file, the library and the runtime are served once).
- N5 (same code): the button is hidden while the scan runs, not disabled, and focus moves to Cancel and back to the button or the answer, so keyboard focus is never lost.
- Decision: proposed (owner approves)

### D57. What changed after the S5 review
- **S1** fixed: yield, Cancel, cap 120 with newest jobs first, 4x throttled e2e (D56).
- **S2** fixed: throttled live text (D56).
- **S3** fixed: one memoised load, in-progress state on a redrawn screen, e2e (D56).
- **S4** fixed: `skill_vecs.json` has `bin_sha256` (the hash of the existing bin; the bin bytes did not change and nothing was re-embedded); `vec_texts.check()` and `app/adult/build.py` verify it and compare model and revision with `tier2_model.json`. Tests: a same-length altered bin, a missing hash, a model or revision mismatch, and a build that refuses an altered bin. `embed_skills.mjs` writes the hash.
- **S5** fixed as far as it can be: revisioned immutable model path, true copy, e2e for the second visit; Safari and Firefox untested (D54).
- **S6** fixed by measurement: `other` is read, `summary` is not (D55).
- **S7** fixed: D47, `S5_DEMO.md` and `HANDOFF_NEXT.md` lead with strict precision and strict recall and say what "fair" counts; strict recall is printed by the Node and browser tests; floors were reset from the new measurements (each the measured number less one suggestion or line).
- **S8** recorded, no code change (D43, `VERSIONS.md`): the runtime is a nightly build, the library was exactly 14 days old, 4.3.1 pins the same nightly build. The owner chooses.
- **N1** the "declining" test now reads the resume again and checks the offer and that nothing was downloaded. **N2** `per_file_limit_bytes` removed from `tier2_model.json` (the 25 MiB check is in `build.py` and tested). **N3** `decodeVectors` refuses a repeated id, like `vec_texts.py`; the per-id best-of-rows code was removed. **N5** see D56. **N6** suggestions say "Because of this line in your resume:". **N8** the O*NET `SOURCE.md` total is 31.1 MB (31,096,286 bytes) and D43 says exactly 14 days. **N9** the 0.55 test is named and commented as documenting today's model, to be replaced when the recipe improves (not a quality bar). **N10** the s3 CSP test now compares the tokens of `script-src` with the exact list and rejects bare schemes and wildcards in any directive. **N11** the bundle does inline `@huggingface/jinja` and `@huggingface/tokenizers` (their error messages are in it); their licence texts are two new files in `hosting/public/vendor/transformers/`, with `VERSIONS.md` rows (new files only; no vendored byte changed). `onnxruntime-common` is part of onnxruntime-web and is covered by `LICENSE-onnxruntime`. **N12** CI runs `npm ci --ignore-scripts` for the embed tool; onnxruntime-node ships its binding inside the package, and the real-model test passed with it.
- Tier 2 `VERSION` 1 to 2 (the line rules changed: `other` is read; the cap and the order of the sentences changed). The scoring is unchanged.

### D58. Open after the S5 review
- **S8 / D43:** the owner chooses the library version and whether a nightly runtime is acceptable.
- **D45:** the `'wasm-unsafe-eval'` token in the `/work/*` policy still needs the owner's or security's sign-off before any deploy.
- **S5 / D54:** Safari and Firefox are untested; the headers block (`! Cache-Control`) is checked on the test server only, not on a Pages preview. The runtime file (14.3 MB) is revalidated on every visit, and fully downloaded again in a browser with no disk cache.
- **N4** `validate_graph.py --exports-dir <other>` fails without vector files. Accepted: nothing uses that option today.
- **N7** the model and the runtime stay in memory for the whole visit (no `dispose()`). Accepted: the page is one visit, and the model is needed again on the next resume. Revisit if a phone runs out of memory in the owner's checks.
- **N9** kept, reworded (D57).
- The first long model start (about 1 s here, longer on a phone) cannot be cut into pieces by page code (D56).
- The 30-resume evaluation (T7.3) is still the only real measure of tier 2.
