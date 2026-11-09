# Prompts quick list

One checklist of every outside asset for the student game, in production order, for a phone. Each prompt or line is in its own box: tap and copy the whole box. The detailed reference is `docs/VIDEO_PRODUCTION_PACK.md` (clips, ffmpeg steps, checks) and `docs/VOICE_SCRIPT.md` (voice and sound). If this list and those differ, fix this list.

**Counts.** 45 assets, 3 optional future voice lines.
- Flow clips: 4 opening + 1 ending + 1 cover loop + 15 towns + 7 trailer = 28 clips, which become 22 video files in `app/video/`.
- Voice and sound: 17 files in `app/audio/` (12 spoken lines and 5 sound beds), made on the local voice model.
- Optional future voice: 3 lines, not played by the game yet.

**Before you start.**
- Every Flow clip is 9:16. Crop the stills first (the crop table is in section 7 of the pack). Never let Flow crop.
- Never upload `app/art/bg-lighthouse.jpg` (third-party watermark "@ ZALAKS"). The ending uses words only.
- No text, logos, close faces or watermarks in any picture. The student is always seen from behind. The lamplighter is never shown.
- Make 2 to 4 takes of each. Use the Fast model to test and the Quality model for finals.
- Do not use any real person's voice or likeness as a reference.
- The game works without every one of these files. Stop at any point.

**Production order.** A opening video, B opening voice, C ending and cover, D towns (Orchard Village first because every student starts there), E trailer, F optional.

## A. Opening video (4 clips)

### 1. Opening shot 1: The road everyone has ready
- [ ] Done
- **File:** `app/video/opening_1.mp4` (raw: `~/flow/raw/opening_1.mp4`)
- **Tool:** Google Flow (Frames to video)
- **Upload:** `app/art/bg-intro1.jpg` as the start frame (crop first: section 7 of the pack)
- **Settings:** 9:16. Generate 8 s, trim to 0 to 6.0 s, export with no audio (`-an`).
- **Matching art:** `bg-intro1.jpg`; no text in the picture, the game adds captions

```
Vertical 9:16, painterly illustration come to life. A wide view from a hillside down over a lamp-lit Indian river town at dusk turning to night. Stone ghat steps, tiled and flat roofs, a small temple spire, an arched stone bridge, hundreds of warm lamps and floating diyas on the river, a few sky lanterns drifting slowly upward. Foreground: a stone wall with small oil-lamp flames and white flowers, the flames flickering gently. Camera: a very slow pan to the right with a slight push in, one smooth move, 35 mm lens feel, deep depth. Light: warm amber lamp glow (#f2a03d, #ffcf6b) against deep indigo sky (#141a3a to #2b2f63), cream highlights on the water. Mood: quiet, a little heavy, expectant. Calm and steady, no sudden motion. Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, close-up faces, cartoon style, squash and stretch, castles, fantasy creatures, flicker, warping.
```

### 2. Opening shot 2: The lighthouse goes dark
- [ ] Done
- **File:** `app/video/opening_2.mp4` (raw: `~/flow/raw/opening_2.mp4`)
- **Tool:** Google Flow (Frames to video)
- **Upload:** `app/art/bg-intro2.jpg` as the start frame
- **Settings:** 9:16. Generate 8 s, trim to 0 to 3.7 s, export with no audio (`-an`).
- **Matching art:** `bg-intro2.jpg`; no text in the picture, the game adds captions

```
Vertical 9:16, painterly illustration come to life. A stone lighthouse on a sea cliff at dusk, ivy climbing one side, an arched wooden door at its foot, a brass lantern glowing beside the door, a stone path and a rope fence, a calm sea and a faint line of town lights far away. The glow in the lantern room at the top fades slowly until the tower is dark. The old wooden door moves a little in the wind and stands slightly open, with a faint warm dark inside and a row of glass oil flasks catching a little light on a shelf. A small paper on the door stays a soft blur, nothing readable. No person anywhere. Camera: a slow push in toward the door, 35 mm lens feel. Light: last orange in the sky, deep indigo night above, one small lantern flame. Mood: quiet, puzzled, a little lonely. Avoid: any text, letters, numbers, logos, watermarks, people, faces, crowds, cartoon style, castles, flicker, warping.
```

### 3. Opening shot 3: Jyo arrives
- [ ] Done
- **File:** `app/video/opening_3.mp4` (raw: `~/flow/raw/opening_3.mp4`)
- **Tool:** Google Flow (Frames to video)
- **Upload:** `app/art/bg-intro3.jpg` as an ingredient (student from behind and Jyo). Optional second: `bg-intro1.jpg`
- **Settings:** 9:16. Generate 8 s, trim to 0 to 7.2 s, export with no audio (`-an`).
- **Matching art:** `bg-intro3.jpg`; no text in the picture, the game adds captions

```
Vertical 9:16, painterly illustration come to life. Over-the-shoulder view from behind a teenage student with short dark hair, a dark hooded jacket and an olive backpack, sitting on a rock on a hillside at night, looking out over a river valley full of warm lamps and floating lanterns. A tiny firefly made of warm golden light drifts in from the right, soft translucent wings beating gently, two thin antennae with glowing tips, a bright gold glow at its body. It is small, graceful and real in feel, not a cartoon mascot, no smile, no large eyes. It slows and hovers beside the student's shoulder. The student's face is never shown. Camera: slow push in, 50 mm lens feel, shallow depth of field, the valley lights soft behind. Light: deep indigo starry sky (#141a3a), amber lamp glow (#f2a03d), the firefly in warm gold (#ffcf6b), cream highlights (#fff3d6). Mood: curious, gentle, a small spark of hope. Calm motion only. Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, close-up faces, cartoon style, squash and stretch, castles, fantasy creatures, flicker, warping hands.
```

### 4. Opening shot 4: Two flasks and a lantern
- [ ] Done
- **File:** `app/video/opening_4.mp4` (raw: `~/flow/raw/opening_4.mp4`)
- **Tool:** Google Flow (Frames to video)
- **Upload:** `app/art/bg-intro4.jpg` as the start frame
- **Settings:** 9:16. Generate 8 s, trim to 0 to 7.2 s, export with no audio (`-an`).
- **Matching art:** `bg-intro4.jpg`; no text in the picture, the game adds captions

```
Vertical 9:16, painterly close-up come to life. A first-person view of two teenage hands resting on a stone ledge at night, holding two round glass flasks with cork stoppers, both full of glowing golden oil. To the left, a brass oil lantern with a warm, steady flame. Behind, a stone path lined with small lanterns winds down the hillside to a river town of tiny lights; the tower on the far hill is dark. The two flasks glow and pulse softly, slowly, like a breath. The hands stay almost still, with only a tiny shift of the fingers. Camera: a slow gentle push in on the flasks, 50 mm lens feel, shallow depth of field, the town soft behind. Light: amber (#f2a03d) and gold (#ffcf6b) from the oil and flame, cream highlights (#fff3d6), deep indigo night (#141a3a). Mood: warm, honest, quietly ready. Avoid: any text, letters, numbers, logos, watermarks, readable screens, faces, crowds, cartoon style, castles, flicker, extra fingers, warping hands.
```

## B. Opening voice and sound (17 files, local voice model)

Made on the local voice model, not in Flow. Mono MP3, 48 kHz, about -16 LUFS, silence trimmed. Save in `app/audio/`. Reference to upload: none. Never use a real person's voice as a reference. Use one voice setting per speaker for every line of that speaker. Details: `docs/VOICE_SCRIPT.md`.

### 5. Voice cue op_amb_night
- [ ] Done
- **File:** `app/audio/op_amb_night.mp3`
- **Tool:** Local sound model, or Google Flow audio (sound only)
- **Upload:** none
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Plays:** shot 1 at 0 s, max 60 s, volume 0.35, loops.

```
Sound only, no voice, no music: Night ambience: crickets, soft wind, far-off festival hum. Loop, low. Crickets, soft wind, far festival hum. Seamless loop of about 10 s. vol 0.35. Loops. Keep it under 60 s. Make it a seamless loop.
```

### 6. Voice cue op1_family
- [ ] Done
- **File:** `app/audio/op1_family.mp3`
- **Tool:** Local sound model, or Google Flow audio (sound only)
- **Upload:** none
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Plays:** shot 1 at 0.1 s, max 5 s, volume 0.35.

```
Sound only, no voice, no music: Family murmurs. Soft overlapping murmurs, no words you can pick out. Warm and caring. Fade in and out. vol 0.35. Keep it under 5 s.
```

### 7. Voice cue op1_l1
- [ ] Done
- **File:** `app/audio/op1_l1.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Even, a little weary. The first of three.
- **Plays:** shot 1 at 0.15 s, max 1.2 s. Words must match the caption exactly.

```
Aunty says doctor.
```

### 8. Voice cue op1_l2
- [ ] Done
- **File:** `app/audio/op1_l2.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Same, slightly faster.
- **Plays:** shot 1 at 1.54 s, max 1.2 s. Words must match the caption exactly.

```
Cousin says engineering.
```

### 9. Voice cue op1_l3
- [ ] Done
- **File:** `app/audio/op1_l3.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Same, then a small pause after.
- **Plays:** shot 1 at 2.93 s, max 1.2 s. Words must match the caption exactly.

```
Sir says science.
```

### 10. Voice cue op1_l4
- [ ] Done
- **File:** `app/audio/op1_l4.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Lower and slower. This is the pressure line.
- **Plays:** shot 1 at 4.32 s, max 1.7 s. Words must match the caption exactly.

```
Everyone has your road ready.
```

### 11. Voice cue op2_lamp_out
- [ ] Done
- **File:** `app/audio/op2_lamp_out.mp3`
- **Tool:** Local sound model, or Google Flow audio (sound only)
- **Upload:** none
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Plays:** shot 2 at 0.4 s, max 6 s, volume 0.6.

```
Sound only, no voice, no music: Lamp going out: a warm hum fading to cold sea wind. A warm hum that fades into cold sea wind. Slow fade. vol 0.6. Keep it under 6 s.
```

### 12. Voice cue op2_l1
- [ ] Done
- **File:** `app/audio/op2_l1.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Quiet, a little hushed.
- **Plays:** shot 2 at 0.15 s, max 1.4 s. Words must match the caption exactly.

```
The lighthouse went dark.
```

### 13. Voice cue op2_l2
- [ ] Done
- **File:** `app/audio/op2_l2.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Slow, puzzled. Short break after "open".
- **Plays:** shot 2 at 1.77 s, max 1.9 s. Words must match the caption exactly.

```
Her door open. Her oil untouched.
```

### 14. Voice cue op3_firefly
- [ ] Done
- **File:** `app/audio/op3_firefly.mp3`
- **Tool:** Local sound model, or Google Flow audio (sound only)
- **Upload:** none
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Plays:** shot 3 at 0.3 s, max 5 s, volume 0.4.

```
Sound only, no voice, no music: Firefly wings: a soft, bright buzz that settles. Soft bright wing buzz that settles. Short. vol 0.4. Keep it under 5 s.
```

### 15. Voice cue op3_l1
- [ ] Done
- **File:** `app/audio/op3_l1.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Jyo (firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Jyo: light, direct, shy. "Jyo" clear.
- **Plays:** shot 3 at 0.15 s, max 1.9 s. Words must match the caption exactly.

```
I'm Jyo. She left by choice.
```

### 16. Voice cue op3_l2
- [ ] Done
- **File:** `app/audio/op3_l2.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Jyo (firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Jyo: plain and warm.
- **Plays:** shot 3 at 2.23 s, max 1.9 s. Words must match the caption exactly.

```
Light a lamp in each town.
```

### 17. Voice cue op3_l3
- [ ] Done
- **File:** `app/audio/op3_l3.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Jyo (firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Jyo: steady, slight stress on "really".
- **Plays:** shot 3 at 4.31 s, max 2.8 s. Words must match the caption exactly.

```
Two flasks each. Spend them on what you'd really do.
```

### 18. Voice cue op4_flasks
- [ ] Done
- **File:** `app/audio/op4_flasks.mp3`
- **Tool:** Local sound model, or Google Flow audio (sound only)
- **Upload:** none
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Plays:** shot 4 at 0.3 s, max 5 s, volume 0.5.

```
Sound only, no voice, no music: Glass flasks touching and a lantern flame flicker. Two glass flasks touching, a lantern flame flicker. Short and gentle. vol 0.5. Keep it under 5 s.
```

### 19. Voice cue op4_l1
- [ ] Done
- **File:** `app/audio/op4_l1.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Plain and honest. No selling voice.
- **Plays:** shot 4 at 0.15 s, max 2.3 s. Words must match the caption exactly.

```
An interest guide, not a test. No marks.
```

### 20. Voice cue op4_l2
- [ ] Done
- **File:** `app/audio/op4_l2.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Plain. Say "10 to 14" as "ten to fourteen".
- **Plays:** shot 4 at 2.69 s, max 1.7 s. Words must match the caption exactly.

```
About 10 to 14 minutes.
```

### 21. Voice cue op4_l3
- [ ] Done
- **File:** `app/audio/op4_l3.mp3`
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Narrator: Indian English accent, calm, warm, natural, a little low, older teen or young adult. Not a trailer voice, not cartoonish.
- **Settings:** Mono, 48 kHz, about -16 LUFS
- **Tone:** Warm, easy. The last line before the button.
- **Plays:** shot 4 at 4.54 s, max 2.6 s. Words must match the caption exactly.

```
You get kinds of work, and a school path.
```

## C. Ending and cover

### 22. Ending: the lighthouse lights
- [ ] Done
- **File:** `app/video/ending.mp4` (raw: `~/flow/raw/ending.mp4`)
- **Tool:** Google Flow (text to video)
- **Upload:** none. Do NOT upload `bg-lighthouse.jpg` (it has a third-party watermark)
- **Settings:** 9:16. Generate 8 s, trim to 7 s. Keep the sound; no voice.
- **Must not show:** the door, paper, letter, a person or any text

```
Vertical 9:16, painterly illustration come to life. A straight road of warm gold light leads away from the viewer to a tall round stone lighthouse at the end of a headland, calm dark sea on both sides, deep indigo dusk with a last orange band on the horizon and a few stars. Four lamp posts stand on each side of the road, eight in all, each with a small warm lamp already glowing. At the start the lighthouse lamp room is dark. Then it lights: a warm gold glow grows in the lamp room, soft rays spread, and a wide gentle beam begins to sweep slowly across the sky, then the sea, then low across the road, so each lamp post brightens a little as the beam passes over it. The beam passes once and then rests, calm and bright, along the road. Camera: a locked wide view, with a very slow rise in the last two seconds. No people anywhere. No door, no paper, no writing. Light: deep indigo night, gold and cream light from the lighthouse, amber on the road. Mood: hope, quiet, steady. Not a celebration: no fireworks, no sparkles. Audio: a soft warm hum that rises and holds, gentle waves, light wind, no voice, no music. Avoid: any text, letters, numbers, logos, watermarks, people, faces, doors, paper, fireworks, lens flare, cartoon style, castles, warping, flicker.
```

### 23. Cover loop
- [ ] Done
- **File:** `app/video/cover_loop.mp4` (raw: `~/flow/raw/cover.mp4`)
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_gate.jpg` (crop 0.40 of `app/art/bg-gate.jpg`) as both the first and last frame
- **Settings:** 9:16. Generate 8 s. Make it seamless with the pack's ffmpeg step 6. Muted (`-an`).

```
Vertical 9:16, painterly illustration come to life, a seamless loop. The first frame and the last frame are exactly the uploaded picture. Two teenagers seen only from behind on a hilltop at night, a boy with dark curly hair and a dark hooded top, a girl with long wavy dark hair and a rust-red top, olive backpacks, holding a brass lantern between them, with a small glowing firefly beside the lantern. They look out over a river valley full of tiny warm lamps and a lit lighthouse on a far hill. Very subtle motion only: the valley lamps twinkle softly, the firefly drifts in a small slow loop beside the lantern, the girl's hair and the grass move in a light breeze, the lantern flame flickers softly, thin clouds drift slowly low in the sky, the stars twinkle a little. The teenagers stay still and never turn around. The lighthouse light stays steady, with no beam. Camera: completely locked, no movement. The top 40 percent stays calm dark star-filled sky. The bottom quarter stays dark and quiet. Everything returns to where it started by the last frame. Mood: quiet, hopeful. No sound. Avoid: any text, letters, numbers, logos, watermarks, faces, turning heads, shooting stars, camera movement, fireworks, cartoon squash and stretch, flicker, warping hands.
```

## D. Town clips (15)

Upload the cropped frame as the **first and last frame**. 9:16. Generate 6 s (or 8 s), then retime to 5 s with the pack's ffmpeg step 1. Make the frames first with the crop table in section 7 of the pack. Raw name: `~/flow/raw/town_sNN.mp4`. Keep ambience in the file: no words, no music.

### 24. Town 4: Orchard Village
- [ ] Done
- **File:** `app/video/town_s04.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s04.jpg` (crop 0.30 of `app/art/bg-s04.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: Apples are ripening faster than the village can press them. The press keeps jamming.
- **Watch for:** The game always starts here, so every student sees this clip. Spend extra takes on it. The press is not in the still: do not add one.
- **Sound (ambience):** Leaves in a light breeze, evening crickets, a wooden press far away that creaks and then jams with a soft thunk, one soft bird.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A big apple tree hung with glowing lanterns, a winding stone path to wooden houses, baskets piled with ripe apples, a rope-net frame on the right, forest hills with a far spire, a low gold sun, two small figures by the apple baskets. Ripe apples are plentiful and the two small figures by the baskets shift and look toward the houses. Leaves rustle, the lanterns on the branches sway a little, the grass and the net move in a light breeze, the sky glow holds steady. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 25. Town 1: Salt Harbour
- [ ] Done
- **File:** `app/video/town_s01.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s01.jpg` (crop 0.50 of `app/art/bg-s01.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: The ferry with the lamp oil has stalled at the dock. Passengers are waiting.
- **Watch for:** The number on the ferry hull is a soft unreadable mark. It must not become clear digits. The ferry stays tied up and does not sail.
- **Sound (ambience):** Water lapping on the dock, a rope chain clinking softly, a far murmur of waiting passengers with no clear words, one distant gull. No engine sound: the ferry is silent.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A white ferry with lit windows tied at a wooden dock at dusk, a crowd of passengers waiting on the pier, two small brass lanterns on the planks, a rope chain, a calm bay and hills, a gold sunset band under a teal sky. The ferry stays tied and does not move, as if its engine has stalled, and only rocks a hair on the water. The passengers wait, shifting their weight and glancing at the ferry. The water shimmers, the sunset glints on it, the clouds drift, the lantern flames on the pier flicker softly, a far boat bobs a little. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 26. Town 5: Fog Pass
- [ ] Done
- **File:** `app/video/town_s05.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s05.jpg` (crop 0.65 of `app/art/bg-s05.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: Fog covers the mountain pass, the signal lamp is dim, and travellers keep arriving.
- **Watch for:** Keep the lamp post flame low and steady. No flare and no beam through the fog.
- **Sound (ambience):** Cold wind through pines, footsteps on stone, a far soft bell, a muffled hush.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A mountain pass at dusk with thick fog filling the valley, a tall lamp post glowing dimly in the fog, a small group of travellers climbing wooden steps, a stone hut at the right with a lantern and a garland. The fog drifts slowly over the pass and the lamp post glows low and dim inside it. The travellers keep arriving, taking slow steps up the wooden steps toward the hut. The garland by the hut sways, the lamp post flame stays steady. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 27. Town 6: Night Bazaar
- [ ] Done
- **File:** `app/video/town_s06.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s06.jpg` (crop 0.45 of `app/art/bg-s06.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: Your borrowed stall opens soon. A strange old machine sits among piles of stock.
- **Watch for:** The paper on the ground must stay unreadable. The torn white edge at the top and bottom of the picture must not move. The machine must not start.
- **Sound (ambience):** A low night murmur with no words, lanterns creaking on their strings, a far soft bell, one faint metal tick from the old machine.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A blue misty night market corner with strings of lanterns, a small lit stall where a person in a hooded jacket tidies the shelf before opening, a strange old brass drum-shaped machine on a wooden stand, piles of stock around it: a fruit cart, a large round pot, stacked plates, and a sheet of paper on the ground. The stall is about to open: the person at the stall tidies a shelf and tilts their head to look at the old machine. The lanterns sway on their strings, mist drifts across the ground, a corner of the loose paper lifts in the breeze. The old machine stays completely still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 28. Town 2: Lantern Bridge
- [ ] Done
- **File:** `app/video/town_s02.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s02.jpg` (crop 0.50 of `app/art/bg-s02.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: The stone bridge's arch is cracked. A repair crew waits; lamp-bearers cross by midnight.
- **Watch for:** Odd marks in the top-right corner of the still are outside the 9:16 crop. If marks or glyphs appear, regenerate. Do not add cracks, scaffolds or a crew.
- **Sound (ambience):** River and waterfall hush, a soft wooden creak underfoot, paper lanterns rustling, one faint far stone settling sound.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wooden bridge at dusk lined with glowing paper lanterns and a tall lamp post, a stone arched bridge and a waterfall far behind, three walkers far down the bridge, mist over dark water. The three far walkers cross the bridge in slow steps, as the lamp-bearers do before midnight, while the far stone arch stays still and quiet. The paper lanterns sway a little on their strings, mist drifts over the river, the waterfall in the distance shimmers, the lamp post flame flickers softly. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 29. Town 10: Salt Market
- [ ] Done
- **File:** `app/video/town_s10.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s10.jpg` (crop 0.50 of `app/art/bg-s10.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: A salt cart has a broken wheel, two traders argue, and a long queue grows.
- **Watch for:** Keep it calm. No fight, no raised sticks, no big flames. Do not add a salt cart: use only the barrel and the spilled salt that are in the still.
- **Sound (ambience):** A low market murmur with no clear words, two voices in a calm disagreement with no clear words, a gentle crackle of a small fire, tent canvas flapping, one soft wooden creak like a wheel.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A tented market at dusk, a small fire and spilled salt on the ground in the middle with a toppled barrel, two traders facing each other, onlookers gathering at a distance, hanging lanterns, a pale moon over far hills, a flag on a pole. The two traders argue calmly, gesturing with open hands, and the onlookers shift and gather into a slow queue. The small fire flickers low and a thin smoke rises, the lanterns sway, the tent cloth and the flag flutter. Nobody moves fast and nobody fights. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 30. Town 3: Clockmaker's Lane
- [ ] Done
- **File:** `app/video/town_s03.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s03.jpg` (crop 0.55 of `app/art/bg-s03.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: The tower clock that tells the lane when to light lamps is wrong.
- **Watch for:** The clock face stays still and soft. Numerals must not turn sharp or change, and the hands must not move: this clock is wrong.
- **Sound (ambience):** A soft slow clock ticking that stumbles and skips once, far footsteps on cobbles, evening wind, a faint wind chime.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A tall clock tower with a lit arched doorway on a cobbled lane at dusk, warm windows, two small people crossing the cobbles, a few odd fish-shaped forms floating in the sky. The clock on the tower stays frozen and its hands do not move. The two small people look up at it as they cross the cobbles. The warm windows and lanterns flicker softly, the fish-shaped forms drift slowly across the sky, the clouds move, a bird crosses. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 31. Town 7: River Camp
- [ ] Done
- **File:** `app/video/town_s07.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s07.jpg` (crop 0.40 of `app/art/bg-s07.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: A wide river blocks the road. Tired lamp-bearers rest by driftwood and a campfire.
- **Watch for:** The sun must not move or grow. Do not add a raft, a boat or a campfire that is not in the still.
- **Sound (ambience):** River lapping on the bank, wind in reeds, a far bird, a soft murmur with no words, a faint crackle like a small fire.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wide river at sunset between dark hills, bare trees, two tired travellers sitting on a mat sharing a small lantern, another traveller with a staff beside a tent, a lantern on the ground and one hanging from a branch. The wide river blocks the road and the travellers rest and do not move on. The water ripples and the low sun glitters on it, the bare branches sway, the grass moves, the clouds drift, the lantern flames flicker softly, the travellers move only a little. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 32. Town 9: Glass Cliffs
- [ ] Done
- **File:** `app/video/town_s09.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s09.jpg` (crop 0.40 of `app/art/bg-s09.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: A group must climb the glowing cliff before evening. Ropes and bolts are laid out.
- **Watch for:** The brass lantern at the far left of the still is outside the crop. That is expected. Do not add ropes or bolts: they are not in the still.
- **Sound (ambience):** Wind on rock, a deep faint echo, boots scuffing stone, a faint clink of metal on rock, a wide quiet.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. Tall glassy cliffs lit amber on one side around a gap of gold dusk sky, five small travellers on a stone ledge looking up, a drifting cloud, a soft amber light on the rock faces. The group has to climb before evening: the five small travellers look up at the glowing cliff and one lifts an arm to point at the top. Thin mist drifts through the gap between the cliffs, the light on the rock faces breathes very slightly, the clouds move. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 33. Town 8: Weavers' Town
- [ ] Done
- **File:** `app/video/town_s08.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s08.jpg` (crop 0.50 of `app/art/bg-s08.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: Market day is near. The power loom creaks, and a new weaver waits to learn.
- **Watch for:** A sign at the far left of the still is outside the crop. If a sign appears, regenerate. Do not add a loom: it is not in the still.
- **Sound (ambience):** Soft cloth fluttering, far footsteps, the creak and clack of a far power loom that sticks and starts again, night insects.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A lamp-lit town lane at dusk with a bell tower, slate roofs, cloth awnings and bunting hung ready for market day, barrels, a shop with books, a few small people and an orange dog on glowing cobbles. Market day is near, so the bunting and cloth awnings flutter in the evening breeze. The orange dog's tail wags and its ears twitch, the stars twinkle, the small people take a step or two, the lamps flicker softly. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 34. Town 11: Observatory Hill
- [ ] Done
- **File:** `app/video/town_s11.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s11.jpg` (crop 0.68 of `app/art/bg-s11.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: A clear night is coming. Visitors climb the hill to use the telescope.
- **Watch for:** No shooting star and no beam from the dome. The game lights the lamp. Do not add a telescope outside the dome.
- **Sound (ambience):** Crickets, a soft hilltop wind, a faint far hum of a town, one soft footstep, the faint squeak of a dome turning far inside.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A domed observatory with a glowing doorway on a hilltop terrace, a fence, a valley full of tiny town lights, stars in a sky that goes from amber to blue, four small visitors on the terrace with long shadows. A clear night is coming and the visitors have climbed the hill to look through the telescope: one visitor lifts an arm toward the sky and the others glance at the dome door. The stars twinkle, the town lights in the valley shimmer, the trees sway a little, the doorway glow stays steady, a thin cloud drifts. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 35. Town 12: Herbalists' Garden
- [ ] Done
- **File:** `app/video/town_s12.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s12.jpg` (crop 0.50 of `app/art/bg-s12.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: The lamp-herb garden is overgrown, the season is turning, and neighbours want herbs.
- **Watch for:** Chalk writing on the flower pot at the lower left of the still is outside the crop. If any writing appears, regenerate.
- **Sound (ambience):** Crickets, leaves in a breeze, a soft wind chime, one night bird.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A thick, overgrown garden at night with paper lanterns hanging from tree branches, iron lamp posts, tall plants and flower beds, a round stone circle where a girl in a yellow coat stands, wooden houses with lit windows. The season is turning: a few leaves drift in the night air and the tall plants and ferns sway. The paper lanterns sway on the branches, a few tiny gold specks drift like fireflies, a bird crosses the sky, the lamp post flames flicker softly, the girl in the yellow coat stays almost still, waiting. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 36. Town 13: Printers' Quarter
- [ ] Done
- **File:** `app/video/town_s13.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s13.jpg` (crop 0.60 of `app/art/bg-s13.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: An old printing press was found in a cellar. Everyone wants to print something.
- **Watch for:** The small papers and the framed picture at the right must stay unreadable and still. The press must not start.
- **Sound (ambience):** A quiet square, a faint metal creak of a lantern chain, a far wind, a soft eager murmur of many people with no clear words.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. An old printing press with brass pipes on a wooden bench in a stone square, a hanging lantern above it, warm shop windows, misty old houses, a pot of flowers. The old press has just been found and waits to be used. The lantern sways a little on its arm, mist drifts behind the houses, the window glow flickers softly, small dust specks float in the lantern light, the wires sway. The press stays completely still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 37. Town 14: Healing House
- [ ] Done
- **File:** `app/video/town_s14.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s14.jpg` (crop 0.55 of `app/art/bg-s14.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: Travellers rest here tonight. Several are unwell, and the medicine shelves run low.
- **Watch for:** A painter-style signature sits at the bottom right of the still. The 9:16 crop at 0.55 leaves it out. Do not widen the crop.
- **Sound (ambience):** A soft wind, crickets, a faint wooden creak, a very quiet wind chime, one far soft cough with no words.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A small cottage with a glowing arched doorway and warm windows, a lit round rug on the stones, cushioned chairs set out for resting, small lanterns on the ground, a girl in a blue dress at the left, a bare tree, hills under an orange and violet dusk. It is a calm, still night for resting. The window and doorway light flickers softly, the curtains stir, the small string lights on the fence twinkle, the clouds drift, the girl takes one slow step, the small lanterns flicker. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### 38. Town 15: Festival Square
- [ ] Done
- **File:** `app/video/town_s15.mp4`
- **Tool:** Google Flow (Frames to video)
- **Upload:** `frames/frame_s15.jpg` (crop 0.50 of `app/art/bg-s15.jpg`) as the first and last frame
- **Settings:** 9:16, 6 s, then 5 s. Setup: The bare festival square needs lanterns, a match, stalls and acts before dusk.
- **Watch for:** This still is in a different, more realistic style from the others, and it is 2:3 (the others are square). Keep it as it is. Add no people, no ball, no performers.
- **Sound (ambience):** A gentle evening wind, banners flapping, lake water hush, a very faint far festival drum, a faint far thump of a ball, crickets.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wide bare cobbled square at sunset with a tall wooden arch and two banners in the middle, strings of lanterns waiting to be lit, empty stalls with cloth canopies, a domed pavilion at the left, palm trees, a lake and far town lights, steps, flower petals on the stones, a small lit diya at the bottom right. No people. The square waits for the festival: the banners flutter, the strings of lanterns sway, the stall canopies move, the palm fronds sway, flower petals drift along the cobbles, the diya flame flickers, the far lights on the lake twinkle. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

## E. Trailer (7 clips, joined into one file)

After the seven clips are trimmed, join them in an editor or with the pack's ffmpeg step 7, add the title card as a still (not in Flow), and save as `app/video/trailer.mp4`. Raw names: `~/flow/raw/trailer_T1.mp4` to `trailer_T7.mp4`. The trailer never shows the letter or why the lighthouse went dark. The optional audio line is pasted at the end of the prompt.

### 39. Trailer T1: The road with signposts
- [ ] Done
- **File:** `~/flow/raw/trailer_T1.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** `app/art/bg-intro3.jpg` as an ingredient
- **Settings:** 9:16. Generate 8 s, trim to 5.0 s.
- **Sound:** Evening ambience, far festival hum, off-screen warm family murmurs (no clear words) under the three narrator lines.

```
Vertical 9:16, painterly illustration come to life. A winding road at dusk leaving a lamp-lit Indian hill town, where the road forks. Many wooden signposts stand along it pointing in different directions, each with a small hanging oil lamp, and each board is blank and unreadable. A teenage student seen only from behind, dark short hair, dark hooded jacket, olive backpack, stands at the fork, still. Camera: a slow rise up and back from behind the student, 35 mm lens feel, the signposts leading into the distance. Light: deep indigo dusk (#2b2f63), warm amber lamp glow (#f2a03d), cream highlights. Mood: quiet pressure, a big choice, not scary. Avoid: any text, letters, numbers, logos, watermarks, readable signs, crowds, faces, cartoon style, castles, fantasy creatures, flicker, warping. Audio: a calm narrator, natural Indian English accent, warm, not a trailer voice, says: "Aunty says doctor. Cousin says engineering. Sir says science."
```

### 40. Trailer T2: The dark lighthouse
- [ ] Done
- **File:** `~/flow/raw/trailer_T2.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** `app/art/bg-intro2.jpg` as the start frame
- **Settings:** 9:16. Generate 8 s, trim to 4.0 s.
- **Sound:** Lamp hum fading, cold sea wind, distant waves.

```
Vertical 9:16, painterly illustration come to life. A stone lighthouse on a sea cliff at dusk, its lamp room fading from warm light to dark. The arched wooden door at its foot stands slightly open and the room inside is dark. A brass lantern flickers on the step. No person. Camera: a slow push in, 35 mm lens feel. Light: last orange horizon, deep indigo sky with stars, one small lantern flame. Mood: hushed, a mystery. Avoid: any text, letters, numbers, logos, watermarks, people, faces, crowds, cartoon style, castles, flicker, warping. Audio: a calm narrator, natural Indian English accent, warm, not a trailer voice, says: "The lighthouse went dark."
```

### 41. Trailer T3: Jyo and the flasks
- [ ] Done
- **File:** `~/flow/raw/trailer_T3.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** `app/art/bg-intro3.jpg` and `bg-intro4.jpg` as ingredients
- **Settings:** 9:16. Generate 8 s, trim to 5.0 s.
- **Sound:** Soft wing buzz, glass clink, night crickets.

```
Vertical 9:16, painterly illustration come to life. Night on a hillside above a river valley of warm lamps. In the foreground, two teenage hands hold two round glass flasks with cork stoppers, full of glowing golden oil, next to a brass oil lantern. A tiny firefly of warm golden light, soft translucent wings, no smile, no large eyes, hovers beside them, and its glow lights the flasks. Camera: a slow push in, 50 mm lens feel, shallow depth of field. Light: gold (#ffcf6b), amber (#f2a03d), cream (#fff3d6) on deep indigo night (#141a3a). Mood: warm, curious, hopeful. Avoid: any text, letters, numbers, logos, watermarks, readable screens, faces, crowds, cartoon style, squash and stretch, castles, flicker, extra fingers, warping hands. Audio: a calm narrator, natural Indian English accent, warm, not a trailer voice, says: "Two flasks each. Spend them on what you'd really do."
```

### 42. Trailer T4: Glass Cliffs
- [ ] Done
- **File:** `~/flow/raw/trailer_T4.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** `app/art/bg-intro3.jpg` as an ingredient (for the student's jacket and backpack)
- **Settings:** 9:16. Generate 8 s, trim to 5.0 s.
- **Sound:** Wind on rock, a distant echo, soft footsteps on stone. No voice.

```
Vertical 9:16, painterly illustration come to life. Tall glassy rock cliffs in the Indian hills at dusk, the rock faces glowing softly amber as if lit from inside. A narrow path climbs the cliff. Coils of rope and iron anchor bolts are laid out on a flat rock at the base, ready for the climb. A few tiny figures far away, seen only as small dark shapes with lanterns, climb toward the top before evening ends, and a small warm lamp is lit at the highest point. Far below, a river road winds through the dark like a string of stars. A teenage student with a dark jacket and olive backpack is seen from behind in the near foreground at the base beside the ropes, looking up. Camera: a slow upward tilt from the student to the lit lamp at the summit, 35 mm lens feel. Light: deep indigo twilight (#2b2f63), glowing amber rock (#f2a03d), one gold lamp (#ffcf6b). Mood: effort, wonder, a long way up. Avoid: any text, letters, numbers, logos, watermarks, crowds, close-up faces, cartoon style, castles, fantasy creatures, flicker, warping.
```

### 43. Trailer T5: Night Bazaar
- [ ] Done
- **File:** `~/flow/raw/trailer_T5.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** none (or `bg-intro1.jpg` for colour)
- **Settings:** 9:16. Generate 8 s, trim to 5.0 s.
- **Sound:** Soft bazaar murmur with no clear words, a bell, a faint machine click, a lamp catching with a soft whoosh.

```
Vertical 9:16, painterly illustration come to life. An Indian night bazaar in a narrow stone lane, strings of small oil lamps and paper lanterns overhead, stalls with brass pots, cloth and spices, marigold garlands. In the foreground, one small wooden stall that is about to open, with piles of crates, cloth and pots around it and a strange old brass machine among the stock, with gears and dials, no writing on it, and a single lamp hanging over the stall that is just being lit. Hands only: one teenage hand reaches in from the edge to touch the machine. The rest of the bazaar is soft and blurred, with only shadows of people, no faces. Camera: a slow glide forward along the lane toward the stall, 35 mm lens feel, shallow depth of field. Light: amber and gold lamps (#f2a03d, #ffcf6b), deep indigo shadows (#141a3a), cream highlights. Mood: curious, lively, warm. Avoid: any text, letters, numbers, signs, price boards, logos, watermarks, readable screens, crowds of faces, cartoon style, castles, flicker, extra fingers, warping hands.
```

### 44. Trailer T6: Observatory Hill
- [ ] Done
- **File:** `~/flow/raw/trailer_T6.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** `app/art/bg-intro3.jpg` as an ingredient
- **Settings:** 9:16. Generate 8 s, trim to 6.0 s.
- **Sound:** Quiet night, crickets, a soft rising tone as the lamp's light lifts.

```
Vertical 9:16, painterly illustration come to life. A grassy hilltop at night under a huge clear sky full of stars and a faint Milky Way. A small white stone observatory dome and a brass telescope pointed at the sky. A path winds up the hill, and a few visitors, only small dark silhouettes, climb it toward the dome to use the telescope, while others sit on the grass and look up. A teenage student, seen from behind, dark hair and olive backpack, stands at the telescope. A lamp on the hill lifts its light upward in a soft beam, and the stars seem to glow a little brighter in answer. Camera: a slow rise and tilt up to the stars, 35 mm lens feel. Light: deep indigo (#141a3a to #2b2f63), warm gold lamp (#ffcf6b), cream starlight (#fff3d6). Mood: wonder, calm, wide open. Avoid: any text, letters, numbers, star-chart labels, logos, watermarks, crowds of faces, close-up faces, cartoon style, castles, fantasy creatures, flicker, warping. Audio: a calm narrator, natural Indian English accent, warm, not a trailer voice, says: "Light a lamp in each town."
```

### 45. Trailer T7: The lighthouse lights
- [ ] Done
- **File:** `~/flow/raw/trailer_T7.mp4` (joined into `app/video/trailer.mp4`)
- **Tool:** Google Flow
- **Upload:** `app/art/bg-intro2.jpg` as the start frame, `bg-intro3.jpg` as an ingredient for the student
- **Settings:** 9:16. Generate 8 s, trim to 7.0 s.
- **Sound:** A soft warm hum rises and holds, waves, wind. One long calm breath of sound under the final line.

```
Vertical 9:16, painterly illustration come to life. A stone lighthouse on a sea cliff at night. The lamp room is dark, and then it lights: a warm gold glow grows slowly, then a soft beam turns across the dark sea and over the hills. A teenage student with a dark hooded jacket and olive backpack stands small in the foreground, seen from behind, a brass lantern in one hand, looking up at the light. A small firefly of warm gold light drifts near their shoulder. The town lights glow far below. Camera: a slow rise from the student up to the lamp room as it lights, 35 mm lens feel. Light: deep indigo night (#141a3a), the lamp in gold (#ffcf6b) and cream (#fff3d6), amber on the stone (#f2a03d). Mood: hope, quiet triumph, calm. Not a celebration. Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, faces, cartoon style, fireworks, castles, fantasy creatures, flicker, warping. Audio: a calm narrator, natural Indian English accent, warm, not a trailer voice, says: "Take the lantern."
```

## F. Optional, future: voice for Jyo's lines and the letter

**The game does NOT play these yet.** Only the opening cues in section B are wired. Make these only if the owner asks. Details and tone notes: `docs/VOICE_SCRIPT.md`. Proposed names, not wired.

### 46. Jyo at town 7
- [ ] Done (optional)
- **File:** `jyo_town7.mp3` (not played by the game yet)
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Jyo (firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Tone:** soft and a little sad on "I miss her", then steady and warm. About 6 s.

```
I miss her. She went to the lighthouse. I promised to wait for you.
```

### 47. Jyo sharpen card
- [ ] Done (optional)
- **File:** `jyo_sharpen.mp3` (not played by the game yet)
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Jyo (firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Tone:** light and kind. A real offer, no pushing. About 4 s.

```
More lamps make your road clearer. Stop any time.
```

### 48. The lamplighter's letter
- [ ] Done (optional)
- **File:** `lamplighter_letter.mp3` (not played by the game yet)
- **Tool:** Local voice model (Indian English)
- **Upload:** none. Voice: Adult woman, Indian English, calm, kind, a little tired, never grand. Heard only; she is never shown.
- **Tone:** slow, about 2.3 words a second, small pauses between sentences, a longer one before "People will tell you what to be." About 24 s.

```
I put this light out myself, so you could light it. A lamp I lit would only show my road. I took no oil, because the oil is yours to spend. I tried every kind of work so you could find yours. People will tell you what to be. The road was never mine. Choose yours.
```
