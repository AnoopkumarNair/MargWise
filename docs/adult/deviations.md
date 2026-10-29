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
