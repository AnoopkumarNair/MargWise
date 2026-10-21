# ADR 001: Monorepo with pnpm workspaces and Turborepo

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

Margwise has two apps, an offline pipeline, Edge Functions and shared packages (contracts, engines, SDKs) that must evolve together under typed contracts (04 §3).

## Decision

One repository, pnpm workspaces, Turborepo for task orchestration, TypeScript project references with strict mode. Boundaries enforced by dependency-cruiser (`.dependency-cruiser.cjs`) and ESLint; `pnpm prove:boundaries` plants a forbidden import in CI to show the lint fails. Packages export TypeScript source with explicit `.ts` import extensions so the same files run in Vite, Vitest, Node and Deno.

## Consequences

Atomic changes across contract and consumers; one CI. Cost: one lockfile and slower installs as the repo grows; Turborepo caching mitigates.

## Alternatives considered

Polyrepo (contracts drift; versioning overhead); Nx (more machinery than needed).
