# Margwise for working adults: specification (v1)

Status: authoritative as of 28 Oct 2026. **Where this file disagrees with older documents, this file wins.** The older design documents (`docs/ADULT_TRACK.md`, `ADULT_WORKFLOWS.md`, `CAREER_GRAPH.md`, `SKILLS_INTAKE.md`, `MATCHING.md`, `AI_LAYER.md`, `ADD_ONS.md`) explain the reasoning and are kept as history.

The build steps are in `docs/adult/BUILD_PLAN.md`.

## 1. What we are building

A web app for **working adults in India (18+)**.

1. **Where you stand.** The person gives their experience by uploading a resume, pasting text, or typing a job title. The app turns it into a confirmed list of roles, skills and credentials.
2. **Deeper.** The app shows their current job: its skills (rising, steady or falling), what AI already does in it, and where pay is going.
3. **Wider.** The app shows **roads**: other roles they could move to, labelled up, across, diagonal, reset or fork. For each road it shows:
   - coverage: how much of the role they already meet;
   - the skill gap, in order;
   - the credentials that bridge it;
   - pay change, demand trend and AI exposure.
4. **Their priorities set the order.**

The core is a **career graph** of occupations, skills, tasks, credentials and titles, built by two pipelines:

- **Pipeline A, the map:** structure, monthly.
- **Pipeline B, the weather:** signals, weekly.

The student game stays as it is. It will later read the same graph at a shallower depth, but that is not part of v1.

## 2. Principles (do not break these)

1. **Facts come from data with a source.** Every node, edge and signal carries `source`, `trust` (`official`, `secondary`, `estimate`, `observed`) and `as_of`. No model ever shows a user a fact of its own.
2. **The matcher is arithmetic, versioned and tested.** No machine learning in v1. Every result records `job_release` and `matcher_version`.
3. **Clicks never change rankings.** Learning from use only proposes graph changes, which a human approves.
4. **Privacy.**
   - Resumes are processed in the browser.
   - Personal details are replaced on the device before any text is sent.
   - Only confirmed ids and bands are stored.
   - Nothing personal goes to a free AI tier.
5. **Independence.** No commission or referral income from courses, colleges, platforms or employers. No commercial field ever enters the matcher.
6. **Not a hiring tool.** Results are for the person. There are no employer accounts and no rating of people for employers.
7. **Honest labels.** Trends are measured, not predicted. No "ATS score" without its definition. Pseudonymised text is never called anonymous.
8. **Boring technology.** Python pipeline, SQLite for the graph, JSON slices, Cloudflare Pages Functions and D1. Same patterns as the existing code.

## 3. Decisions

### Taken

| Topic | Decision |
| --- | --- |
| First audience | Working professionals from the founder's network, invited by labelled codes |
| Sign-in | Verified email, by a 6-digit code or a link. Birth year is asked first and under-18s are refused before the email is asked. Only an age band is stored |
| Entry point | Experience intake (resume, paste or job title), not the interest walk |
| Interest walk | Optional "would you enjoy it?" lens, added later (not v1) |
| Resume reading | Default "Most accurate": rules and a small browser model replace personal details with placeholders, the person previews the text, then a paid-tier large model returns graph ids. Option "Keep everything on my device": dictionary plus browser embeddings. The default is confirmed by the 30-resume test (section 11) |
| Job portals | No scraping of LinkedIn, Indeed or Naukri pages. Use employers' public ATS feeds, the Adzuna API (once its terms are agreed), public reports with quotes, and the network pulse. A user's own LinkedIn PDF upload is fine |
| AI in the job model | Task-level AI use and automation versus augmentation, and skill labels ("AI already does much of this" or "people still do this"). Emerging skills from postings, approved by a human |
| Scores | "Readability, out of 6" and "Role match, %", each shown with its definition. Not in v1 |
| Add-ons | Side roads and paid mentor calls. Not in v1 |

### Open (the owner decides; the v1 defaults allow work to start)

| # | Question | Default until answered |
| --- | --- | --- |
| D1 | Which 2 or 3 industries to go deep on first | All industries at O*NET depth. No Indian ladders or abbreviation lists beyond a starter set |
| D2 | The company list for ATS feeds | Empty. Pipeline B demand shows "not yet measured" |
| D3 | Adzuna commercial terms | Not used |
| D4 | Pilot price | Free for invited testers |
| D5 | Look: the lamp map or a plain adult style | Plain adult style using the existing colour tokens and fonts. The lamp map comes later |
| D6 | DPDP lawyer review | Required before any link goes beyond invited testers |

## 4. Architecture

```
data/graph/                   Pipeline A + B outputs (committed, reviewed, accepted like content.json)
  raw/onet/<version>/          O*NET database text files (pinned version)
  raw/crosswalk/               SOC<->ISCO-08 crosswalk, NCO-2015 <-> ISCO-08
  build_graph.py               Pipeline A v0: raw -> graph.sqlite
  signals.py                   Pipeline B v0: AI + PLFS signals -> signals tables
  export.py                    graph.sqlite -> slices/*.json, skills_index.json, titles.json
  graph.sqlite                 build output (git-ignored); release copies go to data/releases/graph/
  slices/<soc>.json            one per occupation: its skills, tasks, roads, level info, signals
  skills_index.json            dictionary for the browser matcher
  titles.json                  job-title dictionary
pipeline/run.py                gains stages 9-11 (graph build, signals, export) and a graph check in validate
app/adult/                     the adult app source (separate from the student game)
  index.html, app.js, intake.js, redact.js, match.js, styles.css
  build.py                     copies + stamps release ids -> hosting/public/work/
hosting/public/work/           built adult app, served at /work/
hosting/functions/api/         shared Pages Functions; new: email/, me/profile, me/export, me/delete, ai/read
hosting/schema13.sql           adult columns and tables
engine/                        unchanged
matcher/                       match.js (shared by browser and tests), reference.py, tests/golden.json
```

- **The adult app is a separate page** at `/work/`. It does not grow `app/night-of-lamps.html`.
- **The graph slices are static files,** so the app needs no server to compute roads. The matcher runs in the browser on the person's profile and the slices.

## 5. Career graph

### 5.1 Pipeline A v0 inputs (open data only)

| Input | File | Use |
| --- | --- | --- |
| O*NET database, text format, pinned version (from onetcenter.org/database.html, CC BY 4.0) | `Occupation Data.txt`, `Skills.txt`, `Knowledge.txt`, `Work Activities.txt`, `Task Statements.txt`, `Technology Skills.txt`, `Alternate Titles.txt`, `Related Occupations.txt`, `Job Zones.txt`, `Interests.txt` | Occupations, skills (importance `IM` and level `LV`), tasks, tools, titles, related occupations, job zones |
| SOC 2018 to SOC 2010, then SOC 2010 to ISCO-08 (BLS crosswalks, chained, many-to-many) | csv | India link |
| NCO-2015 to ISCO-08 | csv | India link (PLFS uses NCO) |
| Existing repository data | `data/ai/*.csv`, `data/plfs_2025.json`, `data/content.json` | AI exposure and tasks, India pay groups, the 16 fields |

Attribution text for O*NET is already in README.md and must also appear in the adult app's footer.

### 5.2 Tables (`graph.sqlite`)

```sql
CREATE TABLE node (id TEXT PRIMARY KEY, kind TEXT NOT NULL,       -- occupation | skill | task | title | credential | cluster
  label TEXT NOT NULL, alt TEXT, attrs TEXT,                       -- attrs: JSON (job_zone, soc, isco, nco, description, ...)
  source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL);
CREATE TABLE edge (src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL,
  -- needs | has_task | close_to | co_occurs | teaches | in_cluster | is_title_of | skill_near | moved | moved_via
  weight REAL, attrs TEXT, source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL,
  PRIMARY KEY (src, dst, kind));
CREATE TABLE signal (node TEXT NOT NULL, kind TEXT NOT NULL,      -- ai_obs | ai_tier | ai_task_mode | pay_band_in | demand_trend | skill_trend | entry_share
  period TEXT NOT NULL, value TEXT NOT NULL, source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL,
  PRIMARY KEY (node, kind, period));
```

**Node ids:**

| Kind | Format | Example |
| --- | --- | --- |
| Occupation | `occ:<onet-soc>` | `occ:15-2051.00` |
| Skill, knowledge or work activity | `skl:<onet element id>` | `skl:2.A.1.a` |
| Technology | `tec:<commodity code or normalised name>` | |
| Task | `tsk:<task id>` | |
| Title | `ttl:<normalised>` | |
| Cluster | `fld:<field id>` | `fld:health` |

**Edge weights:**

- `needs`: `(IM-1)/4 * (LV/7)`, clipped to the range 0 to 1, kept only where `IM >= 2.5`.
- `skill_near`: cosine similarity of the occupations that need both skills, kept if 0.5 or more (computed).
- `close_to`: O*NET related occupations (`weight` 1 for primary-short and 0.7 for the rest), plus the skill-vector cosine.

### 5.3 Checks (added to `pipeline/validate.py`, failure blocks the build)

- Every edge endpoint exists.
- Every occupation has 10 or more `needs` edges.
- No node or edge has an empty `source`, `trust` or `as_of`, and `trust` is in the allowed set.
- Every one of the 83 existing careers' SOC codes is present as an occupation.
- Slice files are under 60 KB each; `skills_index.json` is under 1.5 MB gzipped.

### 5.4 Exports

- **`slices/<soc>.json`:**
  - the occupation;
  - its top 40 `needs`, with labels and weights;
  - its tasks, with AI use;
  - its job zone and level ladder (if known);
  - its signals;
  - its top 30 candidate road targets, from `close_to`, two-step paths with coverage of 0.4 or more, and same-cluster occupations.

  For each target, the slice also holds the target's top 40 `needs` (repeated, so a slice is self-contained).
- **`skills_index.json`:** `[{id, label, alt:[...], kind}]` for skills and technology, plus the starter list of Indian abbreviations (`data/graph/raw/abbrev_in.csv`).
- **`titles.json`:** `{normalised title: [occ ids]}` from O*NET alternate titles and approved user titles.

### 5.5 Pipeline B v0 (signals available now)

| Signal | How it is computed |
| --- | --- |
| `ai_obs`, `ai_tier` | From the existing AI layer, per occupation |
| `ai_task_mode` | Per task: automation, augmentation or none, from the Anthropic Economic Index task data where the split exists. `none` means no use was observed |
| Skill AI labels | Computed at export: a skill whose weighted share of tasks with AI use is 0.5 or more is "AI already does much of this"; 0.15 or less is "people still do this"; anything between is "mixed" |
| `pay_band_in` | PLFS broad group, mapped through NCO to ISCO to SOC |
| `demand_trend`, `skill_trend`, `entry_share` | Tables exist but are empty until D2 or D3 is answered. The UI shows "not yet measured" |

Every signal has `as_of`.

- **Greyed** when its age is more than twice its cadence (`data/sources.yaml`).
- **Hidden** when its age is more than three times its cadence.

## 6. User model

Stored in D1 as JSON, holding ids and bands only:

```json
{
  "v": 1,
  "roles": [{"occ": "occ:13-2011.00", "level": 3, "industry": "bfsi", "years": "3-7", "current": true}],
  "skills": [{"id": "skl:2.A.2.a", "strength": "strong", "last": 2026}],
  "creds": [{"id": "cred:...", "year": 2019}],
  "lead": {"people": "1-5", "budget": false, "expert": true},
  "constraints": {"hours_month": "5-10", "course_budget": "10k-50k", "relocate": "india", "pay_floor_pct": -10, "mode": "hybrid"},
  "priorities": {"pay": 1, "ai_safe": 1, "short_move": 1, "demand": 1, "enjoy": 0},
  "job_release": "abc123", "matcher_version": "1.0.0"
}
```

| Field | Values |
| --- | --- |
| `strength` | `used`, `strong`, `rusty` |
| `level` | 1 to 6 (section 7.2) |
| Bands | Fixed strings from the lists in `matcher/bands.json` |

## 7. Matcher v1 (`matcher/match.js`, mirrored by `matcher/reference.py`)

### 7.1 Coverage and gap

For person P and target T, with need weights `w_s` from T's slice:

```
have(s) = 1.0 if strong, 0.7 if used, 0.4 if rusty (or last-used more than 3 years ago and not strong)
near(s) = max over P's skills k with skill_near(k, s) >= 0.5 of 0.5 * sim(k, s) * have(k)
cover(s) = max(have(s), near(s))
coverage = sum(w_s * cover(s)) / sum(w_s)          over T's top 40 needs
gap = needs with cover(s) < 0.7, ordered by w_s * (1 + 0.5 if skill label is "people still do this") desc
```

### 7.2 Levels

- **Person's level, from 1 to 6:**
  - start from total years (`<2:1, 2-5:2, 5-8:3, 8-12:4, 12-18:5, 18+:6`);
  - add 1 if they lead 6 or more people or own a budget, capped at 6;
  - the current title's seniority word overrides when present (`associate:1-2, senior:3, lead:4, manager:4, senior manager:5, head|director|vp:6`).
- **Target's typical level:** from the job zone (`zone 1-2: 1-2, 3: 2-3, 4: 3-4, 5: 4-5`) until posting ladders exist.
- **Road kind:**

| Kind | Rule |
| --- | --- |
| Up | Same O*NET minor group (first 4 digits) and target level above the person's |
| Across | Different minor group, same level, plus or minus 0 |
| Diagonal | Different minor group, one level up |
| Reset | Target's typical entry level is below the person's by 2 or more, and coverage is under 0.5 |
| Fork | Same minor group, and the target is a management occupation (SOC 11-) or a known specialist step from the ladder table |

- **Experience fit:** `below`, `in` or `above` the target level's year band.

### 7.3 Order

```
components (each normalised to 0..1 across the candidate set):
  pay       = PLFS band change (0.5 if unknown)
  ai_safe   = 1 - target ai_obs
  short     = coverage
  demand    = demand_trend (0.5 if not measured; shown as "not yet measured")
  enjoy     = interest fit (0 weight unless the walk was taken)
score = sum(priority_i * component_i) / sum(priority_i)
```

Kinds: **adjacent** (coverage 0.7 or more), **stretch** (0.4 to 0.7), **leap** (under 0.4, hidden behind "show leaps"). Constraint flags (`outside_time`, `below_pay_floor`, `needs_relocation`) are shown and never hide a road. Every road displays its components.

### 7.4 Bridges (v1 minimal)

Credential nodes only exist where `teaches` edges are curated (`data/graph/raw/credentials.csv`, each with an official URL and a quote). The bridge is a greedy cover of the gap weight, up to 3 credentials. If none exist, show "No reviewed course yet for these skills" and the skills themselves.

### 7.5 Tests

- `matcher/tests/golden.json` holds 15 hand-built people with expected roads, kinds and coverage to 2 decimals.
- `node --test matcher/tests/*.test.mjs` and `python3 matcher/reference.py` must agree.
- **CI rule:** if any golden output changes, `matcher_version` must change in the same commit.

## 8. Screens (adult app at `/work/`)

1. **Welcome.** What you get, about 8 minutes, and privacy in one line. Then "Start" or "I have been here before".
2. **Sign-up.**
   1. Birth year: under 18 is refused, with nothing sent.
   2. Invite code: from `?c=`.
   3. Email, then the 6-digit code or link.
   4. A nickname.
   5. The notice, with the required tick.
   6. The optional research tick.
3. **Log-in.** Email, then the code.
4. **Intake choice.** Upload a resume (recommended) or paste text, with the mode choice "Most accurate" or "Keep everything on my device". Or "No resume: type your job title".
5. **Preview** ("Most accurate" only). The redacted text with placeholders highlighted. Tap any word to hide it. "Send to read" or "Use on-device only instead".
6. **Confirm.**
   - Roles: title, occupation, industry and years, all editable.
   - Skills grouped by role, each with its source line. Strength is set by tap, recency is pre-filled.
   - "People in your role usually have…" chips.
   - Credentials.
   - Leadership: 3 taps.
7. **Constraints.** 6 quick questions.
8. **Your job today.**
   - Skills, with their AI labels and trend (or "not yet measured").
   - Tasks split into "AI used today" and "No AI use seen".
   - The pay band.
9. **Roads.** A list ordered by priorities, with sliders at the top. Each card shows kind, coverage, top 3 gaps, pay, demand, AI and flags. "Show leaps".
10. **Road detail.**
    - The full gap with reasons.
    - Bridges.
    - The level and experience fit.
    - The components of the score.
    - "Add this road to my list".
11. **Drill.** Tap a skill to see the roles that need it. Tap a role to open its own roads.
12. **Account.**
    - See what you keep (JSON download).
    - Delete my data.
    - Log out everywhere.
    - Research opt-out.
    - The grievance contact.

Every screen shows the job release id and the "as of" dates in its footer.

## 9. API (Pages Functions, same style as `hosting/functions/api/*.js`)

| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `POST /api/email/start` | `{code, birthYear, email}` | Age check on the server, invite track `adult`, rate limits (3 per address per hour, the existing IP limits, a daily site cap). Sends the 6-digit code and link. Always answers "If this address can sign in, we have sent a code" |
| `POST /api/email/verify` | `{email, code}` or `{link token}` | New address: `{needsProfile:true, pending}`. Known address: `{testerId, token}` |
| `POST /api/email/complete` | `{pending, nickname, consent:true, research:bool}` | Creates the tester (`track=adult`) and returns a token |
| `GET/POST /api/me/profile` | Read or save the user model | Validated against `matcher/profile.schema.json`, ids checked against the current release's id set |
| `POST /api/me/export` | Everything kept, as JSON | |
| `POST /api/me/delete` | Deletes the tester, events, profile and email, and revokes tokens | Writes an audit row with no identity |
| `POST /api/me/logout-all` | Sets `tok_after` | |
| `POST /api/ai/read` | `{text}` (already redacted on the device) | Calls the configured provider with the extraction prompt. Accepts only schema-valid output with known ids or placeholders. Per-person 10 calls a day, a site daily cap, a 20 second timeout. Logs no text |
| `POST /api/event` | Existing | New adult event types: `intake`, `profile_saved`, `roads_viewed`, `road_opened`, `road_added`, `feedback` |

**Secrets:** `SIGN_KEY` (existing), `EMAIL_FROM`, `AI_API_KEY`, `AI_ENABLED`, `AI_DAILY_CAP`.

**Email** goes through Cloudflare Email Service. The domain needs SPF, DKIM and DMARC.

## 10. Database (`hosting/schema13.sql`)

```sql
ALTER TABLE testers ADD COLUMN track TEXT;            -- 'student' (null = student) | 'adult'
ALTER TABLE testers ADD COLUMN age_band TEXT;
ALTER TABLE testers ADD COLUMN email TEXT;             -- lower-cased; adults only
ALTER TABLE testers ADD COLUMN email_hash TEXT;        -- HMAC(SIGN_KEY, 'em:'+email)
ALTER TABLE testers ADD COLUMN research_ok INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS testers_email ON testers(email_hash);
ALTER TABLE invites ADD COLUMN track TEXT;              -- null = student
CREATE TABLE IF NOT EXISTS email_codes (email_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL, link_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, invite_id INTEGER, age_band TEXT, sent_count INTEGER NOT NULL DEFAULT 1, first_sent INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (tester_id TEXT PRIMARY KEY, data TEXT NOT NULL, job_release TEXT, matcher_version TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS under18 (invite_id INTEGER, day TEXT, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (invite_id, day));
```

Retention, purge and delete must cover `profiles` and `email_codes`, and add `profiles` to the end-of-pilot deletion.

## 11. Acceptance rules (frozen before data)

| Area | Rule |
| --- | --- |
| Intake (30 consenting resumes) | Precision of suggested skills is 85 percent or more. Recall of confirmed skills without typing is 70 percent or more. The current role is right after at most one edit for 90 percent. Median upload to confirmed is 4 minutes or less |
| Redaction (the same 30) | Zero emails, phones or ID numbers reach the preview. Person names replaced at 99 percent or more, employer and college names at 95 percent or more. Every miss is listed and fixed |
| Default mode | "Most accurate" stays the default only if it beats the on-device route on recall and meets the redaction rule |
| Pilot | 70 percent or more of intake starters reach Roads. Median time to Roads is 8 minutes or less. 60 percent or more mark a road "worth exploring". 70 percent or more agree with their road-kind labels. Zero unresolved critical errors in shown pay or credentials |
| Matcher | The golden tests pass and the reference agrees |

## 12. Legal and guardrails checklist (before any link beyond invited testers)

- **Adult notice.** It covers:
  - verified email;
  - the resume read on the device;
  - the redacted text sent to the AI provider (named) only after the preview;
  - only confirmed ids stored;
  - retention date, deletion and grievance contact.
- **Terms.** For the person's own use, never for hiring.
- **Retention.** `RETENTION_DAYS` on for adults.
- **Breach.** A breach runbook in `docs/PILOT_RUNBOOK.md`.
- **Lawyer.** One hour of review with a DPDP lawyer.
- **Licences.** The O*NET attribution in the footer. ESCO is not used in v1.

## 13. Not in v1

The interest walk for adults, the lamp map skin, Pipeline B demand from postings, ATS feeds and Adzuna, emerging-skill detection, readiness and role-match scores, side roads, mentor calls, follow-up emails, the "What changed" email, the learning loop beyond logging `road_added`, the student depth profile, and the scheduled weekly Claude Code session.
