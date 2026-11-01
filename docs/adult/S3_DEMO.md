# S3 demo: resume on the device (5 minutes)

What slice S3 shows: a working adult uploads a resume (PDF or DOCX) or pastes its text, checks the jobs and skills we found, and sees roads. Everything runs in the browser. The file and its text are never sent or stored. This is a test build (`dev-unaccepted`), never deployed.

## Set up (once)

```bash
python3 pipeline/run.py                 # career graph and job files, offline
python3 app/adult/build.py --dev        # builds /work/ (uses the test reader only if app/adult/intake/ is missing)
npx wrangler@4 pages dev hosting/public # open http://localhost:8788/work/
```

Sample files: `app/adult/tests/fixtures/<name>/resume.pdf` (and `resume.docx` in `docx_basic`). The people in them are invented.

## The demo

| Step | Do this | You should see |
| --- | --- | --- |
| 1 | Open `/work/`, press **Start**. | "Start with your resume". The box says "Your resume is read in your browser. Nothing leaves your device." Three choices: **Upload your resume** (Recommended), **Paste text**, **No resume: type your job title**. |
| 2 | Open the browser's network tab, then choose `single_col/resume.pdf`. | Only after you choose the file, `pdf.min.mjs` and `pdf.worker.min.mjs` load from `/vendor/pdfjs/`. Every request is a GET from this site. Nothing carries your file. |
| 3 | Look at "Check what we found". | Jobs with the title as written in the resume, the closest job in our list, industry (a guess), and years worked out from the dates. Skills under each job, each with Used, Strong or Rusty. Tap **Where did this come from?** to show the "From your resume: ..." line behind each skill. A skill last used more than 3 years ago starts as Rusty. |
| 4 | Change a job's match, untick a skill, tap **Strong** on another. | The count of kept skills changes. |
| 5 | Search a skill we missed (for example "python") and add it. Tap a chip under "People in your role usually have...". | The skill appears under "Skills you added". The chip disappears. |
| 6 | Answer the three leadership questions (tap "6 to 20 people"). | The other two default to No. You can skip all three. |
| 7 | Press **Continue**, skip the questions, press **See my roads**, open one road, go back, press **Change what we found**. | Roads and a road page as in S1. Your edits are still there. |
| 8 | Press **Start again**. | Back at the welcome screen. Everything is gone. Reload does the same. |
| 9 | Try `scanned/resume.pdf`. | "This PDF looks like a scan..." and the paste box opens. |
| 10 | Try `non_resume/resume.pdf`. | "This does not look like a resume..." No confirm screen. |
| 11 | Try `docx_basic/resume.docx`, then **Paste text** with `pasted_text/resume.txt`. | Both reach the confirm screen. |
| 12 | Press **No resume: type your job title**, type "accountant", pick the job. | The top 12 skills are already ticked as Used and 18 are shown. **Show all 40** shows the rest. |

## What is not real yet

- It matches words against the skills list. It does not use AI, and it misses skills a resume only hints at. "Most accurate" is slice S6.
- Certificates are listed but not used or saved: the graph has no certificates list yet (T1.8, slice S2).
- The six questions (hours, budget, city) came with slice S2 (see S2_DEMO.md). Pay and demand figures are not there yet.
- PDF text in some East Asian fonts may be missing (the character maps are not vendored). Resumes in Devanagari and Latin read fine.
- The first second after the intake screen opens, the page prepares the reader (about 0.35 s on a laptop, more on a slow phone).

## Checks behind it

```bash
node --test app/adult/tests/unit/*.test.mjs app/adult/tests/privacy/static.test.mjs app/adult/tests/intake/*.test.mjs
cd app/adult/tests && npm ci && node --test --test-concurrency=1 e2e/*.test.mjs privacy/*.e2e.mjs   # MW_E2E_DATA=real for real data; MW_SHOTS=commit for screenshots
node .github/scripts/check_vendor_hashes.mjs
```

Vendored: pdfjs-dist 6.4.299 (Apache-2.0) and mammoth 1.13.0 (BSD-2-Clause), in `hosting/public/vendor/` with hashes in `VERSIONS.md`. The `/work/*` policy adds `worker-src 'self'`; scripts, workers and connections stay same-site only.
