# Test strategy

Summary in 04 §10. Principles:

1. **Test first.** Each behaviour lands with the test that specifies it.
2. **Tests that guard rules must be able to fail.** Each guard has a meta-test
   or a mutation check:
   | Guard                    | Proof it has teeth                                                                                                                         |
   | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
   | Boundary lint            | `pnpm prove:boundaries` plants `engine → apps/web`, expects failure (runs in CI)                                                           |
   | Closed telemetry schemas | meta-test: the checker flags a nested `z.object`                                                                                           |
   | PII denylist             | positive and negative key tables; JSON-Schema walker test                                                                                  |
   | Network spy at Tier 0    | control test shows the same spy records calls at Tier 1                                                                                    |
   | RLS / constraints (SQL)  | meta-tests: helpers raise on a permitted read, a succeeding statement and a wrong count; manual mutation (planted leaky policy) was caught |
   | Golden values            | CI fails if `docs/golden/*.json` changes without the spreadsheet                                                                           |
3. **Coverage floors** in `vitest.config.ts` (D-020) fail CI; raise only.
4. **No real facts in fixtures.** Fixture values are arbitrary and labelled.

## Layers and where they live

| Layer                                                | Location                                             | Runner                                |
| ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| Contracts (schemas, invariants, OpenAPI)             | `packages/contracts/src/**/*.test.ts`                | Vitest                                |
| Engines: unit, golden, property, instrument snapshot | `packages/engine` (Phase 2)                          | Vitest + fast-check                   |
| SDKs (offline, cache, pinning, consent gating)       | `packages/*-sdk/src/*.test.ts`                       | Vitest                                |
| Edge Function handlers                               | `services/supabase/functions/_lib/*.test.ts`         | Vitest; `deno check` on entrypoints   |
| Migrations, RLS, constraints, deletion               | `services/supabase/tests/sql/*.test.sql`             | psql on Postgres 17 (CI)              |
| UI components                                        | `apps/*/src/**/*.test.tsx`                           | Vitest + Testing Library (jsdom)      |
| E2E, accessibility                                   | `apps/*/e2e/*.spec.ts`                               | Playwright (Pixel 7, iPhone 14) + axe |
| Performance budgets                                  | `scripts/check-bundle-size.mjs`, `lighthouserc.json` | CI                                    |

## Not yet covered (planned)

- Engines and golden cases (Phase 2, STOP 2).
- Pipeline fixture snapshots → change events, extractor accuracy (Phase 3).
- Edge Functions against a running local Supabase (Phase 3/8).
- Visual regression, frame-time sampling, reduced-motion and lite-mode (Phase 6).
- Full e2e journeys per tier and arm (Phase 8–9).
