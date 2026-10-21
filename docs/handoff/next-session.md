# Hand-off: continue in a new session

Written 2026-10-21. A new session is needed because the network allowlist only applies to
sessions that start after it was changed.

## Where things are

- PR #1 (Phase 0+1) is on branch `ccr-5552f257-slyh18`, CI green on its last head. Commit
  authorship was rewritten to Anu's identity and the description footer removed (D-046).
- Phase 2 and the journey work were on branch `phase-2-journey` (no PR; Anu said hold). The newest work (story rewrite, rebuilt prototype) is on `claude/margwise-phase-2-journey-akgt4w`, which contains all of `phase-2-journey`; continue from that branch. Its LFS
  file `docs/golden/golden-cases.xlsx` is NOT on the remote because the LFS host is blocked from
  these sessions. Regenerate with `scripts/golden/build_golden.py` and recalc (it may differ in
  bytes; the JSON export records the workbook hash). The pushed history omits that file.
- Engine: `packages/engine/src/journey/` (two-flask allocation model, adaptive stop, return-visit
  consistency check, confidence labels, stated-path comparison). engine tests pass (208 in packages/engine on 2026-10-21); coverage floors last checked before the journey work.
  Design: `docs/journey/design.md`. Decisions D-047 to D-053.
- Prototype: private artifact (same link as before, now titled "The Night of Lamps"; source in
  `prototypes/lamplighter/`). Placeholder painted art; sound and read-aloud are in.

## Decisions Anu has made

Cloudflare Pages; subject-based gates; CBSE + CISCE; manifest signing; maximum telemetry within the
rules; game-native instrument with the 60 verbatim items kept as optional deep check and as the
calibration yardstick; journey as a lamp road; guide named Jyo; audio in scope (must match the
app); art via connectors (Canva or Hugging Face) once the hosts are reachable.

## Session 2026-10-21 (second) result

- Story rewritten (D-054, `docs/journey/story.md`): one mission, "The Night of Lamps". Bank is journey-v1-draft.
- Prototype rebuilt: full-screen scene, options as swaying objects in a 2x2 grid, story threaded through, new
  audio with no noise source (measured, D-055). Build and check scripts are in `prototypes/lamplighter/`.
- Art is NOT done. Style scene, Jyo and traveller approved by Anu to proceed; Canva then stopped at its credit
  quota after 7 of 83 assets (ids in `docs/art/canva-ids.csv`). Full-size export still needs
  `export-download.canva.com` (allowed by Anu, but only takes effect in a session started after the change;
  this session was started before it took effect). Hugging Face generation is disabled for that connector.

## Do first in the new session

0. Free art route (Anu has no budget for paid image APIs): Cloudflare Workers AI. Anu has added the account id and
   token as environment variables; `api.cloudflare.com` must also be on Allowed domains. Check
   `env | grep -i cloudflare | sed 's/=.*//'` and `curl -sI https://api.cloudflare.com/client/v4/`, then run
   `node scripts/art/generate_workers_ai.mjs --only bg-s01,obj-s01-R` as a first test (script is untested), compare with
   the Canva style scene and characters, check the model's licence before anything ships (D-052), then run it for all
   rows. FLUX.1 schnell is text-only; FLUX.2 klein 4B accepts reference images for consistency (not wired in yet).

1. `curl -I https://export-download.canva.com/` should now answer. If Canva credits are back, resume
   generation of the rows missing from `docs/art/canva-ids.csv`, one or two calls at a time (bursts get
   refused). Use `docs/art/asset-list.csv` (83 rows, built from the bank).
2. Export through a design (`generate-design` with `asset_ids`, `create-design-from-candidate`,
   `export-design`), download, remove backgrounds for the objects, downscale, write
   `prototypes/lamplighter/art.json`, rebuild, run `smoke.mjs`, republish the artifact.
3. Record every asset in `assets/PROVENANCE.csv` after the licence check (D-052). Delete test designs in Canva.
4. Add Hindi and other-language voice and names later, with native review; each translated option needs its
   own measurement check.
5. Then: grow the stop bank (about 30), plan the calibration study, expert review of all 60 activities.

## Still waiting on Anu

Approve D-052 (art route and licence) and D-053 (broad-profile display); D-042 and D-043
(money conventions); D-049 (the "shared areas" explanation quirk); migrations 010 to 012 on
staging; ADRs 001 to 010 and 012; the golden workbook; the licence question (D-031); registering
for O*NET Web Services; allowing `www.onetcenter.org` so the exact interest values replace the
rounded seed.

## Prompt to paste into the new session

"Continue Margwise from docs/handoff/next-session.md on branch claude/margwise-phase-2-journey-akgt4w.
Check the Canva download host, then resume the art generation from docs/art/canva-ids.csv and finish the
export and placement."

## How to start a new session

Open the Claude app or claude.ai/code, start a new session on the repository
AnoopkumarNair/MargWise, choose the branch `claude/margwise-phase-2-journey-akgt4w`, and paste the prompt above.
