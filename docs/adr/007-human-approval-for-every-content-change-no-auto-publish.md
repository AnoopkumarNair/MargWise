# ADR 007: Human approval for every content change; no auto-publish

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

LLM-assisted extraction and scrapers can be wrong; families act on these facts.

## Decision

Every change event becomes a review task; only approved/edited facts enter a release; the release builder runs the validation gate (05 §9) and a human publishes. The DB enforces that LLM extractions are at most medium confidence and that edit/reject decisions carry a note.

## Consequences

Slower updates (target times per severity, 05 §8). Accepted for trust.

## Alternatives considered

Auto-publish parser-confidence changes (rejected for the alpha).
