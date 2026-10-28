# Adult track (18+): plan

Status on 28 Oct 2026: plan only. Nothing below is built.

Purpose: a real product for adults making their own decision, not a stand-in for the school product. It gives reach and feedback now, without the verifiable parental consent that blocks Class 9 to 12. Adult results are never used as evidence about adolescents (see PILOT_PLAN, "What the pilot must not claim").

## Decisions taken

| Question | Decision |
| --- | --- |
| What adults are for | Users in their own right, deciding their own next step |
| Who | (B) working professionals first: switching or reskilling, often because of AI. (A) college students and recent graduates, 18 to 24, second |
| Format | Both: the story walk, or a quick mode on the same engine. The user picks at the start |
| First users | The founder's network first, verified personally; then parents through schools, online communities and, for graduates, college career cells |

## Order of work (changed 28 Oct 2026: professionals first)

The owner chose working professionals as the first segment: they are the founder's own league, the founder can verify each tester personally, and the founder can judge whether the content is right for them. Graduates move to second place.

1. **Shared core first.** Verified email sign-in, age gate, adult notice, track flag, quick mode, adult result page. Every later step needs these.
2. **Professionals (B) second.** The first users are invited from the founder's network, one labelled code per circle (for example former colleagues, LinkedIn, parents through schools). Build the from-where-you-are path in two layers:
   - **data first:** related occupations, skills and knowledge from O*NET joined on the SOC code, and the AI exposure of the current job next to each target. All of this comes from public data and is cheap;
   - **India reskilling routes second:** hand-written, sourced and fact-checked. This is the expensive part, and the one place where AI drafting helps (see `docs/AI_LAYER.md`).
3. **Graduates (A) third,** after professionals meet the rules below. Their `after_degree` content is separate work.

For professionals, quick mode is the default and the story is offered as an option (see ADULT_WORKFLOWS sections 4 and 6).

## Regulatory guardrails (adults only removes the minors problem)

Going 18+ removes verifiable parental consent and the ban on tracking and behavioural monitoring of children under the DPDP Act 2023 and DPDP Rules 2025. Everything else still applies. Get one hour of review from a lawyer who knows DPDP before any public link goes out.

| Duty | What we do | Built? |
| --- | --- | --- |
| Adults only | Ask for birth year; refuse under 18 with a kind message; store only an age band (18 to 24, 25 to 34, 35 to 44, 45+), not the year. Do not promote the adult track in schools to students or to first-year students (many are 17). Delete any account later found to belong to a minor | No |
| Notice and consent | A separate adult sign-up notice: what is kept (now including the email address), why, for how long, how to delete, whom to contact. Plain English | Partly (tester notice exists) |
| Verified email | Adults sign up and log in with a verified email (one-time code or link). Used only for sign-in and, with research consent, one retest invite. Never shown in full to staff, never to colleges. It verifies the inbox, not the age | No |
| Purpose limitation | Self-exploration and product improvement only. No sale or sharing of data, no college or placement referral income | Yes, by policy |
| Retention | Turn on automatic deletion (`RETENTION_DAYS`) for the adult track from day one | Built, switched off |
| Erasure and grievance | Self-service "delete my data" plus a named contact for complaints | Admin delete only |
| Breach | A written breach response: who decides, and how the Data Protection Board and affected users are told | No |
| Research use | Separate, optional consent for the calibration study (taking a second inventory, a retest invite). Saying no changes nothing else | No |
| Honest claims | No "perfect career", "scientifically proven" or "guaranteed". "Areas to explore" until the calibration evidence exists (Consumer Protection Act, CCPA guidelines on misleading advertisements) | Yes, wording already follows this |
| Not a hiring tool | Terms say results are for the person only. No employer accounts, no bulk screening. Hiring use would make this an employment assessment, with fairness duties and, for EU users, high-risk rules under the EU AI Act | No (terms text needed) |

## Phase 1: shared core (about 3 weeks)

- **Track flag.** `testers.track` (`student` or `adult`) and `testers.age_band`, set at sign-up and carried in every `snapshot` event. Invite codes carry a track, so a career-cell code can only create adult testers.
- **Age gate and adult notice** on the sign-in page for adult codes and the adult self-signup link.
- **Quick mode.** The same 60 cards and the same engine, in plain neutral wording, with no story, art or cost clause, on one screen per place. The neutral wording is the one the think-aloud protocol already needs, so it is written once and used twice. Target time: 8 minutes or less.
- **Story mode for adults.** The same walk, with adult framing for the intro and Ila's lines where they say "school". No changes to scored text.
- **Instrument versions.** Quick and story modes are treated as two instrument versions, `walk-story` and `walk-quick`, recorded in each snapshot. Their profiles are not pooled until data shows they agree. This comparison is itself useful: it measures how much the story shifts choices.
- **Adult result page.** Hide Class 11 and 12 subjects, boards and school entrance exams. Show the path section for the user's track (phase 2 and 3 content).
- **Feedback.** After the result: "sounds like me" (1 to 5), "one thing you will do next" (free text), "would you send this to a friend" (yes or no), and which mode they chose.

## Phase 2: graduates (after professionals; about 3 weeks)

- **Content.** For each of the 16 fields, an `after_degree` block in `data/content.py`, with the same source, trust and refresh rules as every other fact:
  - postgraduate routes and their entrance exams (for example CAT, GATE, JAM, CUET-PG, NEET-PG, CLAT-PG, UGC-NET, NID and NIFT master's);
  - first-job routes and entry roles in India;
  - certifications that employers actually ask for;
  - a plan B.
- **Abroad.** Lead with the existing master's-abroad route.
- **Fact checks.** The new statements go through the existing shuffled-task review before release. No unreviewed `after_degree` text ships.
- **Calibration.** Adults who opt in also take the O*NET Interest Profiler short form (check its terms of use first). That runs CALIBRATION.md step 2 on adults, the population the Profiler was built for. Invite a sample of them to a retest after 2 to 3 weeks (step 3). Report intervals, as CALIBRATION.md already requires.
- **Channel.** Two or three college career cells with labelled invite codes (final-year and postgraduate students, not first years), plus the founder's network and online communities, each with its own code so sources can be compared.

## Phase 3: professionals (now built second, straight after phase 1; about 4 to 6 weeks)

- **New input.** Current job, picked from the existing career list (SOC code) or "not listed", plus years of experience as a band.
- **From where you are.** For each top field, how close it is to the current job, using O*NET skills, knowledge and related-occupation data joined on the SOC code that every career already carries. Show the gap as skills to build, not as a score of the person.
- **AI, side by side.** The AI exposure of the current job next to each target, using the existing layer, with the same "relative, not a forecast" wording.
- **Reskilling routes.** Part-time and online degrees, certifications and lateral moves, all with sources, through the existing fact-check before release.
- **Channel.** Parents through schools first, then the founder's network and LinkedIn.

## Frozen decision rules (set before data, changed only in a written next version)

| Measure | Rule |
| --- | --- |
| Completion | At least 70 percent finish; the median is 20 minutes or less in story mode and 8 minutes or less in quick mode |
| Sounds like me | At least 60 percent answer 4 or 5 |
| Next step | At least 70 percent write a concrete next step |
| Reach | At least 15 percent say they would send it to a friend; track the invite source of each sign-up |
| Mode | Record how many pick story or quick mode by segment and age band. If one mode is under 15 percent for a segment after 100 users, consider dropping it for that segment |
| Content | Zero unresolved critical or high-impact errors in the `after_degree` and reskilling text |
| Gate to graduates | The professional track meets the rules above with at least 100 users from at least two circles |

## Kill or change criteria

- If under 40 percent of graduates answer "sounds like me" with 4 or 5 after the wording fixes, stop and fix the instrument before adding segments.
- If no career cell agrees to a free pilot after 10 approaches, career cells are not the channel; rely on the network and communities, and revisit.
- If the professional content cannot be fact-checked at a cost the business can carry (see PRICING_AND_MARKET), keep professionals to the interest result plus AI exposure, without reskilling routes.

## What the adult track must not claim or do

- That adult results show anything about Class 9 to 12 students.
- That the tool picks the right career, predicts success or rates a person for an employer.
- Accept users under 18, or be shown to students through schools.
- Pool story-mode and quick-mode profiles before checking that they agree.

## Open questions for the owner

1. Price: free for individuals with career cells paying, or free everywhere for the first 500 users?
2. Who fact-checks the `after_degree` content: the same reviewers, or someone who knows postgraduate admissions?
3. Is the story's tone right for over-25s? Plan a five-person check from the founder's network before the first invites.
