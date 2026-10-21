# Art direction for the Lamplighter's Road

Status: DRAFT. Nothing here is shipped art; it is the brief for generating and reviewing it.

## Goal

A game that looks illustrated and alive, not drawn with basic shapes: full-screen scenes, four
tappable objects or characters inside each scene (the answer options), each with an idle motion
and a short "it lights up" reaction when oil is spent. Option text appears as a small tag on the
object.

## Look

Painterly storybook illustration at dusk. Deep indigo and warm amber palette, soft rim light,
textured brushwork, real depth (foreground, middle, far). Characters are gender-neutral young
teens and adults in plain, regionally neutral clothing. One consistent firefly guide (Jugnu) and
one apprentice traveller, shown in three poses each.

## Rules (RULES.md 4, 5, 9, 11)

- Every asset has a row in `assets/PROVENANCE.csv` (tool, date, full prompt, licence, reviewer).
- Prompts never name living artists, studios, games, brands or real people.
- No object may hint at an area (no "builder's hammer" badge, no category colours). Objects in one
  stop have equal visual weight and appeal.
- No text inside images; labels are live text so they can be translated.
- Reactions are identical for every object (same glow, same sparks), so nothing signals a right
  answer.
- Reduced-motion users get stills.

## Pipeline

1. Generate 15 backgrounds and 60 object vignettes from `asset-list.csv` (plus Jugnu and the
   traveller), reusing the first approved background and character images as references so the
   style stays consistent.
2. Remove backgrounds from object vignettes (transparent PNG/WebP), downscale to phone sizes,
   compress.
3. Human review of every image: style consistency, no area hints, no cultural problems, equal
   appeal inside a stop.
4. Record provenance, then ship through the asset pipeline (Git LFS under `assets/`).

## Open (needs Anu)

- Which generator is licensed for commercial use. FLUX.1 [dev] variants are non-commercial and
  must not ship. Canva's generated images need a licence check against its current terms.
- Whether to commission a human illustrator for the final set and use generated images only as
  the working prototype.
