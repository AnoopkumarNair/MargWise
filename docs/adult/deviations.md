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

## Awaiting owner decision

These came out of the S0 review. They are design choices the owner makes (DELIVERY, change control), so S0 leaves the current files as they are. Each lists what was built and the reviewer's proposal. Their ids (D1 to D6) are reserved here, so the deviations below start at D7.

### D1. Sign-in token format
- Slice and ticket: S0 (F0.1 contracts); used by T3.x
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: SPEC 9 and BACKEND name a signed token and a signed 30-minute `pending` token, without a byte format.
- We did: nothing yet; the contracts only check the token's length and characters.
- Reviewer's proposal: token `v<keyver>.<tester_id>.<iat>.<mac>`, with the MAC over `track|id|iat|keyver`. Define the `pending` token the same way (its own track value, the email hash, invite and age band, and an expiry).
- Decision: awaiting owner decision

### D2. Year bands versus levels
- Slice and ticket: S0 (F0.1, `bands.json` `years`)
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: SPEC 7.2 sets the level thresholds in years; SPEC 6 shows `years: "3-7"`.
- We did: `years` bands `0-1, 1-3, 3-7, 7-12, 12+` per role.
- Reviewer's proposal: align the role year bands to the SPEC 7.2 thresholds, or store one total-years band for the person.
- Decision: awaiting owner decision

### D3. City ids
- Slice and ticket: S0 (F0.1, `bands.json` `city`, `open_to`)
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: SPEC 5.9 city clusters, without an id format.
- We did: bare ids (`blr`, `hyd`, ...).
- Reviewer's proposal: prefixed ids (`city:blr`) like every other graph id, and rename the band `city_cluster`.
- Decision: awaiting owner decision

### D4. Where `rev` lives
- Slice and ticket: S0 (F0.1, `profile.schema.json`)
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: profile writes use `rev` (ADR-09); the profile is one JSON document (ADR-06).
- We did: `rev` is an optional field inside the profile document, and SPEC 10 also plans a `profiles.rev` column.
- Reviewer's proposal: drop `rev` from the document, or have the server always overwrite it, so the two can never disagree.
- Decision: awaiting owner decision

### D5. Prompt version on AI calls
- Slice and ticket: S0, for T3.1 (`0001_adult.sql`) and T6.x
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: SPEC 10 designs `ai_calls (tester_id, day, n, tokens)`, with no prompt version column.
- We did: nothing yet (`0001_adult.sql` does not exist).
- Reviewer's proposal: add `prompt_version` to `ai_calls` in `0001_adult.sql`.
- Decision: awaiting owner decision

### D6. Event shape strategy
- Slice and ticket: S0 (F0.1, `events.schema.json`, `api/event.request.schema.json`)
- Date: 2026-10-28
- Author: S0 fix lane
- Plan said: ADR-08, one events table with typed `data`.
- We did: one envelope whose `data` is the union of all types, plus a mandatory second check against `#/$defs/<type>`.
- Reviewer's proposal: either one request schema per event type, or keep the union and make the two-step check mandatory and tested in the handler.
- Decision: awaiting owner decision

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
