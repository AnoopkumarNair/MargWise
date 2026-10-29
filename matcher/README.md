# Matcher (SPEC 7)

`match.js` turns a profile and an occupation slice into a list of roads. `reference.py` is a second, independent version in Python. The tests check that the two agree.

Version 1.1.0 covers slice S1, with the owner decisions of 2026-10-29 (see "Versions" below): coverage, gap, reach (adjacent, stretch, leap) and order. Road kind, target level, experience fit, bridges, pay, demand and the flags are stubs. They come back as `null` or `"not_yet_measured"`, because the S1 slices do not hold the data they need. The result lists them in `stubs`.

## Use

```js
import { match, coverage, level, MATCHER_VERSION, ALLOWED_INPUT_FIELDS } from './match.js';
const result = match(profile, slice, { now: 2026, teaches });   // near comes from slice.near
```

- `profile` follows `contracts/profile.schema.json`. `slice` follows `contracts/slice.schema.json`.
- `opts.now` is the current year. The matcher never reads the clock. Without it, skills never turn rusty by age and credentials never expire.
- skill_near data comes from the slice: `slice.near.pairs`, `[["skl:a", "skl:b", 0.93], ...]` (slice contract amendment A1). `opts.near` (`{"skl:a": {"skl:b": 0.93}}`) overrides it when given, which the tests use; `opts.near = {}` turns near off. Either way it is read both ways (the larger value if both are given). The matcher applies the near rule below to whatever pairs it gets; the export already leaves out the pairs that can never count.
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
  - `id`, `label` (the slice's own label), `via` (how the slice found it), `new_role`;
  - `reach` and `coverage` (0 to 1, 4 decimals);
  - `score` (0 to 1, 6 decimals), the slider-weighted average of the components;
  - `components`: all five, each with `value`, `norm` (0 to 1 across the roads), `weight` and `status` (`measured`, `unknown` or `not_yet_measured`);
  - `gap`: needs covered under 0.7, most important first, each with the slice's own label and AI label;
  - `kind`, `level.target`, `level.fit` (all `null` for now), `flags` (empty for now) and `bridges` (`null` for now).

## Rules, and the choices SPEC leaves open

- **have:** strong 1.0, used 0.85, rusty 0.4 (owner decision O1; used was 0.7 before 1.1.0). A used skill last used more than 3 years before `now` counts as rusty. A strong skill never does.
- **Credentials:** a held credential credits the skills it teaches at the used level, 0.85, or at the rusty level, 0.4, if it expired (its `expires` year is before `now`). The person's own rating of a skill always wins, even when it is lower.
- **near:** the best `0.5 x similarity x have` over the person's other skills, including skills credited by credentials, but only from a skill that is one of the 3 closest neighbours of the need being credited and is at least 0.90 similar (owner decision O2). The neighbours are ranked by similarity, then id, over all the pairs the matcher was given; the rank is the credited skill's own. Similarities above 1 count as 1.
- **Coverage:** `sum(w x cover) / sum(w)` over the target's needs, rounded half up to 4 decimals. Reach uses the rounded value. If every weight is 0, coverage is 0. The slice weights are used as given; tool weights in exported slices are already capped at the median of the other needs in their list (owner decision O3, an export rule in `data/graph/export.py`). In S1 they are NOT discounted for the age of the O*NET rating (SPEC 5.6): BUILD_PLAN puts that discount in S2, and `data/graph/export.py` does not apply it yet. Each need carries the date of its rating (`as_of`); tool needs carry the O*NET release month (deviations D20).
- **Gap order:** weight, times 1.5 for "people still do this", then id.
- **Level:** adds the lower bound of each role's year band (0, 2, 5, 8, 12, 18), then uses the SPEC 7.2 thresholds. Plus 1 for leading 6 or more people or owning a budget, up to 6. No roles gives `null`.
- **Roads:** every slice target except the slice's own occupation, once each. Nothing is filtered out: not leaps, not flags.
- **Components:** short is the coverage. AI safety is 1 minus the target's newest `ai_obs` signal, or 0.5 when there is none. Pay, demand and enjoy are 0.5. Each is scaled to 0..1 across the roads (min-max). A component that is equal on every road keeps its own value.
- **Order:** score, then coverage, then id.
- **Sliders:** without `priorities`, the defaults are short move 3, and pay, AI safety and demand 1, enjoy 0 (owner decision O4; before 1.1.0 every slider but enjoy was 1). The app starts its sliders at the same values. If every weight is 0, every score is 0.

## Fair inputs (ADR-16, invariant 8)

`ALLOWED_INPUT_FIELDS` lists every profile field the matcher may read. Two tests enforce it. One scans `match.js` for any demographic or commercial name. The other runs the matcher on a watched profile and fails if it reads any field not on the list. City and openness to move are on the list only for the future relocation flag; 1.0.x does not read them.

## Tests

```bash
node --test 'matcher/tests/*.test.mjs'
python3 matcher/reference.py                  # golden cases, Python only
node matcher/tests/version_guard.mjs          # golden outputs against the lock
node matcher/tests/version_guard.mjs --write  # after a MATCHER_VERSION bump, or to add a case
```

- `tests/golden.json`: 11 cases across 4 occupation families: 9 on hand-built slices (`near-rank` tests the near rule), and 2 on real-shape slices whose near pairs come from the slice (`csr-real-near`, and `acc-real-tools`, which shows the tool cap). `tests/GOLDEN_TABLE.md` lists them for the owner.
- `tests/fixtures/`: 4 made-up test slices, plus skill_near data (`near.json`, `near_rank.json`) and credential data (none of it real data), and two extracts of real O*NET 31.0 slices, `slice_csr_real.json` (Customer Service Representatives) and `slice_acc_real.json` (Accountants and Auditors), 5 targets each, with their near pairs. `make_csr_real.py` rewrites both from the exported slices. The hand-built slices keep their made-up tool weights: the cap is an export rule, and the matcher uses weights as given.
- Properties over 500 random profiles (seed 20261029), each with one of the two hand-built near files. Coverage stays between 0 and 1. Adding a skill never lowers coverage. Strong is at least used, and used is at least rusty. Sliders reorder roads but never add or remove one. Constraints never remove a road. The same input always gives the same bytes.
- `reference.py` must agree with `match.js` to 2 decimals on every golden and random case, with the same road order, reach and gap. It is independent code, but it was written from the same reading of SPEC, so it shares the open choices listed above: it cannot catch a choice that both make the same way. Two of them matter most: the level uses the lower bound of each year band (0, 2, 5, 8, 12, 18), and a component that is equal on every road keeps its raw value instead of a 0..1 score.
- **Version guard.** `tests/golden.lock.json` holds a hash of each golden case's output. If any output changes while `MATCHER_VERSION` stays the same, the tests fail. Bump `MATCHER_VERSION` here and in `contracts/versions.js` (an architect change), then run the guard with `--write`.

## Versions

- **1.0.0** (S1): the first matcher.
- **1.0.1** (S1 review fixes): no change to `match.js` or `reference.py` rules. The real-shape fixture `tests/fixtures/slice_csr_real.json` was re-extracted (`tests/fixtures/make_csr_real.py`) after the export changed how it picks a job's tools and dropped tasks with no AI data from the skill AI labels (deviations D20). That changed the csr-real-near output, and the version guard allows a changed output only with a new version.
- **1.1.0** (owner decisions O1, O2 and O4 of 2026-10-29, deviations "Decisions"): used counts 0.85 (was 0.7), and so does a valid credential; a near skill counts only if it is among the 3 closest neighbours of the skill it credits and at least 0.90 similar (was: any pair at 0.5 or more); the default sliders are short move 3, pay 1, AI safety 1, demand 1, enjoy 0 (was all 1 but enjoy). Owner decision O3 (tool weights capped at the median of the other needs in each slice list) is an export rule, but it changed the two real-shape fixtures. Every golden output was regenerated with `reference.py` first and `match.js` agrees to 2 decimals. The `near.json` pair from quality control to LLM evaluation went from 0.7 to 0.92, so swdev-qa-near still shows near at work. Two cases were added: `near-rank` and `acc-real-tools`.
