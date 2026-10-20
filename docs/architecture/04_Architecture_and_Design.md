# Margwise — 04 Architecture & Design

**As of:** 20 Oct 2026 · Decisions: Supabase (Mumbai region) backend; static web hosting; monorepo; content as versioned releases; consented telemetry in the alpha.

---

## 1. Principles

1. **Built to last.** Clear module boundaries, typed contracts, tests at every layer. No prototype shortcuts that must be rewritten.
2. **Facts are data, never code.** The app fetches versioned content releases; the pipeline produces them; humans approve every change.
3. **Offline-first client.** The game, engines and current content release work without a network after first load.
4. **Consent before any byte leaves the phone.** Telemetry is opt-in and tiered; the product works fully with none.
5. **Deterministic core.** Assessment and money maths are pure functions with golden tests. No LLM at runtime.
6. **Boring infrastructure.** Postgres, static hosting, scheduled jobs. New infrastructure needs an ADR.

## 2. System context (C4 level 1–2)

```
 Families (phone browser)                         Reviewers / Anu (Studio)
          │                                                  │
          ▼                                                  ▼
 ┌──────────────────────┐                        ┌──────────────────────┐
 │ apps/web (PWA)       │                        │ apps/studio          │
 │ React + PixiJS + Rive│                        │ React, Supabase Auth │
 │ engine (in-browser)  │                        └──────────┬───────────┘
 └──────┬─────────┬─────┘                                   │ review / publish
        │content  │telemetry (consented)                    │
        ▼         ▼                                         ▼
 ┌────────────┐ ┌──────────────────────────────────────────────────────┐
 │ Content    │ │ Supabase (Mumbai): Postgres (content, pipeline,       │
 │ releases   │◄┤ telemetry schemas), Storage (release bundles,          │
 │ (Storage + │ │ snapshots), Edge Functions (ingest, publish), Auth    │
 │ CDN, JSON) │ └──────────────────────────▲───────────────────────────┘
 └────────────┘                            │ writes snapshots, extractions, change events
                                           │
                             ┌─────────────┴──────────────┐
                             │ pipeline (scheduled jobs on │
                             │ GitHub Actions): fetch →    │
                             │ diff → extract → validate   │
                             └─────────────┬──────────────┘
                                           ▼
                 Official sources (NIRF, JoSAA, AICTE, UGC, RCI, CBSE, ICAI, SBI,
                 PIB, Income Tax Dept, O*NET, ILO, Anthropic Economic Index,
                 immigration sites of US/UK/DE/CA/AU/IE, institutions' pages)
```

## 3. Repository (monorepo)

pnpm workspaces + Turborepo; TypeScript project references; strict mode everywhere.

```
margwise/
  apps/
    web/                 # family app: Vite + React + PixiJS + Rive, PWA
    studio/              # reviewer app: change queue, diffs, approve/reject, publish
  services/
    supabase/
      migrations/        # SQL migrations (only way to change the DB)
      policies/          # RLS policies (deny by default)
      functions/         # Edge Functions: telemetry-ingest, deletion-request, publish-release
      seed/              # local dev seed
  pipeline/
    sources/             # source registry (YAML, one file per source)
    src/
      fetchers/          # html, pdf, csv/xlsx, json-api
      differs/           # hash diff, table diff, semantic text diff
      extractors/        # deterministic parsers + LLM-assisted extraction (quote + page)
      validators/        # schema, range, unit, cross-field checks
      publishers/        # build release bundles from approved facts
    jobs/                # schedules; one job per source group
  packages/
    contracts/           # Zod schemas → TS types → OpenAPI 3.1 (generated)
    engine/              # assessment/, money/, compare/  (pure, no I/O)
    content-sdk/         # typed client: manifest, bundles, cache, offline, version pinning
    telemetry-sdk/       # consent-aware queue, batching, offline retry, schema-checked
    game-kit/            # PixiJS scenes, asset loader, Rive wrappers, lite mode, frame sampler
    ui/                  # design tokens, DOM components, charts (SVG)
    i18n/                # message catalogues, Indian number/date formatting
    config/              # shared eslint, tsconfig, tailwind presets
  assets/                # art sources (Git LFS) + PROVENANCE.csv
  docs/
    architecture/        # this document, diagrams
    adr/                 # architecture decision records
    product/ game/ assessment/ money/ pipeline/   # specs 01–05
    data-model.md  api.md  test-strategy.md  runbooks/
```

### 3.1 Dependency rules (enforced by lint, e.g. dependency-cruiser)

- `engine` → `contracts` only.
- `content-sdk`, `telemetry-sdk` → `contracts` only.
- `game-kit`, `ui`, `i18n` → no app imports; no engine maths in UI.
- `apps/*` → any package; never another app.
- `pipeline` → `contracts`; never `apps` or `game-kit`.
- No package reads environment-specific config except through an injected config object.

## 4. Content delivery

- The pipeline publishes **immutable releases**: `releases/{releaseId}/` with bundle files (e.g. `core.json`, `colleges/{course}.json`, `countries/{code}.json`, `policy-weather.json`, `ai-exposure.json`, `bounds.json`) and a signed-hash `manifest.json`. `releases/current.json` points at the live release.
- Hosted in a public Supabase Storage bucket behind the CDN. Read-only. No personal data ever.
- `content-sdk`: fetch `current.json` → manifest → bundles needed by the screen; validate every bundle with the Zod schema; cache in Cache Storage/IndexedDB; serve offline; show "Content updated [date]". A family's saved plans pin the release they were built on; the report says which release.
- Release cadence: weekly; urgent hotfix releases for critical changes (e.g. an eligibility rule).

## 5. APIs (OpenAPI 3.1, generated from `packages/contracts`)

### 5.1 Content API (public, read-only; static files in the alpha)

| Path | Returns |
|---|---|
| `GET /content/v1/current` | Current release ID, date, manifest URL |
| `GET /content/v1/releases/{id}/manifest` | Bundle list with hashes and schema versions |
| `GET /content/v1/releases/{id}/core` | Clusters, careers, dossiers, routes, gates, cities, loan schemes, tax rules, quests, bounds |
| `GET /content/v1/releases/{id}/colleges/{courseCode}` | Institutions, programmes, fees, cutoffs, NIRF metrics for a course |
| `GET /content/v1/releases/{id}/countries/{code}` | Country module (costs, visas, post-study work, PR route, career fit, policy weather) |
| `GET /content/v1/releases/{id}/ai-exposure` | Two-lens exposure per career with method and dates |
| `GET /content/v1/coverage` | What is covered (for the share-link landing page) |

The same contract can later be served by a dynamic service (e.g. filtered queries) without client changes.

### 5.2 Telemetry API (Edge Functions; insert-only; consent-gated)

| Endpoint | Body | Notes |
|---|---|---|
| `POST /telemetry/v1/consent` | session ID, tier (1 or 2), notice version, teen assent (bool), timestamp | Creates the session record |
| `POST /telemetry/v1/events` | batch of events (schema per type) | Rejects unknown fields and PII-like keys; rate-limited |
| `POST /telemetry/v1/responses` | session ID, arm, 60 item values, area scores, flags | Tier 2 only |
| `POST /telemetry/v1/coverage-requests` | kind (career/course/city/country), free-text name (parent-entered, ≤ 60 chars) | Tier 1+ |
| `POST /telemetry/v1/feedback` | structured answers (01 §7.2) | Tier 1+ |
| `POST /telemetry/v1/deletion` | session ID + deletion code | Deletes all rows for the session within 7 days |

### 5.3 Review API (authenticated; Studio only)

`GET /review/v1/changes?status=pending` · `GET /review/v1/changes/{id}` (diff, extracted fact, quote, source snapshot) · `POST /review/v1/changes/{id}/approve|reject|edit` · `POST /review/v1/releases` (build and publish from approved facts) · `POST /review/v1/releases/{id}/rollback`. Implemented with Supabase (RLS + Edge Functions); roles: `owner`, `reviewer` (per stream), `viewer`.

## 6. Telemetry, consent and privacy (alpha)

### 6.1 Consent tiers (chosen by the Patron before the teen plays)

| Tier | Name in app | What is sent | Default |
|---|---|---|---|
| 0 | "Nothing leaves this phone" | Nothing. Full product works | Pre-selected |
| 1 | "Help improve Margwise" | Usage events (02 §10), errors, coverage requests, feedback | Opt-in |
| 2 | "Also help check the questionnaire for Indian students" | Tier 1 + item responses and area scores, A/B arm, parent-present flag | Opt-in |

- Plain-language notice (what, why, how long, who can see it, how to delete), notice version stored.
- **Teen assent:** after the Patron consents, the teen sees a short, friendly explanation and can say no to Tier 2.
- Deletion: a deletion code shown on screen and saved on the device; "Delete my data" in settings calls the deletion endpoint.
- Tier changes anytime in settings; downgrades stop sending immediately.

### 6.2 Data minimisation

- Identifier: random session ID generated on the device. No names, emails, phone numbers, schools, exact ages (class only), exact income (bands only), precise location (city tier only), or device fingerprints.
- No hover, dwell or cursor tracking; screen-level timings only.
- Edge Functions don't store IP addresses or full user agents; device class is derived on the phone. Platform-level logs may still record IPs; the privacy page says so.
- Retention: Tier 1 data deleted or aggregated 12 months after the alpha ends; Tier 2 research data kept up to 3 years for validation, then deleted. Stated in the notice.

### 6.3 Legal position

- A friends-and-family alpha with explicit parental consent, before the DPDP children's provisions apply (13 May 2027). Get a legal consult before the alpha starts and again before any public launch.
- Telemetry is built so that, by May 2027, minors' tracking can be switched off globally, or put behind verifiable parental consent, by configuration, with no code change.
- Data stays in Supabase's Mumbai region.

### 6.4 Enforcement

- `telemetry-sdk` sends nothing until a consent record exists; tested with a network spy in e2e.
- Event schemas are closed (unknown keys rejected client- and server-side); a test fails if any schema gains a field from a PII denylist.
- RLS: telemetry tables are insert-only through Edge Functions; reads only for `owner` via Studio aggregate views.

## 7. Data model (Postgres; summary — full DDL in migrations)

**`content` schema** (each fact row references a provenance record):
`clusters`, `careers`, `career_onet_map`, `dossier_sections`, `career_levels` (ladder), `routes`, `route_stages`, `gates` (route × subject combination → OPEN/BRIDGE/LOCKED, reason, source), `institutions`, `programmes` (institution × course × year: intake, status), `programme_fees` (year), `cutoffs` (programme × year × round × quota × category → opening/closing rank), `nirf_metrics` (institution × year × metric), `cities`, `city_costs`, `countries`, `country_costs`, `country_policies` (item, status: proposed/announced/in_force/suspended_or_blocked, dates, source), `career_country_fit`, `loan_schemes`, `tax_rules`, `ai_exposure` (career × lens × release), `quests`, `exam_calendar`, `provenance` (value, unit, as_of, valid_to, status sourced/assumption, confidence, source URL, quote, snapshot ID, reviewer, reviewed_at), `releases`, `release_items`.

**`pipeline` schema:** `sources` (mirrors the YAML registry), `fetch_runs`, `snapshots` (hash, storage path, fetched_at), `extractions` (fields, quotes, page refs, extractor version), `change_events` (entity, field, old, new, severity, detected_at), `review_tasks`, `review_decisions`.

**`telemetry` schema:** `consents`, `sessions`, `events`, `item_responses`, `coverage_requests`, `feedback`, `deletion_requests`.

Conventions: UUID primary keys; `created_at`/`updated_at`; foreign keys enforced; enums as Postgres enums or check constraints; no soft-delete for telemetry (real deletion); every migration reversible or explicitly marked.

## 8. Security

- CSP on both apps: `default-src 'self'` plus the Supabase project and storage origins only; no third-party scripts, fonts or analytics.
- Studio: Supabase Auth with email OTP plus MFA; roles enforced by RLS; the service-role key only in Edge Functions and pipeline secrets (GitHub Actions secrets).
- Input validation with Zod on every Edge Function; rate limiting per session and per IP hash (hash not stored).
- Dependency updates (Renovate or Dependabot), CodeQL scanning, secret scanning, branch protection with required checks.
- Headers: HSTS, `Referrer-Policy: no-referrer`, `Permissions-Policy` (no camera, mic or geolocation), `X-Content-Type-Options: nosniff`.
- Backups: the free tier has limited backups and can pause idle projects; move to a paid plan before any public launch (ADR).

## 9. Environments and delivery

| Env | Web/Studio | Supabase | Content |
|---|---|---|---|
| Local | `pnpm dev` | Supabase CLI (Docker) | Seed + fixture releases |
| Staging | Preview deploy per PR | Separate staging project | Releases built here first |
| Production | `margwise.byteheaven.in` (later margwise.in / .com) | Production project (Mumbai) | Promoted releases only |

- CI (GitHub Actions): typecheck, lint and boundaries, unit, property, golden, contract tests, data validation, e2e (Playwright on Pixel 7 and iPhone 14 profiles), Lighthouse budgets, axe, bundle-size check, migration dry-run.
- Static hosting for `apps/web` and `apps/studio` (Vercel or Cloudflare Pages; on Vercel use a plan whose terms fit commercial use before charging money). Decided in an ADR.
- DNS: Anu adds the CNAME records the builder provides.

## 10. Test strategy (summary; full version in `docs/test-strategy.md`)

| Layer | What | Tools |
|---|---|---|
| Engine | Unit, golden (spreadsheet-independent), property, instrument snapshot | Vitest, fast-check |
| Contracts | Schema round-trips; OpenAPI generated and diffed in CI | Vitest |
| Content | Every release validated before publish (schema, provenance, expiry, ranges, references) | pipeline validators |
| Pipeline | Fixture snapshots → expected change events; extractor accuracy on labelled samples; idempotent reruns | Vitest |
| SDKs | Offline, cache, version pinning, consent gating (network spy) | Vitest + MSW |
| Edge Functions | Schema rejection, PII denylist, rate limits, deletion | Deno/Vitest + local Supabase |
| UI/game | Visual regression on key scenes; reduced-motion; lite mode; accessibility | Playwright, axe |
| Performance | Frame-time sampling on throttled CPU; Lighthouse budgets; bundle size | Playwright + Chrome tracing, Lighthouse CI |
| E2E | Full journeys: game arm, plain arm, Tier 0/1/2, custom path, abroad plan, share, deletion | Playwright |

Golden values change only when Anu updates the spreadsheet; a CI check fails if a golden JSON changes without the spreadsheet changing.

## 11. Internationalisation

All strings in `packages/i18n` catalogues; Indian number formatting (lakh/crore) and currency formatting per country; layouts tolerate 30% longer strings; Devanagari-capable fonts selected now (self-hosted, subset).

## 12. Initial ADRs (write these in Phase 0)

| ADR | Decision |
|---|---|
| 001 | Monorepo with pnpm + Turborepo |
| 002 | Vite + React + PixiJS + Rive for the web app; no 3D in the alpha |
| 003 | Supabase in the Mumbai region for DB, storage, auth and edge functions |
| 004 | Content as immutable versioned releases on Storage/CDN; Content API as a static contract |
| 005 | Tiered consent; Tier 0 default; closed event schemas |
| 006 | IP-SF items verbatim; game delivery only; A/B against a plain arm |
| 007 | Human approval for every content change; no auto-publish |
| 008 | AI exposure as two published lenses, never one score |
| 009 | AI-generated art with provenance log and human finishing |
| 010 | Offline-first PWA |
| 011 | Static hosting choice and commercial-use terms |
| 012 | LLM use limited to offline extraction in the pipeline, with stored quotes |

## 13. Runbooks (create in `docs/runbooks/`)

Publish a content release · Roll back a release · Handle a deletion request · Rotate keys · Respond to a wrong-fact report · Pipeline job failing · Switch off minors' telemetry globally.
