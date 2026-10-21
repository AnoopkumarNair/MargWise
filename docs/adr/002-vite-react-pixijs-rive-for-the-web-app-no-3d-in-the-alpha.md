# ADR 002: Vite + React + PixiJS + Rive for the web app; no 3D in the alpha

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

The game needs smooth 2D on mid-range Android phones (02 §9) while all text, inputs, dossiers and reports must be accessible and translatable.

## Decision

Vite + React for the DOM; PixiJS (WebGL 2D) for scenes; Rive runtime for character animation; SVG for charts. Every game action has a DOM equivalent. No 3D.

## Consequences

Fits the 200 KB initial-JS budget with lazy game chunks. Two rendering worlds to keep in sync; game-kit owns the PixiJS side.

## Alternatives considered

Phaser (heavier, owns the page); Unity/Godot web exports (large downloads, poor accessibility); pure DOM/CSS animation (insufficient for parallax and particles).
