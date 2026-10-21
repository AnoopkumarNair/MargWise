# ADR 005: Tiered consent; Tier 0 default; closed event schemas

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

Minors' data; DPDP children's provisions from 13 May 2027; the product must work fully with no telemetry (04 §6).

## Decision

Tier 0 (nothing leaves the phone) pre-selected; Tier 1 usage; Tier 2 adds item responses. Tier 2 requires teen assent. `telemetry-sdk` queues and sends nothing below the required tier or when the global minors switch is off; consent is recorded server-side before any event. All payloads are `strictObject` Zod schemas; a test fails if any schema gains a PII-denylisted key; the server deep-scans bodies for PII keys. Deletion by session id + code (hash stored).

## Consequences

Strong privacy posture with test evidence (network spy, schema meta-tests, RLS tests). Less data for research; accepted.

## Alternatives considered

Opt-out analytics (rejected by rule 6); third-party analytics (rejected by CSP, 04 §8).
