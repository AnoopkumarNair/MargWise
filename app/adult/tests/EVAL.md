# The resume evaluation (owner guide)

This tool measures how well the resume reader works on real people's resumes. It checks the targets in SPEC section 11. You run it on your own computer, on the 30 people who agreed.

## What it protects

- It prints **only numbers**: counts, rates, medians, and pass or fail for each target. It never prints a resume line, a name, a file name or a skill list.
- It writes **no file** and makes **no network call**.
- It **refuses** to run on a folder inside this repository. Keep the real resumes elsewhere and never commit them.
- It shows numbers only from 5 people up.

## Set up (once)

```bash
python3 pipeline/run.py                          # builds the occupation list the role check needs
python3 app/adult/tools/fetch_model.py           # the tier 2 model (about 23 MB)
cd app/adult/tools/embed && npm ci && cd -       # the tool's packages
```

Without the model, tier 2 is reported as "not measured" and the rest still runs. Use `--no-tier2` to skip it on purpose.

## The folder

One folder, outside the repository. For each person, pick a name (any name; a number is fine) and put these files side by side:

| File | What it is |
| --- | --- |
| `<name>.pdf` or `.docx` or `.txt` | The resume, as the person sent it. |
| `<name>.profile.json` | The profile the person **confirmed** in the app. |
| `<name>.meta.json` | Optional. Written by hand: `{ "secondsToConfirm": 210, "roleEdits": 1 }`. |

`secondsToConfirm` is the time from choosing the file to pressing Continue on the confirm screen. `roleEdits` is how many times the person changed their current job's title or occupation on that screen. Time them while they use the app.

The tool pairs files by name. It lists people in sorted name order, and "resume #7" in its output means the seventh name in that order.

## Getting the confirmed profile out of the app

- **With an account:** the person saves their profile after confirming, then opens the account screen and presses **Download my data**. The file it gives is accepted as it is. It also holds their email and other account rows: the tool reads only the profile, but delete or cut those rows if the file will be kept.
- **Without an account (the on-device path):** the app has **no export**. The profile lives in memory only and is gone when the page closes. Two ways to get it for now: (1) have each person make an account and save, then use the download above; or (2) write the profile by hand from what the person ticked: the shape is `contracts/profile.schema.json`, and only `roles` (with `occ` and `current`) and `skills` (with `id`) are read. This is an open item (deviations D52).

## Run it

```bash
node app/adult/tests/eval_intake.mjs /path/to/the/folder
```

Options: `--now 2026` (the year "present" means), `--no-tier2`, `--json` (the same numbers as JSON).

## What the output means

- **Skills.** *Precision* is the share of suggested skills the person confirmed. *Recall* is the share of confirmed skills the app suggested, so the person did not have to type them. Shown for tier 1 (the dictionary; these skills come ticked), tier 2 (the model; only the extra skills it adds, never ticked) and both together. A skill the person typed in by hand counts against recall. The precision target is judged on tier 1. The recall target is judged on both tiers together, because tapping a tier 2 suggestion is not typing.
- **Role.** The share of people whose current job the reader got right first time, and right with one pick from its three choices. If you give `roleEdits` for 5 or more people, the target uses those recorded edits.
- **Time.** The median of `secondsToConfirm`. It also prints how long the reader took per resume on this computer (a phone is slower).
- **Redaction.** **Not measured yet.** The redactor belongs to slice S6 and does not exist. Until then the tool only counts resumes that **contain** an email, a phone-like number or an ID-like number. That is a baseline, not a leak count. When `app/adult/intake/redact.js` exists and exports `redact(text)`, the tool will run it and list each miss as a category, a count and a position ("resume #7: 1 email"), never the value.

## Limits

- PDF and DOCX files are read in Node with the same libraries and rules as the browser reader (the same vendored pdf.js and mammoth, the same 5 MB, 10 page and scan checks). It is not the browser itself. A test checks the copied rules against `app/adult/intake_file.js`.
- A scanned PDF cannot be read, as in the app. It is counted by reason ("scanned 2") and left out of the other numbers.
- Tier 2 numbers depend on the threshold (0.40) that was tuned on 8 synthetic resumes. This run is the first real measure.
