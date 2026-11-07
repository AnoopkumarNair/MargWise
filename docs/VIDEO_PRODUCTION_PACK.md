# Video production pack for Google Flow

This is the shooting script for every video in Margwise, made in Google Flow (Veo). Every prompt is in its own box so you can copy it on a phone. The wording is plain on purpose.

**What you will make (28 Flow clips become 22 files).**

| Video | Flow clips | Final file | Where it plays |
| --- | --- | --- | --- |
| Opening | 4 shots | `opening_1.mp4` to `opening_4.mp4` | First visit, with game captions |
| Town clips | 15 (one per town) | `town_s01.mp4` to `town_s15.mp4` | Each town, 5 s, then hands over to the still |
| Ending | 1 | `ending.mp4` | After town 8, when the lighthouse lights |
| Cover loop | 1 | `cover_loop.mp4` | Muted, behind the title and Begin button |
| Trailer | 7 clips, joined | `trailer.mp4` | Behind the "Watch the trailer" button |

All files are 720 x 1280 portrait (9:16). Put them in `app/video/`. Sections 7 to 9 are the new clips. Section 10 has file names, sizes and ffmpeg commands. Section 11 says what to make first.

**Honest status.** The art in the game is still pictures with slow motion and captions (see `docs/STORY.md` and `data/story2.json`, `meta.opening`). This pack makes the video files. A separate engineer is building the player: it uses a clip only when its file exists, and falls back to the still picture when video is off, the phone is on data saver or a slow network, or motion is reduced. Nothing here changes the game.

Flow changes often. Menu names, clip lengths and credit costs may differ from this page. Where this pack says "check", look in the app.

## 1. Purpose

**A. In-game opening video.** Four shots, 9:16 portrait, 24.1 seconds in all. **One file per shot** (`opening_1.mp4` to `opening_4.mp4`), so the captions stay in sync: the game starts each file when it shows that shot. The shot times match the game captions, so each Flow clip (8 s) is trimmed. No text in the picture: the game adds captions.

| Shot | Title | Game time | Trim the 8 s clip to |
| --- | --- | --- | --- |
| 1 | The road everyone has ready | 6.0 s | 6.0 s |
| 2 | The lighthouse goes dark | 3.7 s | 3.7 s |
| 3 | Jyo arrives | 7.2 s | 7.2 s |
| 4 | Two flasks and a lantern | 7.2 s | 7.2 s |

**B. Trailer.** 30 to 45 seconds, 9:16 portrait, plays on tap behind a "Watch the trailer" button on the home page (a 16:9 version for social posts is optional). Seven clips, about 37 s after trims. Same world, no spoilers: it never shows the letter or says why the lighthouse went dark. It ends on a call to play, spoken and shown by the lighthouse lighting up. No web address in the video. Add the link in the post text.

**C. Town clips, ending clip and cover loop.** New in this version. See sections 7, 8 and 9.

## 2. Style bible

**Look.** Painterly, like a moving illustration. Warm lamp light against deep blue. Dusk turning to night. An Indian hill-and-river setting: stone ghat steps, a river with floating diyas and sky lanterns, hill towns with tiled and flat roofs, a small temple spire, marigold, banyan and palm, a stone lighthouse on a sea cliff.

**Tone.** Older teens. Quiet and a little wistful, then hopeful. Not childish. No "chosen one" moment, no glowing destiny, no hero pose. Slow, steady movement. No cartoon squash and stretch.

**Characters.** All fictional Indian teens. No likeness to any real person or celebrity. Keep faces small, turned away or in shadow.

**Colours (from the game).**

| Use | Hex |
| --- | --- |
| Night sky top | `#141a3a` |
| Night sky middle | `#2b2f63` |
| Lamp glow | `#ffcf6b` |
| Deep amber | `#f2a03d` |
| Cream, brightest light | `#fff3d6` |

Say these in words in prompts ("deep indigo night, warm amber lamp light, cream highlights"). Flow does not read hex codes reliably.

**Camera language.** Slow push in, slow pan, gentle rise. One move per shot. Lens feel: 35 mm for wide valley, 50 mm for people, shallow depth of field for close-ups. Handheld shake: none. Cuts: calm, on a dark or glowing frame.

**Light.** Every light source is a flame or lantern: diyas, oil lamps, sky lanterns, the lighthouse. Soft glow, gentle flicker. No neon, no electric signs.

**Avoid (always).** Text, letters or numbers anywhere in the picture (signs, paper, book pages, shop boards). Logos and brand names. Phones or screens with readable content. Gore or fear. Crowds of faces. Western-fantasy castles, knights, dragons, wizards. Lens flares like a film trailer. Watermarks.

**Originality.** Do not name any film, game, studio or artist in a prompt, and do not ask for their look. Describe the picture in plain words instead.

**The negative line.** Flow has no strict negative box for every model. Paste this as the last sentence of each prompt (it is already inside each prompt below):

```
Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, close-up faces, cartoon style, squash and stretch, castles, fantasy creatures, flicker, warping hands.
```

## 3. Character and asset sheet

What each reference image really shows, so you know what you are uploading.

| Asset | Look to keep | Upload as ingredient or start frame | Watch out for |
| --- | --- | --- | --- |
| **Valley at dusk** | Lamp-lit hill town, river, arched bridge, floating lanterns, sunset band, diya flames and white flowers in the foreground, hill-top building far right | `app/art/bg-intro1.jpg` | The buildings look a little Mediterranean. For new scenes the prompts add Indian cues (ghats, spire, marigold). |
| **The student** | Seen from behind. Dark short hair, dark jacket with hood, olive backpack. Sitting on rocks, looking at the valley. Gender-neutral: no face. | `app/art/bg-intro3.jpg` (also use for Shot 3 and trailer) | Never show the face. Keep the same jacket and olive backpack in every clip. |
| **Jyo** | A small firefly: warm gold body-light, soft translucent wings, two thin antennae with glowing tips. | Part of `bg-intro3.jpg` | The still art gives Jyo a smiling cartoon face. In video Jyo is subtler: a living light with wings, tiny dark eyes at most, no smile, no big eyes. See Shot 3. |
| **Cover pair** | Two teens from behind: a boy with dark curly hair and a dark hooded top, a girl with long wavy dark hair and a rust-red top, olive backpacks, one brass lantern between them, Jyo glowing beside it, a milky-way sky, a lamp-lit river valley, a lit lighthouse far right | `app/art/bg-gate.jpg` (cover loop only) | Keep them from behind. This is the only clip where Jyo may keep the still's smiling face, because the picture already shows it. |
| **The lamplighter** | Never shown. Only: her brass lantern, her open wooden door, her full glass oil flasks on a shelf. No face, no hands, no body. | Lantern and flasks: `app/art/bg-intro4.jpg`. Door: `app/art/bg-intro2.jpg` | Do not let Flow add a person at the door. |
| **The lighthouse** | Round stone tower, ivy on one side, arched wooden door, lantern room with a railing and a dome, on a sea cliff, stepped stone path, rope fence, a brass lantern by the door. Lamp dark at the start. | `app/art/bg-intro2.jpg` | The door has a small paper pinned on it with soft scribbles. Keep it blurred. It must never be readable. |
| **Lamps and flasks** | Brass oil lantern with a bright flame. Two round glass flasks with cork stoppers, full of glowing gold oil. A stone path with small lanterns going down to the town. | `app/art/bg-intro4.jpg` | Hands: keep movement tiny. Check fingers. |

**The town stills (`bg-s01.jpg` to `bg-s14.jpg`) are square, 1024 x 1024.** Only `bg-s15.jpg` is 2:3, and the opening pictures and `bg-gate.jpg` (the cover) are 2:3. Flow wants 9:16, so crop each picture first (section 7 has the command). A 9:16 crop of a square picture keeps the middle 56 percent of the width.

**Cover picture.** The two teens from behind with the lantern, Jyo and the valley are in `app/art/bg-gate.jpg` (2:3). Do not confuse it with `app/art/bg-welcome.jpg`: that one is square, shows an empty road of lamps leading to a striped lighthouse at sunset, and has no people.

**Do not upload `app/art/bg-lighthouse.jpg`.** It carries a third-party watermark ("@ ZALAKS") in the bottom-left corner. Flow may copy it into the video as text, and we may not have the right to the picture. Section 8 describes that scene in words instead. `bg-welcome.jpg` is also square and looks different from the rest, so it is not used as a frame either.

**Cropping.** Flow's portrait is 9:16. Crop the stills to 9:16 yourself (section 7), keeping the main subject in the middle, so the start frame is exactly what the game shows. Never let Flow crop for you: it may cut the subject.

**How to use the images.**
- **Frames to video** (start frame = the game picture): best for Shots 1, 2 and 4. The video begins exactly like the game picture, so the match is perfect.
- **Ingredients** (reference images, up to the number Flow allows, check): best for Shot 3 and the trailer, where the scene is new.
- Set the aspect ratio to **9:16** in Flow settings before you generate. The prompts also say it.
- Generate 2 to 4 takes of each clip. Pick the best. Use the Quality model for finals, the Fast model to test (check names in your app).

## 4. Shot list for A: the in-game opening

Each box is one full prompt. Copy all of it. Each shot also has: ingredients, audio, dialogue, transition and a fallback.

### Shot 1: The road everyone has ready (6.0 s)

**Upload:** start frame `bg-intro1.jpg` (Frames to video).
**Generate 8 s, trim to 0.0 to 6.0 s.**

```
Vertical 9:16, painterly illustration come to life. A wide view from a hillside down over a lamp-lit Indian river town at dusk turning to night. Stone ghat steps, tiled and flat roofs, a small temple spire, an arched stone bridge, hundreds of warm lamps and floating diyas on the river, a few sky lanterns drifting slowly upward. Foreground: a stone wall with small oil-lamp flames and white flowers, the flames flickering gently. Camera: a very slow pan to the right with a slight push in, one smooth move, 35 mm lens feel, deep depth. Light: warm amber lamp glow (#f2a03d, #ffcf6b) against deep indigo sky (#141a3a to #2b2f63), cream highlights on the water. Mood: quiet, a little heavy, expectant. Calm and steady, no sudden motion. Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, close-up faces, cartoon style, squash and stretch, castles, fantasy creatures, flicker, warping.
```

**Sound (Flow audio, if you keep it).** Crickets, soft wind, a far-off festival hum. Off-screen, overlapping family murmurs, warm and caring, no clear words, no faces. Fade in and out.
**Dialogue.** Narrator, off-screen (the game captions match word for word):
- 0.15 s "Aunty says doctor." Even, a little weary.
- 1.54 s "Cousin says engineering." Same, a touch faster.
- 2.93 s "Sir says science." Same, then a small pause.
- 4.32 s "Everyone has your road ready." Lower and slower. The pressure line.

**Transition out.** The sky is just a little darker at the end and the lamps glow stronger. Cut to Shot 2 on a dark, calm frame.

**Fallback prompt** (use if the camera jumps, lamps pop or the town warps; no start frame, only a still view):
```
Vertical 9:16, painterly night scene. A still, wide view over a river town in the hills at dusk, many warm lamps, floating diyas on the water, sky lanterns rising slowly, a stone bridge. In front: a stone wall with two small oil-lamp flames flickering. The camera barely moves, only a slow gentle drift to the right. Warm amber light on deep indigo. Quiet mood. Avoid: any text, letters, logos, watermarks, people's faces, crowds, cartoon style, castles, flicker, warping.
```

### Shot 2: The lighthouse goes dark (3.7 s)

**Upload:** start frame `bg-intro2.jpg`.
**Generate 8 s, trim to 0.0 to 3.7 s.**

```
Vertical 9:16, painterly illustration come to life. A stone lighthouse on a sea cliff at dusk, ivy climbing one side, an arched wooden door at its foot, a brass lantern glowing beside the door, a stone path and a rope fence, a calm sea and a faint line of town lights far away. The glow in the lantern room at the top fades slowly until the tower is dark. The old wooden door moves a little in the wind and stands slightly open, with a faint warm dark inside and a row of glass oil flasks catching a little light on a shelf. A small paper on the door stays a soft blur, nothing readable. No person anywhere. Camera: a slow push in toward the door, 35 mm lens feel. Light: last orange in the sky, deep indigo night above, one small lantern flame. Mood: quiet, puzzled, a little lonely. Avoid: any text, letters, numbers, logos, watermarks, people, faces, crowds, cartoon style, castles, flicker, warping.
```

**Sound.** A warm lamp hum that fades into cold sea wind. Distant waves. One door creak, very soft.
**Dialogue.** Narrator, off-screen:
- 0.15 s "The lighthouse went dark." Quiet, a little hushed.
- 1.77 s "Her door open. Her oil untouched." Slow, puzzled. Short break after "open".

**Transition out.** End on the dark tower and the star-filled sky. Cut to Shot 3. The game itself fades the light with an overlay, so a dim end is fine.

**Fallback prompt** (if a person appears or the paper becomes readable):
```
Vertical 9:16, painterly night scene. A round stone lighthouse on a sea cliff at dusk, its lamp dark, an arched wooden door a little open, a small brass lantern on the step. Empty. No people. The camera pushes in very slowly. Deep indigo sky with stars, a last band of orange at the horizon, calm dark sea. Quiet and lonely. Avoid: any text, letters, paper with writing, logos, watermarks, people, faces, cartoon style, castles, flicker.
```

### Shot 3: Jyo arrives (7.2 s)

**Upload:** ingredient `bg-intro3.jpg` (student from behind, backpack, valley). Optional second ingredient `bg-intro1.jpg` for the valley.
**Generate 8 s, trim to 0.0 to 7.2 s.**

```
Vertical 9:16, painterly illustration come to life. Over-the-shoulder view from behind a teenage student with short dark hair, a dark hooded jacket and an olive backpack, sitting on a rock on a hillside at night, looking out over a river valley full of warm lamps and floating lanterns. A tiny firefly made of warm golden light drifts in from the right, soft translucent wings beating gently, two thin antennae with glowing tips, a bright gold glow at its body. It is small, graceful and real in feel, not a cartoon mascot, no smile, no large eyes. It slows and hovers beside the student's shoulder. The student's face is never shown. Camera: slow push in, 50 mm lens feel, shallow depth of field, the valley lights soft behind. Light: deep indigo starry sky (#141a3a), amber lamp glow (#f2a03d), the firefly in warm gold (#ffcf6b), cream highlights (#fff3d6). Mood: curious, gentle, a small spark of hope. Calm motion only. Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, close-up faces, cartoon style, squash and stretch, castles, fantasy creatures, flicker, warping hands.
```

**Sound.** A soft bright wing buzz that settles. Night crickets, low.
**Dialogue.** Jyo, light and quick, quietly curious, a little shy. Indian English accent. No squeaks, no baby voice. The voice comes from the glow, with no mouth.
- 0.15 s "I'm Jyo. She left by choice." Light, direct. Say "Jyo" clearly.
- 2.23 s "Light a lamp in each town." Plain and warm.
- 4.31 s "Two flasks each. Spend them on what you'd really do." Steady, slight stress on "really".

**Transition out.** End with Jyo's glow settled near the student. Cut to Shot 4 on the glow.

**Fallback prompt** (if the student's face appears or Jyo looks like a cartoon):
```
Vertical 9:16, painterly night scene. A teenager seen only from behind, dark hair and dark hood, sits on a rock above a lamp-lit river valley. A small glowing firefly, just a warm gold light with fine soft wings, floats near the shoulder. No face on the student. Slow push in. Deep indigo sky with stars, amber lamps below, calm and hopeful. Avoid: any text, letters, logos, watermarks, faces, cartoon style, big eyes, smiling insect, crowds, flicker, warping.
```

If you want Jyo to match the game's still art exactly (a smiling firefly), use `bg-intro3.jpg` as a **start frame** instead, and change the prompt to: "The firefly hovers and drifts a little closer to the student. Keep everything else the same."

### Shot 4: Two flasks and a lantern (7.2 s)

**Upload:** start frame `bg-intro4.jpg`.
**Generate 8 s, trim to 0.0 to 7.2 s.**

```
Vertical 9:16, painterly close-up come to life. A first-person view of two teenage hands resting on a stone ledge at night, holding two round glass flasks with cork stoppers, both full of glowing golden oil. To the left, a brass oil lantern with a warm, steady flame. Behind, a stone path lined with small lanterns winds down the hillside to a river town of tiny lights; the tower on the far hill is dark. The two flasks glow and pulse softly, slowly, like a breath. The hands stay almost still, with only a tiny shift of the fingers. Camera: a slow gentle push in on the flasks, 50 mm lens feel, shallow depth of field, the town soft behind. Light: amber (#f2a03d) and gold (#ffcf6b) from the oil and flame, cream highlights (#fff3d6), deep indigo night (#141a3a). Mood: warm, honest, quietly ready. Avoid: any text, letters, numbers, logos, watermarks, readable screens, faces, crowds, cartoon style, castles, flicker, extra fingers, warping hands.
```

**Sound.** Two glass flasks touching with a soft clink. A lantern flame flickering. A faint night wind.
**Dialogue.** Narrator, plain and honest, no selling voice:
- 0.15 s "An interest guide, not a test. No marks." Plain and honest.
- 2.69 s "About 10 to 14 minutes." Say it "ten to fourteen".
- 4.54 s "You get kinds of work, and a school path." Warm, easy. The last line before the button.

**Transition out.** None. This is the last shot. The game keeps the last frame and fades in the button "Take the lantern". End on a calm, glowing frame.

**Fallback prompt** (if the hands warp):
```
Vertical 9:16, painterly night scene. Two round glass flasks with cork stoppers, full of glowing golden oil, sit on a stone ledge beside a brass oil lantern with a steady flame. Behind them a lantern-lit path runs down to a distant town of small lights. No hands, no people. The camera pushes in very slowly. The flask glow pulses gently. Warm amber on deep indigo. Avoid: any text, letters, logos, watermarks, people, hands, faces, cartoon style, flicker.
```

**Join check.** In Flow's scene builder you can place all four clips in order to check the flow. Export each trimmed clip, then encode each in section 10 (one file per shot, no joining).

## 5. Shot list for B: the trailer

Same style, same student, same Jyo. Three towns: **Glass Cliffs**, **Night Bazaar**, **Observatory Hill** (their story setups: climbers reach the cliff top by evening; a borrowed stall holds a strange old machine; a clear night and visitors climbing to watch the stars). No keeper faces. No letter. No reason for the lighthouse going dark.

Trailer voice: one calm narrator, Indian English, same as the opening. All lines are already in the game. Total about 37 s after trims.

| Clip | Title | Trim from the 8 s clip | Voice line |
| --- | --- | --- | --- |
| T1 | The road with signposts | 5.0 s | "Aunty says doctor. Cousin says engineering. Sir says science." |
| T2 | The dark lighthouse | 4.0 s | "The lighthouse went dark." |
| T3 | Jyo and the flasks | 5.0 s | "Two flasks each. Spend them on what you'd really do." |
| T4 | Glass Cliffs | 5.0 s | (no voice, sound only) |
| T5 | Night Bazaar | 5.0 s | (no voice, sound only) |
| T6 | Observatory Hill | 6.0 s | "Light a lamp in each town." |
| T7 | The lighthouse lights | 7.0 s | "Take the lantern." |

Ending call to play: the narrator says "Take the lantern." while the lighthouse lights. Then add the logo or game title as a still card in your editor (not in Flow, because Flow garbles letters). The finished file is `trailer.mp4` (section 10). It plays behind a "Watch the trailer" button on the home page, with sound, only when tapped.

For a 16:9 version, regenerate each clip with "Horizontal 16:9" in place of "Vertical 9:16", and move the subject to the left third. Do not crop the vertical clips.

### T1: The road with signposts (5.0 s)

**Upload:** ingredient `bg-intro3.jpg`.

```
Vertical 9:16, painterly illustration come to life. A winding road at dusk leaving a lamp-lit Indian hill town, where the road forks. Many wooden signposts stand along it pointing in different directions, each with a small hanging oil lamp, and each board is blank and unreadable. A teenage student seen only from behind, dark short hair, dark hooded jacket, olive backpack, stands at the fork, still. Camera: a slow rise up and back from behind the student, 35 mm lens feel, the signposts leading into the distance. Light: deep indigo dusk (#2b2f63), warm amber lamp glow (#f2a03d), cream highlights. Mood: quiet pressure, a big choice, not scary. Avoid: any text, letters, numbers, logos, watermarks, readable signs, crowds, faces, cartoon style, castles, fantasy creatures, flicker, warping.
```

**Sound.** Evening ambience, far festival hum, off-screen warm family murmurs (no clear words) under the three narrator lines.
**Transition.** Dusk deepens. Cut to T2.
**Fallback:**
```
Vertical 9:16, painterly dusk scene. A teenager seen from behind stands where a country road forks, wooden posts with small lamps beside the road, blank boards. A slow camera rise. Warm amber and deep blue. Avoid: any text, letters, faces, logos, watermarks, crowds, cartoon style, flicker.
```

### T2: The dark lighthouse (4.0 s)

**Upload:** start frame `bg-intro2.jpg`.

```
Vertical 9:16, painterly illustration come to life. A stone lighthouse on a sea cliff at dusk, its lamp room fading from warm light to dark. The arched wooden door at its foot stands slightly open and the room inside is dark. A brass lantern flickers on the step. No person. Camera: a slow push in, 35 mm lens feel. Light: last orange horizon, deep indigo sky with stars, one small lantern flame. Mood: hushed, a mystery. Avoid: any text, letters, numbers, logos, watermarks, people, faces, crowds, cartoon style, castles, flicker, warping.
```

**Sound.** Lamp hum fading, cold sea wind, distant waves.
**Transition.** Ends on the dark tower. Cut to T3.
**Fallback:** use the Shot 2 fallback prompt.

### T3: Jyo and the flasks (5.0 s)

**Upload:** ingredients `bg-intro3.jpg` and `bg-intro4.jpg`.

```
Vertical 9:16, painterly illustration come to life. Night on a hillside above a river valley of warm lamps. In the foreground, two teenage hands hold two round glass flasks with cork stoppers, full of glowing golden oil, next to a brass oil lantern. A tiny firefly of warm golden light, soft translucent wings, no smile, no large eyes, hovers beside them, and its glow lights the flasks. Camera: a slow push in, 50 mm lens feel, shallow depth of field. Light: gold (#ffcf6b), amber (#f2a03d), cream (#fff3d6) on deep indigo night (#141a3a). Mood: warm, curious, hopeful. Avoid: any text, letters, numbers, logos, watermarks, readable screens, faces, crowds, cartoon style, squash and stretch, castles, flicker, extra fingers, warping hands.
```

**Sound.** Soft wing buzz, glass clink, night crickets.
**Transition.** The glow brightens. Cut to T4 on the glow.
**Fallback:** the Shot 4 fallback prompt, adding "a small firefly of gold light floats beside the flasks".

### T4: Glass Cliffs (5.0 s)

**Upload:** ingredient `bg-intro3.jpg` (for colour and the student's jacket and backpack).

```
Vertical 9:16, painterly illustration come to life. Tall glassy rock cliffs in the Indian hills at dusk, the rock faces glowing softly amber as if lit from inside. A narrow path climbs the cliff. A few tiny figures far away, seen only as small dark shapes with lanterns, climb toward the top, and a small warm lamp is lit at the highest point. Far below, a river road winds through the dark like a string of stars. A teenage student with a dark jacket and olive backpack is seen from behind in the near foreground at the base, looking up. Camera: a slow upward tilt from the student to the lit lamp at the summit, 35 mm lens feel. Light: deep indigo twilight (#2b2f63), glowing amber rock (#f2a03d), one gold lamp (#ffcf6b). Mood: effort, wonder, a long way up. Avoid: any text, letters, numbers, logos, watermarks, crowds, close-up faces, cartoon style, castles, fantasy creatures, flicker, warping.
```

**Sound.** Wind on rock, a distant echo, soft footsteps on stone. No voice.
**Transition.** The summit lamp flares to a warm bloom. Cut to T5 on the bloom.
**Fallback:**
```
Vertical 9:16, painterly dusk scene. Tall rock cliffs glowing warm amber at dusk, a small lamp lit at the very top, a winding road of tiny lights far below. A slow tilt up. No people in focus. Deep blue sky, amber rock. Avoid: any text, letters, faces, logos, watermarks, crowds, cartoon style, flicker.
```

### T5: Night Bazaar (5.0 s)

**Upload:** none, or `bg-intro1.jpg` for colour.

```
Vertical 9:16, painterly illustration come to life. An Indian night bazaar in a narrow stone lane, strings of small oil lamps and paper lanterns overhead, stalls with brass pots, cloth and spices, marigold garlands. In the foreground, one empty wooden stall with a strange old brass machine on its counter, with gears and dials, no writing on it, and a single lamp hanging over the stall that is just being lit. Hands only: one teenage hand reaches in from the edge to touch the machine. The rest of the bazaar is soft and blurred, with only shadows of people, no faces. Camera: a slow glide forward along the lane toward the stall, 35 mm lens feel, shallow depth of field. Light: amber and gold lamps (#f2a03d, #ffcf6b), deep indigo shadows (#141a3a), cream highlights. Mood: curious, lively, warm. Avoid: any text, letters, numbers, signs, price boards, logos, watermarks, readable screens, crowds of faces, cartoon style, castles, flicker, extra fingers, warping hands.
```

**Sound.** Soft bazaar murmur with no clear words, a bell, a faint machine click, a lamp catching with a soft whoosh.
**Transition.** The lamp over the stall glows brighter. Cut to T6 on the glow.
**Fallback:** same prompt, but remove the hand, and end with "the camera stops on the old brass machine and the hanging lamp".

### T6: Observatory Hill (6.0 s)

**Upload:** ingredient `bg-intro3.jpg`.

```
Vertical 9:16, painterly illustration come to life. A grassy hilltop at night under a huge clear sky full of stars and a faint Milky Way. A small white stone observatory dome and a brass telescope pointed at the sky. A few visitors, only small dark silhouettes, sit on the grass and look up. A teenage student, seen from behind, dark hair and olive backpack, stands at the telescope. A lamp on the hill lifts its light upward in a soft beam, and the stars seem to glow a little brighter in answer. Camera: a slow rise and tilt up to the stars, 35 mm lens feel. Light: deep indigo (#141a3a to #2b2f63), warm gold lamp (#ffcf6b), cream starlight (#fff3d6). Mood: wonder, calm, wide open. Avoid: any text, letters, numbers, star-chart labels, logos, watermarks, crowds of faces, close-up faces, cartoon style, castles, fantasy creatures, flicker, warping.
```

**Sound.** Quiet night, crickets, a soft rising tone as the lamp's light lifts.
**Transition.** The camera ends on the sky. Cut to T7 on a dark frame.
**Fallback:**
```
Vertical 9:16, painterly night scene. A hilltop observatory dome and a brass telescope under a sky full of stars. A small lamp sends a soft warm beam up. A teenager stands far away, seen from behind. Slow tilt up. Deep indigo and gold. Avoid: any text, letters, faces, logos, watermarks, crowds, cartoon style, flicker.
```

### T7: The lighthouse lights (7.0 s)

**Upload:** start frame `bg-intro2.jpg`; ingredient `bg-intro3.jpg` for the student.

```
Vertical 9:16, painterly illustration come to life. A stone lighthouse on a sea cliff at night. The lamp room is dark, and then it lights: a warm gold glow grows slowly, then a soft beam turns across the dark sea and over the hills. A teenage student with a dark hooded jacket and olive backpack stands small in the foreground, seen from behind, a brass lantern in one hand, looking up at the light. A small firefly of warm gold light drifts near their shoulder. The town lights glow far below. Camera: a slow rise from the student up to the lamp room as it lights, 35 mm lens feel. Light: deep indigo night (#141a3a), the lamp in gold (#ffcf6b) and cream (#fff3d6), amber on the stone (#f2a03d). Mood: hope, quiet triumph, calm. Not a celebration. Avoid: any text, letters, numbers, logos, watermarks, readable screens, crowds, faces, cartoon style, fireworks, castles, fantasy creatures, flicker, warping.
```

**Sound.** A soft warm hum rises and holds, waves, wind. One long calm breath of sound under the final line.
**Dialogue.** Narrator, calm and warm, Indian English, at 4.5 s: "Take the lantern." Say it plain. Not a trailer voice.
**Transition.** End on the lit lighthouse. Fade to the still title card (added in your editor).
**Fallback:**
```
Vertical 9:16, painterly night scene. A stone lighthouse on a sea cliff, its lamp slowly lighting to warm gold, a soft beam over the dark sea. A small teenager seen from behind in the foreground, lantern in hand. Slow rise to the light. Deep indigo, gold. Avoid: any text, letters, faces, logos, watermarks, crowds, fireworks, cartoon style, flicker.
```

## 6. Audio note

**Recommendation for the in-game opening: make the clips silent in the game, and use your local voice model.**

| Piece | Choice | Why |
| --- | --- | --- |
| Narrator lines (Shots 1, 2, 4) | Local voice model per `docs/OPENING_VOICE_SCRIPT.md` | Words must match the captions exactly. Timing is fixed to the second. Veo may change a word or its pace. |
| Jyo lines (Shot 3) | Local voice model | Jyo has no mouth, so Veo's lip-sync has nothing to do. A local voice gives a steady Jyo in every use. |
| Family murmurs (Shot 1) | Veo or the local files, either | No words needed. Veo is good at murmurs. |
| Ambience and SFX (wind, waves, flasks, wings) | Veo | Veo is good at these, and they match the picture. |
| Town clip and ending ambience | Veo, kept in the file (ending has no voice) | Place sounds help the hand-over. Short, quiet, no words. |
| Cover loop | None. Export with `-an` | It plays muted behind the title. |
| Trailer narrator | Veo's dialogue (Indian English accent) is fine to try | The trailer has no fixed caption timing. Redo the take until it sounds right. Use the local voice if it fails. |

Rules:
- Keep the game's own audio cues (`app/audio/`) as the sound source. Export the in-game video **without audio** (`-an`) so the two never play together.
- If you want Veo to make the voice, paste this under the scene text: `Audio: a calm young narrator, off-screen, speaking Indian English, says: "Aunty says doctor." Then: "Cousin says engineering."` and so on. Then check each word against the captions.
- For Indian English in Veo, write it in the prompt: "natural Indian English accent, calm, warm, not a trailer voice".
- Music: none by default. If a bed is wanted, make one soft single-instrument bed (a flute or a plucked string, very quiet, low in the mix) yourself or from a source whose licence you hold. Do not use any copyrighted track, and do not ask Veo for "music like" any film or game.
- Final level: about -16 LUFS, same as the voice files.

## 7. Town clips: 15 clips of 5 seconds

**Job.** When the student arrives in a town, a 5 s clip plays. It starts with gentle motion and ends on a near-still frame that matches that town's still picture (`bg-sNN.jpg`). Then the game hands over to the still with no jump. The student then lights the lamp, so **no lamp is lit in the clip**.

**What the stills really show (checked by eye).** The 14 town stills (`bg-s01` to `bg-s14`) are square. Most have small people at a distance and painted lanterns that are already glowing. The game draws its own small unlit lamp on top, at the right edge about halfway down. So the prompts say "no new lamp is lit" and keep the painted lanterns as they are. Do not ask Flow to add a lamp at the right edge.

**Make the frames first.** Run this once from the repo root (needs `ffmpeg`). It cuts each picture to 9:16 and 720 x 1280. The number is where the crop sits left to right (0 = left edge, 1 = right edge), chosen to keep each town's main subject and to leave out stray marks near the edges.

```bash
mkdir -p ~/flow/frames ~/flow/raw
crop() { ffmpeg -y -v error -i "app/art/bg-$1.jpg" \
  -vf "crop=ih*9/16:ih:(iw-ih*9/16)*$2:0,scale=720:1280:flags=lanczos" \
  -q:v 3 ~/flow/frames/frame_$1.jpg; }
crop s01 0.50
crop s02 0.50
crop s03 0.55
crop s04 0.30
crop s05 0.65
crop s06 0.45
crop s07 0.40
crop s08 0.50
crop s09 0.40
crop s10 0.50
crop s11 0.68
crop s12 0.50
crop s13 0.60
crop s14 0.55
crop s15 0.50
crop gate 0.40
crop intro1 0.50
crop intro2 0.50
crop intro3 0.50
crop intro4 0.50
```

Look at every frame once. The game must show the **same crop** as the poster, so tell the engineer these crop positions.

**Settings in Flow.** Frames to video. Upload the frame as the **first frame** and again as the **last frame**. Aspect 9:16. Length: 6 s (Flow often offers 4, 6 and 8 s only; check). Generate 2 to 4 takes. Fast model to test, Quality model for finals.

**Why 6 s and not 5 s.** If you trim a 6 s clip to 5 s you cut off the end frame. So keep all 6 s and speed it up by 1.2 times in ffmpeg (section 10). Motion this gentle looks fine at 1.2 times.

**If the end does not settle.** Use the second method in section 10: use only a start frame, make 8 s, keep the first 4 s, then fade into the real still for 1 s. The hand-over is then exact by construction.

**Every town prompt already ends with the avoid line.** Each box below is complete. Copy all of it.

### Town 1: Salt Harbour (`s01`)

**Upload:** `frames/frame_s01.jpg` as the **first and last frame** (crop of `bg-s01.jpg`, crop position 0.50). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The number on the ferry hull is a soft unreadable mark. It must not become clear digits.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A white ferry with lit windows tied at a wooden dock at dusk, a crowd waiting on the pier, two small brass lanterns on the planks, a rope chain, a calm bay and hills, a gold sunset band under a teal sky. The water shimmers and ripples slowly, the sunset glints on it, the clouds drift, the lantern flames on the pier flicker softly, a few people on the pier shift their weight, a far boat bobs a little. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Water lapping on the dock, a rope chain clinking softly, a far murmur of a crowd with no clear words, one distant gull.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A white ferry with lit windows tied at a wooden dock at dusk, a crowd waiting on the pier, two small brass lanterns on the planks, a rope chain, a calm bay and hills, a gold sunset band under a teal sky. Only the water ripples and the clouds drift. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 2: Lantern Bridge (`s02`)

**Upload:** `frames/frame_s02.jpg` as the **first and last frame** (crop of `bg-s02.jpg`, crop position 0.50). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** Odd marks in the top-right corner of the still are outside the 9:16 crop. If marks or glyphs appear, regenerate.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wooden bridge at dusk lined with glowing paper lanterns and a tall lamp post, a stone bridge and a waterfall far behind, three walkers far down the bridge, mist over dark water. The paper lanterns sway a little on their strings, mist drifts over the river, the waterfall in the distance shimmers, the three far walkers take slow steps away, the lamp post flame flickers softly. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** River and waterfall hush, a soft wooden creak, paper lanterns rustling.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wooden bridge at dusk lined with glowing paper lanterns and a tall lamp post, a stone bridge and a waterfall far behind, three walkers far down the bridge, mist over dark water. Only the mist drifts and the lanterns sway. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 3: Clockmaker's Lane (`s03`)

**Upload:** `frames/frame_s03.jpg` as the **first and last frame** (crop of `bg-s03.jpg`, crop position 0.55). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The clock face stays still and soft. Numerals must not turn sharp or change.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A tall clock tower with a lit arched doorway on a cobbled lane at dusk, warm windows, two small people crossing the cobbles, a few odd fish-shaped forms floating in the sky. The warm windows and lanterns flicker softly, the fish-shaped forms drift slowly across the sky, the two small figures take a few steps, the clouds move, a bird crosses. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** A soft slow clock ticking, far footsteps on cobbles, evening wind, a faint wind chime.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A tall clock tower with a lit arched doorway on a cobbled lane at dusk, warm windows, two small people crossing the cobbles, a few odd fish-shaped forms floating in the sky. Only the sky shapes drift and the window light flickers. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 4: Orchard Village (`s04`)

**Upload:** `frames/frame_s04.jpg` as the **first and last frame** (crop of `bg-s04.jpg`, crop position 0.30). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The game always starts here, so every student sees this clip. Spend extra takes on it.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A big apple tree hung with glowing lanterns, a winding stone path to wooden houses, baskets of apples, a rope-net frame on the right, forest hills with a far spire, a low gold sun. Leaves rustle, the lanterns on the branches sway a little, the grass and the net move in a light breeze, the two small figures by the apple baskets shift a little, the sky glow holds steady. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Leaves in a light breeze, evening crickets, a faint wooden creak of a press far away, one soft bird.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A big apple tree hung with glowing lanterns, a winding stone path to wooden houses, baskets of apples, a rope-net frame on the right, forest hills with a far spire, a low gold sun. Only the leaves rustle and the lanterns sway. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 5: Fog Pass (`s05`)

**Upload:** `frames/frame_s05.jpg` as the **first and last frame** (crop of `bg-s05.jpg`, crop position 0.65). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** Keep the lamp post flame steady. No flare and no beam through the fog.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A mountain pass at dusk with fog in the valley, a tall lamp post glowing, a small group of travellers climbing wooden steps, a stone hut at the right with a lantern and a garland. The fog drifts slowly across the valley, the travellers take slow steps up, the garland by the hut sways, the lamp post flame stays steady. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Cold wind through pines, footsteps on stone, a far soft bell, a muffled hush.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A mountain pass at dusk with fog in the valley, a tall lamp post glowing, a small group of travellers climbing wooden steps, a stone hut at the right with a lantern and a garland. Only the fog drifts. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 6: Night Bazaar (`s06`)

**Upload:** `frames/frame_s06.jpg` as the **first and last frame** (crop of `bg-s06.jpg`, crop position 0.45). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The paper on the ground must stay unreadable. The torn white edge at the top and bottom of the picture must not move.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A blue misty night market corner with strings of lanterns, a small lit stall where a person in a hooded jacket browses, an old brass drum-shaped machine on a wooden stand, a fruit cart, a large round pot, a sheet of paper on the ground. The lanterns sway on their strings, mist drifts across the ground, the person at the stall shifts and tilts their head to look at a shelf, a corner of the loose paper on the ground lifts in the breeze. The old machine stays completely still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** A low night murmur with no words, lanterns creaking on their strings, a far soft bell, one faint metal tick.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A blue misty night market corner with strings of lanterns, a small lit stall where a person in a hooded jacket browses, an old brass drum-shaped machine on a wooden stand, a fruit cart, a large round pot, a sheet of paper on the ground. Only the lanterns sway and the mist drifts. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 7: River Camp (`s07`)

**Upload:** `frames/frame_s07.jpg` as the **first and last frame** (crop of `bg-s07.jpg`, crop position 0.40). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The sun must not move or grow.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wide river at sunset between dark hills, bare trees, two travellers sitting on a mat sharing a small lantern, another traveller with a staff beside a tent, a lantern on the ground and one hanging from a branch. The water ripples and the low sun glitters on it, the bare branches sway, the grass moves, the clouds drift, the lantern flames flicker softly, the travellers move only a little. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** River lapping on the bank, wind in reeds, a far bird, a soft murmur with no words.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wide river at sunset between dark hills, bare trees, two travellers sitting on a mat sharing a small lantern, another traveller with a staff beside a tent, a lantern on the ground and one hanging from a branch. Only the water glitters and the grass sways. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 8: Weavers' Town (`s08`)

**Upload:** `frames/frame_s08.jpg` as the **first and last frame** (crop of `bg-s08.jpg`, crop position 0.50). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** A sign at the far left of the still is outside the crop. If a sign appears, regenerate.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A lamp-lit town lane at dusk with a bell tower, slate roofs, cloth awnings and bunting, barrels, a shop with books, a few small people and an orange dog on glowing cobbles. The picture shows no loom, so the motion is cloth and light. The bunting and cloth awnings flutter, the orange dog's tail wags and its ears twitch, the stars twinkle, the small people take a step or two, the lamps flicker softly. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Soft cloth fluttering, far footsteps, a faint wooden clack of a far loom, night insects.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A lamp-lit town lane at dusk with a bell tower, slate roofs, cloth awnings and bunting, barrels, a shop with books, a few small people and an orange dog on glowing cobbles. The picture shows no loom, so the motion is cloth and light. Only the bunting flutters and the dog's tail wags. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 9: Glass Cliffs (`s09`)

**Upload:** `frames/frame_s09.jpg` as the **first and last frame** (crop of `bg-s09.jpg`, crop position 0.40). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The brass lantern at the far left of the still is outside the crop. That is expected.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. Tall glassy cliffs lit amber on one side around a gap of gold dusk sky, five small travellers on a stone ledge looking up, a drifting cloud, a soft amber light on the rock faces. Thin mist drifts through the gap between the cliffs, the light on the rock faces breathes very slightly, the five small travellers shift and one lifts an arm to point up, the clouds move. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Wind on rock, a deep faint echo, boots scuffing stone, a wide quiet.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. Tall glassy cliffs lit amber on one side around a gap of gold dusk sky, five small travellers on a stone ledge looking up, a drifting cloud, a soft amber light on the rock faces. Only the mist drifts through the gap. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 10: Salt Market (`s10`)

**Upload:** `frames/frame_s10.jpg` as the **first and last frame** (crop of `bg-s10.jpg`, crop position 0.50). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** Keep it calm. No fight, no raised sticks, no big flames.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A tented market at dusk, a small fire and spilled salt on the ground in the middle, traders and onlookers at a distance, hanging lanterns, a pale moon over far hills, a flag on a pole. The small fire flickers low and a thin smoke rises, the lanterns sway, the tent cloth and the flag flutter, the people only shift their weight and gesture a little. Nobody moves fast and nobody fights. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** A low market murmur with no clear words, a gentle crackle of a small fire, tent canvas flapping, wind.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A tented market at dusk, a small fire and spilled salt on the ground in the middle, traders and onlookers at a distance, hanging lanterns, a pale moon over far hills, a flag on a pole. Only the fire flickers and the flag flutters. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 11: Observatory Hill (`s11`)

**Upload:** `frames/frame_s11.jpg` as the **first and last frame** (crop of `bg-s11.jpg`, crop position 0.68). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** No shooting star and no beam from the dome. The game lights the lamp.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A domed observatory with a glowing doorway on a hilltop terrace, a fence, a valley full of tiny town lights, stars in a sky that goes from amber to blue, four small visitors on the terrace with long shadows. The stars twinkle, the town lights in the valley shimmer, the trees sway a little, one visitor lifts an arm toward the sky, the doorway glow stays steady, a thin cloud drifts. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Crickets, a soft hilltop wind, a faint far hum of a town, one soft footstep.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A domed observatory with a glowing doorway on a hilltop terrace, a fence, a valley full of tiny town lights, stars in a sky that goes from amber to blue, four small visitors on the terrace with long shadows. Only the stars twinkle and the town lights shimmer. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 12: Herbalists' Garden (`s12`)

**Upload:** `frames/frame_s12.jpg` as the **first and last frame** (crop of `bg-s12.jpg`, crop position 0.50). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** Chalk writing on the flower pot at the lower left of the still is outside the crop. If any writing appears, regenerate.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A garden at night with paper lanterns hanging from tree branches, iron lamp posts, flower beds, a round stone circle where a girl in a yellow coat stands, wooden houses with lit windows. The paper lanterns sway on the branches, a few tiny gold specks drift like fireflies, the flowers and ferns sway, a bird crosses the sky, the lamp post flames flicker softly, the girl stays almost still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** Crickets, leaves in a breeze, a soft wind chime, one night bird.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A garden at night with paper lanterns hanging from tree branches, iron lamp posts, flower beds, a round stone circle where a girl in a yellow coat stands, wooden houses with lit windows. Only the lanterns sway and the flowers move. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 13: Printers' Quarter (`s13`)

**Upload:** `frames/frame_s13.jpg` as the **first and last frame** (crop of `bg-s13.jpg`, crop position 0.60). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** The small papers and the framed picture at the right must stay unreadable and still.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. An old printing press with brass pipes on a wooden bench in a stone square, a hanging lantern above it, warm shop windows, misty old houses, a pot of flowers. The lantern sways a little on its arm, mist drifts behind the houses, the window glow flickers softly, small dust specks float in the lantern light, the wires sway. The press stays completely still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** A quiet square, a faint metal creak of a lantern chain, a far wind, a soft murmur.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. An old printing press with brass pipes on a wooden bench in a stone square, a hanging lantern above it, warm shop windows, misty old houses, a pot of flowers. Only the lantern sways and the mist drifts. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 14: Healing House (`s14`)

**Upload:** `frames/frame_s14.jpg` as the **first and last frame** (crop of `bg-s14.jpg`, crop position 0.55). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** A painter-style signature sits at the bottom right of the still. The 9:16 crop at 0.55 leaves it out. Do not widen the crop.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A small cottage with a glowing arched doorway and warm windows, a lit round rug on the stones, cushioned chairs, small lanterns on the ground, a girl in a blue dress at the left, a bare tree, hills under an orange and violet dusk. The window and doorway light flickers softly, the curtains stir, the small string lights on the fence twinkle, the clouds drift, the girl takes a slow step, the small lanterns flicker. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** A soft wind, crickets, a faint wooden creak, a very quiet wind chime.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A small cottage with a glowing arched doorway and warm windows, a lit round rug on the stones, cushioned chairs, small lanterns on the ground, a girl in a blue dress at the left, a bare tree, hills under an orange and violet dusk. Only the window light flickers and the curtains stir. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

### Town 15: Festival Square (`s15`)

**Upload:** `frames/frame_s15.jpg` as the **first and last frame** (crop of `bg-s15.jpg`, crop position 0.50). **Make 6 s** (or 8 s), then trim or retime to 5.0 s (section 10).
**Watch for:** This still is in a different, more realistic style from the others, and it is 2:3 (the others are square). Keep it as it is. Add no people.

```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wide cobbled square at sunset with a tall wooden arch and two banners in the middle, strings of lanterns, empty stalls with cloth canopies, a domed pavilion at the left, palm trees, a lake and far town lights, steps, flower petals on the stones, a small lit diya at the bottom right. No people. The banners flutter, the strings of lanterns sway, the stall canopies move, the palm fronds sway, flower petals drift along the cobbles, the diya flame flickers, the far lights on the lake twinkle. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```

**Sound (ambience only, no words).** A gentle evening wind, banners flapping, lake water hush, a very faint far festival drum, crickets.

**Fallback prompt** (use if buildings warp or the end does not settle):
```
Vertical 9:16, painterly illustration come to life. The first frame and the last frame are exactly the uploaded picture. The motion starts gently, rises a little, then settles so the last second is almost still. A wide cobbled square at sunset with a tall wooden arch and two banners in the middle, strings of lanterns, empty stalls with cloth canopies, a domed pavilion at the left, palm trees, a lake and far town lights, steps, flower petals on the stones, a small lit diya at the bottom right. No people. Only the banners flutter and the petals drift. Everything else stays perfectly still. Camera: locked, or the very slightest slow push in. No new lamp is lit and no light switches on: the lamps already in the picture keep a soft steady glow. People stay small and far, faces never in close-up. Light: deep indigo, warm amber and gold, cream highlights. Mood: quiet, calm. Avoid: any text, letters, numbers, logos, watermarks, close-up faces, new lights switching on, camera shake, scene change, warping buildings, cartoon squash and stretch.
```


## 8. Ending clip: the lighthouse lights (6 to 8 seconds)

**Job.** The payoff after town 8, when the lighthouse lights. The lamp room lights, then its beam sweeps across the road of lamps the student lit. It must **not reveal the letter**: no door, no paper, no person, no words, no voice. It only shows the light.

**About the source picture.** `app/art/bg-lighthouse.jpg` is the model for the composition, but **do not upload it**. It is square and carries a third-party watermark ("@ ZALAKS") bottom-left. What it shows: a tall, plain stone lighthouse at the end of a straight glowing road, rows of lamp posts on both sides (taller at the front), calm dark sea, an orange dusk band, a few stars, rays around the lamp. Use the words below instead (Option A). The lighthouse in `bg-welcome.jpg` (striped, on a winding cliff road) and in the opening (round, ivy, arched door) are different towers. This clip uses the tall plain one.

**Option A (use this one): words only, no upload.** Make 8 s, trim to 7 s. Aspect 9:16. Text to video.

```
Vertical 9:16, painterly illustration come to life. A straight road of warm gold light leads away from the viewer to a tall round stone lighthouse at the end of a headland, calm dark sea on both sides, deep indigo dusk with a last orange band on the horizon and a few stars. Four lamp posts stand on each side of the road, eight in all, each with a small warm lamp already glowing. At the start the lighthouse lamp room is dark. Then it lights: a warm gold glow grows in the lamp room, soft rays spread, and a wide gentle beam begins to sweep slowly across the sky, then the sea, then low across the road, so each lamp post brightens a little as the beam passes over it. The beam passes once and then rests, calm and bright, along the road. Camera: a locked wide view, with a very slow rise in the last two seconds. No people anywhere. No door, no paper, no writing. Light: deep indigo night, gold and cream light from the lighthouse, amber on the road. Mood: hope, quiet, steady. Not a celebration: no fireworks, no sparkles. Audio: a soft warm hum that rises and holds, gentle waves, light wind, no voice, no music. Avoid: any text, letters, numbers, logos, watermarks, people, faces, doors, paper, fireworks, lens flare, cartoon style, castles, warping, flicker.
```

**Option B: a start frame (only if you have the right to the picture).** Ask the owner first (section 13). Cut a clean 9:16 from a **watermark-free** copy and upload only that crop, never the original file. The watermark sits at the far left, so a centred crop leaves it out, but check by eye that no mark remains.

```bash
ffmpeg -y -i bg-lighthouse-CLEAN.jpg -vf "crop=ih*9/16:ih:(iw-ih*9/16)*0.5:0,scale=720:1280:flags=lanczos" -q:v 3 ~/flow/frames/frame_lighthouse.jpg
```

Upload `frame_lighthouse.jpg` as the start frame and use the Option A prompt with its first sentence replaced by: "Vertical 9:16, painterly illustration come to life, starting exactly from the uploaded picture."

**Sound.** Kept in the file. Warm hum rising and holding, waves, light wind. No voice. The game can add its own sound over it.
**Transition.** Ends on the lit lighthouse with the beam resting on the road. The game then shows the result.
**Poster.** The last frame of the clip (command in section 10).

**Fallback prompt** (if the beam looks like a spotlight, people appear, or the lamp posts change):
```
Vertical 9:16, painterly night scene. A tall stone lighthouse at the end of a straight road with lit lamp posts on both sides, calm sea, deep indigo sky with stars and a last orange band. The lighthouse lamp slowly glows from dark to warm gold and a soft glow spreads along the road. Locked camera. No people, no door, no paper. Quiet and hopeful. Avoid: any text, letters, logos, watermarks, people, faces, fireworks, cartoon style, flicker.
```

## 9. Cover loop: 6 to 8 seconds, muted, seamless

**Job.** A quiet loop behind the title and the Begin button on the home page. It plays muted. The first and last frames match, so it never jumps.

**Source picture.** `app/art/bg-gate.jpg` (the cover: two teens from behind with the lantern, Jyo, the milky-way sky, the valley, a lit lighthouse far right). The frame is `frames/frame_gate.jpg` (crop 0.40, which keeps both teens and the far lighthouse). `bg-welcome.jpg` is not this picture (section 3).

**Layout the picture already has.** The top 40 percent is calm night sky with the Milky Way: the title goes there. The bottom quarter is dark grass and flowers: the button goes there. The prompt keeps both quiet. The game can still add its own dark gradient over the bottom.

**Settings in Flow.** Frames to video. Upload `frame_gate.jpg` as the first and the last frame. 9:16. Make **8 s**. Then make the loop seamless (section 10).

```
Vertical 9:16, painterly illustration come to life, a seamless loop. The first frame and the last frame are exactly the uploaded picture. Two teenagers seen only from behind on a hilltop at night, a boy with dark curly hair and a dark hooded top, a girl with long wavy dark hair and a rust-red top, olive backpacks, holding a brass lantern between them, with a small glowing firefly beside the lantern. They look out over a river valley full of tiny warm lamps and a lit lighthouse on a far hill. Very subtle motion only: the valley lamps twinkle softly, the firefly drifts in a small slow loop beside the lantern, the girl's hair and the grass move in a light breeze, the lantern flame flickers softly, thin clouds drift slowly low in the sky, the stars twinkle a little. The teenagers stay still and never turn around. The lighthouse light stays steady, with no beam. Camera: completely locked, no movement. The top 40 percent stays calm dark star-filled sky. The bottom quarter stays dark and quiet. Everything returns to where it started by the last frame. Mood: quiet, hopeful. No sound. Avoid: any text, letters, numbers, logos, watermarks, faces, turning heads, shooting stars, camera movement, fireworks, cartoon squash and stretch, flicker, warping hands.
```

**Sound.** None. Export with `-an`.

**Fallback prompt** (if the teens move or turn):
```
Vertical 9:16, painterly night scene, a seamless loop. Two teenagers seen only from behind on a hilltop with a brass lantern between them, looking over a valley of tiny warm lamps and a far lighthouse under a milky-way sky. Only the far lamps twinkle and thin clouds drift. Everything else is perfectly still. Locked camera. Avoid: any text, letters, logos, watermarks, faces, turning heads, camera movement, flicker.
```

**If the home page should use the road picture (`bg-welcome.jpg`) instead.** It is square and has no people. Cut a 9:16 crop and use this prompt, with no start frame:
```
Vertical 9:16, painterly dusk scene, a seamless loop. A winding road with glowing lamp posts along both sides leads over green headland grass to a small striped lighthouse on a cliff beside a calm sea, a low sun on the horizon, orange and teal sky. Very subtle motion only: the lamp glow breathes softly, the grass sways, thin clouds drift, the sea shimmers. No people. Locked camera. The top 40 percent stays calm sky and the bottom quarter stays dark. Avoid: any text, letters, logos, watermarks, people, camera movement, flicker.
```

## 10. Delivery specs for the web

**Rules for every video.** 720 x 1280 (9:16), H.264 Main profile, `yuv420p`, 24 fps, `faststart`. Optional WebM (VP9) of each file. No burned-in captions. Keep the raw Flow exports outside the repo in `~/flow/raw/` (they are large).

| Video | Length | Video bitrate | Audio | Size limit | Expected |
| --- | --- | --- | --- | --- | --- |
| Town clip (x15) | 5.0 s | 1.1 Mbps | AAC 48 kbps mono ambience | 0.8 MB each | 0.6 to 0.7 MB |
| Opening (4 files) | 6.0 + 3.7 + 7.2 + 7.2 s | 1.2 Mbps | none (`-an`) | 4 MB in all | 3.6 MB |
| Ending | 7.0 s | 1.2 Mbps | AAC 64 kbps | 1.5 MB | 1.1 MB |
| Cover loop | 6.0 s | 1.5 Mbps | none (`-an`) | 1.5 MB | 1.1 MB |
| Trailer | about 37 s | 1.3 Mbps | AAC 64 kbps | 7 MB | 6.3 MB |
| Posters (every clip) | one JPG each | | | 100 KB each | 50 to 90 KB |

**Total budget** (all files on the site):

| Group | Files | Size |
| --- | --- | --- |
| Town clips | 15 | about 10 MB |
| Opening | 4 | about 3.6 MB |
| Ending | 1 | about 1.1 MB |
| Cover loop | 1 | about 1.1 MB |
| Trailer | 1 | about 6.3 MB |
| Posters | 23 | about 1.5 MB |
| **All together** | 45 | **about 23.6 MB** |

A student does not download all of it. A typical play is the cover loop, the opening, 8 towns, the ending and their posters: about 12 MB. The trailer loads only when someone taps "Watch the trailer". If a file is over its limit, lower the bitrate and encode again.

**Exact file names** (all in `app/video/`; each poster has the same name with `.jpg`):

```
app/video/opening_1.mp4  opening_2.mp4  opening_3.mp4  opening_4.mp4
app/video/town_s01.mp4 ... town_s15.mp4
app/video/ending.mp4
app/video/cover_loop.mp4
app/video/trailer.mp4
app/video/<same name>.jpg        poster for each (town_s04.jpg, ending.jpg ...)
app/video/<same name>.webm       optional
```

**Opening is one file per shot, not one file.** The game starts each file when it shows that shot, so the captions stay in sync even on a slow phone. Poster for each opening shot is the crop of its intro picture (`frame_intro1.jpg` to `frame_intro4.jpg`).

### Commands

Install `ffmpeg` on a computer (a phone cannot do this well). Run from the repo root. Raw Flow exports go in `~/flow/raw/` named `town_s01.mp4`, `opening_1.mp4`, `ending.mp4`, `cover.mp4`, `trailer_T1.mp4` to `trailer_T7.mp4`.

**1. Town clips, method A (first and last frame, 6 s, speed up to 5 s).**
```bash
town() { ffmpeg -y -v error -i ~/flow/raw/town_$1.mp4 \
 -filter_complex "[0:v]setpts=PTS/1.2,scale=720:1280:flags=lanczos,fps=24[v];[0:a]atempo=1.2,aresample=48000[a]" \
 -map "[v]" -map "[a]" -t 5 -c:v libx264 -profile:v main -preset slow \
 -b:v 1100k -maxrate 1300k -bufsize 2600k -pix_fmt yuv420p \
 -c:a aac -b:a 48k -ac 1 -movflags +faststart app/video/town_$1.mp4; }
for id in s01 s02 s03 s04 s05 s06 s07 s08 s09 s10 s11 s12 s13 s14 s15; do town $id; done
```
If a Flow clip has no sound, remove `;[0:a]atempo=1.2,aresample=48000[a]`, the `-map "[a]"` and the `-c:a ... -ac 1` parts, and add `-an`.

**2. Town clips, method B (start frame only, 8 s: keep 4 s, then fade into the real still).** Use this when the end frame does not match. The last second is the exact still.
```bash
townB() { ffmpeg -y -v error -i ~/flow/raw/town_$1.mp4 -loop 1 -t 2 -i ~/flow/frames/frame_$1.jpg \
 -filter_complex "[0:v]trim=0:4,setpts=PTS-STARTPTS,fps=24,scale=720:1280[a];[1:v]fps=24,scale=720:1280,format=yuv420p,setpts=PTS-STARTPTS[s];[a][s]xfade=transition=fade:duration=1:offset=3[v];[0:a]atrim=0:5,asetpts=PTS-STARTPTS,afade=t=out:st=4:d=1,aresample=48000[a2]" \
 -map "[v]" -map "[a2]" -t 5 -c:v libx264 -profile:v main -preset slow \
 -b:v 1100k -maxrate 1300k -bufsize 2600k -pix_fmt yuv420p \
 -c:a aac -b:a 48k -ac 1 -movflags +faststart app/video/town_$1.mp4; }
townB s04
```

**3. Check that the last frame matches the still (a score of 0.90 or more is good).**
```bash
ffmpeg -y -sseof -0.2 -i app/video/town_s04.mp4 -i ~/flow/frames/frame_s04.jpg \
 -lavfi "[0:v]scale=720:1280,format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]ssim" \
 -frames:v 1 -f null - 2>&1 | grep "All:"
```

**4. Opening: trim each shot to its game time, no audio.**
```bash
op() { ffmpeg -y -v error -i ~/flow/raw/opening_$1.mp4 -t $2 \
 -vf "scale=720:1280:flags=lanczos,fps=24" -c:v libx264 -profile:v main -preset slow \
 -b:v 1200k -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p -an \
 -movflags +faststart app/video/opening_$1.mp4; }
op 1 6.0; op 2 3.7; op 3 7.2; op 4 7.2
```

**5. Ending: trim to 7 s, keep sound.**
```bash
ffmpeg -y -v error -i ~/flow/raw/ending.mp4 -t 7 \
 -vf "scale=720:1280:flags=lanczos,fps=24" -c:v libx264 -profile:v main -preset slow \
 -b:v 1200k -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p \
 -c:a aac -b:a 64k -movflags +faststart app/video/ending.mp4
```
If the beam ends too early or late, change `-t 7` (6 to 8 s is fine).

**6. Cover loop: make it seamless.** This takes an 8 s clip (at least 7 s), builds a 6 s loop, and blends the last second into the first second, so the end flows into the start.
```bash
ffmpeg -y -v error -i ~/flow/raw/cover.mp4 -filter_complex \
"[0:v]fps=24,scale=720:1280:flags=lanczos,split=3[x][y][z];\
[x]trim=1:6,setpts=PTS-STARTPTS[a];\
[y]trim=6:7,setpts=PTS-STARTPTS[t];\
[z]trim=0:1,setpts=PTS-STARTPTS[h];\
[t][h]xfade=transition=fade:duration=1:offset=0[b];\
[a][b]concat=n=2:v=1:a=0[v]" -map "[v]" \
-c:v libx264 -profile:v main -preset slow -b:v 1500k -maxrate 2000k -bufsize 4000k \
-pix_fmt yuv420p -an -movflags +faststart app/video/cover_loop.mp4
```
How it works: the loop plays from 1.0 s to 6.0 s of the raw clip, then a 1 s blend from 6.0 s into 1.0 s. The blend ends exactly where the loop begins. Test it: play the file on repeat and watch the join. The game should set `loop` and `muted`.

**7. Trailer: trim, join, encode.** Trims: T1 5.0, T2 4.0, T3 5.0, T4 5.0, T5 5.0, T6 6.0, T7 7.0 (37 s).
```bash
mkdir -p ~/flow/tr && cd ~/flow/tr
trm() { ffmpeg -y -v error -i ~/flow/raw/trailer_$1.mp4 -t $2 -vf "scale=720:1280:flags=lanczos,fps=24" \
  -c:v libx264 -crf 17 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -ac 2 $1.mp4; }
trm T1 5; trm T2 4; trm T3 5; trm T4 5; trm T5 5; trm T6 6; trm T7 7
printf "file 'T1.mp4'\nfile 'T2.mp4'\nfile 'T3.mp4'\nfile 'T4.mp4'\nfile 'T5.mp4'\nfile 'T6.mp4'\nfile 'T7.mp4'\n" > list.txt
cd - && ffmpeg -y -v error -f concat -safe 0 -i ~/flow/tr/list.txt \
 -c:v libx264 -profile:v main -preset slow -b:v 1300k -maxrate 1600k -bufsize 3200k -pix_fmt yuv420p \
 -c:a aac -b:a 64k -movflags +faststart app/video/trailer.mp4
```
Add the title card in your editor before this step, as a still, not in Flow.

**8. Posters (the matching still; every clip).**
```bash
for id in s01 s02 s03 s04 s05 s06 s07 s08 s09 s10 s11 s12 s13 s14 s15; do
  ffmpeg -y -v error -i ~/flow/frames/frame_$id.jpg -q:v 6 app/video/town_$id.jpg; done
for n in 1 2 3 4; do ffmpeg -y -v error -i ~/flow/frames/frame_intro$n.jpg -q:v 6 app/video/opening_$n.jpg; done
ffmpeg -y -v error -i ~/flow/frames/frame_gate.jpg -q:v 6 app/video/cover_loop.jpg
ffmpeg -y -v error -sseof -0.1 -i app/video/ending.mp4 -frames:v 1 -q:v 6 -update 1 app/video/ending.jpg
ffmpeg -y -v error -ss 1 -i app/video/trailer.mp4 -frames:v 1 -q:v 6 -update 1 app/video/trailer.jpg
```
If a poster is over 100 KB, raise `-q:v` (a bigger number is smaller).

**9. Optional WebM** (same name, `.webm`). Skip it if time is short.
```bash
ffmpeg -y -v error -i app/video/town_s04.mp4 -c:v libvpx-vp9 -b:v 900k -c:a libopus -b:a 32k app/video/town_s04.webm
```

**10. Check size and length of everything.**
```bash
ls -l app/video; du -ch app/video/*.mp4 | tail -1
for f in app/video/*.mp4; do echo $f $(ffprobe -v error -show_entries format=duration -of csv=p=0 $f); done
```

### How the game picks the files up

- Put the files in `app/video/` with the exact names above. Run `python3 app/build.py`. The build copies them into the page folders and the game finds them by name. A separate engineer is building this part. Nothing else needs editing.
- A clip that is missing is fine: the game shows the still, as it does today. The poster is the still the student sees before and after the clip.
- The game skips video when the student turns it off, on data saver, on a slow network, with reduced motion, or on a low-memory phone. The stills always work.
- The only tracking stays `opening_seen`. Add none for video without the owner's say.
- Cloudflare Pages must serve `.mp4` with range requests (it does by default). No CDN: the files come from our own site.
- If the story text changes (for example "10 to 14 minutes"), the opening captions, the voice files and the opening video change together.

**Notes.**
- Flow and Veo output may carry a visible or hidden mark that says it is AI-made. Keep it. Say "made with AI" in the post text where the platform asks for it.
- Do not use any real person's photo or voice as a reference.

## 11. Production order

Make the clips with the most impact first. Stop at any point: every clip is optional, and the game works without it. Generate 2 to 4 takes of each and keep the best.

| Step | What | Why first | Clips |
| --- | --- | --- | --- |
| 1 | **Opening** (sections 4, 6) | Every new student sees it. It sets the tone. | 4 |
| 2 | **Ending** (section 8) | The payoff. Most students who finish see it. | 1 |
| 3 | **Cover loop** (section 9) | The first thing on the home page. | 1 |
| 4 | **Town 4, Orchard Village** | The game **always starts here**, so every student sees it. | 1 |
| 5 | **Towns 1, 5, 6, 2, 10** | Towns that cover the most kinds of work, so they come up early for most students. | 5 |
| 6 | **Towns 3, 7, 9, 8** | Next most common. | 4 |
| 7 | **Towns 11, 12, 13, 14, 15** | Narrower towns, seen by fewer students. | 5 |
| 8 | **Trailer** (section 5) | It reuses ideas from the other clips. Make it last so you know your look. | 7 |

Steps 5 to 7 are a best guess from how many kinds of work each town offers. When the pilot gives real numbers on which towns come first, change the order. Count: 4 + 1 + 1 + 15 + 7 = 28 Flow clips, 22 final files. With 3 takes each, expect about 85 generations, so check your Flow credits before you start and use the Fast model for early takes.

**A working day.** Day 1: steps 1 to 4 (7 clips). Day 2: steps 5 and 6 (9 clips). Day 3: steps 7 and 8 (12 clips). Encode and check each clip the same day, using the checklist in section 12.

## 12. Review checklist (use for every clip)

Tick every item before you keep a take. If one fails, regenerate or use the fallback prompt.

**For every clip**

- [ ] It is 9:16 and plays at 720 x 1280.
- [ ] No letters, numbers, signs or watermarks anywhere (check lamps, doors, stalls, paper, hulls, clocks, the corners).
- [ ] No face in close-up. No crowd of faces.
- [ ] Hands, if any, have five fingers.
- [ ] No flicker, popping lamps, warping buildings or sudden cuts.
- [ ] One gentle camera move at most. No shake.
- [ ] The file is under its size limit (section 10).

**Town clips**

- [ ] The first frame looks like the still. The **last frame** looks like the still (SSIM check, 0.90 or more).
- [ ] The last second is almost still.
- [ ] No new lamp lights up and no beam, flare or glow appears. The game lights the lamp.
- [ ] Nobody is added or removed. The painted lanterns look the same as in the still.
- [ ] The sound is ambience only: no words, no music, nothing loud.
- [ ] The watch-for note for that town is clear (section 7).

**Ending clip**

- [ ] The lighthouse lamp goes from dark to lit, then the beam sweeps across the road once.
- [ ] No door, no paper, no letter, no person, no voice, no text. It does not hint at the letter's words.
- [ ] No watermark and nothing copied from `bg-lighthouse.jpg`'s corner.
- [ ] Calm and hopeful. No fireworks, no big flare.

**Cover loop**

- [ ] Muted. The first and last frames are the same and the loop joins without a jump.
- [ ] The teens stay from behind and never turn.
- [ ] The top 40 percent is calm sky, so the title is easy to read. The bottom quarter is dark, so the button stands out.
- [ ] The motion is very subtle. No camera move. No shooting star.

**Opening and trailer** (from the first version of this pack)

Tick all of these before you keep a take. If any item fails, regenerate or use the fallback prompt.

**Character**
- [ ] The student has the same hair, jacket and olive backpack as `bg-intro3.jpg`.
- [ ] The student's face is never shown.
- [ ] Jyo is a small warm light with soft wings, not a cartoon with a big smile.
- [ ] The lamplighter never appears. Only her lantern, door and flasks.
- [ ] No crowd of faces. No face in close-up.

**Text and marks**
- [ ] No letters, numbers or signs anywhere (check lamps, doors, stalls, paper, machine, sky).
- [ ] The paper on the lighthouse door is a blur and unreadable.
- [ ] No logo, watermark or brand.
- [ ] No phone or screen with content.

**Hands and body**
- [ ] Each hand has five fingers. No melted or doubled fingers.
- [ ] Hands hold the flasks and lantern steadily. Nothing passes through them.

**Picture quality**
- [ ] No flicker or popping lamps. Flames move gently.
- [ ] No warping buildings, bridge or tower as the camera moves.
- [ ] Only one camera move. Smooth and slow.
- [ ] Colours match the palette: indigo, amber, gold, cream.
- [ ] 9:16, and the subject stays inside the middle 80% (safe for phone screens).
- [ ] The first and last frames are calm, so cuts look clean.

**Tone**
- [ ] Older-teen feel: quiet and honest, not childish, not epic.
- [ ] No "chosen one" glow, no hero pose, no fireworks.
- [ ] No fear or gore. A mystery, not a horror.
- [ ] Indian setting is clear (ghats, diyas, marigold, spire, river).
- [ ] The trailer shows no letter and does not say why the lighthouse went dark.

**Sound**
- [ ] No music in Veo's audio unless you chose a bed.
- [ ] Spoken lines match the captions word for word (opening).
- [ ] Indian English accent, calm, not a trailer voice.
- [ ] "10 to 14 minutes" is said as "ten to fourteen".
- [ ] The in-game opening file is silent (`-an`).

**Files**
- [ ] Opening 4 MB or less in all four files, trailer 7 MB or less.
- [ ] 720 x 1280, 24 fps, `faststart`.
- [ ] Poster JPG made. File names as in section 10.

## 13. Credits and rights

- **Use only art the owner has the right to use.** Every start frame, ingredient and prompt picture must be art the owner made, paid for, or has a licence for. Keep a note of where each picture came from. Do not use a real person's face, voice or likeness, and do not name any film, game, studio or artist in a prompt.
- **Flag: `app/art/bg-lighthouse.jpg` has a third-party watermark** ("@ ZALAKS", bottom-left). Do not upload it to Flow and do not use it in a video or a poster. The owner should confirm where it came from and either get a clean, licensed copy or replace the picture. The ending clip uses a words-only prompt so it does not depend on it.
- **Flag: other marks in the stills.** `bg-s14.jpg` has a painter-style signature at the bottom right. `bg-s02.jpg` has odd glyph marks at the top right. `bg-s06.jpg` has a torn white paint edge. `bg-s08.jpg` and `bg-s12.jpg` have small writing on a sign and a flower pot. The crops in section 7 leave most of these out, but the owner should confirm the source of these pictures too, and have the marks cleaned in the stills.
- **AI-made material.** Clips from Flow (Veo) are AI-made. Keep any mark Flow adds. Say "made with AI" in post text where a platform asks for it. Check the current Flow terms on commercial use and credits before you publish.
- **Sound.** Do not use any copyrighted track. If you add a music bed, make it yourself or use a source whose licence you hold. Do not ask Veo for "music like" anything.
- **Credits line for posts and the about page** (the owner may edit it): "Story, art direction and game by Margwise. Video made with Google Flow (AI)."
- **Raw exports.** Keep them out of the repo. Keep a list of the prompts and settings used for each final clip, so a clip can be remade.
