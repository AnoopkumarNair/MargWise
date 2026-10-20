# ADR 003: Supabase in the Mumbai region for database, storage, auth and Edge Functions

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

The alpha needs Postgres, file storage for release bundles and snapshots, reviewer auth with MFA, and small server functions, with data kept in India (04 §6.3).

## Decision

Two Supabase projects in ap-south-1 (Mumbai): `margwise-staging` and `margwise-prod`. Schemas `content`, `pipeline`, `telemetry` (+ `private` for helpers). RLS deny-by-default on every table. Service-role key only in Edge Functions and GitHub Actions secrets.

## Consequences

Boring Postgres with migrations as the only way to change the DB. Free tier pauses idle projects and has limited backups: move to a paid plan before any public launch (04 §8).

## Alternatives considered

Self-hosted Postgres + custom API (more ops); Firebase (no Postgres/RLS, region constraints).
