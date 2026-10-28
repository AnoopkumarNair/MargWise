# Build plan: Margwise for working adults (v1)

Read `docs/adult/SPEC.md` first. It is the source of truth. **Build in the vertical slices below, not in M-order.** Each slice is a thin end-to-end piece the owner can try. The M sections further down hold the detail of each ticket. Tests for every slice are in `docs/adult/TEST_PLAN.md`, and a slice is done only when its Definition of Done there is met.

## Ground rules for the implementing session

- **Branch.** Work on the branch you were given. Commit after each ticket with a clear message. Never push to `main`. Never deploy (`wrangler pages deploy`) and never apply SQL to the live D1 database: the owner does both.
- **Match the existing code.** Python scripts in `data/` and `pipeline/` are small, plain and dependency-light. Pages Functions follow `hosting/functions/api/*.js`: parameterised SQL, `json()` and `readJson()` from `_util.js`, fail closed. No new frameworks, no bundler, no TypeScript, no ORM.
- **Third-party browser code is vendored** into `hosting/public/vendor/` (as `gsap.min.js` is today), with exact versions noted in `hosting/public/vendor/VERSIONS.md`. The pages use a strict CSP, so do not load scripts from CDNs.
- **Keep the student product green.** After every ticket, run:
  ```bash
  python3 pipeline/run.py && git diff --exit-code -- data/content.json data/releases/latest.json hosting/functions/api/_claims.json
  node --test engine/tests/engine.test.mjs engine/tests/design.test.mjs
  python3 engine/reference.py
  node hosting/tests/util.test.mjs
  ```
- **Stop and ask the owner** when a ticket says **ASK**, when a licence or terms question comes up, or when a test target in SPEC section 11 cannot be met.
- **Network.** Some tickets download public data. If a host is blocked, report the host name and continue with tickets that do not need it. Do not invent or mock data in place of real files.


## Delivery slices (follow this order)

Slices 1 to 3 store nothing on a server and need no sign-in, so the owner can show them to people from their network straight away, with no legal blockers. Slice 4 adds accounts.

| Slice | The owner can try | Tickets (detail below) | Tests (TEST_PLAN) |
| --- | --- | --- | --- |
| **S1. Title to roads** | Open `/work/`, type a job title, tick skills, see adjacent, stretch and leap roads with coverage and gaps, open one | T0.2; T1.1; T1.2 (SOC to ISCO only); T1.3 without PLFS; T1.4; T1.5 without embeddings; T1.6; T2.1; T2.2 with coverage, gap and kinds only (levels and bridges stubbed); T2.3; T2.4 with 8 cases; T4.1 without sign-in; T4.7; T5.2 basic; plus `matcher/slice.schema.json` | Layer 1 all, layer 2 (8 golden cases and properties), layer 7 S1 script, layer 8 budgets for the first load and slices, layer 9 |
| **S2. Deeper and honest labels** | "Your job today" (skills with AI labels, tasks by AI use, pay band, data age), level labels (up, across, diagonal, reset, fork), constraints and priority sliders, road detail, drill | T1.3 PLFS and freshness (SPEC 5.5, 5.6); T2.2 levels (SPEC 7.2) and order (7.3); T2.4 grown to 15 cases (**ASK**: the owner reads them); T4.6 constraints part; T5.1; T5.3 (bridges show "no reviewed course yet" unless credentials are curated) | Layers 1 and 2 extended, layer 7 S2, layer 8 a11y; **people test after S2** |
| **S3. Resume on the device** | Upload a PDF or DOCX, or paste text; see found roles and skills with source lines; confirm; roads. Nothing leaves the device; the profile lives in memory only | T4.3; T4.4; T4.6 confirm screen; the fixture generator scripts and fixtures | Layer 3 all fixtures, layer 4 (on-device network and storage tests, canaries), layer 7 S3, layer 8 intake budget; **people test after S3** |
| **S4. Accounts and saving** | Sign up with email (birth year first), save the profile, log in on another device, export, delete | T3.1 to T3.5; T4.2 (**ASK**: notice wording); T5.4; the adult panel of T7.2 | Layers 5 and 7 S4; `fakedb.mjs` |
| **S5. Better reading on the device** | Tier 2 suggestions for implied skills; the owner runs the 30-resume evaluation | T4.5; T7.3 | Layer 3 extended (tier 2 fixtures), layer 8 model-size and consent check; the 30-person evaluation |
| **S6. "Most accurate"** | Redacted preview, then large-model reading, with fallbacks | T6.1 to T6.5 (**ASK**: R2 or Hugging Face for model files; the provider and spend cap) | Layers 4 (canaries in the preview and in the AI request), 6, 7 S6 |
| **S7. Pilot readiness** | The full journey; the readiness review | T7.1; T7.4; T5.5 as the full journey | All layers; the SPEC 11 results table |

Rules for slicing:

- **Releases.** Only the owner runs `--accept`. During a slice, build the adult app with `python3 app/adult/build.py --dev` (working files, marked `dev-unaccepted` in the footer, never deployed), as `app/build.py --dev` does for the student game. Before the slice's pull request is merged, the owner reviews the graph change report, runs `--accept`, and the session rebuilds without `--dev` so the CI drift check passes.
- **Finish a slice completely** (Definition of Done in TEST_PLAN) before starting the next. Do not leave a slice half-tested to "come back later".
- **Stub the edges, not the core.** A slice may show "not yet measured" or "no reviewed course yet", but whatever it does show must be real data and the real matcher.
- **One pull request per slice,** with screenshots, the test summary and a 5-minute demo script for the owner.
- **The owner signs off each slice.** Feedback from the people tests goes into the next slice's tickets, or into a short "changes" note at the top of that slice.

## M0. Housekeeping (small)

**T0.1 Superseded banners (done on 28 Oct 2026).** Add one line under the title of `docs/ADULT_TRACK.md`, `ADULT_WORKFLOWS.md`, `CAREER_GRAPH.md`, `SKILLS_INTAKE.md`, `MATCHING.md`, `AI_LAYER.md` and `ADD_ONS.md`:

> Superseded where it differs by `docs/adult/SPEC.md`.

- **Done when:** the banner is in all seven files.

**T0.2 Ignore build outputs.** Add `data/graph/graph.sqlite` and `data/graph/raw/onet/*/zip` to `.gitignore`.

## M1. Career graph v0: Pipeline A from open data (SPEC section 5)

**T1.1 Fetch and pin O*NET.** `data/graph/fetch_onet.py` downloads the O*NET database text zip for a pinned version (a constant at the top; use the current version listed on onetcenter.org/database.html). It extracts only the files in SPEC 5.1 into `data/graph/raw/onet/<version>/` and writes `SOURCE.md` with the URL, version, date and licence.

- **Size check.** If the extracted files exceed 40 MB in total, commit filtered copies holding only the needed columns (keep the O*NET column names), and say so in `SOURCE.md`.
- **Register the source.** Add an `onet_database` entry to `data/sources.yaml` (`trust: official`, `cadence: yearly`, `stage: graph/fetch_onet.py`).
- **Done when:** the files are present and `SOURCE.md` and the sources entry exist.

**T1.2 Crosswalks.**

- **SOC to ISCO-08.** Current O*NET-SOC codes are based on SOC 2018, but the BLS ISCO-08 crosswalk (bls.gov/soc/soccrosswalks.htm) maps from SOC 2010. Chain two official BLS files: the SOC 2018 to SOC 2010 crosswalk, then the SOC 2010 to ISCO-08 crosswalk. Keep the many-to-many links, and record in `SOURCE.md` that the mapping is chained and approximate. Put the files in `data/graph/raw/crosswalk/`.
- **NCO-2015 to ISCO-08.** **ASK** the owner for an official source if none is found on a government site. Until then, ship only SOC to ISCO.
- **Register both** in `sources.yaml`.
- **Done when:** the files and `SOURCE.md` exist.

**T1.3 `data/graph/build_graph.py`.** Raw files go into `graph.sqlite` with the exact tables in SPEC 5.2.

- **Occupations:** all O*NET-SOC occupations with data, with `attrs` holding the job zone, SOC, ISCO (where mapped) and description.
- **Skills:** `needs` edges from Skills, Knowledge and Work Activities, with the weight formula in SPEC 5.2.
- **Technology:** Technology Skills become `tec:` nodes and `needs` edges (weight 0.6, or 0.8 when the O*NET `Hot Technology` flag is set).
- **Tasks:** `has_task` edges. Attach AI use from `data/ai/task_pen.csv` and `data/ai/tasks.json` as `signal(kind='ai_task_mode')`.
- **Titles:** Alternate Titles become `ttl:` nodes and `is_title_of` edges. Titles are normalised: lower case, punctuation stripped, whitespace collapsed.
- **`close_to`:** from Related Occupations.
- **`skill_near`:** computed. Cosine over occupation vectors, keep the top 10 per skill with similarity of 0.5 or more.
- **Clusters:** `in_cluster` edges from `data/content.json` careers to `fld:` nodes.
- **Pay:** the PLFS band, as `signal(kind='pay_band_in')` through ISCO. If NCO is missing, attach it only to the 83 careers that already carry PLFS groups.
- **Done when:** the script runs offline from the raw files in under 2 minutes, and its outputs are deterministic (two runs give identical counts and hashes).

**T1.4 Graph checks.** `pipeline/validate_graph.py`: every check in SPEC 5.3, printing counts by node and edge kind.

**T1.5 Exports.** `data/graph/export.py` writes `slices/<soc>.json`, `skills_index.json` and `titles.json` as in SPEC 5.4.

- **Indian abbreviations.** Add a starter list at `data/graph/raw/abbrev_in.csv` (columns: `term,maps_to_id,note`) with about 40 common ones (SAP FICO, MIS, BFSI, KYC, GST, TDS and so on), each mapped to an existing skill or technology id. Mark the file as needing the owner's review.
- **Skill AI labels** come from SPEC 5.5.
- **Done when:** the size limits in SPEC 5.3 pass.

**T1.6 Wire into the pipeline and release.**

- **`pipeline/run.py`:** add stages `9 build graph`, `10 graph checks` and `11 export graph`, and add `--fetch` support for T1.1.
- **`--accept`:** also copies `slices/`, `skills_index.json` and `titles.json` to `data/releases/graph/`, with their hashes in `manifest.json` under `graph`.
- **`build-check.yml`:** extend the drift check to `data/releases/graph/`.
- **Done when:** a full run passes and CI on the branch passes.

## M2. Matcher (SPEC sections 6 and 7)

**T2.1 Contracts.** `matcher/bands.json` (every band list) and `matcher/profile.schema.json` (JSON Schema for SPEC 6).

**T2.2 `matcher/match.js`.** A plain ES module with no dependencies, usable both in the browser and in Node. It exports:

- `match(profile, slice, opts) -> {roads:[...], version}`
- `level(profile)`
- `coverage(profile, needs)`

It implements SPEC 7.1 to 7.4 exactly, with `MATCHER_VERSION = '1.0.0'`.

**T2.3 `matcher/reference.py`.** An independent Python implementation of the same rules.

**T2.4 Golden tests.** `matcher/tests/golden.json` holds 15 hand-built profiles across at least 5 occupation families, including:

- a reset case;
- a fork case;
- a profile with rusty skills;
- a profile where every road falls below the pay floor.

`matcher/tests/match.test.mjs` checks the outputs, and checks that `reference.py` agrees to 2 decimals. Add both to `build-check.yml`, with a check that fails if `golden.json` changes while `MATCHER_VERSION` does not.

- **Done when:** the tests pass, and the owner has read the 15 cases' roads. **ASK:** show them in a short table in the pull request description.

## M3. Backend (SPEC sections 9 and 10)

**T3.1 `hosting/schema13.sql`.** Exactly as SPEC 10. Update `docs/ARCHITECTURE.md`'s list of migrations.

**T3.2 Invite track.**

- **`admin.js`:** creating an invite accepts `track` (`student` or `adult`), and the invite list shows it.
- **`join.js`:** refuses adult codes, with "Use the link for working adults: /work/".

**T3.3 Email sign-in.** `hosting/functions/api/email/start.js`, `verify.js` and `complete.js`, as in SPEC 9.

- **Codes:** 6 digits from `crypto.getRandomValues`, stored as an HMAC. 15-minute expiry. 5 tries.
- **Links:** carry a separate random token, also stored as an HMAC.
- **Server-side age check:** `currentYear - birthYear < 18` refuses, increments `under18` for the invite, and stores nothing else.
- **Sending:** a small `email/_send.js` wrapper around Cloudflare Email Service, using `EMAIL_FROM`. In tests and local dev, `EMAIL_DRY_RUN=1` writes the message to the response log instead.
- **Done when:** the unit tests in `hosting/tests/email.test.mjs` cover the age refusal, rate limits, wrong code, expiry, a known address logging in, and a new address completing.

**T3.4 Profile and account endpoints.**

- `me/profile.js` (GET and POST): validate against the schema, check every id against the id list published with the current graph release (`hosting/functions/api/_graph_ids.json`, generated at T1.6).
- `me/export.js`, `me/delete.js` and `me/logout-all.js`.
- Extend `purgeOld` and the admin delete to cover `profiles` and `email_codes`.
- **Done when:** tests cover a schema rejection, an unknown id rejection, a full delete (no rows left in any table for that tester) and the audit row.

**T3.5 Events.** In `event.js`, add validators for the adult event types in SPEC 9 (ids and numbers only, no free text except `feedback.text`, which is capped at 1,500 characters as today).

## M4. Adult app shell and intake without AI

**T4.1 App skeleton.** `app/adult/` holds:

- `index.html`;
- `styles.css`, reusing the colour tokens and fonts from `app/night-of-lamps.html`;
- `app.js`, a small hash router with one module per screen.

`app/adult/build.py` copies the app to `hosting/public/work/`, copies the release's graph files to `hosting/public/work/graph/`, and stamps the release id. `--dev` uses the working files in `data/graph/` and stamps `dev-unaccepted`. Add a strict CSP for `/work/*` to `hosting/public/_headers`.

- **Done when:** `/work/` serves locally (`npx wrangler pages dev hosting/public`), the release id shows in the footer, and the page works at phone width.

**T4.2 Sign-up and log-in screens** (SPEC 8 screens 1 to 3). The birth-year refusal happens in the page and on the server. The adult notice text goes in `app/adult/notice.md`. **ASK** the owner to approve the wording.

**T4.3 File reading.** Vendor `pdfjs-dist` and `mammoth` (browser build). `intake.js` extracts text from PDF and DOCX up to 5 MB and 10 pages, detects scanned PDFs (almost no text) and shows the paste fallback. It never uploads the file.

**T4.4 Tier 1, dictionary match.** `match_dict.js` loads `skills_index.json` and `titles.json`, and runs a case-insensitive whole-word multi-pattern search (Aho-Corasick, written by hand; it is short). Ambiguous short terms (R, Go, C, Spring, Excel, Access) need a nearby context word from a small list.

It also splits roles: title-and-date blocks, using date patterns for "Jan 2019 - Mar 2023", "2019-2023", "2019 – Present" and "06/2019". Each skill gets the end year of the role block it falls in.

**T4.5 Tier 2, embeddings in the browser.** Vendor `@huggingface/transformers` (pinned version) and the quantised `all-MiniLM-L6-v2` model files under `hosting/public/work/models/`. Check the file sizes: Cloudflare Pages limits each file to 25 MiB. Skill descriptions are embedded at export time in T1.5: add `skill_vecs.bin` (int8) and `skill_vecs.json` (ids) to the export. Achievement sentences are compared with them, and matches above a threshold (start at 0.55, tune on test data) are suggested. Show the download size before loading.

- **Done when:** a test page `app/adult/dev/tiers.html` shows tier 1 and tier 2 results side by side for a pasted text.

**T4.6 Confirm screen and constraints** (SPEC 8 screens 6 and 7).

- Roles, skills, credentials and leadership, each showing its source line.
- The "People in your role usually have" chips: the occupation's top 12 needs not yet present.
- Saving posts to `/api/me/profile`.

**T4.7 No-resume route.** Type a job title, get the `titles.json` lookup with a search fallback over occupation labels, then tick from that occupation's top 25 needs.

## M5. Results

**T5.1 Your job today** (screen 8), from the current occupation's slice.

- Skills with their AI labels.
- Tasks split by AI use.
- The pay band.
- "Not yet measured" for demand.
- Greying and hiding by freshness.

**T5.2 Roads** (screen 9). `match.js` runs on the current slice. The cards show:

- kind and coverage;
- the top 3 gaps;
- pay, demand and AI;
- flags;
- priority sliders, which re-sort live;
- "Show leaps".

Log `roads_viewed` (ids only).

**T5.3 Road detail and drill** (screens 10 and 11).

- **Road detail:** the full gap with reasons, bridges or "no reviewed course yet", level and experience fit, the components, and "Add this road", which logs `road_added`.
- **Drill:** a skill shows the roles in the loaded slices that need it. A role opens its own slice.

**T5.4 Account** (screen 12): wired to the M3 endpoints.

**T5.5 End-to-end test.** `app/adult/tests/e2e.mjs` uses Playwright with the preinstalled Chromium against `wrangler pages dev` with `EMAIL_DRY_RUN=1`:

sign up, paste a sample resume (in `app/adult/tests/fixtures/`, written for the test and containing no real person), confirm, see roads, open a road, export, delete.

## M6. AI read path ("Most accurate")

**T6.1 Rules redaction.** `redact.js`:

- the patterns in SKILLS_INTAKE "Step 1" (Indian phone formats, PAN `[A-Z]{5}[0-9]{4}[A-Z]`, Aadhaar 12 digits in groups of 4, passport `[A-Z][0-9]{7}`, PIN `\b[1-9][0-9]{5}\b` near address words, emails, URLs, dates of birth near DOB words);
- labelled lines;
- the top 3 lines.

Unit tests use synthetic examples.

**T6.2 Name and place model.**

- **The 25 MiB limit.** Most BERT-class NER models are over 25 MiB, too big for a single Cloudflare Pages file. **ASK** the owner to choose between serving model files from an R2 bucket on a subdomain and loading a pinned revision from huggingface.co. Either way, the page fetches only model files; no user text goes there.
- **Candidates to compare.** Evaluate 2 or 3, for example `Xenova/bert-base-NER`, a distilled NER model, and a PII-specific model, together with public lists of Indian first names and surnames (record their source and licence in `SOURCE.md`).
- **Choose by measurement.** Pick the smallest model that meets the redaction rule on the test set (T7.3).

**T6.3 Placeholders and preview.** Consistent placeholders (`[NAME]`, `[EMPLOYER_n]`, `[COLLEGE_n]`, `[CITY_n]`), with the map held in memory only. The preview highlights placeholders, any word can be tapped to hide it, and nothing is sent until "Send to read".

**T6.4 `/api/ai/read`.**

- **Provider settings:** live in `data/ai_config.json` (provider, model, endpoint, timeout). The key is the `AI_API_KEY` secret. The default provider is Gemini on the paid tier. **ASK** the owner to confirm it and to set the spend cap.
- **The prompt:** asks for JSON matching `matcher/extract.schema.json`, made of roles (title text, placeholder employer, start, end), skills (graph id plus source line) and credentials.
- **Checks:** the server checks the schema, drops unknown ids, rejects any output containing an email address or a phone pattern, applies the limits in SPEC 9, and logs nothing but model, tokens, time and success.
- **Back in the browser:** placeholders are restored for the confirm screen only.

**T6.5 Mode choice and fallbacks.** "Most accurate" or "Keep everything on my device" at the intake choice. If the model fails to download, the phone is low-memory, `AI_ENABLED=false` or the call times out, the page falls back to the tier 1 and tier 2 results and says so.

## M7. Pilot readiness

**T7.1 Notice, terms and runbook.**

- The final adult notice and terms text, with the owner's approval.
- A breach runbook section in `docs/PILOT_RUNBOOK.md`.
- `RETENTION_DAYS` documented as required for adults.

**T7.2 Admin views.** In the admin page, an adult panel showing:

- sign-ups by invite;
- under-18 refusals by invite;
- intake mode split;
- the funnel to Roads, with median times;
- feedback.

All counts are aggregates, shown from 5 people up.

**T7.3 Evaluation harness.** `app/adult/tests/eval_intake.mjs` reads a folder outside the repository (path given as an argument, never committed) of resume files plus each person's confirmed profile JSON. It reports:

- precision and recall per tier;
- role match;
- redaction misses, listed;
- time measures.

It writes only aggregate numbers to the console.

- **Done when:** it runs on synthetic fixtures. The owner runs it on the 30 real resumes.

**T7.4 Readiness review.** A pull request listing:

- each SPEC section 11 rule, with its result;
- each SPEC section 12 legal item, marked done or open;
- known limits.

The owner decides on the pilot.

## Order of value

Follow the slices. S1 to S3 need no owner decision except reading the golden cases. S4 needs the notice wording. S6 needs the R2-or-Hugging-Face decision and the provider confirmation. S7 needs the owner and real people.
