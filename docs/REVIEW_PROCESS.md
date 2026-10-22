# How facts get checked (owner-run, no outsiders needed)

Principle: every fact in Margwise is public. The product is the engine, the game and the pilot data. Checkers never see those.

1. Open the admin page (`/admin/`), tab **Fact checks**, and press **Generate a new set**. The server turns `claims.json` (300 single facts built by `pipeline/run.py`) into shuffled tasks with random ids and batches of 12. The mapping from ids to fields stays in the database.
2. Download a batch as a CSV for each reviewer. Give each reviewer a different batch. **All tasks (for you)** downloads everything for your own pass.
3. A reviewer opens the official page for each statement and fills in the verdict (correct, wrong, outdated, cannot find), the exact words the page says, and the date. No counselling expertise is needed. A counsellor adds value only on judgement questions ("is this sensible advice for a Class 9 student?"), and should then see output screens, never code or scoring.
4. For high-stakes claims (medicine, law, defence, civil services, abroad visas), send the same task to a second person who has not seen the first answer.
5. Back in the admin page, choose the filled CSV, enter the reviewer name and press **Load answers**. **Show report** lists everything wrong, outdated, unfindable or disputed. **Report CSV** downloads it.
6. An editor changes the content (`data/content.py`, `data/abroad.json`, `data/plfs_2025.json`), runs `python3 pipeline/run.py`, reads `data/releases/CHANGES.md`, then `--accept`. Press **Mark as applied** in the report so the same finding is not fixed twice.
7. Re-run after every content change and on the refresh cycle: exam notices before each admission season, visa rules quarterly, O*NET, PLFS and AI exposure yearly (AI exposure whenever a new Economic Index is released), exchange rates monthly.

Reviewer answers never change live content automatically. See `docs/ARCHITECTURE.md` section 6.
