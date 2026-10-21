# ADR 004: Content as immutable versioned releases on Storage/CDN; Content API as a static contract

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

Facts change (05 §1) and must be reviewed, dated and reproducible; families must work offline and saved plans must remain explainable.

## Decision

The pipeline publishes `releases/{releaseId}/` bundles plus a manifest with a SHA-256 per bundle; `releases/current.json` (the only mutable file) pins the live manifest by hash. `content-sdk` verifies hashes at each hop and validates every bundle with the Zod contract before caching. Saved plans pin their release. Release id format `YYYY-MM-DD.N`.

## Consequences

Simple, cacheable, offline-friendly. Open: manifest _signing_ (e.g. Ed25519) in addition to hashes — see decisions D-010.

## Alternatives considered

Dynamic API over the content tables (more moving parts, no immutability); facts shipped in the app bundle (rejected by 01 §8 #3).
