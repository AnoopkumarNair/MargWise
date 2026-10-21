# Margwise — 05 Data Pipeline Design

**As of:** 20 Oct 2026 · Purpose: keep every fact in Margwise current, sourced and human-approved, and notice change (a new fee, a course moved between branches, a visa rule proposed or blocked, a new AI exposure release) without anyone having to remember to check.

---

## 1. Why a pipeline

Facts that change, with real examples from this project's research:

| Kind | Example | How often |
|---|---|---|
| Loan rates | SBI education-loan rates are floating; the 6.90% premier rate is valid only to 31 Dec 2026 | Monthly/quarterly |
| Regulation | The RCI M.A. (Clinical Psychology) replaced the M.Phil. from 2025-26; UGC barred online psychology degrees from 2025 | Irregular |
| School demand | CBSE's 19 Jan 2026 circular created counsellor roles | Irregular |
| Courses and colleges | Programmes added, dropped, renamed or moved between departments; intake changes; new campuses | Yearly (seat matrices, approvals) |
| Exam calendars | JoSAA registration opened around 2 June in 2026; CBSE results mid-April/May | Yearly |
| Tax | Income-tax Act 2025 renumbered 80E as Section 129; slabs per Budget | Yearly |
| Abroad policy | US $100,000 H-1B fee blocked in court (July 2026); DHS proposed a $103,265 cap-subject fee (Aug 2026); Australia's student visa rose to AUD 2,500 and its post-study visa to AUD 5,750 from 1 July 2026 | Monthly |
| AI exposure | ILO refined its exposure index in 2025; the Anthropic Economic Index publishes new releases | Per release |

## 2. Flow

```
Source registry (YAML)
   │ schedule per source
   ▼
Fetch ──► Snapshot (hash; stored) ──► Diff vs last snapshot
                                          │ changed?
                                          ▼
                              Extract (parser or LLM-assisted, with quote + page)
                                          │
                                          ▼
                              Validate (schema, units, ranges, cross-checks)
                                          │
                                          ▼
                              Change event (old → new, severity)
                                          │
                                          ▼
                              Review task in Studio (human approves / edits / rejects)
                                          │ approved facts
                                          ▼
                              Release build (bundles + manifest) ──► Validation gate ──► Publish
```

Runs as scheduled GitHub Actions jobs writing to Supabase (`pipeline` schema + Storage). A hosted crawler with built-in change tracking (e.g. Firecrawl) may replace custom HTML fetchers; record that choice in an ADR.

## 3. Source registry

One YAML file per source in `pipeline/sources/`:

```yaml
id: sbi-education-loan-rates
title: SBI — Education Loan Scheme interest rates
owner_domain: loans
url: https://sbi.bank.in/web/interest-rates/interest-rates/loan-schemes-interest-rates/education-loan-scheme
type: html            # html | pdf | csv | xlsx | json-api
schedule: weekly      # daily | weekly | monthly | yearly:<month> | manual
extractor: sbi-rates-table@1   # deterministic parser id, or "llm:loan-scheme@1"
entities: [loan_schemes]
severity_default: high # critical | high | medium | low
terms_note: "Official bank page; fetch politely; no login"
reviewers: [owner, finance]
```

## 4. Seed sources (alpha; the builder confirms exact URLs and adds more)

| Domain | Sources | Schedule |
|---|---|---|
| Interests | O\*NET database (Interests file), O\*NET IP-SF materials | On O\*NET release |
| Careers (India) | NCO-2015 (Ministry of Labour), PLFS reports (MoSPI), government recruitment notices and pay matrices for named posts | Quarterly |
| Psychology | RCI notices and programme guidelines; NCAHP notifications; UGC notices; CBSE circulars | Weekly |
| Engineering/Tech | JoSAA (opening/closing ranks, seat matrix), NTA (JEE notices), AICTE approved-institution data, NIRF Engineering data | Yearly + weekly in season |
| Commerce/CA | ICAI (exam schedule, pass percentages, campus placement reports), IPMAT (IIM Indore/Rohtak) | Monthly |
| Design | UCEED (IIT Bombay), NID DAT, NIFT; institutions' fee pages | Yearly + monthly in season |
| Architecture | Council of Architecture (eligibility, approved institutions), NATA | Yearly |
| Law | Consortium of NLUs (CLAT), AILET, Bar Council of India (approved colleges, AIBE), state judicial service notices | Monthly |
| Colleges (all) | NIRF institution data files (median salary, intake, placement), institutions' official fee and placement pages | Yearly + on change |
| Loans | SBI rates page, SBI MITC, PIB/MoE PM-Vidyalaxmi notes | Weekly |
| Tax | Income Tax Department; Budget documents | Yearly + on Budget |
| Inflation/FX | RBI (policy, reference rates); each destination's official CPI | Weekly (FX), monthly (CPI) |
| USA | USCIS, US State Department (student visas), official DHS notices, BLS occupational wages | Weekly |
| UK | GOV.UK (Student and Graduate routes, fees), ONS earnings data | Weekly |
| Germany | Federal Foreign Office, Make it in Germany, DAAD, Destatis earnings | Weekly |
| Canada | IRCC (study permits, PGWP, Express Entry categories), Statistics Canada wages | Weekly |
| Australia | Department of Home Affairs (visa fees, 500/485, financial capacity), Jobs and Skills Australia lists, ABS earnings | Weekly |
| Ireland | Irish Immigration Service (Stamp 1G etc.), CSO earnings | Weekly |
| Abroad context | MEA data on Indian students abroad | Yearly |
| AI exposure | ILO Generative AI and Jobs (2025 refined index, Working Paper 140); Anthropic Economic Index (Hugging Face, MIT licence) | On release |

Forbidden as sources: LinkedIn, Glassdoor, AmbitionBox, Naukri, Reddit, Quora, job-portal salary pages, coaching-institute marketing pages, cached AI search answers.

## 5. Change detection

### 5.1 Generic

Every fetch stores a snapshot with a content hash. If the hash changes: a structured diff for tables (row and cell level), a normalised text diff for prose (ignoring dates in headers, ads and navigation), then re-extraction of the affected fields only.

### 5.2 Courses and colleges (programme registry)

- Key: `institution_id + normalised_programme_code + campus`. Each year's seat matrix, NIRF data and approval lists update the registry.
- Year-over-year comparison creates typed events:

| Event | Rule |
|---|---|
| `programme_added` | Key present this year, absent last year |
| `programme_dropped` | Absent this year, present last year |
| `programme_renamed` | Same institution and campus, name changed, similarity ≥ threshold, intake within ±20% |
| `programme_moved` | Same programme name at the institution, different department/school or campus |
| `intake_changed` | Intake change ≥ 15% |
| `fee_changed` | Annual fee change ≥ 5% |
| `institution_relocated` | Address/campus city change in official lists |
| `approval_changed` | Approval status changed in AICTE/COA/BCI/UGC lists |

- Each event creates a review task. Approved events update dossiers and the College Explorer and appear in the app as "What changed this year".

### 5.3 Policies (country "weather" and Indian regulation)

Every policy item has a lifecycle: `proposed → announced → in_force → amended | suspended_or_blocked | withdrawn`, with dates and source per transition. The money engine's "policy shock" scenario only uses items in `proposed` or `announced`; items `in_force` change base values; `suspended_or_blocked` items are shown but not applied. Example: the US $100,000 H-1B fee → `suspended_or_blocked` (court, July 2026); the DHS $103,265 cap-subject fee → `proposed` (Aug 2026).

### 5.4 Calendars

Exam and application dates are extracted with status `official` or `expected` (projected from last year's pattern, labelled). Roadmaps refresh when official dates arrive.

## 6. Extraction

1. **Deterministic parsers first** for known, stable tables (SBI rates, JoSAA ranks, NIRF data files, Australian fee tables).
2. **LLM-assisted extraction** for prose and irregular PDFs: the model receives only the fetched snapshot and a strict output schema, and must return every value with the **verbatim quote** and the page or section reference. Results with a missing or non-matching quote are rejected automatically (string-match check against the snapshot).
3. **Confidence:** parser = high; LLM with exact quote match = medium until approved; reviewer approval sets the final confidence.
4. **Accuracy tests:** each extractor has labelled fixtures; CI fails if extraction accuracy on fixtures drops.
5. **Cost control:** LLM calls only on changed snapshots; small models for classification, larger only for complex PDFs; monthly spend cap with an alert.

## 7. AI exposure (two lenses, never one score)

### 7.1 Lens A — ILO Generative AI exposure (2025 refined index)

- Assessed at the task level and summarised per ISCO-08 occupation into four increasing gradients of exposure (plus "not exposed").
- Mapping: career → O\*NET-SOC (01 §4.1) → US SOC 2018 → ISCO-08 via the official crosswalk; cross-check against India's NCO-2015, which is aligned with ISCO-08. Store the mapping and flag any many-to-one mappings for review.
- Shown as "How much of this job's tasks could generative AI affect (ILO, 2025)", with the gradient in words.

### 7.2 Lens B — Anthropic Economic Index (observed usage)

- Task-level data on how AI is actually being used, mapped to O\*NET tasks and occupations, including the split between automation and augmentation; published on Hugging Face under the MIT licence with periodic releases.
- Shown as "How people are already using AI in this kind of work", e.g. "mostly to assist (augmentation) rather than to replace tasks", with the release date.
- Caveat shown: usage from one AI provider's users, mostly outside India.

### 7.3 Combining

- Never merge into one number. The dossier shows both lenses, a plain "what's changing" paragraph (reviewed), and "skills that stay valuable" drawn from O\*NET work activities and reviewer input.
- The money engine's δ uses a published mapping from Lens A gradient (and Lens B automation share) to a δ range, documented in `docs/money/ai-adjustment.md` and labelled as an assumption.

## 8. Review workflow (Studio)

| Severity | Examples | Reviewer | Target time |
|---|---|---|---|
| Critical | Eligibility gate, licensing rule, programme dropped, visa rule in force | Stream reviewer + owner | 48 hours |
| High | Fees, loan rates, tax rules, policy proposed/blocked | Owner or finance reviewer | 1 week |
| Medium | Salaries, NIRF metrics, intake | Stream reviewer | 2 weeks |
| Low | Text tweaks, links | Owner | Next release |

Studio screens: queue (filter by severity, stream, source), change detail (old vs new, quote highlighted in the source snapshot, extractor and confidence), approve / edit / reject with a note, release builder (included changes, validation report, publish, roll back).

## 9. Release validation gate

A release is refused if any: schema error; a `sourced` fact without a quote and snapshot; an `as_of` older than its allowed age (by entity type); an expired `valid_to` without a replacement; a range where low > likely or likely > high; a broken reference; a career missing a required dossier section; bounds not recomputed after a money-relevant change.

## 10. Monitoring

- Job dashboard in Studio: last run, last change, failures per source.
- Alerts (email to Anu): job failed twice; source unreachable for 7 days; critical change awaiting review > 48 hours; LLM spend > 80% of cap; release validation failed.

## 11. Etiquette and compliance

Official and institutional sources only; obey robots.txt and site terms; identify the user agent; rate-limit (≥ 5 seconds between requests per host); cache snapshots; never bypass logins or paywalls; store only what's needed to evidence a fact; attribute licensed data (O\*NET CC BY 4.0; Anthropic Economic Index MIT; ILO per its terms).

## 12. Build order

1. Registry, fetchers, snapshots, diff for 10 sources (SBI, PIB PM-Vidyalaxmi, Income Tax, RCI, CBSE circulars, JoSAA, NIRF, O\*NET, US/UK/AU immigration pages).
2. Studio review queue and release builder; first reviewed release.
3. Programme registry and course-change events.
4. Policy lifecycle and country weather for all six countries.
5. AI exposure lenses.
6. Remaining sources to reach full coverage for 14 careers.
