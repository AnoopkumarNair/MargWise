"""Builds docs/art/asset-list.csv from the journey bank (story v1) so art always matches the text.

python3 -I scripts/art/build_asset_list.py
"""
import csv, json, pathlib

root = pathlib.Path(__file__).resolve().parents[2]
bank = json.loads((root / "packages/engine/src/journey/data/scenes-v0.json").read_text())

STYLE = ("painterly storybook illustration, dusk lighting, deep indigo and warm amber palette, "
         "soft rim light, rich textured brushwork, cinematic depth, no text, no logos, no real people")

# What each background shows. No people close up, no objects that hint at an interest area.
VIEW = {
 "s01": "a quiet harbour at dusk, a small ferry stopped beside a stone quay, crates of lamp oil stacked on the water's edge, a dark lamp post on the quay",
 "s02": "an old stone arch bridge over a dark stream with a visible crack across its middle, a dark lamp at one end, distant hills",
 "s03": "a narrow cobbled lane with leaning houses and a tall stopped clock tower, a dark lamp hanging from a bracket",
 "s04": "an orchard village among apple trees at dusk, heaps of apples and wooden crates piling beside a barn, a dark lamp on a post",
 "s05": "a mountain pass swallowed in drifting fog, the winding road barely visible, a dark lamp standing at the roadside",
 "s06": "a night bazaar square with strings of unlit paper lanterns, rows of empty and busy stalls, one bare stall in the foreground, a dark lamp",
 "s07": "a wide slow river at dusk with a gravel bank and a small camp, bedrolls and a cold fire pit, a dark lamp on a pole, far bank in mist",
 "s08": "a weavers' town street with hanging dyed cloth, a large wooden loom visible through an open workshop door, a dark lamp above the door",
 "s09": "tall glassy cliffs at dusk catching the last light, a zigzag path to the top, a dark lamp at the foot of the path",
 "s10": "a salt market with barrels, sacks and a cart, a spilled heap of oil jars in the middle of the square, a dark lamp post",
 "s11": "a grassy hill under a clearing sky with the first stars, a small round observatory dome, a path winding up, a dark lamp at the top",
 "s12": "an overgrown walled herb garden in the evening, tangled beds, a stone path, a dark lamp on a post among the leaves",
 "s13": "a quarter of old printers' workshops with ink-stained shutters, a cellar door standing open with a hint of an old press inside, a dark lamp",
 "s14": "a long low healing house with many lit windows and a quiet courtyard, a covered well, a dark lamp by the door",
 "s15": "a wide festival square at dusk, bare cobbles, bunting waiting to be hung, a ring of dark lamp posts, the road leading in",
}
EXTRA = [
 ("bg-welcome", "background", "Welcome: the dark road", f"{STYLE}; wide portrait scene of a winding road across hills at night, a line of dark lamp posts leading to a far lighthouse that is unlit, a single warm lantern glow in the foreground, stars. Open space in the lower third."),
 ("bg-lighthouse", "background", "Reveal: the lighthouse lit", f"{STYLE}; wide portrait scene of the lighthouse at the end of the road blazing with golden light over a dark sea, a line of lit lamps along the road behind it, stars, soft beam sweeping across the water."),
]
CHAR = [
 ("char-jyo-hover", "character", "Jyo hovering", "Jyo, a friendly glowing amber firefly guide with translucent wings and big kind eyes, hovering, plain dark indigo background, full body, centred"),
 ("char-jyo-point", "character", "Jyo pointing the way", "Jyo, a friendly glowing amber firefly guide with translucent wings and big kind eyes, flying forward with one leg pointing ahead, plain dark indigo background, full body, centred"),
 ("char-jyo-cheer", "character", "Jyo delighted", "Jyo, a friendly glowing amber firefly guide with translucent wings and big kind eyes, glowing extra bright with joy, plain dark indigo background, full body, centred"),
 ("char-trav-stand", "character", "Traveller standing", "the apprentice lamplighter, a gender-neutral young teen in a plain cloak with a satchel holding an unlit lantern, standing and looking ahead, plain dark indigo background, full body, centred"),
 ("char-trav-walk", "character", "Traveller walking", "the apprentice lamplighter, a gender-neutral young teen in a plain cloak with a satchel holding a lit lantern, mid-stride walking, plain dark indigo background, full body, centred"),
 ("char-trav-lighting", "character", "Traveller lighting a lamp", "the apprentice lamplighter, a gender-neutral young teen in a plain cloak reaching up with a long taper to light a lamp, plain dark indigo background, full body, centred"),
]
rows = []
for sc in bank["scenes"]:
    sid = sc["id"]
    rows.append((f"bg-{sid}", "background", sc["place"],
        f"{STYLE}; wide portrait scene of {sc['place']}: {VIEW[sid]}. Open calm space in the lower third. No characters."))
    for o in sc["options"]:
        area = o["id"].split("-")[1]
        rows.append((f"obj-{sid}-{area}", "object", o["text"],
            f"{STYLE}; a single self-contained illustrated vignette on a plain flat dark indigo background showing the idea: {o['text']}. Warm lantern glow, one clear focal object or small scene, centred, equal visual weight and appeal as its three alternatives, no people's faces, 3:4."))
for pre, kind, subj, prompt in EXTRA + CHAR:
    rows.append((pre, kind, subj, prompt if prompt.startswith(STYLE) else f"{STYLE}, same style as the reference image; {prompt}"))
with open(root / "docs/art/asset-list.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["asset_id", "kind", "subject", "prompt"]); w.writerows(rows)
print(len(rows), "assets")
