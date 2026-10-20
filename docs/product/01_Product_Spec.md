# Margwise — 01 Product Spec (Alpha)

**Status:** Build spec for the alpha · **As of:** 20 Oct 2026 · **Owner:** Anu
**Document set:** 01 Product Spec (this) · 02 Game Design · 03 Assessment & Money Engines · 04 Architecture & Design · 05 Data Pipeline · Build Prompt
**Precedence:** This set replaces every earlier document (PathForge v1 whitepaper, v2 proposal, Gemini implementation plan, PathForge v0.1 Core Spec). If two documents in this set disagree, the more specific one wins (e.g. 03 beats 01 on formulas); log the conflict in `docs/decisions.md`.

---

## 1. What Margwise is

A phone-first career and education game for Indian families with a Class 11–12 student. The teen plays a story-driven game that measures their interests; the family explores deep, verified dossiers on careers, colleges and countries; the parent models what each path costs and returns by age 35, in India or abroad; and the family leaves with a dated roadmap and a plain report.

**What makes it worth paying for:** depth and freshness that a family cannot assemble alone (verified facts kept current by a data pipeline), a money model for their own numbers, and a game that a 16-year-old actually finishes.

**Name:** Margwise (marg = path). `margwise.com` and `margwise.in` were available on 20 Oct 2026. Run an IP India trademark search (classes 9, 41, 42) before public use. During the alpha the app may run at `margwise.byteheaven.in`.

## 2. Alpha goals and gates

### 2.1 Goals

1. Varied, honest feedback from 20–30 families on: interest result fit, usefulness of dossiers, clarity of the money picture, decision impact, willingness to pay, drop-off points.
2. A working, maintainable foundation (code, content API, data pipeline) that the product grows on. Nothing here is throwaway.
3. Consented usage and research data (tracking, see 04 §6) to find drop-offs and start checking the assessment with Indian teens.

### 2.2 Gates

- **Gate 1 (before testers):** all golden/unit/property tests green; pipeline has published at least one reviewed release; 3 parents complete the flow unaided on a phone.
- **Gate 2 (after the alpha):** at least 60% of parents say it changed or confirmed a decision and would pay a stated price; at least 2 career counsellors ask to use it with students; the median teen completes the interest run.

## 3. Users and roles

| Role | Who | In product |
|---|---|---|
| Explorer | Student in Class 11–12 (15–18) | Plays the game, explores dossiers, takes quests |
| Patron | Parent/guardian; user of record and consent giver | Money inputs, plans, report, consent |
| Wider family | Grandparents, relatives | Read the shared report |
| Reviewer | Stream experts, CA, Anu | Approve pipeline changes in the Studio |
| Owner | Anu | Everything; releases |

## 4. Coverage for the alpha

### 4.1 Careers (14 across 5 clusters, all treated identically)

Every cluster gets the same content depth, the same sourcing rules and the same review process. No cluster is marked "draft"; review status is tracked per stream in the Studio and shown uniformly as "Last reviewed by [role] on [date]" once a review exists.

| ID | Career | Cluster | O\*NET-SOC (verify; record version) |
|---|---|---|---|
| PSY-1 | Clinical Psychologist (RCI-registered) | Psychology | 19-3033.00 |
| PSY-2 | Counselling Psychologist | Psychology | 19-3033.00 |
| PSY-3 | School Counsellor & Wellness Teacher | Psychology | 21-1012.00 |
| PSY-4 | Organisational (I-O) Psychologist / People Analytics | Psychology | 19-3032.00 |
| PSY-5 | UX Researcher | Psychology | 17-2112.01 (closest; confirm) |
| TEC-1 | AI / Software Engineer | Tech & AI | 15-1252.00 |
| TEC-2 | Data Scientist / Analyst | Tech & AI | 15-2051.00 |
| TEC-3 | Electronics & EV Hardware Engineer | Tech & AI | 17-2072.00 |
| COM-1 | Chartered Accountant | Commerce & Business | 13-2011.00 |
| COM-2 | Business Manager / Founder | Commerce & Business | 11-1021.00 |
| DES-1 | UX / Product Designer | Design | 15-1255.00 |
| DES-2 | Architect | Design | 17-1011.00 |
| LAW-1 | Corporate Lawyer | Law | 23-1011.00 |
| LAW-2 | Judge (Judicial Services) | Law | 23-1023.00 |

Psychology facts verified on 19–20 Oct 2026 (use as starting points; the pipeline keeps them current): the RCI-regulated 2-year M.A. (Clinical Psychology) replaces the M.Phil. from session 2025-26 and needs a 4-year Psychology UG (3-year graduates: a bridge year or the first year of a Psychology master's); RCI protects titles only within clinical and rehabilitation psychology; the NCAHP covers most other psychology but its central registry is not active; UGC barred psychology in open/distance/online mode from July–August 2025; a CBSE circular of 19 Jan 2026 mandates a Counselling and Wellness Teacher and a career counsellor (1 per 500 students, Classes 9–12) in affiliated schools.

### 4.2 Places

- **India:** Home city (live at home), Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai, plus "Other Indian city" (user-entered costs).
- **Abroad (in-depth country modules):** USA, UK, Germany, Canada, Australia, Ireland. Both undergraduate and master's study.
- **Any other country:** via the Custom path (§4.4), labelled "your numbers, not verified".

### 4.3 What each career dossier MUST contain

| Section | Content |
|---|---|
| The work | What people in this career actually do in India; 4–6 day-in-the-life tasks; work settings; who they work with |
| Career ladder | 3–5 levels from entry to senior, with typical years to reach each and pay range (P10/P50/P90) at each level, in India; for each of the 6 countries, entry and mid-level pay where sourced |
| Where they work | Typical employer types and 6–10 named example employers in India; demand signals abroad (official shortage or skills lists where the career appears) |
| Routes | All main education routes after Class 12 in India and abroad: stages, durations, entrance tests, official links; backup and adjacent routes |
| Eligibility gates | Per subject combination: Open / Bridge / Locked, with reason and official source |
| Licensing & regulation | Bodies, registrations, protected titles, open questions (e.g. NCAHP status) |
| Colleges | The College Explorer slice for this career (§5.2) |
| Skills to start now | 5–8 skills with free ways to begin, for a Class 11–12 student |
| AI exposure | Two-lens view from the pipeline (05 §7), plain-language "what is changing", method and date |
| Abroad | For each country: is this a common route, recognition and licensing issues for Indian degrees, post-study work and stay prospects for this field |
| Try-it quests | 2–3 safe, free 1–2 week activities (02 §6) |
| Honest notes | Crowding, pay dispersion, what is uncertain, common myths |
| Sources | Every fact linked; "last updated" date |

### 4.4 Custom path (coverage outside the alpha)

Any family can build a plan for an uncovered course, college, city or country by entering fees, living costs, duration, expected starting pay range and currency. The same money engine runs. Everything entered is labelled "your numbers, not verified" in the app and in the shared report. Each custom entry also files an anonymous **coverage request** (career/course/city/country name only) if the Patron has allowed usage data, so the backlog is driven by demand.

### 4.5 Sharing outside coverage

The share card and report always show: what is covered, the content release date, a QR/link to the coverage page, and a note when the plan used custom numbers. Opening a shared link never assumes the receiver's child has the same profile.

## 5. Feature set (alpha)

### 5.1 The game (details in 02)

Prologue → six market days (60 interest activities) → Lantern Council reveal → the Isles map with 14 career halls → mentor visits and dossiers → quests.

### 5.2 College Explorer

For each course behind the 14 careers (e.g. B.Tech CSE, B.Sc./B.A. Psychology, B.Des, B.Arch, B.A. LL.B., B.Com + CA), a list of real Indian institutions with: type (public/private), city, NIRF rank and band where ranked (year stated), annual fees (year stated), intake, entrance test, last year's opening/closing ranks where a central counselling body publishes them, median graduate salary where the institution reports it to NIRF, and accreditation/approval status. Target 20–40 institutions per course for the alpha, chosen to cover all three college types and several cities. Every field comes from the pipeline with year and source. Missing data shows "not reported", never a guess.

For abroad, per country: 5–10 example universities per course with tuition range, programme length, language of instruction, and admission requirements summary, sourced from the institutions' official pages.

### 5.3 Country modules (USA, UK, Germany, Canada, Australia, Ireland)

Template fields (all sourced from official government or institutional pages and kept current by the pipeline; status of each policy item: proposed / announced / in force / suspended or blocked):

- Study costs: tuition ranges by level and field; proof-of-funds / living-cost requirement; health cover
- Visa: student visa type, fee, typical processing, work rights while studying
- After study: post-study work route, duration and conditions, fees; route to permanent residence; employer-sponsored work visa basics and fees
- Career fit: whether each of the 14 careers appears on official shortage/skills lists; licensing for foreign-trained professionals (e.g. psychology, law, architecture are heavily licensed)
- Policy weather: dated events from the pipeline, e.g. "US: $100,000 H-1B fee blocked in court (July 2026); DHS proposed a $103,265 cap-subject fee (Aug 2026, comments closed 24 Sep)". Each item shows its status and date.
- Return-to-India view: how the foreign degree is valued for the career in India (where evidence exists)

Context for testers (MEA data via ICEF, Dec 2025): Indian students abroad fell 5.7% in 2025 to just over 1.2 million; new Canadian permits for Indians fell sharply; US F-1 issuances to Indians fell 44% in H1 2025; Germany more than doubled since 2020. This volatility is why country facts come from the pipeline, never from code.

### 5.4 Money engine and plans (details in 03)

Up to 4 plans per family: career route + institution or college type + city/country (+ optional master's stage elsewhere). Family cash-flow NPV to age 35 with P10/P50/P90, loans and tax, abroad currency and policy risk, return-to-India scenario, custom numbers.

### 5.5 Roadmap

From today to first job for a chosen plan: a dated timeline of exam registration windows, exam dates, application windows, documents, skills to build per quarter, and quests. Dates come from the pipeline (official calendars); estimated dates are labelled "expected". Export as `.ics` calendar file and as part of the report.

### 5.6 Compare and family report

Fit-vs-money "voyage chart", plan cards, teen and parent priorities side by side, and a plain report (screen, PDF, share image) that includes sources, release date and a "what this cannot tell you" box.

### 5.7 Conversation guide

A short, structured guide for the parent and teen: questions to ask each other about each plan, how to handle disagreement, when to bring in a counsellor. Static content, reviewed.

## 6. Out of scope for the alpha

- Admission-probability predictions (we show last year's ranks as facts only)
- Reservation category inputs (show category-wise ranks as published, without asking the user's category)
- Payments and accounts for families (Studio accounts exist for reviewers only)
- Hindi and regional languages (code is translation-ready from day one)
- School/counsellor dashboards
- Any runtime LLM chat for families

## 7. Feedback plan

### 7.1 Recruit 20–30 families for variety

- At least 3 families each leaning Builder/Thinker, Creator, Helper, Persuader/Organiser
- At least 4 families considering Psychology; at least 6 seriously considering study abroad, covering at least 4 of the 6 countries
- At least 4 families outside Bengaluru, including tier-2 cities
- Mixed income bands, including at least 4 who would need a loan
- Science, Commerce and Humanities students; girls and boys
- At least 3 families where parent and teen disagree
- Sit in on 4–6 sessions in person (observe, don't help)

### 7.2 Feedback

In-app feedback screen (stored via the Telemetry API with consent; see 04 §6) plus an optional longer form. Questions: device, time taken, interest-result fit (teen, 1–5), useful surprises, money clarity (1–5), decision impact, drop-off point, price perception (bargain / fair / expensive / too expensive in ₹), recommend score (0–10), most wanted missing career/country/feature.

### 7.3 Tester kit

WhatsApp invitation, consent explainer for parents, observer checklist. Prepared by the builder.

## 8. Decisions that override earlier documents

| # | Earlier | Now | Why |
|---|---|---|---|
| 1 | Name PathForge | Margwise | PathForge is taken by a similar site |
| 2 | No backend, no tracking | Supabase (Mumbai) backend; consented tracking in the alpha (04 §6) | Feedback and assessment checks need data; final product keeps tracking minimal |
| 3 | Facts in JSON shipped with the app | Facts served from versioned content releases via the Content API, fed by the pipeline | Facts change; shipping them in code doesn't scale |
| 4 | 5 Indian cities + one generic "Abroad" | 7 Indian cities + Other + 6 in-depth countries + Custom path | Studying abroad is a central question for many families |
| 5 | Thin flow | Deep dossiers, College Explorer, country modules, roadmap, conversation guide | Depth is what families pay for |
| 6 | Psychology labelled draft | All clusters treated identically | Every stream will be expert-reviewed |
| 7 | Style without a game | Full game design (02) | The game is the hook for teens |
| 8 | Single package | Monorepo with apps, services, pipeline, packages (04 §3) | Built to last |
| 9 | Per-career AI guess | Sourced two-lens AI exposure (05 §7) | Evidence over opinion |
| 10 | 6–8 weekends | 12–16 weekends plus art production | Honest estimate for the new scope |

## 9. Open items

- IP India trademark search for "Margwise"
- Reviewers per stream (Psychology, Tech, Commerce/CA, Design, Law) and a CA for the money engine
- Legal consult on alpha tracking of minors before the DPDP children's provisions apply (13 May 2027)
- Confirm SBI premier/Scholar moratorium terms
- Confirm the closest O\*NET occupation for UX Researcher
