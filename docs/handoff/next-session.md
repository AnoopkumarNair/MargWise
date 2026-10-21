# Hand-off: continue in a new session

Written 2026-10-21. A new session is needed because the network allowlist only applies to
sessions that start after it was changed.

## Where things are

- PR #1 (Phase 0+1) is on branch `ccr-5552f257-slyh18`, CI green on its last head. Commit
  authorship was rewritten to Anu's identity and the description footer removed (D-046).
- Phase 2 and the journey work are on branch `phase-2-journey` (no PR; Anu said hold). Its LFS
  file `docs/golden/golden-cases.xlsx` is NOT on the remote because the LFS host is blocked from
  these sessions. Regenerate with `scripts/golden/build_golden.py` and recalc (it may differ in
  bytes; the JSON export records the workbook hash). The pushed history omits that file.
- Engine: `packages/engine/src/journey/` (two-flask allocation model, adaptive stop, return-visit
  consistency check, confidence labels, stated-path comparison). 651 tests, coverage floors met.
  Design: `docs/journey/design.md`. Decisions D-047 to D-053.
- Prototype: private artifact "Lamplighter's Road" (source in `prototypes/lamplighter/`). Vector
  placeholder art; sound and read-aloud are in.

## Decisions Anu has made

Cloudflare Pages; subject-based gates; CBSE + CISCE; manifest signing; maximum telemetry within the
rules; game-native instrument with the 60 verbatim items kept as optional deep check and as the
calibration yardstick; journey as a lamp road; guide named Jyo; audio in scope (must match the
app); art via connectors (Canva or Hugging Face) once the hosts are reachable.

## Do first in the new session

1. Check the download works: `curl -I https://export-download.canva.com/` (and
   `https://www.onetcenter.org`). If refused, ask Anu to add the hosts under Network, Allowed
   domains, then start another session.
2. Art: read `docs/art/art-direction.md` and `docs/art/asset-list.csv` (77 assets). Generate with
   Canva `generate-image` (pass earlier images as references for consistency), export via a
   design (`generate-design` with `asset_ids`, `create-design-from-candidate`, `export-design`),
   download, remove backgrounds for the objects. Start with ONE style-reference scene and the two
   characters (Jyo, the traveller) and show Anu before doing the rest. Record every asset in
   `assets/PROVENANCE.csv`. Delete test designs left in Canva ("Illuminated Harbour at Dusk").
3. Rebuild the game screen: full-screen scene, the four options as tappable objects inside the
   scene, each with an idle motion and the same "lights up" reaction, option text as a tag on the
   object. Keep one screen, no scrolling, no per-option feedback.
4. Keep the sound identity (D-051). Add Hindi and other-language voice and names later, with
   native review; every translation of an option needs its own measurement check.
5. Then: grow the stop bank (about 30), plan the calibration study, expert review of all 60
   activities.

## Still waiting on Anu

Approve D-052 (art route and licence) and D-053 (broad-profile display); D-042 and D-043
(money conventions); D-049 (the "shared areas" explanation quirk); migrations 010 to 012 on
staging; ADRs 001 to 010 and 012; the golden workbook; the licence question (D-031); registering
for O*NET Web Services; allowing `www.onetcenter.org` so the exact interest values replace the
rounded seed.

## Prompt to paste into the new session

"Continue Margwise from docs/handoff/next-session.md on branch phase-2-journey. Start with step 1
(check the network), then generate the style reference scene and the two characters and show me
before generating the rest."

## How to start a new session

Open the Claude app or claude.ai/code, start a new session on the repository
AnoopkumarNair/MargWise, choose the branch `phase-2-journey`, and paste the prompt above.
