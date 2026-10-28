# Matching: the user model, the job model and levels

Status on 28 Oct 2026: design only. Nothing below is built. It sits between `SKILLS_INTAKE.md` (how the user model is filled) and `CAREER_GRAPH.md` (where the job model comes from).

## Three parts

| Part | What it is | Who builds it | Changes |
| --- | --- | --- | --- |
| **Job model** | For each occupation and level: weighted skills, tools, typical years, pay band, demand trend, AI exposure, bridges | Pipelines A and B | Every release. Each release has an id |
| **User model** | For one person: roles, skills with strength and recency, level, constraints, priorities, the optional interest profile | The person, through intake and a few questions | When the person edits it |
| **Matcher** | A fixed, written-down scoring function that compares the two and returns roads | Code, versioned like the engine | Only by a reviewed change |

**Every result records the job-model release id and the matcher version.** That makes results reproducible, and lets "What changed for your roads" say why a road moved: new demand data, a new skill weight, or a matcher change.

The matcher has no machine learning at first. It is arithmetic anyone can check. Learned weights come only after confirmed outcomes exist (see the learning loop in `CAREER_GRAPH.md`), and only as a separate version tested against the fixed one.

## Levels: same level, next level, or a change

A working adult's first question is often "what is my next step up?", not "what else could I do?". The graph therefore needs a level axis as well as the skill links.

**Where levels come from:**

- **O*NET Job Zones** (1 to 5): how much preparation an occupation needs. A coarse level per occupation.
- **Indian postings** (Pipeline A): seniority words in titles (Associate, Senior, Lead, Manager, Principal, Head, Director, VP) and stated experience ranges ("5 to 8 years"). Together these give, for each occupation, a **ladder of levels** with typical years and the skills that grow at each step (for example, "people management" and "budget ownership" appear at Manager).
- **A small hand-checked table of common Indian ladders** for the founder's industries first, for example IT services: Associate, Senior Associate, Lead, Manager, Senior Manager, AVP.

**The person's level** is estimated from:

- total years and years in the current role (from the resume dates);
- the current title's seniority word;
- leadership signals the person confirms: "I manage people (how many)", "I own a budget", "I am the go-to expert".

The person can correct it. It is shown as a band, never a verdict.

**Kinds of road**, each labelled honestly:

| Road | What it means | Example |
| --- | --- | --- |
| **Up** | Same family, next level | Senior Analyst to Lead Analyst |
| **Across** | Different family, same level | Lead Analyst to Product Owner |
| **Diagonal** | Different family, one level up | Lead Analyst to Product Manager |
| **Reset** | A change that usually starts a level lower | Finance Manager to Junior Data Scientist |
| **Fork** | The specialist or the manager track from here | Senior Engineer to Principal Engineer, or to Engineering Manager |

The label comes from postings data where it exists ("most people moving into this role from yours start at Associate level") and from the ladder table otherwise. Saying "this is usually a reset" up front is one of the most useful honest things the product can do.

**Experience fit.** Each road shows where the person sits against the typical years for the target level: below range, in range or above range. "Above range" is shown too, because it is a sign to look one level up.

## The user model

Everything is stored as ids and bands, never free text. Covered by "See what you keep" and "Delete my data".

| Part | Content | From |
| --- | --- | --- |
| Roles | Occupation id, level band, industry, years band, current yes or no | Intake |
| Skills | Skill id, strength (used, strong, rusty), last-used year | Intake confirm screen |
| Credentials | Credential id, year | Intake |
| Leadership | Manages people (band), owns budget (yes or no), go-to expert (yes or no) | 3 taps |
| **Constraints** | Monthly hours for study, budget for courses (band), open to relocating (no, within India, abroad), lowest acceptable pay change, work mode | 6 quick questions, about 1 minute |
| **Priorities** | Slider weights: pay, staying safe from AI, a short move, demand, enjoyment | Sliders, equal by default |
| Interest profile | The six interest scores, if the walk was taken | The optional walk |

**Constraints filter and priorities order.**

- A road needing 18 months of study is marked "outside your time" for someone with 5 hours a month. It is not hidden.
- A road that pays less than the person's floor is marked the same way.

The constraints are the questions adults actually need to answer. They are short and they change the result.

## Do adults need to answer the interest questions?

No. For working adults the walk is an optional lens, labelled "Would you enjoy it?". It measures what someone likes doing, not whether they are good at it or would be hired.

**What it adds:**

- **"Does your current job fit what you enjoy?"** The walk's profile is compared with the current occupation's O*NET interest profile. A low fit is often the real reason someone wants to move, and naming it helps.
- **An "enjoy" score on every road,** used only if the person turns that slider up.

**What it must not claim:** "you are a good fit for this job" in a hiring sense. That is the employment-assessment line in the guardrails. The product compares a person's own skills with a job's typical needs, so the person can plan. It never rates a person for an employer.

## The matcher, written down (version 1)

For a person P and a target occupation-level T:

1. **Coverage.** The sum of T's skill weights covered by P, divided by the sum of all T's weights.
   - A skill rated strong counts fully, used counts 0.7 and rusty counts 0.4.
   - A close skill counts 0.5 times its link strength.
   - Weights are O*NET importance and ESCO "essential", multiplied by the posting frequency in India where known.
2. **Gap.** The uncovered skills, ordered by weight, then by rising demand.
3. **Level relation.** Up, across, diagonal, reset or fork, plus experience fit.
4. **Bridge cost.** The smallest set of credentials covering the most gap weight, as hours and rupees from the official pages.
5. **Signals.** Pay change, demand trend and AI exposure, from Pipeline B.
6. **Constraint flags.** Time, budget, pay floor, relocation.
7. **Order.** A weighted sum of normalised components using P's priority sliders. The components are shown next to every road, so the order can always be explained.

**Not in version 1:** anything learned from clicks. Learned weights come only from confirmed outcomes, as a separately tested version.

**Tests.** Fixed sample people with known answers, the way `engine/reference.py` checks the engine today. CI fails if a matcher change moves any sample road without the version number changing.

## ATS: parsing, and a score with an honest name

1. **ATS-style resume parsing.** This is what `SKILLS_INTAKE.md` already does: sections, roles, dates and skills, in the browser.
   - Commercial parsers (Affinda, Textkernel and others) would require sending the resume to their servers, which breaks the on-device promise.
   - OpenResume has a browser parser, but its AGPL-3.0 licence would oblige us to publish all of Margwise's source code.
   - So write our own on pdf.js (Apache-2.0) and mammoth.js (BSD-2-Clause).
2. **A score, yes, named for what it measures.** There is no single "ATS score". Each employer's system (Workday, SuccessFactors, Taleo, Greenhouse, Naukri RMS and others) reads and filters differently, and most rank by the recruiter's own filters. A number labelled "ATS score" would claim knowledge of employers' systems that nobody outside them has. That is a misleading claim, and it pushes people to stuff keywords. So show two scores we can define and defend, for a role the person picks:

   - **Readability, out of 6.** Could a standard parser find:
     - the contact block;
     - the role titles;
     - the dates;
     - the sections, as one column or separable columns;
     - text that is real text rather than an image;
     - a file under 2 MB?

     Each failed check says how to fix it.
   - **Role match, 0 to 100 percent.** The share of the role's most-asked skills in Indian postings that the resume visibly mentions, weighted by how often postings ask for each. It lists the missing ones and marks which of them the person actually has (from the confirm screen). The advice is to show real skills more clearly, never to add skills they lack.

   The screen may be titled "ATS readiness check" as long as both definitions sit beside the numbers, with the line: "Employers' systems differ. This checks what most of them need, not how any one employer ranks you." Build it after the roads view.

## "Predict" versus "measure"

Pipelines **measure**: what postings ask for, how that changed over months, what official projections say. A trend from history is labelled as a trend ("rising for 4 months"). A forecast appears only when it comes from an official source with its own method, such as BLS 10-year projections.

Margwise does not publish its own predictions until it can test them against what later happened. The data to test them builds up automatically, because every month's signals are kept.

## Data changes (adds to ADULT_WORKFLOWS section 12)

- **`profiles` table:** one row per adult tester, a JSON column with the user model (ids and bands only), `job_release`, `matcher_version` and `updated_at`.
- **`results` event:** the top roads, with their components, the job release and the matcher version.
- **Migration:** a new migration file, with nullable columns only. Student testers are untouched.
