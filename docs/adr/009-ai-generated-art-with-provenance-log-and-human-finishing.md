# ADR 009: AI-generated art with provenance log and human finishing

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

A ~35-rig, ~60-illustration art set is needed on a small budget (02 §8).

## Decision

Use AI image tools whose paid plan grants commercial use; record tool, plan, date, terms version and prompt summary for every asset in `assets/PROVENANCE.csv`; human cleanup and compositing on every final; brand marks human-made; no prompts naming living artists, studios, games, brands or real people.

## Consequences

Ownership of purely AI-generated images is uncertain; edited composites with provenance reduce risk.

## Alternatives considered

Commissioned illustration only (cost/time); stock art (inconsistent style).
