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

## Awaiting owner decision

Questions from the S1 review that only the owner can answer. Nothing below was changed by an agent. Each lists the reviewer's options.

### O1. Reach thresholds against the "used" value
- The question: a skill ticked "used" counts 0.7, and "adjacent" needs coverage of 0.7, so a road is close only when nearly every need is ticked or marked strong (D19).
- Options: (a) keep 0.7 and 0.4 and used = 0.7, and wait for the people test; (b) lower the thresholds (for example 0.6 and 0.35); (c) raise "used" (for example 0.8); (d) count coverage over the top 20 needs instead of 40. Any of (b) to (d) changes golden outputs and needs a `MATCHER_VERSION` bump.

### O2. Near is noisy
- The question: O*NET skill vectors are alike for most jobs (D18 item 6), so skill_near pairs at 0.5 or more are common and near lifts coverage a lot (D17, D19: csr-real-near goes from about 0.2 to about 0.4).
- Options: (a) keep near as it is; (b) raise the similarity floor (for example 0.8 or 0.9); (c) lower the near credit (0.5 x similarity x have, for example to 0.3); (d) turn near off in S1 and revisit with better skill data.

### O3. Tool weights
- The question: every tool weighs 0.8 (Hot Technology) or 0.6 by rule (BUILD_PLAN T1.3), so tools rank above many rated skills, and the cap of 10 of 40 is what keeps them in check. D20 changed only which tools fill the 10 places.
- Options: (a) keep 0.8 and 0.6 with the cap; (b) lower both (for example 0.5 and 0.3); (c) weight by the D20 score or by In Demand; (d) move tools to their own list outside coverage.

### O4. Road order
- The question: with the default sliders, AI safety counts as much as coverage, so a low-coverage road with little AI use can come before a closer one (`matcher/tests/GOLDEN_TABLE.md`, "Please check one thing").
- Options: (a) keep SPEC 7.3 as written; (b) make coverage (short move) count double by default; (c) sort by reach first (close, stretch, leap) and use the score only inside each group.

### O5. Review lists
- The question: `data/graph/raw/abbrev_in.csv` (144 rows) and `titles_in.csv` (34 rows) were drafted by the data lane and are live in the title search; 19 terms in `abbrev_in_unmapped.csv` wait (D18 item 10).
- Options: (a) the owner reviews them before the people test; (b) ship S1 without them (O*NET titles only) until reviewed; (c) keep them, marked as a draft in the demo.

### O6. History squash
- The question: the earlier S1 commit holds 46 MB of slices in git history (D15).
- Options: (a) leave the history as it is; (b) squash the S1 branch before it merges into `main`, so the slices never reach `main`'s history. Rewriting history is the owner's call; agents never force-push.

### O7. Anthropic data: trust level and date
- The question: the Anthropic Economic Index sources are marked `official`, and their `as_of` (2026-10-22) is the date the files were downloaded, not the date of the data.
- Options for trust: (a) keep `official` (Anthropic publishes the data itself); (b) mark it `secondary` or `observed` (it is usage seen on one AI product, not an official statistic). Options for the date: (a) keep the download date and say so; (b) use the release date of the dataset version; (c) show both.
