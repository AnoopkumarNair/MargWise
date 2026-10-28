# Delivery: a multi-agent SDLC

Status: authoritative with `SPEC.md`, 28 Oct 2026. How several agents (and the owner) build Margwise for working adults without stepping on each other, and without small issues snowballing.

## Hats

Each hat is a role with clear authority. One agent can wear several hats over time, but **never review its own work**.

| Hat | Who | Owns | Signs off |
| --- | --- | --- | --- |
| **Product owner** | The founder | Scope, priorities, the answers to every ASK, people tests, legal sign-off | Each slice demo, every ADR, the seed lists (new roles, certifications), notice wording |
| **Architect** | Opus session | `contracts/`, `docs/adult/BACKEND.md` ADRs, `SPEC.md`, cross-lane interfaces, the id registry policy | Every change to a contract, an ADR or an invariant |
| **Orchestrator / integrator** | Opus session | The slice plan, splitting work into lanes, merge order, the integration branch, the slice pull request | Merges a lane into the slice branch when its gates pass |
| **Data engineer** | Sonnet session | `data/graph/`, `pipeline/` stages, exports, the catalogues (new roles, certifications, abbreviations) | |
| **Backend engineer** | Sonnet session | `hosting/core/`, `hosting/functions/`, `hosting/migrations/`, `hosting/tools/` | |
| **Frontend engineer** | Sonnet session | `app/adult/`, vendored libraries | |
| **Matcher engineer** | Sonnet session | `matcher/` (`match.js`, `reference.py`, golden cases) | |
| **QA engineer** | Sonnet session, separate from the builders | `TEST_PLAN.md` coverage, fixtures, the e2e, privacy and performance suites, the CI jobs | Confirms each slice's Definition of Done |
| **Security and privacy reviewer** | Opus session with the security-review skill | The threat model, the data inventory, redaction quality, the invariant checker | A required review on any pull request touching auth, email, AI, deletion, logging or the data inventory |
| **DevOps / release** | The owner, assisted by an agent that writes the runbooks | Environments, secrets, migrations on remote databases, deploys, rollbacks, alerts | The owner alone runs anything remote |
| **Data steward** | The owner, with reviewers | Fact checks, catalogue approvals, `--accept` of releases | Each graph release |
| **Technical writer** | Any agent, reviewed by the owner | User-facing copy, the notice, runbooks, the docs index | Plain-language check on all copy |

## Lanes and file ownership

Parallel agents work in **separate git worktrees on separate branches**, each owning a disjoint set of paths. A lane never edits another lane's paths. If it needs a change there, it asks the owning lane through the orchestrator.

| Lane | Paths it may change |
| --- | --- |
| contracts (architect) | `contracts/`, `docs/adult/*.md` |
| data | `data/graph/`, `pipeline/run.py` (graph stages only), `pipeline/validate_graph.py`, `data/sources.yaml` (new entries only) |
| matcher | `matcher/` |
| backend | `hosting/core/`, `hosting/functions/api/v1/`, `hosting/migrations/`, `hosting/tools/`, `hosting/tests/adult/` |
| frontend | `app/adult/`, `hosting/public/vendor/` (new files only), `hosting/public/_headers` (`/work/` block only) |
| qa | `app/adult/tests/`, `.github/workflows/` (new adult jobs only), `docs/adult/TEST_PLAN.md` |

Shared files (`README.md`, `CLAUDE.md`, `wrangler.toml`, the existing student code) are changed only by the orchestrator, in the slice integration branch.

## Branches and merge order

```
main
 └─ adult/s<N>                  slice integration branch (orchestrator)
     ├─ adult/s<N>-contracts    merged FIRST, then frozen for the slice
     ├─ adult/s<N>-data
     ├─ adult/s<N>-matcher
     ├─ adult/s<N>-backend
     ├─ adult/s<N>-frontend
     └─ adult/s<N>-qa
```

1. **Contracts first.** At the start of a slice, the architect writes or updates every schema and version the slice needs, the orchestrator merges it into `adult/s<N>`, and it is **frozen**. Lanes branch from it, so all of them build against the same shapes. A contract change mid-slice goes back through the architect and is re-merged before any lane uses it.
2. **Lanes merge into the slice branch** when their gates pass (below), in dependency order: data and matcher, then backend, then frontend, then qa (final suites).
3. **Rebase lanes onto the slice branch** after each merge. Conflicts are a signal that ownership was crossed; the orchestrator resolves them and records why.
4. **The slice pull request** (`adult/s<N>` into `main`) carries screenshots, the test summary, the demo script and the risks. The owner merges it after the demo.

## Gates

### Definition of Ready (before a lane starts)

- The slice's contracts are merged and frozen.
- The ticket says "done when" in testable terms, and names its tests from TEST_PLAN.
- The ASK items it depends on are answered, or the ticket says what default it uses.
- The input data or fixtures exist.

### Lane gate (before merging into the slice branch)

1. The lane's unit tests and contract validation pass.
2. The student regression commands pass (BUILD_PLAN ground rules).
3. **Code review** by an agent that did not write the code (use the code-review skill). It checks:
   - correctness against SPEC and ADRs;
   - matching the existing style;
   - no secrets;
   - no personal data in logs;
   - error handling that fails closed.
4. **Security review**, required for the backend lane, and for any lane that touches redaction, AI, storage or logging.
5. **A handoff note** in the pull request: what changed, how it was tested, the contracts used (with versions), open questions, and anything another lane must know.

### Slice gate (Definition of Done)

As in `TEST_PLAN.md`: every test layer for the slice passes in CI, the invariant checker passes, the demo script works, and the owner signs off.

## Change control (keeping small issues small)

- **Requires an ADR and the owner's approval:**
  - a change to any contract;
  - a change to an invariant;
  - a change to a frozen decision;
  - a new external service;
  - a new runtime dependency;
  - anything touching stored personal data.

  Write ADRs in `BACKEND.md` (append, never rewrite history; mark the old ADR "superseded by ADR-xx").
- **Deviation log.** If an implementer finds that SPEC is wrong or impossible, they stop, write a short note in the slice's `docs/adult/deviations.md` (what, why, the proposed change), and ask. Silent workarounds are not allowed.
- **Version bumps** are mechanical, not optional: matcher behaviour means `MATCHER_VERSION`, profile shape means `PROFILE_V`, slice shape means `SLICE_V`, API shape means `API_V`. CI checks the matcher and profile versions against their golden or migration tests.
- **Weekly drift review** (orchestrator, 15 minutes):
  - Do the code and SPEC still agree?
  - Are any TODOs older than a week?
  - Are there skipped tests?
  - Is any ASK unanswered?

  Results go to the owner as a short list.

## Risk register (keep updated in the slice pull requests)

| Risk | Signal | Mitigation |
| --- | --- | --- |
| Graph ids change meaning between releases | The registry CI check fails, or profiles lose skills | ADR-05; the rule that removed ids become tombstones |
| Contracts drift between lanes | Validation failures at integration | Contracts first and frozen; a shared validator |
| Weak redaction of Indian names | Canary or eval misses | The preview as backstop, name lists, the 30-resume rule before "Most accurate" is the default |
| O*NET does not fit Indian IT, BPM or BFSI jobs | Low "sounds right" in people tests; many unmatched titles | The Indian abbreviation and title lists, new-role and certification catalogues, posting weights when available |
| Scope creep from exciting add-ons | Tickets outside the slice | The slice table is the scope. New ideas go to a "later" list in SPEC section 13 |
| Agent-generated code hides subtle bugs | Review findings, flaky tests | Independent review, property tests, two implementations of the matcher, no merge without green CI |
| Owner bottleneck on ASK items | Lanes blocked | Batch ASKs per slice, each with defaults, so the owner answers once per slice |
| Cost overrun (AI, email) | `ops_daily` counters | Hard caps at the provider, plus daily caps in code |
| Platform change (Pages to Workers) | A Cloudflare deprecation notice | ADR-01 portable handlers |

## Release and operations runbook (the owner runs it; agents write and maintain it)

`docs/PILOT_RUNBOOK.md` gains an "Adult" section covering:

1. **Releasing the graph.** Review `CHANGES.md` and the graph change report, `--accept`, rebuild, tag `graph-<release_id>`.
2. **Migrations.**
   1. `npx wrangler@4 d1 migrations list <database> --remote` for preview, then production (exact names in `docs/PILOT_RUNBOOK.md`).
   2. Rehearse on a local copy of the production export.
   3. Apply to preview, then run the smoke test.
   4. Apply to production, then run the invariant checker.
3. **Deploying.** Preview first (the e2e suite against the preview URL), then production. Smoke test: health, sign-up with the owner's own address, roads, export and delete of a test account.
4. **Rollback.** The Pages rollback. Migrations are not rolled back, because they are additive. Fix forward.
5. **Rotating a key.** Add the new version, deploy, wait out the overlap, then remove the old version. For a suspected leak: rotate immediately and set `tok_after`.
6. **Incidents.**
   - Severity levels.
   - First steps: contain, assess personal-data impact, decide on notification.
   - The DPDP breach notice steps (from the lawyer's review).
   - A post-mortem template: timeline, cause, the fix, the test or invariant that now prevents it.
7. **Support.**
   - A `help@` address on every adult page.
   - Answers within 3 working days.
   - A short FAQ built from real questions.
   - Data requests (see, correct, delete) handled with the same self-service tools, and logged.
8. **Routine checks.**
   - Monthly: the invariant checker and AI and email spend.
   - Quarterly: the restore drill, new-role promotion and retirement, certification renewals, and dependency versions.

## Working with Claude Code sessions

- **One orchestrator session (Opus) per slice.** It reads SPEC, BACKEND, BUILD_PLAN, TEST_PLAN and DELIVERY, writes the contracts (wearing the architect hat), then starts the lane sessions with the lane prompt below.
- **Lane sessions (Sonnet)** each get one lane, one branch, and their tickets.
- **Review sessions (Opus)** use the code-review and security-review skills on each lane pull request before merge.
- **The QA session (Sonnet)** is separate from the builders and writes the slice-level suites.

**Lane prompt template:**

> You are the `<lane>` lane for slice `S<N>` of Margwise for working adults. Read `CLAUDE.md`, `docs/adult/SPEC.md`, `BACKEND.md`, `TEST_PLAN.md` and `DELIVERY.md`, then your tickets in `BUILD_PLAN.md`: `<list>`. Work only in these paths: `<paths>`. Contracts are frozen at commit `<sha>`. If you need a contract or ADR change, stop and write it in `docs/adult/deviations.md`. Write tests with the code. Run your lane checks and the student regression commands. Open a pull request into `adult/s<N>` with the handoff note. Never deploy, touch remote databases, or edit outside your paths.

## Coverage review (28 Oct 2026)

**Covered, and where:**

| Area | Document |
| --- | --- |
| Product scope, audience, industries, location, certifications, new AI roles | SPEC 1 to 5 |
| Data sources, freshness, legality of collection | SPEC 5, CAREER_GRAPH (history) |
| User model, matcher, levels, bridges | SPEC 6 and 7 |
| Screens and copy rules | SPEC 8, CLAUDE.md |
| API, database, migrations, keys, sessions, abuse, ids, concurrency, contracts, logging, backups, security, fairness, prompts, switches, isolation from students | SPEC 9 and 10, BACKEND ADR-01 to ADR-19, invariants |
| Privacy and legal checklist | SPEC 12, BACKEND ADR-11 and ADR-14 |
| Tests at every layer, browsers, people tests | TEST_PLAN |
| Slicing, tickets, owner stop points | BUILD_PLAN |
| Roles, lanes, branches, gates, change control, risks, runbook, support | DELIVERY |

**Open, and owned by the founder:** D2 to D6 (SPEC 3), the seed lists (new roles, certifications, Indian titles and abbreviations), notice wording, the preview database and Turnstile keys, R2 or Hugging Face for model files, AI provider and spend cap, the lawyer's hour, the 30 resumes, and 5 people for each people test.

**Deliberately not in v1** (SPEC 13, plus):

- regional-language interfaces (English only in v1; Devanagari text in resumes is handled);
- payments;
- employer or recruiter features of any kind;
- a native mobile app.

