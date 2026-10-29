# S1 demo: title to roads (5 minutes)

What slice S1 shows: a working adult types a job title, ticks what they do, and sees the jobs they could move to, with how much of each job they already cover and what they would still need. Everything runs in the browser. Nothing is stored or sent.

This is a test build (`dev-unaccepted`) made from the working data. It is not a release, and it is never deployed.

## Set up (once, about 2 minutes)

From the repository root:

```bash
python3 pipeline/run.py                 # rebuilds the career graph and the 910 job files offline (about 1 minute)
python3 app/adult/build.py --dev        # builds the app into hosting/public/work/
npx wrangler@4 pages dev hosting/public # local server; open http://localhost:8788/work/
```

The first command must end with `graph checks passed` and `done.`. The second prints `release=dev-unaccepted graph=data/graph`.

## The demo

| Step | Do this | You should see |
| --- | --- | --- |
| 1 | Open `/work/`. | "Margwise for working adults", a note that there is no sign-in and nothing is stored on a server, and **Start**. The footer says "Job data release: dev-unaccepted (test build, not for real use)", "O*NET version: 31.0", the data dates, and the O*NET credit. |
| 2 | Press **Start**. Type `qwertyuiop`. | "No job found". |
| 3 | Clear it and type `chartered account`, then `Accountant`. | A pick list with **Accountants and Auditors**. Indian titles such as "CA" also work (they come from the draft lists in `data/graph/raw/`, which you still need to review). |
| 4 | Pick **Accountants and Auditors**. | "What do you do as Accountants and Auditors?": 40 things in four groups (Skills, Knowledge, Work activities, Tools and software), each with **Tick all**. The count says "0 of 40 ticked" and asks you to tick everything you do. |
| 5 | Press **Tick all** on Skills and Knowledge, untick one or two, set a few to **Strong**. Open "Tasks in this job, and where AI is used". | The count goes up. The task list says how many tasks had AI use seen and how many had none. Tasks with no AI data have no label. |
| 6 | Choose a years band and press **See my roads**. | Up to 30 roads, best first. Each card shows Close move or Stretch, the share covered (a whole percent, rounded down, so it never contradicts the badge), the top skills still missing, and "not yet measured" for pay and demand. Leaps are hidden until you press **Show leaps**. |
| 7 | Move the sliders (Safe from AI to 5, the rest to 0; then Short move to 5). | The order changes at once. A note says pay and demand are not yet measured, so those sliders change nothing yet. |
| 8 | Press **See details** on a road. | The skills you would still need, each with its importance and, where known, its AI label; "No reviewed course yet"; and how the score was made. |
| 9 | Go back to the skills and tick fewer (about 10), then see the roads again. | Almost every road becomes a leap. This is the effect in deviation D19: coverage counts only what you tick, and "Used" counts 0.7. Ticking more, and marking real strengths as Strong, gives closer roads. |
| 10 | Reload the page. | You are back at the title screen: nothing was kept. |

## What is not real yet

- Pay, demand, level fit and courses say "not yet measured" or "no reviewed course yet" (later slices).
- AI labels: most skills have none, because the public task data is too thin to label them (deviation D18, item 9).
- The job data is from the United States (O*NET 31.0). There is no India pay yet: the SOC to ISCO crosswalk could not be fetched (D18, item 5).

## Checks behind it

```bash
node --test 'contracts/tests/*.test.mjs'
node --test 'matcher/tests/*.test.mjs' && python3 matcher/reference.py && node matcher/tests/version_guard.mjs
python3 -m unittest discover -s data/graph/tests && python3 pipeline/validate_graph.py --exports
cd app/adult/tests && npm ci && node --test unit/*.test.mjs e2e/s1.test.mjs     # MW_E2E_DATA=real for real data
```

Every run writes its screenshots to `app/adult/tests/out/` (not committed). The committed phone-width screenshots in `app/adult/tests/e2e/screenshots/` change only when you ask for it with `MW_SHOTS=commit`, so a real-data run never overwrites them by accident.

## Open items (not done in S1)

- **CI has never run on GitHub.** `.github/workflows/build-check.yml` was written and every step was run by hand in the build environment, but no pull request has run it yet. The first PR will show whether it works there (fetch-depth, Playwright install, timings).
- **Release build in CI after the first `--accept`.** Once the owner has accepted a graph release (`data/releases/graph/latest.json` exists), add `python3 app/adult/build.py` (release build: unpacks the slice pack and checks every hash) and the e2e on that build to the `graph` and `e2e` jobs (TODOs in the workflow).
- **Manual device checks.** The e2e runs headless Chromium at 390 and 1280 pixels only. Before people tests, someone must walk the demo above by hand on: Android Chrome (a real phone), iPhone Safari (a real phone), and one desktop browser that is not Chrome (Firefox or Safari). Check the tick-all buttons, the sliders, the strict CSP (no console errors) and the footer.
