# Student playtest, November 2026

Question for this review: students say the storyline is boring and there are too many questions, so they do not finish. Why, and what should we change first?

Short answer: students leave when the game shows a town they already played a second time (the "second look"), about six towns and four locks in. That screen looks like a bug and the counter goes up. Behind it sits a bigger problem: the game is long, it promises "About 15 minutes", and almost nobody gets the short version.

## 1. What we did

We played the game with 9 simulated students. Each one was an AI playing a character, one tap at a time, in a real browser on a local copy of the site (invite code `master`). Nothing live was touched.

These are **AI simulations, not real students.** The reading speeds, the quit points and the minutes are the AI's best guesses from word counts and from how that kind of student tends to behave. How far to trust them:

- Good for finding screens that confuse or bore people, and for finding bugs. We checked their claims against the code (section 7).
- Not good for saying how many real students would quit, or exactly when. The minutes are estimates.
- When 8 of 9 different characters stop at the same screen, treat that screen as a real problem. A single persona's opinion is weaker evidence.

The 9 students are Class 9 to 12, with ADHD, dyslexia, autism, English as a second language, a first-generation rural student, exam stress, and a student who only wants one career. Each played on a phone, tablet or laptop view. Each wrote a report in the same 11 sections.

Per-persona reports are in `docs/reviews/student_playtest_2026-11/`. Screenshots were not kept.

The tools to repeat this are in `app/tests/playtest/` (see its README).

## 2. Headline result

All 9 saw the "second look" screen. 8 of 9 would quit, or nearly quit, right there. The ninth (Arjun) stopped soon after, at the second shape lock.

| Student | Age, class | Variation | Device | Finished? | Quit point (towns done, locks seen, est. minutes) | Main reason |
|---|---|---|---|---|---|---|
| [Aarav](student_playtest_2026-11/aarav.md) | 14, Class 9 | ADHD, off medicine | Phone | No | Second look, 6 towns, 4 locks, 8 to 9 min | "Is it glitching? Why am I doing the same thing again? How many more?" |
| [Meera](student_playtest_2026-11/meera.md) | 15, Class 10 | Exam stress, reads every word | Laptop | Borderline | Second look, 6 towns, 4 locks, about 14 min | "It said fifteen minutes. I have been here fourteen." Fears she answered wrong. |
| [Kabir](student_playtest_2026-11/kabir.md) | 16, Class 11 | Sarcastic, switches apps | Phone | No | Second look, 6 towns, 4 locks, about 10 min | "I get nothing till the end." The shape lock felt like an IQ test. |
| [Sana](student_playtest_2026-11/sana.md) | 17, Class 12 | Story lover (control) | Laptop | No | Second look, 6 towns, 4 locks, about 8 min | "I've lit six lamps and I still don't know why the lamplighter vanished." |
| [Rohan](student_playtest_2026-11/rohan.md) | 15, Class 10 | Probable dyslexia, Hindi medium | Tablet | No (quits at results) | Second look, 6 towns, 4 locks, 17 to 19 min | The repeat and the counter. Then a 1,700-word field page. |
| [Ishita](student_playtest_2026-11/ishita.md) | 16, Class 11 | ADHD (inattentive), anxious | Phone | Likely no | Second look, 6 towns, 4 locks, 7 to 8 min | "Is it broken? Did I mess up?" |
| [Dev](student_playtest_2026-11/dev.md) | 14, Class 9 | Autistic, literal reader | Laptop | Yes, with two near-quits | Second look, 6 towns, 4 locks, about 17 min | "Nobody said there is a check." The counter went up. |
| [Priya](student_playtest_2026-11/priya.md) | 17, Class 12 | One goal (physiotherapy) | Phone | No | Second look, 6 towns, 4 locks, 7 to 8 min | "Where is physio? This is a school test with a story on top." |
| [Arjun](student_playtest_2026-11/arjun.md) | 15, Class 10 | Rural, first-gen, Marathi-medium, slow data | Phone | No | Second shape lock, 8 towns, 6 locks, about 14 min | "Madam said 15 minutes. I have done 15 minutes and it still says seven more." |

Totals: the 8 who stopped at the second look did so after 6 towns and 4 locks, between 7 and 19 estimated minutes (most between 7 and 14). Real time to finish, where the reports gave it: 28 to 36 minutes for the careful and slow readers (Meera, Dev, Arjun, Rohan), 12 to 20 for the fast ones.

## 3. Root causes, most common first

### (a) The "second look" reads as a bug, and the counter goes up (all 9)

What they saw: after Place 6, a town they already played (Orchard Village, Night Bazaar or Herbalists' Garden, depending on the run) comes back with the same four choices in a new order.

- Aarav: "I already did the apple place. Is it glitching?"
- Ishita: "Did I mess up?"
- Meera: "Did I answer wrong?"
- Dev: "Is it checking whether I lie? Nobody said there is a check. The counter also went UP from '1 to 8 more' to '2 to 9 more'."
- Sana: "it says 1 to 8 more, so there are MORE."

What the code does (verified, `verify_code.md`):

- This is on purpose. It is a consistency check. After 6 or more towns, the game replays the town where the student put the most oil, with the options in a new order. Rules: `engine/SPEC.md:19,29,35`. Reshuffle: `app/night-of-lamps.html:1219`.
- The only words at that moment are `app/night-of-lamps.html:1218`: "The lamp at X is flickering, as if it wants a second look." The purpose is explained only on the results page, in "How we got this result" (`:2153`).
- The echo is not counted in "Place N of 15" (`:1088`). So while it shows, the pill says "Second look · 1 to 8 more" (`:1103-1110`), and the "more" number can look higher than before.

### (b) The length (all 9, in different words)

- The game is up to 15 towns plus the second look, always 8 locks, and 4 intro slides. The cover says "About 15 minutes" (`:649`, gate `:624`).
- The simulated students estimated 28 to 36 minutes for careful or slow readers, and 12 to 20 for fast ones. These are guesses, but all point the same way.
- The pill on the first town says "Place 1 of 15 · 7 to 14 more" (Priya, Ishita and others read it as "this is long" straight away).
- The early stop rarely fires. By the engine rules a student can stop after 8 towns if the top traits are clear (`engine/SPEC.md:34-36`, `minStops:8, stopZ:1`). In our runs, 7 of the 8 runs whose finale was logged ended with "15 lamps". Only Priya stopped early, at 10. So in practice the walk is almost always the full 15.
- The locks are always 8 (4 rounds of 2), because unplayed rounds are forced after the walk ends (`:1182-1183`).
- "Skip the story" skips only the 4 intro slides (`:694`, `:1897`). There is no "show my result now".

### (c) The story loop (at least 6 of 9: Sana, Kabir, Priya, Rohan, Arjun, Aarav)

- Same screen pattern 15 times: read setup, tap 2 of 4 options, tap "Light the lamp".
- Choices do not change the story. The keeper's line is a warm description of the options, not a reaction to the pick.
- The mystery never pays off. Even Sana, the story lover, quit: "I still don't know why the lamplighter vanished."
- Kabir: "The mystery never advances... the ending line 'The road was never mine. Choose yours.' does not answer anything."
- Students who skipped the intro (Kabir, Priya, Rohan) meet Ila with no context after town 3.
- Priya: the story has nothing to do with her goal.
- Code fact: the engine and story are data-driven (`data/story2.json`, 15 scenes). Chapter beats are 66 words in total and Ila's beats 107 words in total. Jyo's thread lines are a pool of 133, one shown per town. The story is thin compared with 15 repeats.

### (d) The locks feel like exams (Aarav, Kabir, Arjun, Rohan, Ishita; Dev liked them)

- Aarav: "A flask costs ₹40... You need 10 flasks. How much do you pay?" is "a school word problem".
- Word locks ("Map is to traveller as recipe is to ...") test English. Arjun: they "make him feel behind".
- The shape lock was skipped by Kabir and Priya; Arjun called it "a hard exam question".
- "Strong" for lucky guesses (Dev, Ishita saw all four "Strong"). Code: levels 2 and 3 both show "Strong" (`LEVEL_WORD`, `:1836`). A lucky first guess followed by a wrong second still says "Strong" (`aptScores`, `:1823-1828`). The puzzles do not change the ranking (`APT_NUDGE=false`, `:1832`), so this is a display problem, not a scoring one.
- Not a root cause: right and wrong answers do get different feedback (`:1816`). Dev's claim that they do not is false.

### (e) The front door (Aarav, Dev, Arjun, Ishita, Meera)

- Gate, privacy text, consent, intro: the simulated students estimate 3 to 5 minutes of reading before the first town. Arjun and Aarav counted a 358-word notice.
- Code fact: the gate text is about 190 words visible and about 330 to 415 with the collapsed parts (`:618-646`). The "students under 18" consent is a separate screen (`:656-659`, 54 words).
- "Best with a parent beside you" is in the gate facts (`:624`).
- The oil rule (46 words) shows only at the first town (`:706`, `:1184`). Several students said it repeats on every town. That is wrong, but it does stay on screen after the first lamp is lit, which looks like a leftover.
- "Light the lamp · keep my oil" confused Kabir, Priya and Rohan (not checked in code).

### (f) The results (Meera, Kabir, Rohan, Ishita, Arjun, Dev, Priya)

- Pay on career cards is in US dollars in all 9 runs ("$103k a year"). There is no rupee pay per career. Code: `:1691`, `:1706-1709`. The only India pay is a national average under "India salary context (national, not these roles)" (`:1674`, `:1717`).
- Field pages are long: 1,700 to 3,000 words (Rohan, Meera, Kabir, Ishita). Rohan would quit here.
- "AI exposure very high" next to a doctor, nurse or designer worries students (Meera, Ishita). It is also US data.
- Priya's best field was Sports and fitness, but Physiotherapist sits only in Health and medicine (verified: `data/content.py`).

### (g) Access (Rohan, Arjun, Dev)

- English only. No Hindi, Marathi or other language (`<html lang="en">`; README says regional languages are not built).
- Read-aloud exists only on town screens (`listen`, `:2056`). Not on locks, results or field pages. Rohan, with probable dyslexia, needs it most on the lock questions.
- Arjun: slow data and a shared phone. He stopped when his father needed the phone, and nothing lets him come back to where he was (not checked in code).

## 4. What worked (keep these)

- The art and the lamp animation. They carried Aarav a few extra screens.
- Short, concrete choices that match the student's life: "Open the engine and fix it, with oily hands" (Aarav, Rohan), "Run the budget for a school fest" (Kabir).
- Options that name a drawback ("though it may turn out to be junk"). Priya said they sound like real training. They also read as long on a phone.
- The Pattern and Shape locks, when the student was in the mood for puzzles (Aarav, Ishita, Dev). Dev: puzzles and the "how it was calculated" page held him.
- "Nothing is marked" and the honest tone.
- The result page: the radar, the three cards and "Summary for parents". Aarav, Kabir and Meera felt it fit them and would show a parent.
- "Skip the story" and "Skip this lock" (used by Kabir, Rohan, Priya).
- The honest "Some of your top areas were tied" note.

## 5. Recommendations

Ranked by impact against effort. "Engine" means it changes engine or matcher behaviour, which per `CLAUDE.md` needs a version bump and golden tests. "Copy" means words only.

| # | Change | Impact | Effort | Type | Where |
|---|---|---|---|---|---|
| 1 | Explain the second look when it appears: "We ask one town again to check your answers hold steady. It does not count as a new place." Keep the counter at the same number. Show "Second look" with no "more" range. | High, fixes the main quit point | Low | Copy and small UI | `night-of-lamps.html:1218`, `:1103-1110`, `:1081`, `:1109` |
| 2 | Tell the truth about length: "10 to 25 minutes, you can stop at the result after 8 places." Drop "About 15 minutes" or measure it. | High | Low | Copy | `:649`, `:624` |
| 3 | Make the early stop fire more: lower `stopZ` or `minStops`, or cap the walk (for example 10 towns). Re-run the simulation to see the new length spread. | High | Medium | **Engine** (version bump and golden tests) | `engine/margwise-engine.js` params `echoAfter:6, minStops:8, stopZ:1`; `engine/SPEC.md:30-36`; UI mirror `MIN_STOPS/MAX_STOPS` at `:1101` |
| 4 | Offer a "Show my result now" button after town 8, with a note that more places make it sharper. | High | Medium | UI only if the engine can already finish at 8; otherwise **Engine** | `advance` around `:1182-1183` |
| 5 | Fewer locks: ask for 4 (one per type) with the option to add 4 more after the result. Or make all locks optional with one "skip all" button. | High | Medium | UI for "skip all". Fewer rounds changes the result page, check `aptScores` | `ROUNDS` `:1759`, forced loop `:1182-1183` |
| 6 | Give the story a payoff: let the keeper's line react to the pick, and give the lamplighter mystery an ending. Add a clue per chapter. | High for story lovers | High | Copy (data) | `data/story2.json`, `applyStory` at `:842` |
| 7 | Show pay in rupees, or show no pay when we have no Indian number. Keep the US figure only under a clear label. | High for trust | Medium | Data (needs source, trust level, date per CLAUDE.md) | `cstats` `:1691`, `usPay` `:1706-1709`, `plfsText` `:1674` |
| 8 | Fix the "Strong" label. Show "Strong" only when both items were right. Show "3 of 4 right" if you want it clear. | Medium | Low | Copy and display only (APT_NUDGE is off, ranking is not affected) | `LEVEL_WORD` `:1836`, `aptScores` `:1823-1828` |
| 9 | Replace two word locks with picture or pattern locks. Keep one maths lock using shop money. | Medium | Medium | Content only | `LOCKS` `:1743-1756` |
| 10 | Add read-aloud to lock questions and result summaries. | Medium | Low | UI | `listen` `:2056-2062` |
| 11 | Shorten the front door: show the 90-word summary, put the rest behind "More". Move the under-18 notice into one step. | Medium | Low | Copy | `:618-659` |
| 12 | Lead each field page with a 5-line summary. Fold the rest. Rename or soften "AI exposure" and say it is US data. | Medium | Medium | Copy and layout | field page code around `:2097-2153` |
| 13 | Put Physiotherapist in Sports and fitness too (or add a cross-link). | Medium for athletes | Low | Data | `data/content.py` (health and spo careers) |
| 14 | Add a Hindi version of the choices and results. | High for reach, large | High | Content and UI | not built; see README line 50 and `docs/ARCHITECTURE.md:170` |
| 15 | Rename "Light the lamp · keep my oil" to "Light this lamp". | Low | Low | Copy | the `#light` button in `night-of-lamps.html` |
| 16 | Add a "Save and continue later" step for slow connections. | Medium | Medium | UI and storage; mind the privacy rules | not built |

Suggested first batch (all low effort, no engine change): 1, 2, 8, 10, 11, 13, 15. Then decide on 3 and 4 together, as one engine change with one version bump.

## 6. Bugs and layout issues

| Issue | Status |
|---|---|
| "Second look" pill shows a "more" range that can look higher than before | Verified in code (`:1103-1110`) |
| Oil rule stays visible after the first lamp is lit and looks like a leftover | Verified in code (`:1184`) |
| Counter says "Place N of 15" but 8 to 15 is the real range, so "15" misleads when the walk ends early | Verified in code (`:1101`) |
| Physiotherapist is missing from Sports and fitness | Verified in data |
| Shape lock on a short screen: "Pick a key" and "Skip this lock" are below the fold and need a scroll (seen by Sana on a 1366x768 laptop; Kabir and Priya skipped the shape lock on phone) | Seen in the driver; code check could only estimate. Likely on real phones. Not verified on a device |
| On a laptop, the game is a narrow column in the middle with a blurred background (Meera) | Seen by one persona. Not verified |
| "Board: cbse" in lower case in the parent summary (Meera) | Not verified |
| Radar chart axes have no numbers (Dev) | Not verified |
| No page errors were reported by the driver | Per run logs; not exhaustive |

## 7. Persona claims corrected by code review

Use this list to trust the rest of the reports.

- "The oil rule is shown on every town": false. It shows at the first town only (`:706`, `:1184`).
- "Right and wrong lock answers give the same feedback" (Dev): false. They differ (`:1816`). The wrong-answer message is soft and gives no answer.
- "Seven locks" (Kabir): wrong. There are always 8 (4 rounds of 2).
- "The repeated town is a bug or a glitch": it is on purpose, a consistency check. The real problem is that it is not explained when it happens.
- "The game has a fixed 15 or 16 towns": the walk is adaptive, 8 to 15 towns plus the second look. In practice it was almost always 15.
- "Jyo has no lines after the intro" (Sana): Jyo has a pool of 133 thread lines, one shown per town.
- "Strong means the puzzle scores ignore right and wrong" (Ishita, Dev): partly. Right and wrong are scored, but levels 2 and 3 both show "Strong". Puzzles do not affect the ranking.
- "The gate is 358 words": about 190 words are visible. 358 is with the collapsed parts open. The under-18 consent is a separate screen.
- Not false, confirmed: US pay only; Physiotherapist missing from Sports; no Hindi; read-aloud on towns only.
- Not verified: how the lock screen looks on a real phone, and the "keep my oil" confusion.

## Notes

- The harness and a persona brief are in `app/tests/playtest/`.
- Order to read the persona reports: Sana (story), Kabir (pace), Rohan (access), Priya (single goal), Arjun (rural).
