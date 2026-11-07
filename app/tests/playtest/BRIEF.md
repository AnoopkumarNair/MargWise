# Brief for every student-persona playtester

You are role-playing ONE Indian school student (persona below) playing the Margwise career game "Night of Lamps" for the first time. Students have told us the storyline is boring and there are too many questions, so they quit before the end. Your job is to find out, honestly and in character, where and why that happens.

Rules
- Do NOT edit any file in /home/user/MargWise. Do not deploy, push or touch any live site. Only play the local copy.
- The local server is already running at http://localhost:8788. Do not start or stop it.
- Invite code: `master`. Use your persona's first name as the name.
- Play ONE action per Bash call with the driver, like a person would. Driver: H=app/tests/playtest
  - start your browser: `VP=<viewport> node $H/play.mjs serve <PORT> > /dev/null 2>&1 &` then `sleep 3` then `node $H/play.mjs <PORT> look`
  - `node $H/play.mjs <PORT> click '<selector>'` or `click <number>` from the last look; `fill '<sel>' <text>`; `check '<sel>'`; `scroll page 400`; `look`; finally `stop`.
  - Each call prints the screen text, numbered choices and a screenshot path. Look at a screenshot with the Read tool now and then (at least: first screen, first town, first lock puzzle, the result), because students react to how things LOOK, not only to text.
  - Gotchas: click #gStart before the form appears; after #gGo come #consentYes then #csDone; at a town pick up to 2 of the 4 `.obj` choices then click #light, then #nextBtn; lock puzzles: click an option number, then #lkTry, then #lkNext (#lkSkip exists); beat screens use #beatGo; at the finale click #fnGo; at the reveal click #openDoors, then a .fcard opens a field page.
- Make every choice the way YOUR persona would, from their real interests. Do not optimise. If your persona would skim, do not "read" the text: say what they would actually take in.
- Keep a running diary in your head. After EVERY screen note: screen id, a boredom score 0 to 10, and one short honest reaction in the persona's voice.
- QUIT POINT: the moment your persona would really close the tab in real life, write "WOULD QUIT HERE" with the screen, the count of towns and puzzles done so far, and the reason. Then KEEP PLAYING to the end anyway (as a tester), so we also learn about the rest. If your persona would never quit, say so.
- Time: a real student reads at the persona's speed. Estimate the real minutes your persona would have spent at each point (word count / reading speed + thinking time); do not use the driver's elapsed time, which includes tool overhead.
- At the result screens: does the result fit the persona's real interests? Do they understand it? Would they show it to a parent?
- Stop your browser at the end (`node $H/play.mjs <PORT> stop`).

Write your report to docs/reviews/<run folder>/<name>.md with these sections:
1. Persona (one line)
2. Did they finish? Quit point (screen, towns done, puzzles done, estimated real minutes) and the reason, in their words
3. Boredom curve: a table of screen | boredom 0-10 | reaction (keep it short; group repeated screens like "towns 5-9")
4. Top 5 moments that lost them, each with the exact text or screen that caused it (quote it)
5. Top 3 moments that worked for them
6. Story: did they care about the characters/plot? what would make them care?
7. Questions: how many felt like too many? which were repetitive or confusing? (quote)
8. Lock puzzles: fun or exam-like?
9. Result: did it fit? would they share it?
10. Their 5 concrete suggestions, ranked, specific to this game
11. Bugs or layout problems seen (with screenshot paths)
Reply to the orchestrator with only a 10-line summary and the report path. Keep the report factual: quote what was on screen, and say clearly where you are guessing.
