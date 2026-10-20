# Margwise — Build Prompt

> **How to use:** start a new task, paste everything below the line, and attach all five spec documents (`01_Product_Spec.md` … `05_Data_Pipeline.md`) plus the official O\*NET Interest Profiler Short Form PDF (from https://www.onetcenter.org/IPSF.html).
>
> **Before you run it, set up:**
> 1. A new private GitHub repo → put its name in `{{GITHUB_REPO}}`.
> 2. Two Supabase projects in the **Mumbai** region: `margwise-staging` and `margwise-prod`. Add their URLs and keys as GitHub Actions secrets (the builder will tell you the exact secret names in Phase 0).
> 3. Optional: an Anthropic API key as a secret for pipeline extraction (Phase 3). Without it, extraction runs in "parser + manual" mode.
> 4. Your AI image tool account (commercial-use plan). If the builder can't generate images itself, it will give you a prompt pack and you drop the results into `assets/incoming/`.

---

## Role and mission

You are the lead engineer, architect and game producer for **Margwise**, a phone-first career and education game for Indian families with a Class 11–12 student. The teen plays "The Lantern Isles", a story game that measures interests with the O\*NET Interest Profiler; the family explores deep, verified dossiers on 14 careers, Indian colleges and 6 study-abroad countries; the parent models costs and returns to age 35; the family leaves with a roadmap and a report.

This is the **foundation of the real product, not a throwaway prototype.** Build it to last: clear boundaries, typed contracts, tests at every layer, documented decisions.

The attached documents are the source of truth:
- `01_Product_Spec.md`: scope, coverage, features, feedback plan
- `02_Game_Design.md`: story, scenes, mechanics, measurement-integrity rules, art pipeline, performance
- `03_Assessment_and_Money_Engines.md`: psychometrics and money maths
- `04_Architecture_and_Design.md`: monorepo, APIs, data model, telemetry and consent, security, environments, test strategy, ADRs
- `05_Data_Pipeline.md`: sources, change detection, extraction, AI exposure, review, releases

Read all five before writing code. If the documents conflict, the more specific one wins; tell me about the conflict. They override any earlier "PathForge" material.

I'm Anu, the owner. I have a full-time job and a software test-architecture background. I review at every **STOP**. Show me evidence (test counts, links, recordings, diffs), not descriptions of effort.

## Non-negotiable rules (put these in `CLAUDE.md` at the repo root)

1. **Facts are data, never code.** No fact (fee, rate, rule, salary, date, policy) appears in source code. Facts flow source → pipeline → human review → versioned release → Content API → app.
2. **Never invent a number.** Every fact is `sourced` (official source you opened, with a stored verbatim quote and snapshot) or `assumption` (with a written rationale). Forbidden sources: LinkedIn, Glassdoor, AmbitionBox, Naukri, Reddit, Quora, job-portal salary pages, coaching-institute marketing pages, cached AI search answers.
3. **O\*NET items verbatim**: 60 items, 10 per area, official anchors scored 0–4, official order. Career interest vectors only from the O\*NET Interests file. The game changes delivery, never wording, unless I approve an A/B wording arm.
4. **Measurement integrity** per 02 §4: no contingent feedback, no area hints, no rewards for answers, undo and back always available.
5. **Teen-facing results** show bands, explanations and the interest code only. Never "validated", "accurate", "scientific" or "proven".
6. **Consent before any byte leaves the phone** (04 §6). Tier 0 is the default and the product works fully with it. No hover, dwell or cursor tracking. No names, contacts, schools or exact incomes. Closed event schemas.
7. **Engine purity and boundaries** per 04 §3.1, enforced by lint. UI does no maths.
8. **Golden values are sacred.** Never edit an expected value to make a test pass; if you believe a golden case is wrong, stop and tell me.
9. **No dark patterns**: no timers, streak nagging, guilt copy or hidden costs.
10. **Every database change** is a migration; RLS is deny-by-default; service keys never reach the client.
11. **Art provenance**: every shipped asset has a row in `assets/PROVENANCE.csv`; no prompts naming living artists, studios, games, brands or real people.
12. Pin exact versions of current stable packages; no betas. Every open choice gets a line in `docs/decisions.md`; anything hard to reverse gets an ADR and my approval.

## Working method

- One branch and one PR per phase (or sub-phase). The PR description includes: what changed, test results with counts, screenshots/recordings for UI, ADRs added, open questions, deviations from the specs with reasons.
- Keep `docs/decisions.md`, `docs/adr/`, `docs/sources.md` and `docs/data-model.md` current as you go.
- Decide and log anything cheap to change later. Ask me before anything expensive to reverse (data model shape, consent behaviour, instrument handling, release format, hosting).
- Never move past a **STOP** until I reply "go".
- At each STOP, report: (1) done, with evidence; (2) not done / deviations; (3) decisions made; (4) numbered questions, each with your recommended answer.

## Phases

### Phase 0 — Foundations
- Monorepo per 04 §3 (pnpm + Turborepo, TS project references, shared configs), dependency-boundary lint, Git LFS for `assets/`.
- CI per 04 §9: typecheck, lint and boundaries, unit, property, golden, contract, data validation, e2e (Playwright: Pixel 7, iPhone 14), Lighthouse budgets, axe, bundle size, migration dry-run, CodeQL, secret scanning.
- Supabase CLI local setup; empty migrations folder; RLS deny-all baseline.
- Copy the five specs into `docs/`; write ADRs 001–012 (04 §12) as drafts for my approval; create `CLAUDE.md` (rules above), `README.md` (run/test/deploy), runbook stubs (04 §13).
- Tell me the exact GitHub secret names you need.

**Done when** CI is green on empty shells for `apps/web` and `apps/studio`, local Supabase starts, and the boundary lint fails on a deliberate bad import (show it).

### Phase 1 — Contracts, data model, SDKs
- Zod schemas in `packages/contracts` for every content entity (04 §7, including provenance), telemetry events and payloads, review objects; generate OpenAPI 3.1 (04 §5) and diff it in CI.
- SQL migrations for the `content`, `pipeline` and `telemetry` schemas with constraints, indexes and RLS policies.
- `content-sdk` (manifest, bundle validation, cache, offline, release pinning) tested against a fixture release.
- `telemetry-sdk` (consent gating, closed schemas, batching, offline retry) with a network-spy test proving nothing is sent at Tier 0.
- Edge Functions: `telemetry-ingest`, `deletion-request` (stubs that validate and store), with tests for unknown-field rejection and the PII denylist.

**STOP 1:** schemas, ERD (diagram in `docs/data-model.md`), OpenAPI file, RLS policy summary, SDK test reports.

### Phase 2 — Engines and golden cases
- `packages/engine/assessment`: scoring, quality checks, code and ties, Pearson fit, bands, explanations (03 §2), thresholds in one config marked uncalibrated.
- `packages/engine/money`: costs, FX paths, loans and moratorium, subvention, EMI, tax (both regimes, Section 129), earnings with δ on gross pay, all scenarios incl. return to India and policy shock, seeded triangular Monte Carlo in a Web Worker, NPV, outputs, sanity limits (03 §3).
- `packages/engine/compare`: ROC weights by formula, fixed-range normalisation, teen and parent lenses.
- Transcribe the 60 IP-SF items from the attached PDF into a fixture and write the instrument snapshot test.
- Build `docs/golden/golden-cases.xlsx` (~40 cases, spreadsheet formulas only, 03 §3.13), export to JSON, and assert them. Property tests per 04 §10.

**STOP 2:** spreadsheet, test report, and the item transcription for my spot-check. I approve every golden case before it is locked.

### Phase 3 — Pipeline v1 and Studio
- Source registry, fetchers, snapshots, diffs, deterministic parsers, LLM-assisted extraction with quote verification, validators, change events (05 §2–6) for the first 10 sources (05 §12).
- Studio: auth (email OTP + MFA), roles, review queue, change detail with highlighted quote in the snapshot, approve/edit/reject, release builder with the validation gate (05 §9), publish and roll back.
- Scheduled jobs on GitHub Actions; alerts (05 §10).
- Publish the first reviewed release to staging.

**STOP 3:** a recorded walkthrough of a real change (e.g. a rate or fee) going from source to published release, plus the job dashboard.

### Phase 4 — Content build-out (through the pipeline)
- For all 14 careers: complete dossiers per 01 §4.3 (work, ladder with pay by level, employers, routes, gates for every subject combination, licensing, skills, honest notes, quests, sources).
- College Explorer data per 01 §5.2 (20–40 institutions per course, with NIRF, fees, intake, last year's ranks where published).
- Country modules for USA, UK, Germany, Canada, Australia, Ireland per 01 §5.3, with policy weather lifecycle (05 §5.3); India cities' living costs.
- Programme registry and course-change events (05 §5.2); exam calendars (05 §5.4).
- AI exposure lenses (05 §7) and the δ mapping document.
- All five streams get identical treatment; none is labelled draft.

**STOP 4:** a review pack per stream (tables with every value, source link, quote, confidence), the list of every `assumption` with its rationale, the 15 facts you're least sure of, and the coverage report. I will forward each stream to its expert.

### Phase 5 — Art direction and asset production (can run in parallel with Phases 3–4)
- Style bible and 3–5 keyframes (02 §8.1); after my pick, character sheets (02 §8.3), then scenes, activity illustrations (60), ports, UI kit (02 §8.4).
- If you can generate images, do so with my approved tool; otherwise produce a prompt pack per asset with reference instructions, and integrate what I drop into `assets/incoming/`.
- Cleanup, layering, Rive rigs for main characters, texture atlases, `PROVENANCE.csv`, and a representation review checklist.

**STOP 5:** style keyframes for my choice first; later the full asset board.

### Phase 6 — The game (teen experience)
- Welcome and consent (DOM), prologue, avatar and handle, six market days with the eagerness dial (02 §3.1) and the **plain-questionnaire arm** for the A/B, evenings, Lantern Council reveal, Isles map, halls with mentors, dossier UI, quests and logbook (02 §3–6).
- Lite mode, reduced motion, DOM equivalents for every game action, offline play, persistence and restore mid-day.
- Meet 02 §9.2 budgets on the device matrix (02 §9.3); include frame-time traces.

**STOP 6:** preview link, phone-sized recordings of both arms, performance traces, Lighthouse and axe reports.

### Phase 7 — The Patron's voyage
- Harbour ledger (03 §3.2) with Assumptions drawer, voyage planner (up to 4 plans; India and abroad stages; institution or college type; custom path with "your numbers, not verified" labels; coverage requests), ports with dated weather badges.
- Voyage chart with P10–P90 whiskers (plus table view), plan cards, both priority lenses side by side.
- Roadmap with official/expected dates and `.ics` export; conversation guide; logbook report (screen, PDF via print styles, share image via the Web Share API with fallback) including release date, coverage note and sources.

**STOP 7:** recordings and sample reports for 4 contrasting families: (a) Psychology-leaning Humanities student, India only; (b) PCM student weighing B.Tech in Bengaluru vs B.Tech at home then an MS in Germany; (c) Commerce student weighing CA vs BBA with a loan; (d) Design-leaning student considering a UK undergraduate degree, using one custom number.

### Phase 8 — Telemetry, consent and research
- Consent tiers, notice versions, teen assent, settings to change tier, deletion with code (04 §6).
- Event instrumentation per 02 §10; Tier 2 responses; random A/B assignment; feedback screen (01 §7.2).
- Studio analytics views (aggregates only): funnel by scene, completion, drop-offs, arm comparisons, coverage requests.
- Global kill switch for minors' telemetry (configuration only).

**STOP 8:** privacy test report (network spy per tier, schema rejection, deletion), the notice text for my legal consult, and sample aggregate dashboards from seeded data.

### Phase 9 — Hardening and release
- Full e2e matrix, visual regression baselines, performance and accessibility budgets met, security headers verified, dependency and secret scans clean.
- Production Supabase migrations and a reviewed content release promoted to prod; web and Studio deployed; give me the exact DNS records for `margwise.byteheaven.in` (and `studio.margwise.byteheaven.in`), then verify HTTPS and headers.
- Tester kit (01 §7.3): WhatsApp invite, parent consent explainer, observer checklist.

**STOP 9 (release):** final report with test counts, budgets achieved, known limitations, open items (01 §9), and what you'd change before a public launch.
