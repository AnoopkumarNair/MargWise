# Margwise — 02 Game Design Document

**Working title of the game world:** The Lantern Isles · **As of:** 20 Oct 2026

The game has two jobs that pull in different directions: it must be fun enough that a 16-year-old finishes it, and it must deliver 60 questionnaire items without distorting the answers. Every design choice below is checked against both. Section 4 lists the rules that protect the measurement; where fun and measurement conflict, measurement wins.

---

## 1. Pillars

1. **Discovery, not testing.** The teen is exploring a world, not taking an exam. No marks, no timers, no right answers.
2. **The world reflects you, honestly.** What the teen sees about themselves is earned from their real answers and explained plainly.
3. **Real careers, real routes.** Fantasy wrapping, factual core: every career hall opens onto verified dossiers.
4. **Two players, one family.** The teen explores; the parent (Patron) funds the voyage; the final chart is shared.
5. **Premium and calm.** Beautiful, smooth, unhurried. Not childish, not casino-like.

## 2. World and story

### 2.1 Setting

The Lantern Isles are a ring of islands linked by bridges and ferries. Each island is home to one of six guilds, and each guild keeps a lighthouse. A great storm has put every lighthouse out. Ships can't find their way, and the isles need newcomers to help relight them.

The six guilds map to the six interest types (RIASEC). Guild names are friendly words, always shown with an icon and the letter, never by colour alone:

| Guild | Interest type | Island feel |
|---|---|---|
| Builders | Realistic (R) | Workshops, shipyard, gardens, machines |
| Thinkers | Investigative (I) | Observatory, labs, libraries |
| Creators | Artistic (A) | Studios, stages, murals, music |
| Helpers | Social (S) | Healing house, school, community hall |
| Persuaders | Enterprising (E) | Market square, trading hall, debate steps |
| Organisers | Conventional (C) | Harbour office, archives, ledgers, signal tower |

### 2.2 Characters

All characters are original, diverse Indian characters (regions, genders, ages, skin tones, body types, abilities). No real people, no existing IP, no caste or religious markers used as shorthand. Each has a character sheet (02 §8.3).

- **Jugnu** — the explorer's companion: a small firefly spirit with a lantern tail. Warm, curious, slightly cheeky. Speaks in short lines. Never comments on the teen's answers.
- **Six Guild Keepers** — one per guild; each appears at the market and later hosts their island.
- **Fourteen Mentors** — one per career hall (e.g. the Clinical Psychologist at the Healing House on the Helpers' island; the Architect in the Builders' shipyard tower). Each is a working professional character with a short "day in my life".
- **The Harbourmaster** — runs the voyage planner (money and destinations) in the Patron chapter.
- **The Lantern Council** — the six Keepers together; they perform the reveal.

### 2.3 Narrative beats

| Beat | Scene | Length | Purpose |
|---|---|---|---|
| Prologue | Storm cinematic: parallax panels, lighthouses go dark, Jugnu finds the newcomer on the beach | 30–45 s, skippable | Hook, tone |
| Arrival | Choose an explorer look (preset diverse avatars, no photos) and a generated handle (no real names) | 30 s | Ownership |
| Days 1–6 | Market Day at the harbour: guild members offer tasks (the 60 activities, 10 a day) | 45–60 s per day | Measurement |
| Evenings 1–5 | Campfire vignette: Jugnu tells a short story about the isles; one lighthouse relights (fixed order for everyone) | 10 s each, skippable | Pacing and reward without feedback on answers |
| Day 7 | The Lantern Council: all six lighthouses glow at their own brightness; three join into your crest | 45 s | Reveal (interest code) |
| Exploration | The Isles map opens: visit halls, meet mentors, read dossiers, accept quests | Open-ended | Career exploration |
| The Patron arrives | Hand-off: "Your Patron has arrived at the harbour" | 10 s | Parent's turn |
| The Voyage | The Harbourmaster's ledger and charts: plans as voyages to ports | 5–8 min | Money, places, compare |
| Epilogue | The family's voyage chart is sealed into a "logbook" (the report) | 30 s | Shareable output |

### 2.4 Season structure (re-engagement)

- Quests continue after the first session (the logbook tracks them on the device).
- "New Season" each year: a fresh storm and a re-run of the market days to see how interests have changed (side-by-side crest comparison).

## 3. Core loops

### 3.1 Market-day loop (measurement)

1. Jugnu: "Day 2. Let's see who needs help today."
2. The camera pans along the harbour market. A guild member steps forward with an **offer card**: an illustration of the activity, the activity text **exactly as in the O\*NET item**, and the character's name and guild hidden (shown only as "a villager") so the guild doesn't hint at the area.
3. The teen sets the **eagerness dial** to one of five positions, labelled with the official anchors: Strongly dislike · Dislike · Unsure · Like · Strongly like (0–4). Playful icons sit beside the labels, never replacing them. Swipe shortcuts exist (right = Like, left = Dislike, up = Strongly like, down = Strongly dislike); the dial always works by tap.
4. The villager reacts with a neutral nod (the same animation for any answer) and walks off; the next one steps up.
5. After 10 offers: evening campfire.

### 3.2 Exploration loop

Map → island → hall → mentor dialogue (3–5 lines) → "a day in my life" (4–6 illustrated task panels) → dossier tabs (Ladder, Routes, Gates, Colleges, Abroad, AI exposure, Skills, Quests, Sources) → accept a quest → back to the map. Halls glow by match band for this explorer (Strong, Mixed, Weak, Unclear); every hall stays open and visitable.

### 3.3 Voyage loop (parent with teen)

Ledger (family inputs) → choose up to 4 voyages (career route + institution or college type + city/country + optional master's port) → each port shows "weather" (policy, cost and job-market signals from the pipeline, each dated) → the voyage chart (fit vs money with P10–P90 whiskers) → both priorities side by side → seal the logbook (report).

### 3.4 Quest loop (after the session)

Quest cards with steps, "what to notice about yourself", and a reflection prompt the teen answers by tapping (no free text from minors in the alpha). Completing a quest adds a stamp to the logbook and a "lantern spark" to the hall. No streaks or daily nagging (dark-pattern ban).

## 4. Measurement integrity rules (non-negotiable)

1. **Item text verbatim.** The 60 O\*NET IP-SF activities appear word for word. A second "simplified wording" set may be tested only as an A/B variant with consent and tracking (03 §2.7), never as the default.
2. **Official response anchors visible** on every item; exact 0–4 mapping.
3. **Fixed item order** per the official form; the six days are 10 consecutive items each.
4. **No contingent feedback.** Nothing in the world reacts differently to different answers during days 1–6: the same nod, the same evening, the same lighthouse in the same order.
5. **No hints about areas.** The offering villager's guild is not shown during the market; illustrations depict the activity, not the guild.
6. **No incentives to like things.** No points, coins or rewards tied to answers.
7. **Undo and back** are always available; the teen can revisit any earlier day.
8. **Parent off-screen** during days 1–6 (the hand-off copy asks the parent to wait), and the A/B test measures whether that matters.
9. **The reveal explains, never labels.** "Your current direction", ties shown as ties, broad profiles described as broad (03 §2).

## 5. Screens and scenes (alpha)

| Scene | Rendered with | Notes |
|---|---|---|
| Title / Welcome & consent | DOM (React) over an animated PixiJS background | Consent is DOM for accessibility |
| Prologue | PixiJS parallax panels + Rive Jugnu | Skippable; reduced-motion version is still panels |
| Avatar & handle | DOM + Rive avatar preview | Preset avatars only |
| Market day | PixiJS harbour (parallax, villagers) + DOM offer card and dial | The dial and card text are DOM for screen readers |
| Evening campfire | PixiJS vignette + Rive | 10 s, skippable |
| Lantern Council (reveal) | PixiJS + particle shader | ≤ 1.5 s particles; reduced-motion: fades |
| Isles map | PixiJS world map (pan, pinch, tap) | DOM list view equivalent for accessibility |
| Hall & mentor | PixiJS interior backdrop + Rive mentor + DOM dialogue | |
| Dossier | DOM (React) | Rich text, tables, sources |
| Harbour ledger (Patron) | DOM over a light harbour backdrop | Plain inputs |
| Voyage planner & ports | PixiJS sea chart + DOM cards | Ports show dated weather badges |
| Voyage chart (compare) | SVG (DOM) | Accessible table view |
| Logbook (report) | DOM, light theme, print stylesheet, share image | |

## 6. Quests (content rules)

- Free, safe, 1–2 weeks, doable from home or school.
- No travelling alone, no contacting strangers online, no sharing personal data, no spending money. Interviewing a practitioner only "with a parent's help".
- Each quest: goal, 3–5 steps, time needed, what to notice, two tap-based reflection questions.
- 2–3 quests per career (28–42 in total for the alpha), reviewed with the career's dossier.

## 7. Audio and haptics

- Ambient sea and market soundscape plus soft UI sounds, **off by default**, with a visible toggle. All audio optional; the game is fully playable muted.
- Light haptic tick on answer commit where supported (Android); never required.

## 8. Art direction and AI art pipeline

### 8.1 Style bible

- **Look:** painterly 2D with clean shapes, soft rim light, night-blue and lantern-gold palette; each guild has an accent hue (paired with an icon). Inspired by the feel of premium mobile narrative games, without copying any specific game, studio or artist.
- **Camera:** side-on parallax for the harbour; three-quarter top-down for the Isles map; framed interiors for halls.
- **Characters:** stylised proportions (about 6 heads tall), expressive faces, readable silhouettes at phone size.
- **Day vs night:** the teen's journey is night (lanterns); the Patron's harbour ledger is dawn (light theme), so the parent's screens read as calm and factual.
- **Representation check:** every set reviewed for gender, region, skin tone, body type and disability representation; no profession shown as only one gender.

### 8.2 Tools and rights

- Use AI image tools whose terms grant commercial use for the plan you pay for. Record the tool, plan, date and terms version for every asset.
- Never prompt with names of living artists, studios, games, films, brands or real people.
- Human edits on every final asset (cleanup, consistency, compositing), and keep the layered source files. Ownership of purely AI-generated images is legally uncertain in several jurisdictions; edited, composited assets with provenance are safer, and the brand marks (logo, wordmark) should be human-made.
- An `assets/PROVENANCE.csv` file lists every shipped asset: file, tool, plan, date, prompt summary, editor, licence notes.

### 8.3 Consistency workflow

1. Write the style bible and generate 3–5 style keyframes; Anu approves one.
2. Character sheets for Jugnu, 6 Keepers, 14 Mentors, 8 avatars: front, three-quarter, side, 4 expressions; approved before scenes.
3. Generate scenes and props using the approved sheets and keyframes as references.
4. Clean up and separate layers (for parallax and rigging).
5. Rig characters in Rive (idle, talk, react) or use simple sprite tweens for minor characters.
6. Pack textures into atlases; export Rive files; log provenance.

### 8.4 Asset list (alpha)

| Group | Count |
|---|---|
| Characters (Jugnu, 6 Keepers, 14 Mentors, 8 avatars, villagers set) | ~35 rigs or sprite sets |
| Activity illustrations (one per item) | 60 |
| Scenes (prologue panels, harbour, campfire, council, map, 6 islands, 14 hall interiors, sea chart, harbour ledger) | ~30 |
| Ports (7 Indian cities + 6 countries + custom) | 14 badges/scenes |
| UI kit (dial, cards, badges, icons, guild crests, stamps) | 1 set |

## 9. Technology and performance

### 9.1 Rendering

- Graphics run on the phone's GPU through WebGL; the server only serves files. No server-side rendering is involved.
- **PixiJS** (2D WebGL) for scenes, embedded in the React app. **Rive** runtime for character animation. DOM/React for all text, inputs, dossiers and reports (accessibility and translation).
- No 3D in the alpha.

### 9.2 Budgets

| Metric | Budget |
|---|---|
| First playable (welcome + prologue) transfer | ≤ 1.5 MB |
| Per-scene lazy load | ≤ 2 MB, prefetched during the previous scene |
| Total game assets cached after full play | ≤ 15 MB |
| Texture atlases | ≤ 2048×2048 each; device pixel ratio capped at 2 |
| Frame rate | 60 fps on reference devices for pan, pinch, parallax and card moves; a "lite" mode (fewer parallax layers, no particles) keeps ≥ 30 fps on the floor device |
| Initial JS (gzip, excluding lazy game chunks) | ≤ 200 KB |
| Lighthouse mobile (welcome route) | Performance ≥ 85, Accessibility ≥ 95 |
| Offline | All played scenes and the current content release work offline after first load |

### 9.3 Device matrix

iPhone 12 or newer (iOS 16+ Safari); Pixel 6+, Galaxy S21+, OnePlus 9+ (current Chrome); one Snapdragon 7-series phone as the floor device. Auto-select "lite" mode when the device is weak (frame-time sampling during the prologue), when Data Saver is on, or when the user picks it.

### 9.4 Accessibility

- Every game action has a DOM equivalent (dial buttons, list view of the map, table view of the chart).
- `prefers-reduced-motion`: no parallax, no particles, fades only.
- Text at 200% without breaking; contrast AA; 44 px targets; screen-reader labels for all controls.

## 10. Instrumentation hooks (with consent; details in 04 §6)

Scene entered/exited, day started/completed, item answered (item ID, response value, undo count), reveal viewed, hall visited, dossier tab opened, quest accepted/completed, voyage created, report shared/saved, errors, lite-mode switch, session duration. No hover, dwell or cursor tracking. Item responses are stored only with the Patron's research-level consent.
