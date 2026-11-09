# Voice script

Audio is optional and off by default. The captions carry the whole story. This file is for generating the voices on a local model and dropping the files in with no code change.

**What is wired today.** Only the opening cues in `meta.opening` play (17 files: 12 spoken lines and 5 sound beds). The game does **not** play any other voice. The last section of this file lists optional future lines. They are written down so they are ready, but nothing in the game plays them yet.

## How it works
- Cues live in `data/story2.json`, under `meta.opening[].audio`. Each cue has `id`, `file`, `at` (seconds from the start of its shot), `speaker`, `line`, `max` (longest length in seconds), and optionally `loop` and `vol` (0 to 1).
- `python3 app/build.py` copies every file in `app/audio/` into the page folders and lists them in the page (`window.OP_AUDIO`). A cue plays only if its file is in that list.
- No files: no "Sound on" button and no network request for audio. With files: the button appears in the opening, the student's choice is remembered on that device, and sound stays off until they turn it on. Tap, skip and the last button all stop the sound at once.
- The `line` of a spoken cue must match the caption word for word.

## Format
- Mono MP3 (or OGG/Opus), 48 kHz, about -16 LUFS, silence trimmed at both ends.
- Name each file exactly as in the table, for example `app/audio/op1_l1.mp3`. Put all files in `app/audio/`.
- Keep all files together under about 150 KB. A mono MP3 at 32 kbps is about 4 KB a second.

## Voices
- **Narrator**: Indian English accent, calm, warm, natural, a little low. Older teen or young adult. Not a trailer voice, not cartoonish.
- **Jyo** (the firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Family murmurs**: Aunty, Cousin and Sir as soft overlapping voices, no clear words, warm and caring, never mocking or harsh. They are people who love the student.
- Pace: a touch brisk, about 3 words a second, because each line has only a few seconds. Stop at the end of the sentence. No breath at the end.

## Opening cues
These match `meta.opening` in `data/story2.json` exactly: ids, file names, start times, max lengths and words. The caption for each spoken cue is the same text.

| Cue id | File | Shot | Speaker | Start (s) | Max (s) | Line | Tone |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `op_amb_night` | `op_amb_night.mp3` | 1 | Night ambience: crickets, soft wind, far-off festival hum | 0 | 60 | (no spoken line) | Loop, low. Crickets, soft wind, far festival hum. Seamless loop of about 10 s. vol 0.35. Loops. |
| `op1_family` | `op1_family.mp3` | 1 | Family murmurs | 0.1 | 5 | (no spoken line) | Soft overlapping murmurs, no words you can pick out. Warm and caring. Fade in and out. vol 0.35. |
| `op1_l1` | `op1_l1.mp3` | 1 | Narrator | 0.15 | 1.2 | Aunty says doctor. | Even, a little weary. The first of three. |
| `op1_l2` | `op1_l2.mp3` | 1 | Narrator | 1.54 | 1.2 | Cousin says engineering. | Same, slightly faster. |
| `op1_l3` | `op1_l3.mp3` | 1 | Narrator | 2.93 | 1.2 | Sir says science. | Same, then a small pause after. |
| `op1_l4` | `op1_l4.mp3` | 1 | Narrator | 4.32 | 1.7 | Everyone has your road ready. | Lower and slower. This is the pressure line. |
| `op2_lamp_out` | `op2_lamp_out.mp3` | 2 | Lamp going out: a warm hum fading to cold sea wind | 0.4 | 6 | (no spoken line) | A warm hum that fades into cold sea wind. Slow fade. vol 0.6. |
| `op2_l1` | `op2_l1.mp3` | 2 | Narrator | 0.15 | 1.4 | The lighthouse went dark. | Quiet, a little hushed. |
| `op2_l2` | `op2_l2.mp3` | 2 | Narrator | 1.77 | 1.9 | Her door open. Her oil untouched. | Slow, puzzled. Short break after "open". |
| `op3_firefly` | `op3_firefly.mp3` | 3 | Firefly wings: a soft, bright buzz that settles | 0.3 | 5 | (no spoken line) | Soft bright wing buzz that settles. Short. vol 0.4. |
| `op3_l1` | `op3_l1.mp3` | 3 | Jyo | 0.15 | 1.9 | I'm Jyo. She left by choice. | Jyo: light, direct, shy. "Jyo" clear. |
| `op3_l2` | `op3_l2.mp3` | 3 | Jyo | 2.23 | 1.9 | Light a lamp in each town. | Jyo: plain and warm. |
| `op3_l3` | `op3_l3.mp3` | 3 | Jyo | 4.31 | 2.8 | Two flasks each. Spend them on what you'd really do. | Jyo: steady, slight stress on "really". |
| `op4_flasks` | `op4_flasks.mp3` | 4 | Glass flasks touching and a lantern flame flicker | 0.3 | 5 | (no spoken line) | Two glass flasks touching, a lantern flame flicker. Short and gentle. vol 0.5. |
| `op4_l1` | `op4_l1.mp3` | 4 | Narrator | 0.15 | 2.3 | An interest guide, not a test. No marks. | Plain and honest. No selling voice. |
| `op4_l2` | `op4_l2.mp3` | 4 | Narrator | 2.69 | 1.7 | About 10 to 14 minutes. | Plain. Say "10 to 14" as "ten to fourteen". |
| `op4_l3` | `op4_l3.mp3` | 4 | Narrator | 4.54 | 2.6 | You get kinds of work, and a school path. | Warm, easy. The last line before the button. |

Captions on screen, one line at a time: shot 1 "Aunty says doctor. / Cousin says engineering. / Sir says science. / Everyone has your road ready."; shot 2 "The lighthouse went dark. / Her door open. Her oil untouched."; shot 3 "I'm Jyo. She left by choice. / Light a lamp in each town. / Two flasks each. Spend them on what you'd really do."; shot 4 "An interest guide, not a test. No marks. / About 10 to 14 minutes. / You get kinds of work, and a school path.".

## Rebuild and test
1. Put the files in `app/audio/`.
2. `python3 app/build.py` (needs the accepted release), then serve it (for example `bash app/tests/playtest/start_server.sh`).
3. Open the page, sign in, tap Begin. A "Sound on" button should show in the opening. Turn it on, play through, then try tap and Skip: the sound must stop at once.
4. If a line runs past its `max`, shorten the take or move its `at` in `data/story2.json`. Caption timing is fixed (700 ms plus 230 ms a word per line), so a voice that runs long will overlap the next line.
5. Story text changes need an owner accept (`--accept`) before they reach the build.

## Later: Hindi tracks
Use the same cue ids with a language suffix: `op1_l1.hi.mp3`, `op3_l3.hi.mp3`. The captions are English today, so Hindi voice needs Hindi captions first (add them to `data/story2.json`, then a small code change to choose by language). Until then, do not drop `.hi` files in: they are copied but never played.

## OPTIONAL, FUTURE: voice for Jyo's in-game lines and the letter

**The game does NOT play these yet.** Only the opening cues above are wired. There are no cue ids, no code and no files for the lines below. Do not drop these files into `app/audio/` expecting them to play: they would be ignored (or skipped by the build). This section exists so the owner can record them once the player supports them. It would need a code change and new cues in `data/story2.json` (and an owner accept). The words below are copied from `data/story2.json` and must be re-checked if the story text changes.

Same format rules as above (mono, 48 kHz, about -16 LUFS, trimmed). Indian English for all three voices. Proposed file names (not wired): `jyo_town7.mp3`, `jyo_sharpen.mp3`, `lamplighter_letter.mp3`.

| Proposed file | Where it would play | Speaker | Line | Tone |
| --- | --- | --- | --- | --- |
| `jyo_town7.mp3` | Clue card at town 7 | Jyo | I miss her. She went to the lighthouse. I promised to wait for you. | Jyo: soft, a little sad on "I miss her", then steady and warm on "I promised to wait for you." About 6 s. |
| `jyo_sharpen.mp3` | The Jyo card before sharpening | Jyo | More lamps make your road clearer. Stop any time. | Jyo: light and kind. No pushing. "Stop any time" is easy, a real offer. About 4 s. |
| `lamplighter_letter.mp3` | The lamplighter's letter, after the lighthouse door | The lamplighter | I put this light out myself, so you could light it. A lamp I lit would only show my road. I took no oil, because the oil is yours to spend. I tried every kind of work so you could find yours. People will tell you what to be. The road was never mine. Choose yours. | Adult woman, Indian English, calm, kind, a little tired, never grand. She is writing to someone she trusts. Slow pace, about 2.3 words a second. Small pauses after each sentence, and a longer one before "People will tell you what to be." The last line, "The road was never mine. Choose yours.", is plain and quiet. About 24 s. |

Notes for these:
- The lamplighter is never shown in the pictures. Her voice, if used, is heard only over the letter. Keep it warm, not ghostly, not a trailer voice.
- Jyo's voice must be the same voice as in opening shot 3 (`op3_l1` to `op3_l3`).
- Do not voice the scene card "At the lighthouse: The door is open. The lamp is dark. A letter lies beside it." unless the owner asks. If it is voiced, use the narrator from the opening.
- Voice stays optional and off by default, as in the opening. Captions and text carry the story.
