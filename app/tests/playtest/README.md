# Student playtest harness

Tools to re-run the simulated student playtest (see `docs/reviews/student_playtest_2026-11.md`) after changing the game. The students are AI role-plays, not real people.

All output goes to `app/tests/playtest/out/` (gitignored). Set `PLAYTEST_OUT` to use another folder. Nothing else in the repo is written. The one exception: if `hosting/public/index.html` is missing, `start_server.sh` builds it first (that file is gitignored).

## Files

- `start_server.sh` / `stop_server.sh`: run a local copy of the site on `:8788` (`PORT=` to change), invite code `master`. It works on a copy of `hosting/` under `out/site/`.
- `play.mjs`: a browser driver. One action per call, prints the screen text, the choices and a screenshot path.
- `autoplay.mjs`: plays a whole run with simple fixed rules (smoke test or counting screens).
- `BRIEF.md`: the instructions given to each persona tester.

## Needs

Node, `npx wrangler`, `curl`, and Playwright with a Chromium browser (resolved through `NODE_PATH`). Python 3 with `pillow` only if `hosting/public/index.html` must be built.

## Re-run a persona

1. `bash app/tests/playtest/start_server.sh`
2. Start a browser on a free port (`VP=phone`, `tablet` or `laptop`): `VP=phone node app/tests/playtest/play.mjs serve 9101 > /dev/null 2>&1 &`
3. Look and act: `node app/tests/playtest/play.mjs 9101 look`, then `click '#gStart'`, `click 3`, `fill '#gName' Aarav`, `scroll page 400`, and so on. Last step: `stop`.
4. Each persona reads `BRIEF.md` plus a one-paragraph persona (see the first section of each report in `docs/reviews/student_playtest_2026-11/`) and writes a report in the same sections.
5. Quick check without a persona: `node app/tests/playtest/autoplay.mjs 9101 signup` plays to the doors screen. Logs are in `out/runs/<port>/log.json`.
6. `bash app/tests/playtest/stop_server.sh`

## What to compare after a change

- Where each persona would quit (screen, towns, locks, estimated minutes). The first run: 8 of 9 at the "second look" after about 6 towns and 4 locks.
- Total screens and estimated minutes against the "About 15 minutes" promise.
- Page errors listed in the logs.

Trust: these are guesses by an AI in character. Use them to find problems, not to measure how many real students would quit.
