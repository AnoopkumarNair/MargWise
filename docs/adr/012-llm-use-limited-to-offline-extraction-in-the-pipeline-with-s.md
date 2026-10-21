# ADR 012: LLM use limited to offline extraction in the pipeline, with stored quotes

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

LLMs help with prose and irregular PDFs but can hallucinate (05 §6).

## Decision

No LLM at runtime for families. In the pipeline the model sees only the fetched snapshot and a strict output schema, must return every value with a verbatim quote and locator, and results whose quote does not string-match the snapshot are rejected. Calls only on changed snapshots, with a monthly spend cap and alert.

## Consequences

Higher reviewer load for prose sources; acceptable.

## Alternatives considered

Runtime chat (out of scope, 01 §6); LLM without quote verification (rejected).
