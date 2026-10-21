# Data model

Source of truth: SQL in `services/supabase/migrations/` and Zod schemas in
`packages/contracts/src/`. Constraints are duplicated deliberately: the
contracts reject bad data on the phone, in the pipeline and in Edge
Functions; the database rejects it again (05 §9 release gate, RULES.md
rule 2). DB tests: `services/supabase/tests/sql/`.

## ERD — content

```mermaid
erDiagram
  provenance ||--o{ career_levels : evidences
  provenance ||--o{ gates : evidences
  provenance ||--o{ route_stages : evidences
  provenance ||--o{ city_costs : evidences
  provenance ||--o{ country_costs : evidences
  provenance ||--o{ cutoffs : evidences
  provenance ||--o{ loan_schemes : evidences
  provenance ||--o{ tax_rules : evidences
  clusters ||--o{ careers : groups
  careers ||--o{ career_onet_map : "maps to O*NET-SOC (+OI vector)"
  careers ||--o{ dossier_sections : has
  careers ||--o{ career_levels : ladder
  careers ||--o{ routes : "reached by"
  routes ||--o{ route_stages : "ordered stages"
  routes ||--o{ gates : "eligibility per subject combination"
  careers ||--o{ quests : offers
  careers ||--o{ ai_exposure : "two lenses"
  careers ||--o{ career_country_fit : "abroad fit"
  countries ||--o{ career_country_fit : ""
  countries ||--o{ country_costs : ""
  institutions ||--o{ programmes : offers
  institutions ||--o{ nirf_metrics : "ranked by"
  programmes ||--o{ programme_fees : "fee per year"
  programmes ||--o{ cutoffs : "ranks per round/quota/category"
  cities ||--o{ city_costs : ""
  country_policies ||--o{ country_policy_transitions : lifecycle
  releases ||--o{ release_items : contains
```

## ERD — pipeline and telemetry

```mermaid
erDiagram
  sources ||--o{ fetch_runs : ""
  sources ||--o{ snapshots : ""
  fetch_runs |o--o{ snapshots : produced
  snapshots ||--o{ extractions : ""
  extractions ||--o{ change_events : ""
  change_events ||--|| review_tasks : ""
  review_tasks ||--o{ review_decisions : ""
  sessions ||--o{ consents : ""
  sessions ||--o{ events : ""
  sessions ||--o{ item_responses : "Tier 2 only"
  sessions ||--o{ coverage_requests : ""
  sessions ||--o{ feedback : ""
```

`telemetry.deletion_requests` has no foreign key on purpose: the audit row
survives the deletion it requested. `telemetry.settings` holds the minors
kill switch.

## Key invariants (DB-enforced)

| Rule                                                                                   | Where                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Sourced fact ⇒ `https` URL + non-blank quote + snapshot id                             | `provenance_sourced_evidence`                  |
| Assumption ⇒ non-blank rationale                                                       | `provenance_assumption_rationale`              |
| No forbidden source domains                                                            | `provenance_not_forbidden_source`              |
| `valid_to ≥ as_of`                                                                     | `provenance_valid_to_after_as_of`              |
| Gates and cutoffs need **sourced** provenance                                          | trigger `require_sourced_provenance`           |
| Ranges `low ≤ likely ≤ high`; percentiles `p10 ≤ p50 ≤ p90`; ranks `opening ≤ closing` | table checks                                   |
| Loan rates are ratios in [0, 0.5]                                                      | `loan_schemes_rate_range`                      |
| "Not reported" is NULL with no provenance, never 0                                     | `*_reported_has_source` checks                 |
| O*NET OI vector is all-or-nothing, 1–7, with provenance                                | `career_onet_vector_complete`                  |
| Programme registry key `institution + normalised code + campus (+ year)`               | unique constraint                              |
| LLM extraction confidence ≤ medium                                                     | `extractions_llm_confidence`                   |
| Edit/reject decisions need a note; edit needs a value                                  | `review_decisions_*`                           |
| One current release                                                                    | partial unique index `releases_single_current` |
| Tier 2 consent ⇒ teen assent                                                           | `consents_tier2_assent`                        |
| Exactly 60 item values, each 0–4                                                       | `item_responses_sixty`, `item_responses_range` |

## Row-level security

Every table in `content`, `pipeline`, `telemetry` has RLS **enabled and
forced**; a DB test fails if any table lacks it. Client roles have no default
grants (baseline migration).

| Schema    | anon | authenticated non-member | Studio viewer | Stream reviewer              | Owner                                    | service_role  |
| --------- | ---- | ------------------------ | ------------- | ---------------------------- | ---------------------------------------- | ------------- |
| content   | ✗    | ✗ (0 rows)               | read          | read                         | read                                     | read/write    |
| pipeline  | ✗    | ✗ (0 rows)               | read          | read + decide on own streams | read + decide on all                     | read/write    |
| telemetry | ✗    | ✗                        | ✗             | ✗                            | ✗ (aggregates via Studio views, Phase 8) | insert/delete |

Decisions are inserted with `reviewer = auth.uid()` (no impersonation), only
on pending tasks, one per person per task. A trigger sets the task status per
05 §8: critical needs the stream reviewer **and** the owner, any rejection is
final, low severity is owner-only (D-035). Reviewers never need UPDATE on
`review_tasks`. Helpers live in `private` (security definer,
`search_path = ''`) and are called as `(select private.fn())`.
