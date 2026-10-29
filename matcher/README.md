# Matcher (SPEC 7)

`match.js` turns a profile and an occupation slice into a list of roads. `reference.py` is a second, independent version in Python. The tests check that the two agree.

Version 1.0.0 covers slice S1: coverage, gap, reach (adjacent, stretch, leap) and order. Road kind, target level, experience fit, bridges, pay, demand and the flags are stubs. They come back as `null` or `"not_yet_measured"`, because the S1 slices do not hold the data they need. The result lists them in `stubs`.

## Use

```js
import { match, coverage, level, MATCHER_VERSION, ALLOWED_INPUT_FIELDS } from './match.js';
const result = match(profile, slice, { now: 2026, near, teaches });
```

- `profile` follows `contracts/profile.schema.json`. `slice` follows `contracts/slice.schema.json`.
- `opts.now` is the current year. The matcher never reads the clock. Without it, skills never turn rusty by age and credentials never expire.
- `opts.near` is skill_near data: `{"skl:a": {"skl:b": 0.7}}`. It is read both ways, and values under 0.5 are ignored. The slice contract has no place for it, so the caller passes it.
- `opts.teaches` is credential data: `{"cred:x": ["skl:a", ...]}`. Without it, credentials credit nothing.
- `opts.walk` is `true` only after the interest walk. Until then the enjoy slider has no weight.

`coverage(profile, needs, opts)` returns `{coverage, needs, gap}` for one list of needs. `level(profile)` returns `{level, years_total, years_level, lead_bonus, title_override}`.

## The result

`matcher/result.schema.json` is the exact shape, and a test checks every output against it.

- `version`, `release` (from the slice), `from` (the slice's occupation).
- `person`: the person's level and how it was worked out. `title_override` is always `null`: the profile holds no job title text.
- `weights`: the slider weights used for `pay`, `ai_safe`, `short`, `demand` and `enjoy`.
- `stubs`: the parts that are not worked out yet.
- `roads`, best first. Each road has:
  - `id`, `label`, `via` (how the slice found it), `new_role`;
  - `reach` and `coverage` (0 to 1, 4 decimals);
  - `score` (0 to 1, 6 decimals), the slider-weighted average of the components;
  - `components`: all five, each with `value`, `norm` (0 to 1 across the roads), `weight` and `status` (`measured`, `unknown` or `not_yet_measured`);
  - `gap`: needs covered under 0.7, most important first;
  - `kind`, `level.target`, `level.fit` (all `null` for now), `flags` (empty for now) and `bridges` (`null` for now).

## Rules, and the choices SPEC leaves open

- **have:** strong 1.0, used 0.7, rusty 0.4. A used skill last used more than 3 years before `now` counts as rusty. A strong skill never does.
- **Credentials:** a held credential credits the skills it teaches at 0.7, or 0.4 if it expired (its `expires` year is before `now`). The person's own rating of a skill always wins, even when it is lower.
- **near:** the best `0.5 x similarity x have` over the person's other skills, including skills credited by credentials.
- **Coverage:** `sum(w x cover) / sum(w)` over the target's needs, rounded half up to 4 decimals. Reach uses the rounded value. If every weight is 0, coverage is 0. The slice weights are used as given: the data lane applies the rating-age discount (SPEC 5.6) before export.
- **Gap order:** weight, times 1.5 for "people still do this", then id.
- **Level:** adds the lower bound of each role's year band (0, 2, 5, 8, 12, 18), then uses the SPEC 7.2 thresholds. Plus 1 for leading 6 or more people or owning a budget, up to 6. No roles gives `null`.
- **Roads:** every slice target except the slice's own occupation, once each. Nothing is filtered out: not leaps, not flags.
- **Components:** short is the coverage. AI safety is 1 minus the target's newest `ai_obs` signal, or 0.5 when there is none. Pay, demand and enjoy are 0.5. Each is scaled to 0..1 across the roads (min-max). A component that is equal on every road keeps its own value.
- **Order:** score, then coverage, then id.
- **Sliders:** without `priorities`, the SPEC 6 example is used (pay, AI safety, short move and demand at 1; enjoy at 0). If every weight is 0, every score is 0.

## Fair inputs (ADR-16, invariant 8)

`ALLOWED_INPUT_FIELDS` lists every profile field the matcher may read. Two tests enforce it. One scans `match.js` for any demographic or commercial name. The other runs the matcher on a watched profile and fails if it reads any field not on the list. City and openness to move are on the list only for the future relocation flag; 1.0.0 does not read them.

## Tests

```bash
node --test 'matcher/tests/*.test.mjs'
python3 matcher/reference.py                  # golden cases, Python only
node matcher/tests/version_guard.mjs          # golden outputs against the lock
node matcher/tests/version_guard.mjs --write  # after a MATCHER_VERSION bump, or to add a case
```

- `tests/golden.json`: 8 hand-built cases across 4 occupation families. `tests/GOLDEN_TABLE.md` lists them for the owner.
- `tests/fixtures/`: 4 test slices, plus skill_near and credential data. All made up; none of it is real data.
- Properties over 500 random profiles (seed 20261029). Coverage stays between 0 and 1. Adding a skill never lowers coverage. Strong is at least used, and used is at least rusty. Sliders reorder roads but never add or remove one. Constraints never remove a road. The same input always gives the same bytes.
- `reference.py` must agree with `match.js` to 2 decimals on every golden and random case, with the same road order, reach and gap.
- **Version guard.** `tests/golden.lock.json` holds a hash of each golden case's output. If any output changes while `MATCHER_VERSION` stays the same, the tests fail. Bump `MATCHER_VERSION` here and in `contracts/versions.js` (an architect change), then run the guard with `--write`.
