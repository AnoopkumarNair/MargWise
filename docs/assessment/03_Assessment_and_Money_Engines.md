# Margwise — 03 Assessment & Money Engines

**As of:** 20 Oct 2026 · Both engines live in `packages/engine` as pure TypeScript (no UI, no network), fully unit-, golden- and property-tested.

## 1. Scope

Section 2 covers the interest assessment; Section 3 covers the money engine. Other documents refer to these as 03 §2.x and 03 §3.x.

---

## 2. Interest assessment

### 2.1 Instrument

- **O\*NET Interest Profiler Short Form (IP-SF):** 60 items, 10 per RIASEC area, computerised 5-point scale: Strongly dislike 0 · Dislike 1 · Unsure 2 · Like 3 · Strongly like 4. Area score = sum of its 10 items (0–40).
- **Why 60 items:** O\*NET reports alphas of .78–.87 (development) and .85–.90 (validation) for the 10-item scales, versus .70–.81 for the 5-item Mini-IP scales.
- **Source:** the official IP-SF materials (PDF or O\*NET Web Services), transcribed verbatim and spot-checked by Anu. Licence CC BY 4.0, with O\*NET's attribution text verbatim on the About/Attribution screen and a note that Margwise changed the presentation.
- **Known limitation (shown in About):** items and reliability evidence come from US samples; some activities may feel unfamiliar or low-status to Indian teens. Margwise is collecting consented data to check this (§2.7).
- **Wording:** "based on the O\*NET Interest Profiler (US Department of Labor), being checked with Indian students". Never "validated", "accurate", "scientific" or "proven" until §2.8 is complete.

### 2.2 Administration in the game

See 02 §3.1 and §4. Days 1–6 = items 1–10, 11–20, … 51–60 in official order. Undo/back always available. The parent is off-screen.

### 2.3 Quality checks before results (thresholds provisional, one config file)

| Check | Rule | Response |
|---|---|---|
| Straight-lining | ≥ 54 of 60 identical | Offer to redo a day; allow continue |
| Flat profile | max − min area score ≤ 6 | "Broad interests right now"; matches shown as "Unclear"; quests promoted |
| Low engagement | all areas ≤ 10 | Supportive note; matches shown |
| High engagement | all areas ≥ 30 | Supportive note; matches shown |

### 2.4 Interest code and ties

Top three areas form the code (e.g. A-S-I). Scores within 3 points (provisional, about one standard error at alpha ≈ .87) are ties; show alternatives ("A-S-I or A-I-S"). Friendly names: R Builder, I Thinker, A Creator, S Helper, E Persuader, C Organiser.

### 2.5 Matching

Career vectors: O\*NET Occupational Interest (OI, 1–7) ratings for elements 1.B.1.a–f of each mapped O\*NET-SOC code, from the O\*NET database Interests file. Store the O\*NET release. Never hand-author vectors.

```
TraitFit = ½(1 + r),  r = Pearson(U, V) over k ∈ {R, I, A, S, E, C}
```

| Band | Rule |
|---|---|
| Strong | r ≥ 0.5 |
| Mixed | 0 ≤ r < 0.5 |
| Weak | r < 0 |
| Unclear | flat profile |

Explanation: the two largest positive per-area contributions z(U_k)·z(V_k) ("You and this career both lean Helper and Thinker") and the largest negative one ("what may not suit you").

Teen-facing display: band, explanation, code only. No percentages, decimals, rankings beyond "top matches", diagnosis words or "you should". The parent's voyage chart may show TraitFit (0–1, two decimals) on its axis.

### 2.6 Required tests

Exact scoring on known vectors; all-Unsure → 20 per area; 60 items, 10 per area, verbatim snapshot; hand-computed r (including +1, −1, and an Artistic-high/Investigative-low teen vs a software profile giving a clearly negative r); flat profile → Unclear; tie boundaries at 2/3/4 points; shift and scale invariance of r (property tests).

### 2.7 Alpha research (needs research-level consent; 04 §6)

- **Data:** item responses (60 values), area scores, quality flags, game-vs-plain arm, parent-present flag (self-reported by the Patron), device class, class (11/12), subject combination, city tier. No names or contact details.
- **A/B test:** with research consent, randomly assign 50% of sessions to a **plain questionnaire** arm (same items, same anchors, simple list UI) and 50% to the **game** arm. Compare completion rate, time, mean and spread per area, and straight-lining rate.
- **Optional third arm (only after Anu approves):** "simplified wording" items, analysed as a new instrument.
- **Honest limit:** 20–30 families give usability evidence, not psychometric evidence. Internal-consistency estimates need roughly 150–300 teens; the same pipeline collects that once counsellor or school partners join.

### 2.8 Validation plan (post-alpha)

300 or more students in Classes 9–12 via partners: internal consistency per area, 4-week test–retest, agreement with the paper IP-SF, game-vs-plain equivalence, subgroup checks (gender, stream, city tier), and Indian reference data for score interpretation. Publish a technical note.

---

## 3. Money engine

### 3.1 Outputs per plan (to age 35)

Total family cost (out-of-pocket vs loan); loan scheme, rate, moratorium, capitalised interest, EMI, tenure, debt-free age; in-hand pay by year; **family cash-flow NPV P10/P50/P90** over 1,000 seeded simulations; peak EMI ÷ in-hand pay (P50) and the share of futures above 40%; years until first salary; for abroad plans, the share of futures that end with a return to India.

### 3.2 Patron inputs (keep short)

Student age and class; subject combination; home city (or tier); annual family income band (< ₹4.5L, ₹4.5–8L, ₹8–15L, ₹15–30L, > ₹30L); savings for this child's education (₹); largest comfortable loan (₹); parent's tax regime (New default / Old / Not sure); parent's priority ranking. Everything else lives in an Assumptions drawer with defaults and sources.

### 3.3 Plan structure

A plan = up to two education stages (e.g. UG in India + master's abroad), each with: route stage, institution (from the College Explorer) or college type (Top public / Good private / Other private, or the country's equivalent), city or country, duration; then a work location (India city or country) with a "stay abroad vs return" scenario where relevant. Any field can be Custom (user-entered, labelled unverified).

### 3.4 Costs

- Tuition per stage from the institution record or college-type range (low/likely/high), in local currency with the release's dated FX rate.
- Living per city/country per year (sourced or `assumption`); one-time costs (coaching where typical, equipment, deposits, visa and travel for abroad, proof-of-funds blocked accounts where required — modelled as cash held, not spent).
- Inflation defaults (editable, labelled): India general 4% (RBI target, cited); education 8% (range 6–10%, assumption); abroad costs use each country's latest official CPI (pipeline) or a labelled assumption.
- **FX:** dated base rate from the release; INR depreciation drawn per simulation from a triangular range (default 1–4% a year, assumption, editable).

### 3.5 Loans

Scheme table (from SBI's page effective 15 Oct 2026; floating rates on SBI's EBR of 8.15%; each with `valid_to` where known; the pipeline keeps them current):

| Scheme | Rate | When (user confirms) | Moratorium | Notes |
|---|---|---|---|---|
| SBI premier concessional | 6.90% | Listed premier institutes; valid to 31 Dec 2026 | To confirm with SBI | — |
| SBI Scholar | 7.15–7.90% | Scholar-list college | Repayment starts 6 months after course per SBI's 2020 page — confirm | 1% concession if interest serviced during study and moratorium |
| PM-Vidyalaxmi | 7.15 / 7.45 / 8.65% | One of 1,425 QHEIs; not management/NRI quota | Course + 1 year | Collateral-free; 75% guarantee ≤ ₹7.5L; 3% subvention during moratorium if income < ₹8L, loans ≤ ₹10L, 1 lakh students a year ("possible, not guaranteed"); full subvention (PM-USP CSIS) if income ≤ ₹4.5L for technical/professional courses at NAAC/NBA institutions; once per student |
| SBI Student Loan | 10.15% ≤ ₹7.5L (no collateral); 9.65% above (collateral) | Other recognised colleges | Course + 1 year or 6 months after job, whichever earlier | 0.50% girl concession; margin nil ≤ ₹4L, 5% above (India); 1% servicing concession |
| SBI Global Ed-Vantage | 9.15% secured / 9.65% unsecured ≤ ₹50L (select institutions) | Study abroad | As SBI MITC | 0.50% girl concession on general tiers only |
| Private lender (generic) | 10.5–14% (assumption) | User choice | Course + 1 year (assumption) | Comparison only |

Rules: the user confirms list membership via official links (no institution lists maintained by us in the alpha); moratorium interest is simple, capitalised at repayment unless serviced; annuity EMI; tenure default 10 years (5–15).

### 3.6 Earnings

- **India:** starting pay per career × college type or institution (P10/P50/P90 triangular), from NIRF institution data, government pay matrices and recruitment notices, regulator and institute placement reports; career-ladder pay by level for growth (01 §4.3); every range has source and confidence or is an assumption with a note.
- **Abroad:** entry and mid-level pay per career per country from official statistics where available (e.g. national occupational wage data), else labelled assumption; an **effective tax rate range per country** (assumption, labelled) in the alpha instead of full foreign tax models; living costs in the work country.
- **AI adjustment δ:** a yearly drag on gross pay growth per career, derived from the two-lens AI exposure (05 §7) by a published mapping (e.g. exposure gradient → δ range), default centred near 0, shown in the dossier. Applied to gross wages only.
- **In-hand (India):** gross − income tax (new regime). EPF and surcharge ignored in the alpha (stated).

### 3.7 Scenarios

| Scenario | Applies | Effect |
|---|---|---|
| Core | All | Works in the target career |
| Fallback | All | Adjacent role with its own pay range |
| Repeat year | Exam-heavy routes (JEE, CLAT, CA, RCI M.A. entrance, design entrances) | +1 year cost, delayed earnings; probability cited (e.g. ICAI pass rates) or assumption |
| Stay abroad, employed | Abroad stages | Works in the country (post-study work → longer stay) |
| Return to India | Abroad stages | Works in India at India pay; abroad loan still repaid |
| Policy shock | Abroad stages | A dated, proposed policy that would raise costs or shorten work rights (from the pipeline's "proposed" items) applied with a probability set by the user (default shown) |

All probabilities visible and editable; all appear in the report.

### 3.8 Tax (India, tax year 2026-27; Budget 2026 made no change)

- **New regime (default, Section 202):** 0–4L nil; 4–8L 5%; 8–12L 10%; 12–16L 15%; 16–20L 20%; 20–24L 25%; > 24L 30%; rebate up to ₹60,000 if income ≤ ₹12L; standard deduction ₹75,000 (salaried); cess 4%.
- **Old regime:** 0–2.5L nil; 2.5–5L 5%; 5–10L 20%; > 10L 30%; rebate ₹12,500 up to ₹5L; standard deduction ₹50,000; cess 4%.
- Slabs held flat in future years (assumption, stated). Tax rules come from the content release so a Budget change is a data update, not a code change.
- **Section 129 (ex-80E):** only outside the default regime: interest actually paid × parent's marginal old-regime rate, up to 8 tax years from the first year of interest payment. ₹0 under New; "Not sure" → New with an explanation.

### 3.9 Family cash-flow NPV

Nominal ₹ per year, t = 1 … H, H = 35 − current age:

```
NPV = Σ_t [ InHand_t − Living_t − OutOfPocket_t − EMI_t − Coaching_t − OneTime_t + TaxSaving129_t ] / (1 + r)^t
```

Loan-financed costs enter only through EMI (never twice). Abroad pay is converted to INR at the simulated FX path. r default 7% (assumption, editable). The household is one pot (stated in the report).

### 3.10 Monte Carlo

Seeded PRNG; 1,000 draws per plan (configurable); triangular sampling for every ranged input; one scenario per draw by probability; FX path per draw. P10 ≤ P50 ≤ P90 guaranteed. Four plans together in under 400 ms on the floor device (Web Worker).

### 3.11 Comparison

Priorities ranked separately by teen and parent: enjoying the work (fit), money by 35 (P50), safety net (P10), debt pressure, distance from home (home < other Indian city < abroad), years until first salary. Rank-order-centroid weights computed by formula (ranks 1–6 → 0.408, 0.242, 0.158, 0.103, 0.061, 0.028; tested). Fixed-range normalisation against published bounds frozen per content release. Primary view: the voyage chart (fit × P50 with P10–P90 whiskers). Teen and parent lenses side by side, never averaged.

### 3.12 Sanity limits

Flag "check inputs" if P50 NPV is outside −₹2 crore to +₹10 crore, EMI > 100% of in-hand pay, or any negative cost or pay. Never show NaN, Infinity or blanks.

### 3.13 Golden cases

About 40 spreadsheet-formula cases (independent of app code), reviewed by Anu, later by a CA: tax slab edges (₹4L, ₹8L, ₹12L, ₹12,00,001, ₹24L) in both regimes; EMI; moratorium capitalisation; 1% concession; PM-Vidyalaxmi subvention; Section 129 Old vs New; FX conversion with a fixed depreciation path; deterministic NPV per scenario (inputs at "likely"); a custom-path plan. Asserted within ±₹1 or ±0.01%.
