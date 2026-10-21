# The story that joins the stops

Status: DRAFT for Anu's review (D-054). Wording is in `packages/engine/src/journey/data/scenes-v0.json`
(`story`, and `setup` / `lit` on each scene). This page explains the idea.

## The problem it solves

The first prototype had fifteen separate little problems (a ferry, a bridge, a clock...). Each was fine
alone, but nothing carried from one to the next, so it felt like a quiz with pictures.

## The story

Once a year every lamp on the old road is lit, and the lighthouse at its end shines out to sea so that
anyone far from home can find the way back. This year the lamplighter has gone. The towns have been
waiting. Jyo, a firefly who remembers every lamp, has found the traveller (the player), who carries the
lantern and two flasks of oil.

At each town the lamp is dark for a reason. The traveller helps in the way they would most gladly spend an
evening (the four options), the lamp catches, and the walk moves on. When enough lamps burn, the lighthouse
shines and shows the doors that open (the result). The old lamplighter's note at the end says "A lamp burns
best for hands that like the work", which is also the honest message of the whole game: liking the work
matters.

## How it stays honest to the measurement

- Stops are visited in an adaptive order, so every setup stands alone: it names an occasion and its stake in the
  festival ("the ferry has docked late with the festival's lamp oil"), never a fault that only one option fixes,
  and never where in the walk it sits (no "first", "last", "next": tested).
- Jyo's connecting lines (`threads`, several per phase) are chosen only by how many lamps are lit: first, early,
  middle, late, or a return visit (which also gets its own setup and closing line in the page). They never react to what was chosen (rule 4). The line after lighting (`lit`) describes
  the town, not the choice, and is the same for every option.
- Options and loadings are unchanged from journey-v0, so the 15-stop design (every 4-subset of the six areas)
  and all simulation tests hold. No text names an area, the source instrument or "assessment" (tested).
- The only person the game ever calls "right" is nobody: every lamp catches whatever was chosen.

## What the story needs from the art

Each background shows its town with the dark lamp post in view, no characters, calm space in the lower
half where the four option objects sit. Objects are small self-contained vignettes of the option, equal in
weight inside a stop. Jyo and the traveller are separate sprites. See `docs/art/asset-list.csv`, built from
the bank by `scripts/art/build_asset_list.py`.

## Open

- Expert review of the wording and of every option (still required; nothing here is validated).
- Hindi and other languages: names, the story frame and each option need native review, and each translated
  option needs its own measurement check.
