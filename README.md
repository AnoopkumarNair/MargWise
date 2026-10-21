# Margwise

A phone-first career and education game for Indian families with a Class
11–12 student. The teen plays _The Lantern Isles_, a story game that measures
interests with the O\*NET Interest Profiler; the family explores verified
dossiers on careers, colleges and study-abroad countries; the parent models
costs and returns to age 35; the family leaves with a roadmap and a report.

**Read first:** [`RULES.md`](RULES.md) (rules) · [`docs/`](docs) (specs,
ADRs, decisions, data model, test strategy, runbooks).

## Repository layout (04 §3)

```
apps/web            family PWA (Vite + React; PixiJS + Rive from Phase 6)
apps/studio         reviewer app (Phase 3)
packages/contracts  Zod schemas → TS types → OpenAPI 3.1 (packages/contracts/openapi)
packages/engine     assessment / money / compare — pure TS (Phase 2)
packages/content-sdk   verified, offline-capable release client
packages/telemetry-sdk consent-gated telemetry queue
packages/game-kit, ui, i18n, config
pipeline/           sources → snapshots → diffs → extraction → review (Phase 3)
services/supabase/  migrations, RLS, Edge Functions, DB tests
assets/             art sources (Git LFS) + PROVENANCE.csv
docs/               specs 00–05, ADRs, decisions, data model, runbooks
```

## Run

Requirements: Node 22.12+ (`.nvmrc`), pnpm 10 (`corepack enable`), Git LFS.
Optional: Supabase CLI + Docker for the local backend; Deno 2 for Edge Functions.

```sh
pnpm install
pnpm dev                     # web on :5173, studio on :5174
supabase --workdir services start   # local Supabase (Postgres, Auth, Storage, Functions)
```

## Test

```sh
pnpm check                   # typecheck, lint, boundaries, format, unit tests with coverage gates
pnpm test:db                 # migrations + RLS tests (needs DATABASE_URL or local Postgres binaries, non-root)
pnpm build && pnpm e2e       # Playwright on Pixel 7 and iPhone 14 profiles, axe
pnpm budget:bundle           # initial JS ≤ 200 KB gzip
```

CI (`.github/workflows/ci.yml`) runs all of the above plus the OpenAPI drift
check, a Deno check of the Edge Functions, Lighthouse budgets, CodeQL and a
secret scan.

## Deploy

Not yet. Hosting is ADR 011 (draft). Staging and production Supabase projects
are in the Mumbai region; see `docs/runbooks/` and the secrets list in
`docs/decisions.md`.
