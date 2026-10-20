# ADR 010: Offline-first PWA

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

Families may have patchy mobile data; the game, engines and current release must work offline after first load (04 §1, 02 §9.2).

## Decision

Service worker precaches the shell and played scenes; content-sdk caches verified bundles (IndexedDB/Cache Storage) and falls back to them offline; telemetry queues durably and retries with backoff.

## Consequences

Cache-invalidation complexity; mitigated by immutable releases.

## Alternatives considered

Online-only SPA.
