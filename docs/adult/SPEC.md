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
| **Industries (D1, decided 28 Oct 2026)** | **Primary: IT**, in full: IT services, engineering R&D, software products, the technology functions of GCCs, and IT management (delivery, programme, product and engineering management). **Second: BPM / ITeS** (business process management). **Third: BFSI** technology, operations, analytics and risk, including BFSI GCCs. See "Why these industries" below |
| **Location** | Metro-first pilot through the founder's network, but no city is excluded. The person's city cluster and openness to move are inputs. City demand is shown once postings are connected (5.9) |
| **Certifications** | Part of the map: as **bridges** (what a certification teaches) and as **asked-for credentials** (what employers list), never double-counted with skills (5.8) |
| **Backend** | As in `docs/adult/BACKEND.md` (ADR-01 to ADR-14 and the invariants). Delivery follows `docs/adult/DELIVERY.md` |

**Why these industries.**

- **One sector, three segments.** India's technology sector was estimated by NASSCOM at about 5.95 million people in FY26. Of its USD 315 billion revenue, IT services is about USD 149 billion, engineering R&D USD 63 billion and BPM USD 59 billion. Hiring growth has slowed, campus hiring has fallen significantly, and most net hiring growth came from GCCs.
- **BPM / ITeS** is the most AI-compressed part of the sector (support, finance and accounting operations, data processing). Its people have the strongest reason to look for a next role, and their roads lead to adjacent IT, analytics and new AI-era roles (for example, AI trainer, data annotation lead, LLM evaluation).
- **BFSI** sits right next to IT. Technology and BFSI together were reported as 56 percent of GCC hiring in the first half of 2026, BFSI and fintech had the highest hiring intensity, and about 190 BFSI GCCs employ around 540,000 people. Its operations, analytics and risk roles are heavily AI-exposed, and many of its people already sit in technology functions.
- **Portal users.** All three groups use job portals heavily, are digital-first, and are in the founder's network.

(Figures are from press coverage of NASSCOM's Strategic Review 2026 and of a July 2026 foundit GCC report. They describe the sector, so they are not shown to users as facts.)

### Open (the owner decides; the v1 defaults allow work to start)

| # | Question | Default until answered |
| --- | --- | --- |
| D2 | The company list for ATS feeds | Empty. Pipeline B demand shows "not yet measured" |
| D3 | Adzuna commercial terms | Not used |
| D4 | Pilot price | Free for invited testers |
| D5 | Look: the lamp map or a plain adult style | Plain adult style using the existing colour tokens and fonts. The lamp map comes later |
| D6 | DPDP lawyer review | Required before any link goes beyond invited testers |

## 4. Architecture

```
contracts/                     JSON Schemas, bands, versions, validator, id and profile migrations (BACKEND ADR-05/06/07)
data/graph/                   Pipeline A + B outputs (committed, reviewed, accepted like content.json)
  id_registry.json             append-only registry of every published id (ADR-05)
  raw/emerging_roles.yaml      new AI-era roles (5.7)
  raw/credentials.yaml         certifications catalogue (5.8)
  raw/cities.json              city clusters (5.9)
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
hosting/core/                  portable adult handlers: handle(request, deps) (ADR-01), data_inventory.js (ADR-14)
hosting/functions/api/v1/      thin Pages Functions adapters for the adult API
hosting/migrations/            wrangler d1 migrations: 0000_baseline.sql (existing schema), 0001_adult.sql, ... (ADR-03)
hosting/tools/                 check_invariants.mjs, migration_guard.mjs
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
  -- needs | has_task | close_to | co_occurs | teaches | asked_for | in_cluster | is_title_of | skill_near | moved | moved_via
  weight REAL, attrs TEXT, source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL,
  PRIMARY KEY (src, dst, kind));
CREATE TABLE signal (node TEXT NOT NULL, kind TEXT NOT NULL,      -- ai_obs | ai_tier | ai_task_mode | pay_band_in | demand_trend | skill_trend | entry_share | city_share | remote_share | pay_band_city
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
- Every `needs` edge has a real collection date from O*NET (not the download date).
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

### 5.6 Data age: the map is slow, the weather is fresh

"SOC 2018" and "ISCO-08" are editions of code lists. They are not the age of the data.

- **What O*NET updates.** O*NET publishes database releases several times a year. Technology skills are refreshed often, from job postings.
- **What ages.** Each occupation's skill and knowledge ratings come from surveys repeated every few years, so some are several years old. All of it is US data.

Rules:

1. **Every `needs` edge keeps O*NET's own collection date.** The O*NET files carry a `Date` column (MM/YYYY) per rating; store it in `edge.as_of`. Never store the download date there.
2. **Age is shown.** The slice includes, for each occupation, the oldest and newest rating dates. The UI says "Skill ratings collected 2021 to 2024 (US)".
3. **Old ratings count for less.** A rating's weight is multiplied by `max(0.6, 1 - 0.05 * max(0, age_years - 3))` (after 3 years it loses 5 percent a year, down to 0.6). Once Indian posting frequencies exist (Pipeline B), they take over: posting weight 0.6 and O*NET weight 0.4.
4. **New roles and skills come from postings, not code lists.** Roles and tools that appear in Indian postings but not in O*NET (for example, AI engineer or agent operations) are added as `occ:in-*` or `tec:in-*` nodes with `trust: observed` after the founder approves them (CAREER_GRAPH "emerging skills"). Until postings are connected, the UI says "Roles newer than the official lists may be missing".
5. **The release pins the version.** The O*NET version and its release date appear in `manifest.json` and in the app footer.

### 5.7 New roles that AI created

Official lists lag the market by years, and AI has created roles that are not in them yet. People in the founder's league are moving into exactly these roles. They are a first-class part of the map from slice S2, not something that waits for postings.

**Three kinds of AI-era change, handled differently:**

| Kind | Example | How the map holds it |
| --- | --- | --- |
| **New roles** | AI or ML engineer, AI product manager, AI solutions architect, LLM evaluation specialist, AI trainer or data annotation lead, AI governance and risk, AI red teamer, conversation designer, agent or automation builder, forward-deployed engineer, AI enablement or adoption lead | New occupation nodes `occ:ai-*` from a curated catalogue (below) |
| **Existing roles, changed by AI** | A financial analyst who now spends less time on reports and more on judgment | Not a new node. The skill and task AI labels (5.5) and the emerging skills on the existing occupation |
| **Roles AI demand creates elsewhere** | Data centre technicians, power and cooling engineers, semiconductor process roles | Existing O*NET occupations, with a demand signal once postings exist. Where an Indian role is missing, it goes into the catalogue |

**The catalogue: `data/graph/raw/emerging_roles.yaml`.** Each entry has:

- `id` (`occ:ai-llm-evaluator`), `label`, and other titles people use;
- a description in plain words;
- `parents`: 1 to 3 existing O*NET occupations it grows out of, with a share. For example, an LLM evaluation specialist might be 0.5 software QA analyst, 0.3 data scientist and 0.2 technical writer. Parent `needs` are inherited, scaled by share, as a starting point;
- `needs`: its own skills, with weights. These add to or override the inherited ones, and must include the AI-specific skills (new `tec:` and `skl:ai-*` nodes where none exist);
- `levels`: typical ladder and years, if known;
- `entry_from`: occupations people commonly move from, as hints for `close_to`;
- `sources`: at least 2. Each is a real posting from an Indian employer's ATS feed, or a public report (for example NASSCOM, MeitY or IndiaAI material, or LinkedIn's Jobs on the Rise India), with URL, date and the word-for-word quote that supports the role or a skill;
- `maturity`: `settling` (titles and skills still changing) or `established`;
- `reviewed_by` and `reviewed_on`: the founder's approval.

**Rules:**

1. **Honest labels.** Every new role carries the `trust: observed` or `secondary` of its sources and a visible "New role" tag. `settling` roles say "This role is new and its title and skills are still changing". Some new titles fade (for example, "prompt engineer" as a stand-alone job), so maturity matters.
2. **Seed, then grow.** The founder approves a seed list of about 15 roles that people in their network actually hold or hire for (**ASK** in S2). Later, Pipeline B proposes more from postings (emerging titles and skills), always with founder approval.
3. **Quarterly review.**
   - **Promotion:** a role with growing postings for 2 quarters becomes `established`.
   - **Retirement:** a role with no supporting postings for 3 quarters is retired. Roads into a retired role show "fewer openings lately" before it is retired.
4. **Matching treats them like any occupation,** with two differences:
   - **Coverage:** computed against the catalogue `needs`.
   - **Level:** the target level comes from `levels` when present; otherwise it is "not yet known".

   Roads into a new role are labelled "New role".
5. **India first.** Prefer roles with Indian sources. Many AI roles in India sit in global capability centres (GCCs), IT services and data-services firms, so the seed should reflect the founder's industries (D1).

### 5.8 Certifications

Certifications play two roles, which are kept apart so nothing is counted twice:

1. **Bridge.** A certification `teaches` skills. If a person lacks those skills, the certification is a way to close the gap.
2. **Asked-for credential.** Employers list certain certifications in postings, for example AWS Solutions Architect, CKA, PMP, ITIL 4, CISSP, ISTQB, Salesforce Administrator, ServiceNow CSA, SAP, NISM or IIBF. This is an `asked_for` edge from an occupation to a credential, with the share of postings that list it. It comes from Pipeline B, so it is empty until postings are connected.

**The catalogue: `data/graph/raw/credentials.yaml`.** Each entry has:

- `id` (`cred:aws-saa`), name and issuer;
- `official_url` and the `exam_guide_url`;
- level, typical cost in INR and hours;
- `validity_years` (null if it does not expire);
- India availability (online, test centres in India);
- `teaches`: skill ids, each with a word-for-word quote from the exam guide;
- `source`, `trust: official` (from the issuer), `as_of`;
- `reviewed_by` and `reviewed_on`.

Include low-cost Indian routes where they exist: NPTEL and SWAYAM courses with certification, NASSCOM FutureSkills Prime, NISM (securities) and IIBF (banking).

**Seed.** About 40 certifications across IT, BPM and BFSI, drafted with real exam-guide quotes. The owner approves each one (**ASK**, slice S2).

**How the matcher uses them:**

- **Skills credited.** A certification the person holds, and that has not expired, credits its `teaches` skills at the `used` level (0.7), unless the person rated those skills themselves. Their own rating wins.
- **Expired certifications** credit at the `rusty` level (0.4) and are labelled "expired, renew?".
- **Screening flags.** An `asked_for` certification that the person lacks is shown as a separate screening note on the road ("Often asked for: CKA, in 31 percent of postings"). It does not change coverage, which measures skills only.
- **Bridges** (7.4) choose from certifications first. Each bridge shows cost, hours, validity, and the official link.

### 5.9 Location

- **Who it is for.** The pilot starts in metros through the founder's network, because that is where most of these jobs are: Bengaluru alone was reported as about 30 percent of GCC hiring, and metros about 88 percent of GCC activity. Tier-2 cities are growing fastest, so none is excluded.
- **City clusters.** `raw/cities.json` lists Bengaluru, Hyderabad, Pune, Chennai, Delhi NCR, Mumbai, Kolkata, Ahmedabad, a tier-2 list (for example Coimbatore, Kochi, Jaipur, Indore, Bhubaneswar, Visakhapatnam, Thiruvananthapuram, Chandigarh, Nagpur, Mysuru) and "other". Each cluster has a state. Only the **cluster** is stored, never an address. Cluster ids have the prefix `city:` like every other graph id (`city:blr`, `city:hyd`, ..., `city:other`); the list is `city_cluster` in `contracts/bands.json`.
- **Inputs.** The profile records the person's current cluster and their openness: same city, these cities, anywhere in India, remote only, abroad. The three choices that are not a city are stored as `open:india`, `open:remote` and `open:abroad`.
- **Signals.** Once postings are connected, demand and pay are recorded per occupation per cluster, with a "remote or hybrid share". Each road shows "Where these jobs are: mostly Bengaluru, Hyderabad, Pune; 20 percent remote". Until then it shows "not yet measured". A road where most openings are outside the person's acceptable places gets the `needs_relocation` flag. It is never hidden.
- **Pay by city.** Postings that show pay, per cluster, with `secondary` trust. PLFS has no city-level occupation pay, so it stays a broad national band.

## 6. User model

Stored in D1 as JSON, holding ids and bands only:

```json
{
  "v": 1,
  "roles": [{"occ": "occ:13-2011.00", "level": 3, "industry": "bfsi", "years": "5-8", "current": true}],
  "skills": [{"id": "skl:2.A.2.a", "strength": "strong", "last": 2026}],
  "creds": [{"id": "cred:aws-saa", "year": 2024, "expires": 2027}],
  "lead": {"people": "1-5", "budget": false, "expert": true},
  "constraints": {"hours_month": "5-10", "course_budget": "10k-50k", "city": "city:blr", "open_to": ["city:blr", "city:hyd", "open:remote"], "pay_floor_pct": -10, "mode": "hybrid"},
  "priorities": {"pay": 1, "ai_safe": 1, "short_move": 1, "demand": 1, "enjoy": 0},
  "job_release": "abc123", "matcher_version": "1.0.0"
}
```

| Field | Values |
| --- | --- |
| `strength` | `used`, `strong`, `rusty` |
| `level` | 1 to 6 (section 7.2) |
| Bands | Fixed strings from the lists in `contracts/bands.json` |
| `years` | Years in that role: `0-2`, `2-5`, `5-8`, `8-12`, `12-18`, `18+`. The same bands as the level thresholds in 7.2. `a-b` means at least `a` and under `b` years |
| `city`, `open_to` | City cluster ids with the prefix `city:` (5.9). `open_to` also allows `open:india` (anywhere in India), `open:remote` and `open:abroad` |
| `rev` | Not part of this document. The edit counter lives in the `profiles` table and in the API wrapper `{rev, data}`, and the server sets it on every save (BACKEND ADR-06) |
| Ids | Must be live or tombstoned-with-replacement in `id_registry.json`. Mapped on read by `contracts/migrate_ids.js` (ADR-05) |

## 7. Matcher v1 (`matcher/match.js`, mirrored by `matcher/reference.py`)

### 7.1 Coverage and gap

For person P and target T, with need weights `w_s` from T's slice:

```
have(s) = 1.0 if strong, 0.7 if used, 0.4 if rusty (or last-used more than 3 years ago and not strong)
          if the person did not rate s but holds a credential that teaches s: 0.7 if valid, 0.4 if expired (5.8)
near(s) = max over P's skills k with skill_near(k, s) >= 0.5 of 0.5 * sim(k, s) * have(k)
cover(s) = max(have(s), near(s))
coverage = sum(w_s * cover(s)) / sum(w_s)          over T's top 40 needs
gap = needs with cover(s) < 0.7, ordered by w_s * (1 + 0.5 if skill label is "people still do this") desc
```

### 7.2 Levels

- **Person's level, from 1 to 6:**
  - start from total years, in the year bands of `contracts/bands.json` (`0-2:1, 2-5:2, 5-8:3, 8-12:4, 12-18:5, 18+:6`; `0-2` means under 2 years, and each band includes its lower bound). Each role's `years` (section 6) uses the same bands;
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

Credential nodes exist only where the catalogue (`data/graph/raw/credentials.yaml`, 5.8) holds them, each with an official URL and a quote. The bridge is a greedy cover of the gap weight, up to 3 credentials. If none exist, show "No reviewed course yet for these skills" and the skills themselves.

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
7. **Constraints.** 6 quick questions: study hours a month, course budget, current city cluster, places you would work (including remote), lowest pay change, work mode.
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

## 9. API (`/api/v1/`, portable handlers; conventions in BACKEND ADR-09)

Every response is `{ok:true,...}` or `{ok:false, error:{code, message}}`, and carries an `x-request-id`. The tester id always comes from the verified token, never from the request body.

| Endpoint | Request | Behaviour |
| --- | --- | --- |
| `POST /api/v1/email/start` | `{invite, birthYear, email, turnstile}` | Verify Turnstile. Check the age on the server. Under 18: count a refusal for the invite, store nothing else, and return `refused_age`. Otherwise the invite must be active with `track=adult`. Limits per address (3 an hour, 10 a day), per IP bucket and site-wide. Store `email_codes`, send the code and link. Always answer "If this address can sign in, we have sent a code" |
| `POST /api/v1/email/verify` | `{email, code}` or `{link}` | At most 5 tries, then the code is void. New address: `{needsProfile:true, pending}`, where `pending` is a signed 30-minute token holding the email hash, invite and age band (format in BACKEND ADR-20). Known address: `{token}` |
| `POST /api/v1/email/complete` | `{pending, nickname, consent:true, research:bool}` | Creates the tester. **Idempotent:** the unique `email_hash` index means a repeat returns a token for the same tester |
| `GET /api/v1/me/profile` | | Returns the profile, upgraded to the current `v` and with ids mapped (ADR-05/06) |
| `PUT /api/v1/me/profile` | `{rev, data}` | Validates the contract, checks ids against the current release's id list (loaded with `env.ASSETS.fetch` and cached), writes with `WHERE rev = ?`. On a mismatch, `409 conflict` with the current document |
| `POST /api/v1/me/export` | | Everything in the data inventory for this tester, as JSON |
| `POST /api/v1/me/delete` | `{confirm:"DELETE"}` | Deletes across every table in the inventory, revokes sessions, and writes an audit row with no identity |
| `POST /api/v1/me/logout-all` | | Sets `tok_after` |
| `POST /api/v1/ai/read` | `{text, turnstile}` | Requires login. Text at most 20,000 characters. The provider is called with the extraction prompt. The output must validate against `contracts/extract.schema.json`, unknown ids are dropped, and any output containing an email or phone pattern is rejected. Limits: 10 a person a day, a site daily cap, a 20-second timeout. Never logs the text |
| `POST /api/v1/event` | `{type, eid, data}` | Adult event types `intake`, `profile_saved`, `roads_viewed`, `road_opened`, `road_added` and `feedback`. Each type has its own strict request schema, chosen by `type` (`contracts/event_schemas.js`); an unknown type or a field from another type is `bad_request`. Ids and numbers only, plus the capped feedback text. Deduplicated by `eid`. Capped per tester per day |
| `GET /api/v1/health` | | Database reachable, release id, `API_V`, AI enabled, email configured |

**Secrets, per environment (ADR-02 and ADR-04):** `SIGN_KEY`, `EMAIL_KEY`, `CODE_KEY`, `IP_KEY`, `TURNSTILE_SECRET`, `EMAIL_FROM`, `AI_API_KEY`, plus the settings `AI_ENABLED`, `AI_DAILY_CAP`, `EMAIL_DRY_RUN` and `RETENTION_DAYS`.

**Email** goes through Cloudflare Email Service. The domain needs SPF, DKIM and DMARC.

## 10. Database (`hosting/migrations/0001_adult.sql`, after the baseline, ADR-03)

```sql
ALTER TABLE testers ADD COLUMN track TEXT;              -- NULL = student, 'adult'
ALTER TABLE testers ADD COLUMN age_band TEXT;
ALTER TABLE testers ADD COLUMN email TEXT;              -- normalised (ADR-04); adults only
ALTER TABLE testers ADD COLUMN email_hash TEXT;         -- HMAC(EMAIL_KEY, 'em:v1:' + email)
ALTER TABLE testers ADD COLUMN research_ok INTEGER;
ALTER TABLE testers ADD COLUMN key_v INTEGER;           -- session key version (ADR-04)
CREATE UNIQUE INDEX IF NOT EXISTS testers_email ON testers(email_hash) WHERE email_hash IS NOT NULL;
ALTER TABLE invites ADD COLUMN track TEXT;              -- NULL = student, 'adult'
CREATE TABLE IF NOT EXISTS email_codes (email_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL, link_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, invite_id INTEGER, age_band TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS email_sends (email_hash TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (email_hash, day));
CREATE TABLE IF NOT EXISTS profiles (tester_id TEXT PRIMARY KEY, v INTEGER NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL,
  job_release TEXT, matcher_version TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS under18 (invite_id INTEGER, day TEXT, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (invite_id, day));
CREATE TABLE IF NOT EXISTS ai_calls (tester_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0,
  prompt_version TEXT, PRIMARY KEY (tester_id, day));        -- prompt_version: the extraction prompt of the latest call that day, e.g. 'extract_v1' (ADR-17)
CREATE TABLE IF NOT EXISTS ops_daily (day TEXT NOT NULL, metric TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, metric));
```

Every table holding `tester_id` or `email_hash` must be listed in `hosting/core/data_inventory.js`, which deletion, purge, export and the invariant checker all use (ADR-11, ADR-14). `email_codes` rows older than 24 hours and `email_sends` rows older than 7 days are purged daily (on first request of the day, as today's lazy purge).

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

## 14. Document map

| Need | Document |
| --- | --- |
| What we are building, and the decisions | This file |
| Backend decisions, invariants, failure modes | `docs/adult/BACKEND.md` |
| How agents and the owner build it (hats, lanes, gates, change control, runbook) | `docs/adult/DELIVERY.md` |
| What to build, in which order | `docs/adult/BUILD_PLAN.md` |
| How it is tested | `docs/adult/TEST_PLAN.md` |
| The opening prompt for an implementation session | `docs/adult/HANDOFF_PROMPT.md` |
| Why things are the way they are (history) | `docs/ADULT_TRACK.md`, `ADULT_WORKFLOWS.md`, `CAREER_GRAPH.md`, `SKILLS_INTAKE.md`, `MATCHING.md`, `AI_LAYER.md`, `ADD_ONS.md` |

