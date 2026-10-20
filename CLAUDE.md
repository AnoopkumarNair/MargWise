# Margwise — rules for anyone (human or agent) changing this repo

Margwise is a phone-first career and education game for Indian families with a
Class 11–12 student. Specs live in `docs/` (01 product, 02 game, 03 engines,
04 architecture, 05 pipeline). The more specific document wins; log conflicts
in `docs/decisions.md`.

## Non-negotiable rules

1. **Facts are data, never code.** No fee, rate, rule, salary, date or policy
   appears in source code. Facts flow source → pipeline → human review →
   versioned release → Content API → app. Test fixtures use arbitrary values
   and say so.
2. **Never invent a number.** Every fact is `sourced` (an official source that
   was opened, with a stored verbatim quote and snapshot) or `assumption`
   (with a written rationale). Forbidden sources: LinkedIn, Glassdoor,
   AmbitionBox, Naukri, Reddit, Quora, job-portal salary pages,
   coaching-institute marketing pages, cached AI search answers.
3. **O\*NET items verbatim**: 60 items, 10 per area, official anchors scored
   0–4, official order. Career interest vectors only from the O\*NET Interests
   file. The game changes delivery, never wording, unless Anu approves an A/B
   wording arm.
4. **Measurement integrity** (02 §4): no contingent feedback, no area hints, no
   rewards for answers, undo and back always available.
5. **Teen-facing results** show bands, explanations and the interest code only.
   Never "validated", "accurate", "scientific" or "proven".
6. **Consent before any byte leaves the phone** (04 §6). Tier 0 is the default
   and the product works fully with it. No hover, dwell or cursor tracking. No
   names, contacts, schools or exact incomes. Closed event schemas.
7. **Engine purity and boundaries** (04 §3.1), enforced by
   `.dependency-cruiser.cjs` and ESLint. The UI does no maths.
8. **Golden values are sacred.** Never edit an expected value to make a test
   pass. If a golden case looks wrong, stop and tell Anu.
9. **No dark patterns**: no timers, streak nagging, guilt copy or hidden costs.
10. **Every database change is a migration**; RLS is deny-by-default; service
    keys never reach the client.
11. **Art provenance**: every shipped asset has a row in
    `assets/PROVENANCE.csv`; no prompts naming living artists, studios, games,
    brands or real people.
12. Pin exact versions of current stable packages; no betas. Every open choice
    gets a line in `docs/decisions.md`; anything hard to reverse gets an ADR and
    Anu's approval.

## How we work

- **Test first.** Write the failing test, then the code. A change without a
  test that would have caught its absence is not done.
- **Prove tests can fail.** Checks that guard rules (PII denylist, closed
  schemas, RLS, boundaries, network spy) each have a meta-test or mutation
  showing they reject a planted violation.
- **Coverage gates** in `vitest.config.ts` are floors: raise them, never lower
  them.
- One branch and one PR per phase; stop at every **STOP** in
  `docs/00_Build_Prompt.md` until Anu replies "go".
- Imports use explicit `.ts` extensions so the same files run in Vite, Vitest,
  Node and Deno (Edge Functions).

## Commands

| What                                   | Command                                          |
| -------------------------------------- | ------------------------------------------------ |
| Everything CI runs locally (fast part) | `pnpm check`                                     |
| Unit/property/contract tests           | `pnpm test` (`pnpm test:coverage` for gates)     |
| Boundary lint / proof it has teeth     | `pnpm lint:boundaries` / `pnpm prove:boundaries` |
| DB migrations + RLS tests              | `DATABASE_URL=… pnpm test:db`                    |
| OpenAPI regenerate / drift check       | `pnpm openapi:generate` / `pnpm openapi:check`   |
| E2E (Pixel 7, iPhone 14)               | `pnpm build && pnpm e2e`                         |
| Initial-JS budget                      | `pnpm build && pnpm budget:bundle`               |
