# Contracts frozen (S0)

The contracts in this folder were frozen on 2026-10-29, at the end of slice S0, after the owner decided D1 to D6 (`docs/adult/deviations.md`).

## What is frozen

Every contract file: each `*.schema.json` outside `examples/` (including `api/` and `api/event/`), `bands.json`, and the generated `event_schemas.js`. `freeze.lock.json` holds a SHA-256 hash of each one and the versions at the freeze:

| Version | At the freeze |
| --- | --- |
| `PROFILE_V` | 1 |
| `SLICE_V` | 1 |
| `API_V` | 1 |
| `MATCHER_VERSION` | 1.0.0 |

`PROFILE_V` and `API_V` stay at 1 even though D1 to D6 changed the profile and the API. No version had been released or stored before the freeze, so there is nothing to migrate (deviations D12 and the S0 freeze entry).

Code in this folder (`validate_lib.js`, `validate.js`, `migrate_ids.js`, `profile_migrations.js`, `sync.mjs`, `freeze.mjs`), the examples and the tests are not frozen. They have their own tests.

## How a frozen contract changes

1. The change needs the architect's review and the owner's approval (DELIVERY, change control), and a line in `docs/adult/deviations.md` if it differs from the plan.
2. Edit the source schema, then run `node contracts/sync.mjs`.
3. Bump the governing version in `versions.js` and `versions.json` (the table in `README.md`). A profile change also adds an upgrade step to `profile_migrations.js`.
4. Run `node contracts/freeze.mjs --write`. It refuses while a changed file's version has not gone up.

## How it is checked

- `contracts/tests/freeze.test.mjs` (in CI with the other contract tests) fails when a contract file differs from the lock, when a file is added or removed, when a version goes down, or when the lock is out of date.
- `node contracts/freeze.mjs` runs the same check from the command line.

## Amendments (a change without a version bump)

The owner may approve an additive change to a frozen contract that keeps its version, but only before anything with that version has been released. It is never done silently:

1. Add an entry to `amendments.json`: an id (`A1`, `A2`, ...), the date, the owner decision that approved it, a summary, the contract files it changes, and the versions it keeps.
2. Edit the files, run `node contracts/sync.mjs`, then `node contracts/freeze.mjs --write --amend <id>`. It refuses if any other contract file changed, if a version does not match what the amendment keeps, if the id was used before, or, for a slice contract file, once a graph release exists (`data/releases/graph/latest.json`).
3. The lock records the amendment (id, date, the new hashes, the versions). `freeze.test.mjs` fails if `amendments.json` and the lock disagree.

| Id | Date | Files | Versions kept | Owner decision |
| --- | --- | --- | --- | --- |
| A1 | 2026-10-29 | `slice.schema.json`, `bands.json` | `SLICE_V` 1 (and `PROFILE_V`, `API_V` 1) | 2026-10-29, item (2): slice `near` pairs and task `ai_mode` `used` (deviations D14) |
