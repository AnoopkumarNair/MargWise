# S5 / T4.5 review: tier 2 reading on the device

Independent review of `git diff 7f7f372 eda85df` on 2026-11-10, read-only. The reviewer did not write the code. It ran the pure unit tests, the vector check, the vendor hash check and a YAML parse, and compared the pins with npm and Hugging Face. It did not run the e2e tests, the real-model tests or a build, so browser behaviour below is from reading the code unless it says otherwise.

## Verdict

No blockers. Nothing reaches the network except fixed same-origin GETs, and the CSP blocks CDNs anyway. The deploy gate is D45 (the `wasm-unsafe-eval` token), which needs the owner's sign-off.

## Should-fix

**S1. The scan runs on the main thread, one sentence at a time, with no yield and no cancel.**
- Where: `app/adult/intake/tier2.js` (`suggest` loop, `maxLines: 250`), `app/adult/intake_embed.js` (one thread, no worker), `app/adult/screens/confirm_more.js`.
- Scenario: a long resume on a cheap Android phone. The page looks frozen for 30 seconds or more, with no Cancel. TEST_PLAN layer 8 asks for checks with 4x CPU throttling; no tier 2 test throttles.
- Fix: yield to the event loop between sentences, add Cancel, lower `maxLines` or read the newest jobs first, add a throttled e2e check.

**S2. The live region is rewritten on every network chunk and every sentence.**
- Where: `intake_embed.js` (`say` per stream chunk), `confirm_more.js` (`#more-status`, `aria-live="polite"`).
- Scenario: a screen-reader user hears hundreds of progress announcements.
- Fix: keep `<progress>` fast; update the live text at the start, every 10 percent or few seconds, and the end.

**S3. Two loads can run at once; the loader is not memoised.**
- Where: `intake_embed.js` (`loaded` set only at the end), `confirm_more.js` (`m.suggestionsDone` set only at the end).
- Scenario: press the button, go Back and Forward during the download, press again. Two imports, two 14 MB fetches, two pipelines sharing one `env.fetch` and `fail`.
- Fix: memoise a module-level `loading` promise, reset on failure; the box shows "still working" while it is pending; e2e for Back and Forward during a load.

**S4. `skill_vecs.bin` has no content hash.**
- Where: `data/graph/vec_texts.py` `check` (ids, length, recipe, text hash; never the bin bytes).
- Scenario: the bin is regenerated with another model or altered at the same length. Every check passes and the browser compares against wrong vectors.
- Fix: `bin_sha256` in `skill_vecs.json`, verified in `check()` and in `build.py`; `check()` also compares `model` and `revision` with `tier2_model.json`.

**S5. "Downloads 39 MB once" is not backed by the headers; the cache story is unverified.**
- Where: `hosting/public/_headers` (`/work/*` is `no-cache`), `confirm_more.js` copy, `tier2_model.json` (served path has no revision).
- Scenario: each visit revalidates 39 MB; small caches may evict; a model update could be served stale from the library's own cache.
- Fix: put the revision in the served path and serve it `immutable`, or turn the library cache off and change the copy. Check which is true in the browser.

**S6. Sections that hold achievements are skipped, and the docs do not say so.**
- Where: `tier2.js` `SKIP_SECTIONS` (includes "other", which holds achievements, awards, volunteering, and "summary").
- Scenario: a fresher whose only real sentences sit under "Achievements" gets no offer.
- Fix: read those sections, or state the exclusion in D47, with numbers either way.

**S7. The headline number is the loose one.**
- "Fair precision 0.72" counts about 3 to 4 acceptable ids per line out of 109. Strict precision is 0.22. Strict recall is computed and never reported.
- Fix: lead D47 and S5_DEMO with the strict numbers; say what "fair" counts.

**S8. The vendored runtime is a nightly build, and the library was 14 days old.**
- `onnxruntime-web 1.31.0-dev.20260914` inside transformers 4.3.2 (published 2026-10-27). The vectors were made with stable `onnxruntime-node 1.30.0`.
- Fix: owner decision. Take 4.3.1 if its runtime is stable, or accept 4.3.2 and record "nightly runtime" in D43 and VERSIONS.md.

## Nits

- **N1** `s5.test.mjs` "declining": the comment claims a check the code does not make. Assert it or drop it.
- **N2** `tier2_model.json` `per_file_limit_bytes` is read by nothing.
- **N3** `tier2.js` allows several rows per id; `vec_texts.py` forbids it. Make them agree.
- **N4** `validate_graph.py --exports-dir <other>` now fails without vector files. Nothing uses it today.
- **N5** `confirm_more.js`: disabling the focused button drops keyboard focus. Use `aria-disabled` or move focus to the status line.
- **N6** `confirm.js` reuses "From your resume:" for suggestions, where the line does not name the skill.
- **N7** The model and wasm stay in memory for the whole visit; no `dispose()`.
- **N8** `data/graph/raw/onet/31.0/SOURCE.md` total size is stale; D43 says "a little under two weeks" where it is exactly 14 days.
- **N9** The "0.55 suggests almost nothing" test documents today's model; it will fail when the recipe improves.
- **N10** The s3 CSP assertion would not catch a scheme-only or wildcard source in `script-src` (older than S5).
- **N11** If `@huggingface/jinja`, `@huggingface/tokenizers` and `onnxruntime-common` are inlined in the bundle, their notices are not vendored (unverified).
- **N12** `npm ci` in `app/adult/tools/embed` runs install scripts in CI; consider `--ignore-scripts` if the binding is bundled (unverified).

## Verified OK

- **Privacy and network.** Three kinds of fetch, all same-origin constant URLs, no body, `credentials: 'omit'`. `tier2.js` is pure. No console, storage or `innerHTML` in the new files. The library's remote model path is off and its CDN wasm default is overridden before any session; the CSP would block both anyway. The library is imported only inside the click handler.
- **CSP.** `wasm-unsafe-eval` is the only addition, on `/work/*` only. Student, admin and counsellor headers are unchanged. The narrowed s1 and s3 assertions still fail on `unsafe-eval`, `unsafe-inline`, `blob:` and any new origin.
- **Supply chain.** All six vendored hashes equal VERSIONS.md. The model pin (revision, size, sha256) matches Hugging Face. `fetch_model.py` checks every file's hash and size on download and on reuse. The 25 MiB limit is enforced and tested. The shown size is the real total.
- **Correctness.** int8 decode and cosine are right. Suggestions enter unticked and only ticked skills reach the profile, as ids. No resume-derived HTML.
- **Data.** O*NET `Content Model Reference.txt` has its source, hash, date and licence recorded. `contracts/`, `matcher/` and `engine/` are untouched. A rebuild never recomputes vectors.
- **Tests and CI.** The new tests assert what they claim (except N1, N9). A missing model fails under `CI=true`. The workflow is valid YAML, adds no secrets and keeps the earlier jobs.
