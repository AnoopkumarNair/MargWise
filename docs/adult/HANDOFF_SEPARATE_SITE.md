# Handoff: move the adult app to its own site

Written 10 Nov 2026. Read this first, then `CLAUDE.md`, then `docs/adult/HANDOFF_NEXT.md`.

## Opening prompt for the new session

Paste the text below as the first message of a new session on this repository.

---

You are restructuring Margwise so the adult app is a separate site from the children's game, in the same repository.

1. **Start from branch `claude/compassionate-hopper-u04goa`,** not from `main`. It holds the adult app (slices S0 to S5) merged onto current `main`. If your session gives you a different working branch, base it on that branch.
2. **Read** `docs/adult/HANDOFF_SEPARATE_SITE.md` (this plan), `CLAUDE.md`, `docs/adult/HANDOFF_NEXT.md`, `docs/adult/BACKEND.md` and `docs/adult/deviations.md`.
3. **Do the work in the "Work" section of the handoff, in order.** Commit after each step with a clear message. Push to your branch.
4. **`main` is the children's live site. Do not break it.** Never deploy, never apply SQL to a remote database, never run `--accept`, never push to `main`, never merge the pull request yourself. The owner merges.
5. **Stop and ask the owner** before any contract change, any licence question, or anything this handoff marks as an owner decision.
6. **Finish with** all checks green locally, a pull request into `main` (the owner has asked for one), CI green on it, and a short report: what moved, proof that the children's site is untouched, and what the owner must do.

---

## The decision (owner, 10 Nov 2026)

- **The adult app becomes its own site:** its own Cloudflare Pages project, its own D1 database, its own secrets and its own name. The children's site does not link to it.
- **The repository stays one repository.** Both products share the data pipeline, the sourced facts and the release process. CI gets path filters so a change to one product runs only that product's checks.
- **This replaces the shared-database design.** `BACKEND.md` ADR-15 (students and adults in the same tables, told apart by a `track` column) no longer applies. Record this as a new owner decision in `deviations.md` and a new or amended ADR.
- **Name and domain are not chosen yet.** Keep them as settings. Ask the owner when you need them.

## Why

On this branch the student API (`hosting/functions/api/_util.js`, `admin.js`, `config.js`, `join.js`, `resume.js`, `review.js`) reads a `track` column that the live database does not have. A student deploy from `main` after a merge would break every student sign-in and join until the owner applied `0001_adult.sql`. A separate site removes the cause: the children's backend does not change at all.

## The goal, as a test

After your work, this must hold:

```bash
git diff main -- hosting/functions/api/ ':!hosting/functions/api/v1' hosting/public/_headers hosting/public/manifest.json \
  hosting/wrangler.toml hosting/schema*.sql engine/ app/night-of-lamps.html app/build.py data/content.json data/releases/latest.json
```

- **Target: empty output,** or only changes you can justify one by one in the pull request. Two changes are known and should be judged, not assumed:
  - `app/build.py` copies vendored files into `hosting/public/vendor/` without wiping the folder, because `VERSIONS.md` lives there. If the adult vendor files move to the adult site, this change may no longer be needed.
  - `data/ai_exposure.py` fails loudly when `data/ai/retrieved.json` is missing instead of writing today's date. `retrieved.json` is committed, so an offline rebuild is unchanged. Keep it unless it causes trouble.
- A student deploy from `main` after the merge must behave exactly as it does today, with no migration and no new setting.

## Work

1. **Give the adult site its own hosting folder.**
   - Pick a name that matches the repo style (for example `hosting-adult/`) with its own `wrangler.toml`, `public/`, `functions/`, `_headers`, `migrations/` and `.gitignore`.
   - Move there: `hosting/core/`, `hosting/functions/api/v1/`, `hosting/migrations/`, `hosting/tools/`, `hosting/tests/adult/`, `hosting/tests/migration_guard.mjs`, the `/work/*` block of `hosting/public/_headers`, and the adult-only vendored libraries (`pdfjs`, `mammoth`, `transformers`) with their rows in `VERSIONS.md` and the hash check.
   - `app/adult/build.py` must write into the new folder. Today it writes to `hosting/public/work/`.
2. **Decide the URL shape and say why.** Either keep the app under `/work/` on the new site with a redirect from `/`, or move it to the root. Moving to the root is cleaner but touches every absolute path in `app/adult/`, the tests and the CSP. Pick the smaller safe change unless the owner says otherwise.
3. **Revert the student API to `main`.**
   - `git checkout main -- hosting/functions/api/_util.js hosting/functions/api/admin.js hosting/functions/api/config.js hosting/functions/api/join.js hosting/functions/api/resume.js hosting/functions/api/review.js` and the student `wrangler.toml`, then check nothing else in the student site still differs (the goal test above).
   - Remove tests that only existed to prove track isolation in student queries.
4. **Give the adult site its own schema.**
   - The adult code today reuses the student tables `testers` and `invites` (`hosting/core/` has about 26 mentions of `track`) and imports student helpers in `hosting/core/keys.js`.
   - Make the adult database stand alone: one migration set that creates only what the adult app needs. No migration has been applied to any remote database, so you may rewrite `0000_baseline.sql` and `0001_adult.sql` for the adult site rather than stack fixes. The student `schema*.sql` files stay as they are.
   - Drop the `track` column and its filters from adult code where a separate database makes them pointless. Keep `hosting/core/data_inventory.js`, the invariant checker and `fakedb` in step.
   - Decide what happens to invites: the adult site needs its own invite and admin path. The adult panel planned inside the student admin page (T7.2) becomes an adult-site page.
   - The adult site gets its own `SIGN_KEY`. Remove the note that rotating it breaks student return codes.
5. **Check the contracts.** `contracts/` is frozen (`contracts/FROZEN.md`). If any API or profile contract mentions `track`, an invite shape or anything else that changes, stop and ask the owner; use the amendment mechanism.
6. **Split CI by path** in `.github/workflows/build-check.yml`.
   - A student-only change runs only the student checks. An adult-only change runs only the adult checks. Shared paths (`pipeline/`, `data/`, `contracts/`) run both.
   - A red adult job must never block a children's fix. The adult jobs have never run on GitHub, so expect first-run failures and fix them.
   - Check `.github/workflows/data-refresh.yml` still works with the graph stages added to `pipeline/run.py`.
7. **Update the docs.**
   - `CLAUDE.md`: two sites, two deploy commands, and the rule that a student deploy never needs an adult step.
   - `docs/adult/BACKEND.md`: the new or amended ADR, the migration and deploy sections.
   - `docs/adult/deviations.md`: the owner decision, and every earlier entry it supersedes (ADR-15, the "apply `0001` before deploying" rule, the `ADULT_SIGNUP` and track notes).
   - `docs/adult/HANDOFF_NEXT.md`: a dated note. Remove the "Deploy order" warning once it no longer applies.
   - A short runbook for the owner: create the Pages project and the D1 database, apply the adult migrations, set the secrets and switches (`ENVIRONMENT`, `SIGN_KEY`, `EMAIL`, Turnstile keys, `ADULT_SIGNUP`), run `app/adult/tools/fetch_model.py`, then `app/adult/build.py`, then deploy.
8. **Run every check** in the "Check set" of `HANDOFF_NEXT.md`, updated for the new paths, plus `node --test app/tests/*.test.mjs`. An offline `python3 pipeline/run.py` must leave committed data unchanged.
9. **Open the pull request into `main`.** Draft PR #20 is from the stale branch `ccr-4a84cc2e-h7kisr`; say in the new pull request that it replaces #20 and leave closing #20 to the owner. Include the goal-test output, the test summary and the owner's to-do list. The owner chose squash on merge.

## State of the branch on 10 Nov 2026

- **Merged:** adult branch `ccr-4a84cc2e-h7kisr` (S0 to S4) onto current `main`, five conflicts resolved, all checks green.
- **S5 built:** tier 2 on-device suggestions (T4.5) and the evaluation harness (T7.3, `app/adult/tests/EVAL.md`).
- **S5 reviewed and fixed:** `docs/adult/S5_REVIEW.md`; fixes in `deviations.md` D54 to D58. Confirm the last fix commits passed the full check set before you build on them (`git log`, then run the checks).
- **Pushed:** everything, to `claude/compassionate-hopper-u04goa`. GitHub's secret scanner flagged a class name in `hosting/public/vendor/transformers/transformers.min.js` as a Mistral key; the owner approved it as a false positive. If the file moves folders and the scanner objects again, tell the owner; do not change the vendored bytes.

## Known problems that are not yours to hide

- **`python3 app/build.py` dirties tracked files on plain `main`:** it changes `app/dist/index.html` and `hosting/public/manifest.json` and writes untracked `video/` folders. Revert after running it; do not commit that output. Tell the owner.
- **Tier 2 is weak on synthetic resumes.** See the strict numbers in `deviations.md` D47 and the review fixes. The owner's run on 30 real resumes decides whether it stays.
- **Tier 2 is tested in Chromium only.** Android Chrome and iPhone Safari are manual checks.

## Owner decisions still open

- The adult site's name and domain.
- CSP: `'wasm-unsafe-eval'` on the adult pages (D45). On a separate site this no longer touches the children's headers at all.
- The vendored library version: transformers 4.3.2 with a nightly runtime, or 4.3.1 (D43 and the S8 note).
- The two blanks in `app/adult/notice.md` (retention period, grievance contact).
- The dictionary and title lists (O5), the seed lists for new roles and certifications (T1.7, T1.8).
- Next slices after this restructure: S6 (provider, spend cap, model hosting), then S7.
