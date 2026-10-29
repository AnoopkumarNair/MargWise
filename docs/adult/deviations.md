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

These came out of the S0 review. They are design choices the owner makes (DELIVERY, change control). The owner decided all six on 2026-10-29, and the contracts were then frozen (`contracts/FROZEN.md`). Their ids (D1 to D6) are kept, so the deviations below start at D7.

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
  8. **Technology cap:** at most a quarter of a needs list (10 of 40) is technology, so tools do not crowd out skills (all tools weigh 0.6 or 0.8 by rule). Even so, the tool list can look odd for a job (Adobe Illustrator for Customer Service Representatives is O*NET's own data).
  9. **AI labels are mostly unknown.** In the slices, 82% of skill needs have no AI label (too few linked tasks with AI data), 13% "people still do this", 4% mixed, 1% "AI already does much". Tasks: 1,695 `used`, 16,735 `none`, 157 `unknown`. The app shows no AI label for unknown.
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
- We did: the thresholds are unchanged. The skills screen lists all of the job's top needs (up to 40, before: 25) in four groups (skills, knowledge, work activities, tools), each with a "Tick all" button, and asks the person to tick everything they do ("Most people tick 15 or more"). It also lists the job's tasks with their AI use ("AI use seen", "No AI use seen", and no label when there is no data).
- Why: with real slices, a person who ticks 10 skills sees only leaps. Measured on five jobs (accountant, software developer, customer service, registered nurse, marketing manager), counting adjacent/stretch/leap of 30 roads, with the slice's near pairs: 10 ticked as used: 0/0/30 for all five; 15 used: 0/0-5/25-30; 25 used: 0/13-30/0-17; 25 strong: 1-4/26-29/0; all 40 strong: 10-28/2-20/0. A skill ticked "used" counts 0.7, so adjacent (0.7) needs almost every need ticked; strong ratings and near do the rest.
- Effect: the owner may want to revisit the thresholds or the "used" value after people tests; nothing changed here.
- Decision: proposed
