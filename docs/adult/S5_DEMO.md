# S5 demo: more skills from the resume, on the device (5 minutes)

What slice S5 shows: after the dictionary reading (tier 1), the confirm screen offers one extra step. If the person agrees, a small language model (about 39 MB to download; the browser usually keeps it for next time) runs in their browser, reads the sentences of the resume, and suggests skills the resume only hints at. Every suggestion is unticked, shows the line it came from, and needs a tap. Nothing leaves the device. This is a test build (`dev-unaccepted`), never deployed.

## Set up (once)

```bash
python3 app/adult/tools/fetch_model.py      # downloads the pinned model (23 MB) into a git-ignored cache and checks every hash (needs network, once)
python3 pipeline/run.py                     # the career graph, offline
python3 app/adult/build.py --dev            # builds /work/ ; look for the line "tier 2: on (model ..., download 38.6 MB ...)"
node -e "import('./app/adult/tests/e2e/server.mjs').then(m => m.startServer(process.cwd() + '/hosting/public')).then(s => console.log('http://127.0.0.1:' + s.port + '/work/'))"
```

The last command is the test server (it applies the same `_headers` as Cloudflare, including the policy). `cd hosting && npx wrangler pages dev public` serves the same files, but needs network to start. Open the address it prints. Keep the browser's network tab open.

## The demo

| Step | Do this | You should see |
| --- | --- | --- |
| 1 | Press **Start**, then **Paste text**. Paste the contents of `app/adult/tests/fixtures/tier2/ops_manager/resume.txt`. Press **Read this text**. | The confirm screen: one job (Operations Manager) and the skills the dictionary found. |
| 2 | Scroll to **Look for more skills**. | One button: "Look for more skills in your resume (downloads about 39 MB, runs on this device)", and under it "Your browser usually keeps these files, so next time is quicker. It may remove them to save space." The network tab shows **no** request for the model, the runtime or `skill_vecs`. |
| 3 | Press **Continue** instead (this is "no thanks"), then use the browser back button. | The roads come as before. Back on the confirm screen the offer is still there, and still nothing was downloaded. |
| 4 | Press the button. | The button gives way to a progress bar and a **Cancel** button, with "Downloading... 12 MB of 39 MB", then "Reading your resume... 3 of 7 lines". About 1 to 2 seconds here; on a phone network the download is the wait. The model files are under `/work/models/<12 characters of the revision>/`. |
| 4b | Press the button again on a fresh page, then **Cancel** while it works (to slow the download, throttle the network in the browser tools). | "Stopped. Your list is as it was. You can start again." The button is back and has the focus; no suggestion is shown. Press it again: if the model had finished downloading, nothing is downloaded again. |
| 5 | Read the result. | A group **You may also have**, with about 3 skills (for example "Coaching and Developing Others", "Resolving Conflicts and Negotiating with Others"). None is ticked. Each shows "Because of this line in your resume: "..."" with the sentence it came from. The skill count has not changed. |
| 6 | Tick one. | A "Used / Strong / Rusty" choice appears, and the count goes up by one. |
| 7 | Press **Continue**, skip the questions, look at the roads. | The ticked skill counts like any other. The network tab shows only `GET`s for files on this site. No request has any part of the resume in it. |
| 7b | Open the page again in the same browser, read the same resume and press the button. | The network tab shows no request for the model files (they come from the browser's cache). The 14 MB runtime is asked for again; a browser with a disk cache gets a "304 Not Modified" with no body. |
| 8 | Open `/work/tiers.html`. Press **Run tier 1**, then **Run tier 2**. | Two columns for the pasted sample: tier 1 (the dictionary skills with their lines) and tier 2 (suggestions with scores). Change the threshold (try 0.30 and 0.50) and run tier 2 again. |
| 9 | Stop the test server, build with the model missing (`mv app/adult/tools/model_cache /tmp/`, then `python3 app/adult/build.py --dev`), serve again, and repeat step 1. | The build says "tier 2 ... is NOT in this build". The confirm screen has no "Look for more skills" section, and everything else works. Put the folder back and build again. |

## Run the evaluation (T7.3)

The owner runs this on the 30 real resumes. The guide is `app/adult/tests/EVAL.md`. It prints only aggregate numbers, writes nothing, and refuses a folder inside the repository.

```bash
node app/adult/tests/eval_intake.mjs /path/outside/the/repo/people --now 2026
```

To see it work without real people, copy the synthetic fixtures to a folder outside the repository (`app/adult/tests/intake/eval_harness.test.mjs` builds one in the temp folder). On 13 readable fixtures with profiles made from their `expected.json` (one person with a wrong job and recorded edits, for the demo), it prints SKILLS, ROLE, TIME, REDACTION and SPEC 11 TARGETS blocks, for example: tier 1 precision 76.1%, recall 100.0% (the "confirmed" skills here are the fixtures' must-find lists, so recall is 1 by construction); tier 2 adds 31 suggestions that none of those lists confirm; redaction "not measured (arrives with S6)". These numbers describe the synthetic set, not real resumes.

## What the numbers are

- Download: 38,606,275 bytes (library and runtime 14.9 MB, model 23.7 MB, skill vectors 44 KB). Compressed on the wire it is about 20 MB. The button shows the uncompressed size. The browser keeps the model files (23.7 MB) for a later visit unless it removes them; the runtime is revalidated each visit (`deviations.md` D54).
- How good it is, on 8 synthetic resumes with 48 lines that imply a skill, at threshold 0.40 (D47). Lead with the strict numbers: **strict precision 0.22** (4 of 18 suggestions are exactly the skill the line shows) and **strict recall 0.09** (4 of the 47 skills the lines show were suggested). "Fair precision 0.72" (13 of 18) also counts as right the other readings a careful person would accept, 3 to 4 accepted skills a line out of 109, so it is a generous number. One implied line in five gets a fair suggestion. 2.3 suggestions a resume. It misses most. The real measure is the 30-resume evaluation (T7.3).
- Which sections it reads: the experience lines and the Achievements, Awards and Volunteering sections; not the summary, education, skills, certificates or personal details (D55).
- Speed on this machine (headless Chromium, files from localhost): reading takes about 17 ms a sentence, so the longest scan (120 sentences, newest jobs first) takes about 2 s, and about 7.5 s with the CPU slowed 4 times. The page stays usable meanwhile and Cancel works (D56). Model start and the first small resume: 1.0 to 1.4 s.

## What is not real yet, and what the owner decides

- **D45: the `/work/*` policy gains `'wasm-unsafe-eval'`.** Without it the model cannot run. It allows WebAssembly and not `eval`. Needs your or a security reviewer's yes before any deploy.
- D43 to D49 and D54 to D58 are proposals. D43: the library was published 2026-10-27 and vendored exactly 14 days later, and its runtime is a nightly build (`1.31.0-dev.20260914`); 4.3.1 pins the same nightly, so the owner chooses between keeping it, 4.3.1, or waiting (S8). D46: the model is fetched at build time and is not in git, so the deploy machine must run `fetch_model.py` before `app/adult/build.py` (the build says clearly when it did not).
- Tested in Chromium only. The owner's manual checks on Android Chrome, iPhone Safari and a desktop browser other than Chrome are still needed: WebAssembly memory on a low-end phone is the thing to watch. If a browser cannot run it, the person sees "We could not look for more skills. Your list is as it was." and keeps tier 1.
- The vectors are made by hand (`app/adult/tools/embed/embed_skills.mjs`). If O*NET or the model changes, CI fails until they are made again.

## Checks behind it

```bash
node --test app/adult/tests/unit/*.test.mjs app/adult/tests/intake/*.test.mjs app/adult/tests/privacy/static.test.mjs
cd app/adult/tools/embed && npm ci && cd ../../..    # once: the packages for the real-model test in Node
cd app/adult/tests && npm ci && node --test --test-concurrency=1 e2e/s5.test.mjs e2e/s5_off.test.mjs
```

`e2e/s5_robust.test.mjs` checks, under 4x CPU throttling, that the page keeps painting, the progress text advances and Cancel works; that the live region speaks about 20 times, not on every sentence; that a screen drawn again during a download shows it and each file is served once; and that a second visit asks for no model file. `e2e/s5.test.mjs` checks the size is real and shown first, nothing loads before agreeing, suggestions are unticked with source lines, every request after agreeing is a `GET` for a listed file on this site, no canary or run of resume text leaves the page, a failed download leaves tier 1 as it was, and the browser gives the same numbers as the Node test. `s5_off.test.mjs` checks a build without the model offers nothing.
