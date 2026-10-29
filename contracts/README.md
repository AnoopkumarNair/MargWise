# Contracts

The shapes that the adult app, the API and the graph pipeline agree on (BACKEND ADR-07). Browser code, server handlers and pipeline exports all check data against these files. The architect lane owns this folder; a change here needs the architect's review and a version bump.

## Files

| File | What it is |
| --- | --- |
| `validate_lib.js` | A small validator for the JSON Schema subset we use. No dependencies and no Node imports, so the browser and the server bundle import this file |
| `validate.js` | The command line tool (Node only; it uses `node:fs`). It also re-exports the library for Node scripts. Never import it from browser or server code |
| `versions.js` | `MATCHER_VERSION`, `PROFILE_V`, `SLICE_V` and `API_V`, for JavaScript (`import { versions } from '../contracts/versions.js'`). The one place they are set |
| `versions.json` | The same numbers for Python and people. A test keeps it equal to `versions.js` |
| `bands.json` | The fixed value lists (years, budgets, city clusters, levels and so on). Each list says what it means in `_doc` |
| `FROZEN.md`, `freeze.mjs`, `freeze.lock.json` | The S0 contract freeze: the lock holds a hash of every contract file, and a test fails when one changes without its version (see below) |
| `profile.schema.json` | The stored adult profile document (SPEC 6). Ids and bands only. No demographic or commercial field (ADR-16). No `rev`: the edit counter lives in the `profiles` table and the API wrapper `{rev, data}` |
| `slice.schema.json` | One graph slice, `data/graph/slices/<soc>.json` (SPEC 5.4). **This is the canonical slice schema.** BUILD_PLAN and TEST_PLAN call it `matcher/slice.schema.json`; use this file instead |
| `skills_index.schema.json` | `data/graph/skills_index.json`, the dictionary used to find skills in text |
| `extract.schema.json` | What the AI read must return (SPEC 9, T6.4) |
| `events.schema.json` | One adult event, with the `data` shape of each type in `$defs`. The source for every event shape, and the check for stored events |
| `api/event/<type>.request.schema.json` | One strict request schema per event type for `POST /api/v1/event`, generated from `events.schema.json` |
| `event_schemas.js` | The same per-type schemas as a plain module, with `schemaForType(type)` and `checkEvent(body)`, for the server and the browser. Generated |
| `api/<endpoint>.request.schema.json`, `api/<endpoint>.response.schema.json` | Every `/api/v1` endpoint in SPEC 9. A body-less request (GET, export, logout-all) is `{}`. The event request is per type, in `api/event/` |
| `api/error.schema.json` | The one error shape, `{ok: false, error: {code, message}}`. A profile conflict also carries `current` |
| `migrate_ids.js` | Maps tombstoned graph ids in a profile to their replacements on read (ADR-05) |
| `profile_migrations.js` | Upgrades an older profile to the current `v` (ADR-06). A no-op while v1 is the only version |
| `sync.mjs` | Keeps the copies inside `api/`, the per-type event schemas and `event_schemas.js` equal to their sources (see below) |
| `examples/` | Example documents. `examples/invalid/` holds documents that must fail |
| `tests/` | The tests for all of the above |

## The validator

It supports `type` (one type or a list, including `integer` and `null`), `required`, `properties`, `additionalProperties` (`false` or `true` only), `enum`, `items`, `minItems`, `maxItems`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, and `$ref` inside the same file (`#` or `#/$defs/name`). It refuses any other keyword with an error, so a schema can never look stricter than it is. There is no `oneOf`, `const`, `uniqueItems` or `format`.

In code:

```js
import { validate } from '../contracts/validate_lib.js';
const r = validate(schema, value);           // {ok, errors: [{path: '$.roles[0].occ', message: 'does not match ...'}]}
validate(eventsSchema, event.data, '#/$defs/' + event.type);   // check against one part of a schema
```

Bad data never throws. A schema outside the subset does throw.

From Python (the pipeline):

```python
r = subprocess.run(["node", "contracts/validate.js", "contracts/slice.schema.json", *slice_files], capture_output=True, text=True)
# r.returncode: 0 = all valid, 1 = a file is invalid (errors on stderr, one per line: "<file>: <path> <message>"),
#               2 = usage error, unreadable JSON or a bad schema
```

## Rules

- **Every object is closed.** Every object schema has `additionalProperties: false`, so an unexpected field (a name, an email, a referral id) is rejected, not stored.
- **Bands.** `bands.json` is the list of record. The schemas repeat the lists as `enum`s, and a test checks that they match.
- **Copies.** The validator only follows `$ref` inside one file, so some API schemas carry a copy of another schema: the profile in `error`, `me_profile_get.response` and `me_profile_put.request`; and the extract in `ai_read.response`. The per-type event request schemas and `event_schemas.js` are generated from `events.schema.json`. After editing a source, run `node contracts/sync.mjs`. The tests fail while a copy differs.
- **Event requests** have one strict schema per type (owner decision D6). The validator has no `oneOf`, so the handler picks the schema by the body's `type`: `schemaForType(type)` from `event_schemas.js` returns it, or `null` for an unknown type (answer `bad_request`). Then one `validate(schema, body)` checks the envelope and `data` together, and refuses any field from another type. `checkEvent(body)` does both. Result events (`profile_saved`, `roads_viewed`, `road_opened`, `road_added`) require `job_release` and `matcher_version`.
- **Stored events** are checked against `events.schema.json` in two steps: the whole event, then `data` against `#/$defs/<type>`.
- **Email verify** is checked in two steps too: the whole body against `api/email_verify.request.schema.json`, then against exactly one form: `#/$defs/by_link` when the body has `link`, otherwise `#/$defs/by_code`. Each form requires its own fields and allows no others, so a body with both forms or with neither fails.
- **Tokens** (BACKEND ADR-20, owner decision D1). The session token is `v<keyver>.<tester_id>.<iat>.<mac>`, with the MAC over `adult|tester_id|iat|keyver`, so it only works for the adult track. The 30-minute `pending` token is `p<keyver>.<email_hash>.<invite_id>.<age_band>.<iat>.<mac>`, signed with a key used only for pending tokens. The schemas check the shapes; the server checks the MAC, the age and `tok_after`.
- **City ids** have the prefix `city:` (`city:blr`), and the band is `city_cluster` (owner decision D3). `open_to` also allows `open:india`, `open:remote` and `open:abroad`, prefixed so they can never clash with a city id.
- **Year bands** for a role are `0-2, 2-5, 5-8, 8-12, 12-18, 18+`, the SPEC 7.2 level thresholds (owner decision D2). `a-b` means at least `a` and under `b` years.
- **No @ in text.** Feedback text (at most 1,500 characters) and the nickname refuse `@`, so an email address is never stored there. The app removes it before sending.
- **Errors.** `api/error.schema.json` lists exactly the codes in `ERRORS` in `hosting/core/http.js`, in the same order, and `bands.json` `error_code` repeats them. A test checks all three.
- **Size.** The 32 KB cap on a stored profile is checked by the server, not by the schema.
- **Ids on read.** `migrateIds(profile, registry)` takes the parsed `data/graph/id_registry.json` (`{registry_version, entries}`), a list of entries or a `Map`. It returns a new profile plus `mapped` (for roles also the role's `index`, and `pick: true` when the occupation was split), `dropped` (tombstones with no replacement, so the app can ask the person to re-check them), `unknown` (ids missing from the registry, kept unchanged and only reported) and `merged` (skill or credential entries removed because another entry has the same id after mapping). Roles are never merged. Between credentials with the same id, the latest year stays. It never changes its input. The stored profile is rewritten only after the person confirms.

## Version bumps

Bump the version in `versions.js` and `versions.json` in the same commit as the change:

| You change | Bump |
| --- | --- |
| Matcher behaviour or golden outputs | `MATCHER_VERSION` |
| `profile.schema.json`, or a band the profile uses | `PROFILE_V`, plus an upgrade step in `profile_migrations.js` with a test, and the `v` enum in the schema |
| `slice.schema.json` or `skills_index.schema.json` | `SLICE_V`, and the `slice_v` enum in the schema |
| Anything in `api/`, `events.schema.json`, `extract.schema.json` or `event_schemas.js` | `API_V` |

A contract change needs the architect's review and the owner's approval (DELIVERY, change control).

## The freeze

The contracts were frozen at the end of S0 (`FROZEN.md`). `freeze.lock.json` holds a SHA-256 hash of every contract file (every schema, `bands.json` and `event_schemas.js`) and the versions at the freeze. `tests/freeze.test.mjs` fails when a file differs from the lock. To change a contract after the freeze:

1. Make the change, and run `node contracts/sync.mjs`.
2. Bump the version that governs the file (the table above) in `versions.js` and `versions.json`.
3. Run `node contracts/freeze.mjs --write`. It refuses while a changed file's version has not gone up.

`node contracts/freeze.mjs` alone checks without writing.

## Tests

```bash
node --test contracts/tests/*.test.mjs
```

Node 22 does not accept a bare folder here, so pass the glob. The tests cover the freeze, every validator keyword, the per-type event schemas, the token shapes, the owner decisions D1 to D6, the command line exit codes, every example (including the profile JSON read straight from SPEC 6, and the request fields named in the SPEC 9 table), band and version consistency, the copies, id migration and profile upgrades.
