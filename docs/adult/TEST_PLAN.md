# Test plan: Margwise for working adults

Every slice in `BUILD_PLAN.md` ships with the tests listed for it here. A slice is not done until its tests run locally **and** in CI, and the student product's suite is still green.

## Layers

| # | Layer | What it proves | Tool | Where |
| --- | --- | --- | --- | --- |
| 1 | Data contracts | The graph and exports are complete, sourced, dated and deterministic | Python | `pipeline/validate_graph.py`, `data/graph/tests/` |
| 2 | Matcher | The arithmetic is right and stable, in both implementations | `node --test`, Python | `matcher/tests/` |
| 3 | Intake | Reading, dictionary, dates and roles work on many resume shapes | `node --test`, Playwright | `app/adult/tests/intake/` |
| 4 | Redaction and privacy | No personal detail leaves the device unless intended | `node --test`, Playwright with request capture | `app/adult/tests/privacy/` |
| 5 | API | Endpoints are correct, safe and scoped | `node --test` with a local SQLite stand-in for D1 | `hosting/tests/adult/` |
| 6 | AI read | Only valid, known ids get through, whatever the model says | `node --test` with a fake model | `hosting/tests/adult/ai_read.test.mjs` |
| 7 | End to end | Each slice's journey works at phone and desktop width | Playwright | `app/adult/tests/e2e/` |
| 8 | Accessibility and performance | Usable, fast enough on a mid-range phone | Playwright with axe-core (test-only), CPU and network throttling | `app/adult/tests/e2e/` |
| 9 | Regression | The student product is unchanged | Existing suite | `.github/workflows/build-check.yml` |
| 10 | People | It makes sense to real users | Owner-run sessions | `docs/adult/TEST_PLAN.md` section "People tests" |

## 1. Data contracts (graph)

- **Structure:** all checks in SPEC 5.3, including real O*NET collection dates on every `needs` edge.
- **Determinism:** build twice from the same raw files, and the `graph.sqlite` content hash and every export hash must be identical. Sort everything; never depend on dictionary or set order.
- **Expected counts:** `data/graph/tests/expected_counts.json` holds node and edge counts by kind. CI fails if a count moves more than 2 percent without the O*NET version changing in the same commit.
- **Known truths:** `data/graph/tests/truths.json`, 20 facts the owner agrees with, as assertions. For example:
  - software developers (`15-1252.00`) need programming;
  - accountants (`13-2011.00`) are `close_to` auditors or financial analysts;
  - every occupation in `fld:health` has a task.

  They catch silent parsing errors that structure checks miss.
- **New AI-era roles** (SPEC 5.7):
  - every catalogue role has 12 or more needs after inheritance, 1 to 3 parents that exist, parent shares summing to 1, and 2 or more sources, each with a URL, a date and a quote of at least 8 words;
  - every `entry_from` occupation exists;
  - `maturity` and `reviewed_on` are set;
  - no role ships without `reviewed_by`;
  - quote check: when the source page is cached in `data/graph/raw/emerging_sources/`, the quote must appear in it word for word.
- **Exports:**
  - every slice validates against `matcher/slice.schema.json` and stays under 60 KB;
  - every road target in a slice carries its needs;
  - every id in a slice exists in the graph;
  - `skills_index.json` has no duplicate term pointing at two ids unless the term is marked ambiguous.
- **Certifications** (SPEC 5.8): every entry has an official URL, an issuer, a validity, and at least 5 `teaches` links with quotes. A golden case where a certification closes a gap, and one with an expired certification.
- **Cities** (SPEC 5.9): the clusters are unique, each has a state, and the profile accepts only known clusters.
- **Freshness:** a test with a fixed "today" checks that weights fall with rating age (SPEC 5.6), and that the greying and hiding thresholds apply.

## 2. Matcher

- **Golden cases:** `matcher/tests/golden.json`, starting at 8 in slice 1 and growing to 15 in slice 2. Slice 2 must include at least 2 cases with roads into new AI-era roles: one adjacent (for example, a QA analyst towards LLM evaluation specialist) and one reset. Each has a hand-built profile, the expected road ids in order, the kinds, the coverage to 2 decimals and the flags. The owner reads them and agrees (BUILD_PLAN marks this ASK).
- **Properties** (500 random profiles from a fixed seed):
  - coverage is between 0 and 1;
  - adding a skill never lowers any road's coverage;
  - strong is at least used, which is at least rusty, for the same skill;
  - changing the priority sliders reorders roads but never adds or removes one;
  - constraint flags never remove a road;
  - the same input gives byte-identical output.
- **Two implementations agree:** `match.js` and `reference.py` agree to 2 decimals on every golden case and every random profile.
- **Version guard:** CI fails if `golden.json` outputs change while `MATCHER_VERSION` does not.

## 3. Intake

**Fixture corpus.** `app/adult/tests/fixtures/` holds about 14 synthetic resumes. Each is written by hand with invented people, and each comes with an `expected.json`: its roles, dates, skills that must be found, and skills that must not be found. The shapes:

- single-column PDF;
- two-column PDF;
- DOCX;
- table-based layout;
- Indian format with DOB, father's name, religion, marital status and an address block;
- LinkedIn-export style;
- dates in 5 formats ("Jan 2019 - Mar 2023", "2019-2023", "06/2019 - present", "2019 – Till date", "Since 2021");
- ambiguous terms ("R", "Go", "Spring", "Excel" as a verb);
- a 10-page resume;
- a scanned PDF (the test expects the paste fallback);
- a non-resume PDF (expects a "this doesn't look like a resume" message);
- lines in Devanagari mixed with English;
- a resume with hidden white text ("ignore previous instructions…").

**Making the fixtures without new dependencies.** PDFs are made by printing HTML with Playwright's `page.pdf()`. DOCX files are made by a small Python script that zips the minimal XML parts. The generator scripts are committed, so fixtures can be rebuilt.

**Targets per fixture:**

- every "must find" skill found;
- no "must not find" skill found;
- the roles and years right;
- the run takes under 3 seconds on a desktop for tier 1.

The 30-person real-resume evaluation (SPEC 11) is separate, run by the owner with `eval_intake.mjs`, and never committed.

## 4. Redaction and privacy

**Canary strings.** Every fixture contains unique fake values for each kind of personal detail, for example:

- email `canary.mail.7731@example.com`;
- phone `+91 98765 43210`;
- PAN `ABCDE1234F`;
- Aadhaar `2345 6789 0123`;
- the name `Ravindran Canarypally`;
- employer `Canaryworks Pvt Ltd`;
- college `Canary Institute of Technology`.

The canaries are listed in `fixtures/canaries.json`.

**Unit tests:** `redact.test.mjs` has positive and negative cases for each pattern. Over-redaction is acceptable; under-redaction fails.

**Preview test:** no canary appears in the preview text for any fixture, except where the test marks it as a known model miss with an issue number.

**Network tests** (Playwright, all requests captured):

- **"Keep everything on my device":** across the whole intake and roads journey, no request URL or body contains any canary or any 20-character run of the resume text. The only requests are GETs for static files and slices.
- **"Most accurate":** the only request carrying resume text is the one POST to `/api/ai/read`, and it contains no canary.
- **Before consent:** nothing is sent before "Send to read" is pressed.

**Storage test:** after the journey, `localStorage`, `sessionStorage` and IndexedDB hold no resume text and no canary. The model cache is allowed.

## 5. API

**D1 stand-in.** `hosting/tests/adult/fakedb.mjs` wraps Node's built-in `node:sqlite` (Node 22) with the D1 call shapes the code uses: `prepare().bind().first()`, `.run()`, `.all()` and `env.DB.batch()`. It applies `hosting/migrations/*.sql` in order (BACKEND ADR-03). If `node:sqlite` is unavailable, the tests fail with a clear message rather than skipping.

**For each endpoint:**

- the happy path;
- bad input (oversized body, wrong types);
- missing, expired or revoked tokens;
- **cross-account access:** tester A's token cannot read, export or delete tester B's data;
- the rate limits;
- the under-18 refusal storing nothing personal;
- code expiry and tries, with an injected clock;
- the known-address login;
- delete cascading to every table (the tests list tables from `sqlite_master` and check that none holds the tester id);
- purge covering `profiles` and `email_codes`;
- profile rejection for schema errors and unknown ids;
- the feedback length cap;
- the email dry run.

**Student endpoints:** `join.js` refuses adult codes, and existing student flows are unchanged. With an adult tester in the database, every existing student, admin and counsellor endpoint returns exactly what it returned before (ADR-15).

**Backend foundations** (BACKEND ADRs):

- **Migrations:** the baseline equals the old schema files applied in order; the migration guard rejects destructive SQL.
- **Key rotation:** tokens from the old key work inside the overlap window and fail after it. `tok_after` revokes them.
- **Email normalisation:** cases covering upper case, spaces, Unicode lookalikes, and `+tags` left unchanged.
- **Optimistic concurrency:** two writes from the same `rev`, where one wins and the other gets `409`.
- **The id registry:** append-only, tombstones mapped on read.
- **Profile migrations:** `v1` to `v2` with fixtures, once `v2` exists.
- **Logging:** a test captures log lines for every endpoint and fails if any contains an email, a code, a token, an IP or a request body.
- **The inventory:** every table with `tester_id` or `email_hash` is listed.
- **The invariant checker** passes after the full e2e journey, including the delete.
- **Feature switches:** each one off, with the rest still working.

## 6. AI read

The provider is injected, so the tests use a fake model that returns scripted outputs:

- valid output;
- invalid JSON;
- valid JSON with unknown ids (dropped);
- output containing an email or phone (rejected);
- a slow reply (timeout, then the fallback message);
- `AI_ENABLED=false`;
- the per-person and site daily caps;
- a reply to the hidden-instruction fixture (still schema-only).

There is also a test that nothing about the request or reply text is written to any table or log.

## 7. End to end

Each slice has one script, run at 390 × 844 and 1280 × 800:

- **Slice 1:** type a title, tick skills, see roads, open one.
- **Slice 2:** plus your job today, level labels, sliders re-ordering, constraint flags, drill.
- **Slice 3:** upload each fixture type, confirm, roads.
- **Slice 4:** sign up (email dry run), confirm, save, log out, log in on a "new device" (a new browser context), see the same roads, export, delete, then confirm that the account is gone.
- **Slice 6:** "Most accurate" with a fake provider (a local stub endpoint).

**Rules:**

- Zero console errors.
- **Screenshots** of each screen at phone width go into the slice's pull request.
- **Launch Playwright** with the preinstalled Chromium (`require('playwright')`; `chromium.launch()` with no options in this environment). In CI, install Chromium in the workflow.

## 8. Accessibility and performance

- **Accessibility:** axe-core (a test-only dependency, never shipped) reports no serious or critical violations on each screen. Every control can be reached by keyboard. Focus is visible. Text contrast follows the existing colour tokens.
- **Performance budgets**, checked with Playwright using 4× CPU throttling and a "fast 3G" network profile:
  - `/work/` first load is at most 300 KB of HTML, JS and CSS, before vendor libraries are loaded lazily;
  - a slice fetch is at most 60 KB;
  - roads are computed in at most 200 ms;
  - tier 1 intake takes at most 2 s on the 2-page fixture;
  - the embedding model loads only after the user agrees, and its size is shown first.

## 9. Regression (student product)

The existing `build-check.yml` steps run unchanged on every pull request. Adult work must not modify `data/content.json`, `data/releases/latest.json`, the engine or the student page. The CI drift check enforces this.

## 10. People tests (owner-run)

| When | Who | What | Pass |
| --- | --- | --- | --- |
| After slice 2 | 5 people from the network | Think aloud while using title, roads and detail | 4 of 5 understand coverage and road kinds unaided. Note every confusing word |
| After slice 3 | The same 5 | Their own resume, on-device mode | The confirm screen takes 4 minutes or less. Nobody is surprised by what was found |
| After slice 5 | 30 consenting people | `eval_intake.mjs` on their resumes and confirmed profiles | SPEC 11 intake and redaction targets |
| Before the pilot | Owner | The whole journey on their own phone, on mobile data | No blockers |

## Browsers and devices

- **Automated:** Chromium at phone and desktop sizes.
- **Manual, by the owner, before each slice sign-off:**
  - Chrome on a mid-range Android phone;
  - Safari on an iPhone;
  - one desktop browser other than Chrome.
- **A slice cannot be signed off** with a blocker on any of these.

## CI wiring

Add jobs to `.github/workflows/build-check.yml`, in this order:

1. `graph` (layer 1)
2. `matcher` (layer 2)
3. `api` (layers 5 and 6)
4. `intake-unit` (the unit parts of layers 3 and 4)
5. `e2e` (layers 3, 4, 7 and 8, which installs Chromium)

The existing student job stays first. All jobs run on every pull request, and a red job blocks the merge.

## Definition of done for a slice

1. The slice's tickets are implemented as written, or deviations are explained in the pull request.
2. The slice's tests exist, pass locally and pass in CI. The student suite is green.
3. The pull request includes:
   - phone-width screenshots of each new screen;
   - the test summary;
   - a short demo script the owner can follow in 5 minutes;
   - known limits.
4. The owner tries the demo and signs off before the next slice starts.
