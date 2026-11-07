# Opening: voice script

Audio is optional and off by default. The captions carry the whole story. This file is for generating the voices on a local model and dropping the files in with no code change.

## How it works
- Cues live in `data/story2.json`, under `meta.opening[].audio`. Each cue has `id`, `file`, `at` (seconds from the start of its shot), `speaker`, `line`, `max` (longest length in seconds), and optionally `loop` and `vol` (0 to 1).
- `python3 app/build.py` copies every file in `app/audio/` into the page folders and lists them in the page. A cue plays only if its file is in that list.
- No files: no "Sound on" button and no network request for audio. With files: the button appears in the opening, the student's choice is remembered on that device, and sound stays off until they turn it on. Tap, skip and the last button all stop the sound at once.
- The `line` of a spoken cue must match the caption word for word.

## Format
- Mono MP3 (or OGG/Opus), 48 kHz, about -16 LUFS, silence trimmed at both ends.
- Name each file exactly as in the table, for example `app/audio/op1_l1.mp3`.
- Keep all files together under about 150 KB. A mono MP3 at 32 kbps is about 4 KB a second.

## Voices
- **Narrator**: Indian English accent, calm, warm, natural, a little low. Older teen or young adult. Not a trailer voice, not cartoonish.
- **Jyo** (the firefly): Indian English accent, light and quick, quietly curious, a little shy. A character, not a cartoon: no squeaks, no baby voice.
- **Family murmurs**: Aunty, Cousin and Sir as soft overlapping voices, no clear words, warm and caring, never mocking or harsh. They are people who love the student.
- Pace: a touch brisk, about 3 words a second, because each line has only a few seconds. Stop at the end of the sentence. No breath at the end.

## Cues
| File | Shot | Speaker | Start (s) | Max (s) | Line | Tone |
| --- | --- | --- | --- | --- | --- | --- |
| `op_amb_night.mp3` | 1 | Night ambience: crickets, soft wind, far-off festival hum | 0 | 60 | (no spoken line) | Loop, low (vol 0.35). Crickets, soft wind, far festival hum. Seamless loop of about 10 s. |
| `op1_family.mp3` | 1 | Family murmurs | 0.1 | 5 | (no spoken line) | Soft overlapping murmurs, no words you can pick out. Fade in and out. vol 0.35. |
| `op1_l1.mp3` | 1 | Narrator | 0.15 | 1.2 | Aunty says doctor. | Even, a little weary. The first of three. |
| `op1_l2.mp3` | 1 | Narrator | 1.54 | 1.2 | Cousin says engineering. | Same, slightly faster. |
| `op1_l3.mp3` | 1 | Narrator | 2.93 | 1.2 | Sir says science. | Same, then a small pause after. |
| `op1_l4.mp3` | 1 | Narrator | 4.32 | 1.7 | Everyone has your road ready. | Lower and slower. This is the pressure line. |
| `op2_lamp_out.mp3` | 2 | Lamp going out: a warm hum fading to cold sea wind | 0.4 | 6 | (no spoken line) | A warm hum that fades into cold sea wind. Slow fade. |
| `op2_l1.mp3` | 2 | Narrator | 0.15 | 1.4 | The lighthouse went dark. | Quiet, a little hushed. |
| `op2_l2.mp3` | 2 | Narrator | 1.77 | 1.9 | Her door open. Her oil untouched. | Slow, puzzled. Short break after "open". |
| `op3_firefly.mp3` | 3 | Firefly wings: a soft, bright buzz that settles | 0.3 | 5 | (no spoken line) | Soft bright wing buzz that settles. Short. |
| `op3_l1.mp3` | 3 | Jyo | 0.15 | 1.9 | I'm Jyo. She left by choice. | Jyo: light, direct, shy. "Jyo" clear. |
| `op3_l2.mp3` | 3 | Jyo | 2.23 | 1.9 | Light a lamp in each town. | Jyo: plain and warm. |
| `op3_l3.mp3` | 3 | Jyo | 4.31 | 2.8 | Two flasks each. Spend them on what you'd really do. | Jyo: steady, slight stress on "really". |
| `op4_flasks.mp3` | 4 | Glass flasks touching and a lantern flame flicker | 0.3 | 5 | (no spoken line) | Two glass flasks touching, a lantern flame flicker. Short and gentle. |
| `op4_l1.mp3` | 4 | Narrator | 0.15 | 2.3 | An interest guide, not a test. No marks. | Plain and honest. No selling voice. |
| `op4_l2.mp3` | 4 | Narrator | 2.69 | 1.7 | About 10 to 14 minutes. | Plain. Say "10 to 14" as "ten to fourteen". |
| `op4_l3.mp3` | 4 | Narrator | 4.54 | 2.6 | You get kinds of work, and a school path. | Warm, easy. The last line before the button. |

## Rebuild and test
1. Put the files in `app/audio/`.
2. `python3 app/build.py` (needs the accepted release), then serve it (for example `bash app/tests/playtest/start_server.sh`).
3. Open the page, sign in, tap Begin. A "Sound on" button should show in the opening. Turn it on, play through, then try tap and Skip: the sound must stop at once.
4. If a line runs past its `max`, shorten the take or move its `at` in `data/story2.json`. Caption timing is fixed (700 ms plus 230 ms a word per line), so a voice that runs long will overlap the next line.
5. Story text changes need an owner accept (`--accept`) before they reach the build.

## Later: Hindi tracks
Use the same cue ids with a language suffix: `op1_l1.hi.mp3`, `op3_l3.hi.mp3`. The captions are English today, so Hindi voice needs Hindi captions first (add them to `data/story2.json`, then a small code change to choose by language). Until then, do not drop `.hi` files in: they are copied but never played.
