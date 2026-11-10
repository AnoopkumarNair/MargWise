# Matcher (SPEC 7)

`match.js` turns a profile and an occupation slice into a list of roads. `reference.py` is a second, independent version in Python. The tests check that the two agree.

Version 1.2.0 covers slice S2 (SPEC 7.1 to 7.4): coverage, gap, reach, the person's level, the target's level and experience fit, the road kind, the order with the pay change, the three constraint flags, and bridges. Demand and interest fit have no data yet and stay "not yet measured". Parts that need data a slice or the caller did not give stay stubs, and the result lists them in `stubs`.

## S2 additions (1.2.0)

For the frontend lane: **nothing was renamed or removed.** Every field the app reads (`roads[].id, label, reach, coverage, score, components, gap, kind, level.target, level.fit, flags, bridges, via, new_role`) keeps its name and type. Fields that were stubs now carry values, and these fields are new:

| Field | What it is |
| --- | --- |
| `credentials` (top level) | The credentials the person holds: `[{id, status: "valid" or "expired", renew}]`. `renew` is true for an expired one: show "expired, renew?" (SPEC 5.8). Valid unless every entry for that id has expired. Without `opts.now` nothing expires |
| `roads[].kind` | Was always `null`. Now `up`, `across`, `diagonal`, `reset`, `fork`, or `null` when the person's or the target's level is not known (rules below) |
| `roads[].level.target` | Was `null`. The target's typical **entry** level (1 to 6), or `null` |
| `roads[].level.fit` | Was `null`. `below`, `in` or `above` the years band of the target's levels, or `null` |
| `roads[].level.range` | New. `[low, high]` typical levels, or `null` ("not yet known") |
| `roads[].level.basis` | New. `"job_zone"`, `"typical_level"` (a new role's own levels) or `null` |
| `roads[].flags` | Was always `[]`. Now any of `outside_time`, `below_pay_floor`, `needs_relocation`, in that order. A flag never hides a road |
| `roads[].bridges` | Still a list of credential ids or `null`, as before. `null` means no reviewed catalogue was passed; `[]` means the catalogue has nothing for this gap |
| `roads[].bridge_detail` | New. `{status: "reviewed" or "no_reviewed_course", items, skills}`. `items` (up to 3): `{id, label, issuer, covers: [gap skill ids], gain, cost_inr, hours, validity_years, url, renew}`; unknown details are `null`. `skills`: the gap skills no bridge covers, in gap order. With `no_reviewed_course`, show "No reviewed course yet for these skills" and the skills |
| `roads[].pay_change_pct` | New. The pay change in percent (2 decimals), or `null` when either pay is unknown |
| `roads[].components.pay` | Now `measured` when both pays are numbers; `unknown` when the person's job has pay but the target does not; `not_yet_measured` when the person's job has none |

New inputs: `opts.credentials` (a reviewed catalogue, below) and the profile's `constraints.hours_month`, `pay_floor_pct`, `city` and `open_to` (flags only). New file: `matcher/ladder.json` (known specialist steps, a draft for the owner).

## Use

```js
import { match, coverage, level, MATCHER_VERSION, ALLOWED_INPUT_FIELDS } from './match.js';
const result = match(profile, slice, { now: 2026, credentials });   // near comes from slice.near
```

- `profile` follows `contracts/profile.schema.json`. `slice` follows `contracts/slice.schema.json`.
- `opts.now` is the current year. The matcher never reads the clock. Without it, skills never turn rusty by age and credentials never expire.
- skill_near data comes from the slice: `slice.near.pairs`, `[["skl:a", "skl:b", 0.93], ...]` (slice contract amendment A1). `opts.near` (`{"skl:a": {"skl:b": 0.93}}`) overrides it when given, which the tests use; `opts.near = {}` turns near off. Either way it is read both ways (the larger value if both are given). The matcher applies the near rule below to whatever pairs it gets; the export already leaves out the pairs that can never count.
- `opts.credentials` is the reviewed credential catalogue (SPEC 5.8, `data/graph/raw/credentials.yaml` once T1.8 exists): `[{id, label, issuer, official_url, cost_inr, hours, validity_years, teaches: ["skl:a", ...] or [{id, quote}, ...]}]`. Only these are offered as bridges. The catalogue's `name` must be passed as `label` (the matcher's fair-input check refuses any `.name` read). Without it, every road says "No reviewed course yet".
- `opts.teaches` is credential data for crediting held credentials: `{"cred:x": ["skl:a", ...]}`. When it is not given, the catalogue's `teaches` lists are used. Without either, credentials credit nothing.
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
  - `kind`, `level` (`target`, `fit`, `range`, `basis`), `flags`, `bridges`, `bridge_detail` and `pay_change_pct` (see "S2 additions").
- `credentials`: the person's credentials with `valid` or `expired` and `renew`.

## Rules, and the choices SPEC leaves open

- **have:** strong 1.0, used 0.85, rusty 0.4 (owner decision O1; used was 0.7 before 1.1.0). A used skill last used more than 3 years before `now` counts as rusty. A strong skill never does.
- **Credentials:** a held credential credits the skills it teaches at the used level, 0.85, or at the rusty level, 0.4, if it expired (its `expires` year is before `now`). The person's own rating of a skill always wins, even when it is lower.
- **near:** the best `0.5 x similarity x have` over the person's other skills, including skills credited by credentials, but only from a skill that is one of the 3 closest neighbours of the need being credited and is at least 0.90 similar (owner decision O2). The neighbours are ranked by similarity, then id, over all the pairs the matcher was given; the rank is the credited skill's own. Similarities above 1 count as 1.
- **Coverage:** `sum(w x cover) / sum(w)` over the target's needs, rounded half up to 4 decimals. Reach uses the rounded value. If every weight is 0, coverage is 0. The slice weights are used as given; tool weights in exported slices are already capped at the median of the other needs in their list (owner decision O3, an export rule in `data/graph/export.py`). Skill, knowledge and activity weights in exported slices are already discounted for the age of their O*NET rating (SPEC 5.6 rule 3, slice S2, deviations D25): the export multiplies the weight by `max(0.6, 1 - 0.05 * max(0, age_years - 3))`, with the age counted from the rating's own `as_of` to a fixed reference date, the release date of the pinned O*NET version (`2026-08`, never today). The export applies the discount first, then chooses the top 40 needs, then caps the tool weights at the median of the other (already discounted) weights in the list. Tool needs are not discounted: their `as_of` is the O*NET release month, not a rating date (deviations D20). The matcher does not apply the discount itself and must not apply it a second time; each need still carries its rating date (`as_of`) so the app can show the age.
- **Gap order:** weight, times 1.5 for "people still do this", then id.
- **Level:** adds the lower bound of each role's year band (0, 2, 5, 8, 12, 18), then uses the SPEC 7.2 thresholds. Plus 1 for leading 6 or more people or owning a budget, up to 6. No roles gives `null`.
- **Roads:** every slice target except the slice's own occupation, once each. Nothing is filtered out: not leaps, not flags.
- **Components:** short is the coverage. AI safety is 1 minus the target's newest `ai_obs` signal, or 0.5 when there is none. Pay is `0.5 + change / 2`, kept between 0 and 1, where change is the target's pay over the person's job's pay, minus 1 (so a 20 percent cut is 0.4); 0.5 when either is unknown. Demand and enjoy are 0.5. Each is scaled to 0..1 across the roads (min-max). A component that is equal on every road keeps its own value.
- **Pay** (SPEC 7.3, "PLFS band change"): the newest `pay_band_in` signal whose value is a number above 0, on the slice's own occupation and on the target. The contract allows a string or a number; a band name (a string) cannot be compared, so it counts as unknown. Only the ratio of two numbers is used, so the unit does not matter as long as one slice uses one unit. The real slices carry no `pay_band_in` yet (PLFS is T1.3, data lane).
- **Target level** (SPEC 7.2, 5.7): `occ.typical_level` when the slice has it (a new role's own levels), otherwise from the job zone: zone 1 and 2 give levels 1-2, zone 3 gives 2-3, zone 4 gives 3-4, zone 5 gives 4-5. `level.target` is the low end, the typical entry level. No job zone and no `typical_level` gives `null` ("not yet known").
- **Experience fit:** the person's total years (the same lower-bound sum as the level) against the years band of the target's levels: from the first year of the low level (0, 2, 5, 8, 12, 18) to just under the first year of the level above the high one. Level 6 has no top.
- **Road kind** (SPEC 7.2). The minor group is the first 4 digits of the SOC code (13-2011 gives 13-20), from `occ.soc` or else from an O*NET id; new roles (`occ:ai-*`, `occ:in-*`) have none, so they are never in the person's group. The rules are checked in this order, and the first that holds wins:
  1. **reset:** the target's entry level is 2 or more below the person's level, and coverage is under 0.5;
  2. **fork:** the target is a management occupation (SOC 11-) and the person's job is not; or the move is a known specialist step in the same minor group (`ladder.json`);
  3. **up:** same minor group, and the entry level is above the person's;
  4. **diagonal:** another minor group, and the entry level is above the person's;
  5. **across:** anything else where both levels are known.
  The SPEC table leaves three moves unnamed; the choices here are open for the owner (GOLDEN_TABLE questions K1 to K3): the same group at the same or a lower level is across; another group two or more levels up is diagonal; a lower level that is not a reset is across. A manager moving to another manager role follows the level rules, not fork.
- **Specialist steps** (`ladder.json`, a draft for the owner, K4): 4 steps, each an O*NET 31.0 related occupation of the source (graph `close_to` from `onet_database`) in the same minor group at a higher job zone: financial analyst to quantitative analyst, and registered nurse to nurse anesthetist, nurse midwife and nurse practitioner. `match.js` holds a copy; a test keeps the two equal.
- **Bridges** (SPEC 7.4): a greedy cover of the gap weight with up to 3 credentials from `opts.credentials`. Each round takes the credential whose taught skills cover the most gap weight not yet covered (the gap item's weight, to 4 decimals; ties go to the smaller id); it stops when nothing adds weight. A credential the person holds and that is valid is never a bridge. An expired one can come back, with `renew: true`.
- **Flags** (SPEC 7.3, 5.9). Each is raised only when its inputs exist, and never hides a road:
  - `below_pay_floor`: the pay change in percent, to 2 decimals, is under `constraints.pay_floor_pct`. -10 percent is not below a floor of -10.
  - `outside_time`: the suggested bridges' hours add up to more than 12 months at the top of the person's `hours_month` band (5, 10, 20, 40; `40+` never). Without a catalogue, or without hours, it is not raised. The 12 months is our choice (K5).
  - `needs_relocation`: under half the target's openings are in places the person accepts (their `city` and the `city:` ids in `open_to`), counting remote openings as accepted. `open:india` accepts everywhere, so it never rises; with no city and no `open:remote` there is nothing to compare. **Provisional:** the slice contract does not fix how `city_share` is written. The matcher reads the newest `city_share` signal whose value is a string like `"city:blr=0.42,city:hyd=0.31"`, and the newest numeric `remote_share` (0 to 1). Until the data lane and the owner fix a format, real slices have no such signal and the flag stays a stub.
- **Not done:** the title-word override of the level (the profile holds no title text; the app applies it at intake and stores `roles[].level`), demand and interest fit (no data), the rating-age discount of SPEC 5.6 (left to the export, T1.3), and the asked-for credential screening note of SPEC 5.8 (needs `asked_for` data from postings).
- **Order:** score, then coverage, then id.
- **Sliders:** without `priorities`, the defaults are short move 3, and pay, AI safety and demand 1, enjoy 0 (owner decision O4; before 1.1.0 every slider but enjoy was 1). The app starts its sliders at the same values. If every weight is 0, every score is 0.

## Fair inputs (ADR-16, invariant 8)

`ALLOWED_INPUT_FIELDS` lists every profile field the matcher may read. Two tests enforce it. One scans `match.js` for any demographic or commercial name. The other runs the matcher on a watched profile and fails if it reads any field not on the list. City and openness to move are read only for the `needs_relocation` flag. A third test (ADR-16) changes them on 200 random profiles and the pay-floor case, and checks that every score, component and the order stay the same and only that flag moves.

## Tests

```bash
node --test 'matcher/tests/*.test.mjs'
python3 matcher/reference.py                  # golden cases, Python only
node matcher/tests/version_guard.mjs          # golden outputs against the lock
node matcher/tests/version_guard.mjs --write  # after a MATCHER_VERSION bump, or to add a case
```

- `tests/golden.json`: 15 cases across 5 occupation families: 13 on hand-built slices (`near-rank` tests the near rule) and 2 on real-shape slices whose near pairs come from the slice (`csr-real-near`, and `acc-real-tools`, which shows the tool cap). Every expectation is written by `python3 matcher/reference.py --expect` first, then `match.js` is checked against it. The S2 cases: `qa-llm-adjacent` (a close move into a new AI-era role, and every kind but reset), `bpm-lead-reset` (a reset into a new role, an expired credential offered again to renew, outside_time), `bfsi-pay-floor` (every road below the pay floor, needs_relocation) and `csr-cert-bridge` (a held certification closes a gap; bridges). `tests/GOLDEN_TABLE.md` lists them for the owner, with the open questions K1 to K5. **The owner has not read the 15 cases yet (BUILD_PLAN T2.4, ASK).**
- `tests/fixtures/`: 7 made-up test slices (`make_s2_fixtures.py` writes the three S2 ones: `slice_qa_analyst.json`, `slice_bpm_lead.json`, `slice_bfsi_sales.json`), plus skill_near data (`near.json`, `near_rank.json`), credential data (`teaches.json`) and a made-up credential catalogue (`credentials.json`, `demo-` ids), none of it real data, and two extracts of real O*NET 31.0 slices, `slice_csr_real.json` (Customer Service Representatives) and `slice_acc_real.json` (Accountants and Auditors), 5 targets each, with their near pairs. `make_csr_real.py` rewrites both from the exported slices. The hand-built slices keep their made-up tool weights: the cap is an export rule, and the matcher uses weights as given.
- Properties over 500 random profiles (seed 20261029) on the 7 hand-built slices, each with one of the two hand-built near files, and half with the credential catalogue. Coverage stays between 0 and 1. Adding a skill never lowers coverage. Strong is at least used, and used is at least rusty. Sliders reorder roads but never add or remove one. Constraints never remove a road. The same input always gives the same bytes.
- `reference.py` must agree with `match.js` to 2 decimals on every golden and random case, with the same road order, reach, gap, kind, target level, fit, flags, pay change, bridges (ids, covered skills, gain, hours, renew) and held-credential status. It reads the specialist steps from `ladder.json` itself. It is independent code, but it was written from the same reading of SPEC, so it shares the open choices listed above: it cannot catch a choice that both make the same way. Two of them matter most: the level uses the lower bound of each year band (0, 2, 5, 8, 12, 18), and a component that is equal on every road keeps its raw value instead of a 0..1 score. In 1.2.0 the kind rules for the moves SPEC 7.2 does not name (K1 to K3) are shared choices too.
- **Version guard.** `tests/golden.lock.json` holds a hash of each golden case's output. If any output changes while `MATCHER_VERSION` stays the same, the tests fail. Bump `MATCHER_VERSION` here and in `contracts/versions.js` (an architect change), then run the guard with `--write`.

## Versions

- **1.0.0** (S1): the first matcher.
- **1.0.1** (S1 review fixes): no change to `match.js` or `reference.py` rules. The real-shape fixture `tests/fixtures/slice_csr_real.json` was re-extracted (`tests/fixtures/make_csr_real.py`) after the export changed how it picks a job's tools and dropped tasks with no AI data from the skill AI labels (deviations D20). That changed the csr-real-near output, and the version guard allows a changed output only with a new version.
- **1.1.0** (owner decisions O1, O2 and O4 of 2026-10-29, deviations "Decisions"): used counts 0.85 (was 0.7), and so does a valid credential; a near skill counts only if it is among the 3 closest neighbours of the skill it credits and at least 0.90 similar (was: any pair at 0.5 or more); the default sliders are short move 3, pay 1, AI safety 1, demand 1, enjoy 0 (was all 1 but enjoy). Owner decision O3 (tool weights capped at the median of the other needs in each slice list) is an export rule, but it changed the two real-shape fixtures. Every golden output was regenerated with `reference.py` first and `match.js` agrees to 2 decimals. The `near.json` pair from quality control to LLM evaluation went from 0.7 to 0.92, so swdev-qa-near still shows near at work. Two cases were added: `near-rank` and `acc-real-tools`.
- **1.2.0** (slice S2, BUILD_PLAN T2.2, T2.4, T1.8 matcher part, T5.3 bridges): the target's typical level and experience fit, the road kind (with `ladder.json`), the pay change from numeric `pay_band_in` signals, the flags `below_pay_floor`, `outside_time` and `needs_relocation` (provisional city_share format), bridges from `opts.credentials`, and held credentials with "renew?". Coverage, gap, reach, the level and the order rules did not change, and neither did the coverage, reach or order of the 11 earlier golden cases; their expectations now also hold kind, target level, fit and bridges. Four cases were added (15 in all, 5 families). `contracts/versions.js`, `versions.json` and `freeze.lock.json` carry 1.2.0 (versions only: no contract file changed).
