# Playtest round 2: Siddharth

1. **Persona:** Siddharth, 15, Class 10 ICSE, Bengaluru. Plays 4+ hours of games a day, codes small Discord bots, thinks career tests are astrology. Contrarian, respects honesty that shows its working. Quits on preachiness, slowness, or fake knowledge of him.

2. **FINISHED: yes.** On the first draft he chose **Sharpen it**, did 4 extra towns, then pressed "Stop and see my result". Total **12 towns** (8 base + 4 sharpened). Est. **about 19 minutes** (range 17 to 22). The cover says "8 to 10 minutes", which is short for this run. His words: "Okay, it's a lot of reading, but the chime script one was actually mine."

3. **Diary** (repeated screens grouped)

| Screen | Interest (0-10) | Reaction in his voice |
|---|---|---|
| Cover ("Begin") | 5 | "Fine. Pretty picture, 8 to 10 minutes, let's go." |
| Sign-up form (name, code `master`, tick box) | 4 | "Why does it need my name for a test? Ticked the box, obviously." |
| Consent: "A parent has agreed" | 3 | "Clicked yes. Nobody's checking that, is it?" |
| Save login code (`5JZ6-4TAG`) + welcome | 5 | "Code saved in notes. Okay." |
| Intro story + "Walk on" beat | 4 | Skipped the story. "Girl looking for the lamplighter. Sure." |
| Orchard Village (test apple mixes, juice stall) | 6 | "Picked the test one, it sounds like debugging. Juice stall, ok." |
| Herbalists' Garden (planting reminder calendar, 3D garden) | 5 | "Reminders thing is basically a bot. Fine." |
| River Camp (boat sketch, run camp meeting) | 5 | "Sketching a boat, ok. Meetings are boring." |
| Night Bazaar (old machine, phone repair) | 6 | "The old machine is a mystery. Good." |
| Clockmaker's Lane (chime script, repair tracker) | 9 | "Script for missed chimes, bugs may eat your evening. Yes, that's my weekend." |
| Salt Market (records losses, settle deal) | 6 | "Recording losses, ok." |
| Salt Harbour (ferry engine, tide data) | 7 | "Fix the engine alone sounds like me. Tide data too." |
| Fog Pass (headcount app, route plan) | 7 | "Headcount app, obviously." |
| Lighthouse letter + Ila/lamplighter beats | 6 | "Okay, the lamplighter put the light out on purpose. Twist." |
| Draft ("Persuader, Thinker, Organiser") | 5 | "Persuader? I didn't pick the talking stuff. Sharpen it." |
| Chapter III: Healing House (water test, patient register) | 6 | "Test water, good. Register is boring." |
| Lantern Bridge (arch design on screen, crack measuring) | 7 | "Designing on screen is basically a game. Ok." |
| Glass Cliffs (climb video, safety checklist) | 5 | "Video is fine. Safety list is a chore." |
| Weavers' Town (cloth stock app, banner design) | 8 | "Log cloth stock in an app. Yes." |
| Class / board / stream questions | 5 | "Not sure yet. I'm in 10th, I don't have a stream." |
| Finale (lighthouse animation, Skip) | 6 | "Skip. Show me the result." |
| Reveal "Your shape" (Thinker, Organiser, Creator) | 6 | "Thinker, yes. Creator is vague. At least it says some areas were close." |
| "Where this can lead" (16 fields) | 7 | "Technology and data, Start here. Okay." |
| Technology and data field page (1,400+ words) | 9 | "It shows my actual choices. Then US AI exposure, 'very high', and pay in India. Skimmed it." |

4. **Top 3 that kept him going**
- The choices are specific jobs with a cost: "Write a small script to log missed chimes, though bugs may eat your evening" (Clockmaker's Lane). He picked it at once.
- The honest hedges: "This is a draft. More towns can change the order." and "Some areas were close, so the order could swap on another day." He liked that they did not pretend to be sure.
- The "Your choices at Clockmaker's Lane" quote on the field page. It shows the exact choice he made, which is the one place the game clearly noticed him.

**Top 3 that nearly lost him**
- Sign-up wall: "Data: what we keep and who sees it" (about 320 words) before he could start. He skimmed it.
- Repetition: every town has the same shape ("Light the lamp · keep my oil", a 30-word reaction, two lines from Jyo or Ila). "Each lamp makes your picture a little sharper" annoyed him. He stopped after 4 sharpened towns.
- The field page: "Matches come from US job profiles" followed by "AI exposure: very high, in use" and "Real AI use seen so far covers about 46% of this job". He read "US" and nearly closed the tab. "Pay in India: what we know" was the only India-specific block, and he skipped it.

5. **Did it notice him? Did the mystery land?**
- Mostly no. Reactions are generic ("She tried my work for a day. She was trying them all.", "Your road is getting clearer with every lamp."). Only the field page's "Your choices at" section shows it noticed what he picked.
- The mystery ending is nice but not gripping for him: "She was never lost. She went ahead to make room for you." He read it as a metaphor and did not care much about Ila.

6. **Does the result fit? Would he share it?**
- Thinker fits (he codes, he likes debugging). Organiser and Creator are vague. "Creator" came from one 3D-garden choice.
- He would not share the result card. "It's astrology with better graphics." He might screenshot the chime-script line for a friend as a joke, but not the result.

7. **Bugs and layout** (screenshots in `screenshots not kept/`)
- `shot_072.png` (reveal): the "In school this often shows up in: Maths, Science..." line sits under the fixed bottom button "Next: the fields that fit this shape" and is clipped. Real layout bug at 390px wide.
- `shot_074.png` (technology and data field): the page runs over 1,400 words before "Back to all fields". Not a bug, but too long for a 15-year-old.
- Consent: "A parent has agreed" is accepted with one click and no check. A 15-year-old can click it without asking anyone. Design issue, not a crash.
- On the field page, tapping "Next: Class 11 to 12 subjects" and "4 Talk it over" did not visibly change the text in the driver output. I could not confirm whether they work. Needs a manual check.
- Driver: `[action #4]` and `[action #21]` were printed twice. This is cosmetic in the harness, not the app.
- Screens: `shot_000.png` (cover), `shot_048.png` (first draft), `shot_072.png` (reveal), `shot_073.png` (where this can lead), `shot_074.png` (field), `shot_070.png` (finale).
