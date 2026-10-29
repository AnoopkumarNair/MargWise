# Golden cases, matcher 1.0.0 (slice S1)

For the owner to read (BUILD_PLAN T2.4). Each row is a made-up person run against a hand-built test slice. The slices are test fixtures, not real data: the weights and AI shares are invented to exercise the rules.

How to read it:

- **Level** is the person's level from 1 to 6 (SPEC 7.2): total years, plus 1 for leading 6 or more people or owning a budget.
- **Roads** are in the order the app would show them, with the reach and the coverage (the share of the target's skill needs the person already has).
- **Reach:** adjacent is 0.70 or more, stretch is 0.40 to 0.70, leap is under 0.40. The app hides leaps behind "show leaps".
- **Order** uses the default sliders (pay, AI safety, short move and demand all at 1) unless the case says otherwise. Pay and demand are "not yet measured", so they are equal for every road and do not change the order. In S1 the order comes from coverage and AI safety (1 minus the observed AI use).
- **Flags** are empty in every case. The S1 slices carry no city, pay or study-hours data, so no flag can be raised yet.

| Case | Family | Person | Level | Roads (reach, coverage) |
| --- | --- | --- | --- | --- |
| acc-core | Business and financial (13-) | Accountant, 5-8 years in BFSI, strong in accounting, Excel and Tally | 3 | 1. Budget Analysts — adjacent 0.71<br>2. Credit Analysts — stretch 0.68<br>3. Financial and Investment Analysts — stretch 0.66<br>4. Treasurers and Controllers — leap 0.24<br>5. Bookkeeping, Accounting, and Auditing Clerks — adjacent 0.77<br>6. Data Scientists — leap 0.16 |
| acc-rusty | Business and financial (13-) | Accountant, 8-12 years, leads 6-20; most skills last used 2018-2019 (rusty) | 5 | 1. Budget Analysts — stretch 0.46<br>2. Credit Analysts — stretch 0.45<br>3. Financial and Investment Analysts — stretch 0.50<br>4. Treasurers and Controllers — leap 0.10<br>5. Bookkeeping, Accounting, and Auditing Clerks — stretch 0.47<br>6. Data Scientists — leap 0.13 |
| swdev-data | Computer and mathematical (15-) | Software developer, 2-5 years in IT, Java and Python | 2 | 1. Data Scientists — stretch 0.53<br>2. Database Administrators — stretch 0.67<br>3. Computer and Information Systems Managers — leap 0.20<br>4. Computer Systems Analysts — stretch 0.49<br>5. Software Quality Assurance Analysts and Testers — leap 0.38<br>6. LLM Evaluation Specialist (new role) — leap 0.12 |
| swdev-qa-near | Computer and mathematical (15-) | Tester on a developer slice: strong quality control and Selenium, no LLM evaluation | 3 | 1. Software Quality Assurance Analysts and Testers — adjacent 0.71<br>2. Computer and Information Systems Managers — leap 0.00<br>3. Data Scientists — leap 0.22<br>4. Computer Systems Analysts — leap 0.23<br>5. LLM Evaluation Specialist (new role) — stretch 0.44<br>6. Database Administrators — leap 0.11 |
| csr-voice | Office and administrative support (43-) | Customer service, voice process, 2-5 years in BPM | 2 | 1. Sales Representatives of Services — stretch 0.55<br>2. First-Line Supervisors of Office and Administrative Support Workers — leap 0.32<br>3. Computer User Support Specialists — stretch 0.44<br>4. Office Clerks, General — stretch 0.62<br>5. Training and Development Specialists — leap 0.21 |
| csr-creds | Office and administrative support (43-) | Customer service, 5-8 years, ITIL 4 (valid) and COPC (expired 2023) | 3 | 1. First-Line Supervisors of Office and Administrative Support Workers — stretch 0.59<br>2. Computer User Support Specialists — adjacent 0.76<br>3. Sales Representatives of Services — stretch 0.42<br>4. Training and Development Specialists — leap 0.21<br>5. Office Clerks, General — leap 0.21 |
| nurse-core | Healthcare practitioners (29-) | Registered nurse, 8-12 years | 4 | 1. Nurse Practitioners — adjacent 0.74<br>2. Nursing Instructors and Teachers, Postsecondary — stretch 0.40<br>3. Health Education Specialists — leap 0.33<br>4. Medical and Health Services Managers — leap 0.18<br>5. Health Information Technologists and Medical Registrars — leap 0.39 |
| nurse-lead-short | Healthcare practitioners (29-) | Senior nurse, 14+ years, leads 6-20; cares only about a short move | 6 | 1. Nursing Instructors and Teachers, Postsecondary — adjacent 0.88<br>2. Health Education Specialists — adjacent 0.85<br>3. Medical and Health Services Managers — stretch 0.52<br>4. Nurse Practitioners — stretch 0.44<br>5. Health Information Technologists and Medical Registrars — leap 0.20 |

What each case shows:

- **acc-rusty:** skills last used more than 3 years ago count as rusty (0.4), so every road drops a band compared with acc-core. Excel is rated strong, so it keeps full credit.
- **swdev-qa-near:** the person has no LLM evaluation skill, but has the nearby quality control skill. near() credits it at 0.35, which lifts the LLM Evaluation Specialist road from a leap (0.35) to a stretch (0.44).
- **csr-creds:** ITIL 4 is valid, so it credits ServiceNow, computers and problem solving at 0.7. COPC expired in 2023, so its skills count 0.4. The person rated coordination strong, and their own rating wins.
- **nurse-lead-short:** only the short-move slider is on, so the roads are in coverage order. The enjoy slider is ignored, because the interest walk was not taken.

**Please check one thing.** With the default sliders, AI safety counts as much as coverage. So a road with low coverage but low AI use can come before a closer road. In swdev-qa-near, a manager road with coverage 0.00 is second. In acc-core, Bookkeeping (adjacent, 0.77) is fifth because AI already does much of that work. This is what SPEC 7.3 says. Leaps are hidden by default, so on screen the person sees the adjacent and stretch roads first. Is this the order you want?
