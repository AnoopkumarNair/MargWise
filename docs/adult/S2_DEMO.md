# S2 demo: honest labels, six questions, your job today, drill (5 minutes)

What slice S2 shows: after you confirm your jobs and skills, six optional questions flag roads that may not fit your time, money or place. "Your job today" shows what AI does in your job. Roads show the kind of move and an experience fit. Tap a skill to see which jobs need it, and tap a job to see roads from there. This is a test build (`dev-unaccepted`), never deployed. Everything runs in the browser.

## Set up (once)

```bash
python3 pipeline/run.py                  # offline
python3 app/adult/build.py --dev         # real data from data/graph/; add --fixtures for the small test data (it has made-up pay and city numbers, so the notes show)
npx wrangler@4 pages dev hosting/public  # open http://localhost:8788/work/
```

Sample resume: `app/adult/tests/fixtures/single_col/resume.pdf` (an invented person).

## The demo

| Step | Do this | You should see |
| --- | --- | --- |
| 1 | **Start**, choose `single_col/resume.pdf`. | "Check what we found". Each skill is a short line. The resume lines behind them are hidden. |
| 2 | Tap **Where did this come from?** | "From your resume: ..." under every skill. Tap again to hide. |
| 3 | Press **Continue**. | "A few quick questions": study hours, course budget, city, where you would work, lowest pay change, work mode. Each has **Skip**. A line says the answers never change the order of your roads. |
| 4 | Answer some: 0 to 5 hours, free only, Pune, "Remote only", at least 20% more, remote. Press **Save and continue**. | "Your job today". Nothing shows a date or says "not yet measured". |
| 5 | Read the page. | Skills with a label: "People still do this", "Mixed: people and AI both do this" or "AI already does much of this". Tasks in two lists: **AI used today** and **No AI use seen**. Then "Your answers". If the data has no pay or demand figures, one line says "Pay and demand figures are coming." |
| 6 | Tap **Jobs that need this** on a skill. | A list of jobs near yours that need the skill, most important first. |
| 7 | Tap **See roads from this job** on one. | "Roads from <that job>", with a note that you are looking from another job and your skills are the same. **Back** in the browser returns to the list. **Back to roads from <your job>** returns to your own. |
| 8 | Go to your own roads. | Each card shows Close move, Stretch or Leap, and the kind of move in words (Step up, Sideways move, Step up and sideways, Start again lower, Fork in the same field). Notes appear on cards where a road may not fit your answers (pay may fall below your lowest change; may need a move). |
| 9 | Move the sliders (Safe from AI to 5, Short move to 0). | The list re-orders live. Short move starts at 3. |
| 10 | Press **Change my answers**, **Skip these questions**, **See my roads**. | The order is the same and the notes are gone. The questions never change the order. |
| 11 | Open a road. | The skills you would still need (each with **Jobs that need this**), "No reviewed course yet for these skills", your level and how your years fit this job, and a closed **Why this order?**. |
| 12 | Open **About this data** in the footer. | Where the data comes from, how old the skill ratings are ("Skill ratings collected ... (US)"), what is missing, and how the order is worked out. |

## What is not real yet

- Pay and demand figures for India are missing (D27, O9). So the pay-floor note does not show on real data, and the pay and demand sliders change nothing.
- The "may need a move" note needs city data on each job. No job has it yet. The "more study time than you have" note needs a list of reviewed courses (T1.8), which does not exist yet, so every road says "No reviewed course yet".
- Skills and tasks are not greyed or hidden by age yet: the slice does not say how often each source is updated (D28).
- "Add this road" comes with sign-in (slice S4).

## Checks behind it

```bash
node --test app/adult/tests/unit/*.test.mjs app/adult/tests/privacy/static.test.mjs app/adult/tests/intake/*.test.mjs
cd app/adult/tests && node --test --test-concurrency=1 e2e/*.test.mjs privacy/*.e2e.mjs   # MW_E2E_DATA=real for real data; MW_SHOTS=commit for phone screenshots
node .github/scripts/check_vendor_hashes.mjs
```
