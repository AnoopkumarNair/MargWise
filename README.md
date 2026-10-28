# Margwise

**Light your way.** A story game that helps Indian students and their parents find the careers worth exploring, using real, current, sourced data instead of guesses.

> Early test version. Live for named testers at margwise.byteheaven.in. An interest guide, not a test of ability, and not a prediction.

## The problem

In Class 9 and 10, a family makes the biggest education decision of a child's life, often on a neighbour's advice and a few outdated web pages. Most career tests feel like exams, give one vague label, and ignore what happens after school: which exam, which degree, what the job pays, and what AI is doing to it.

## What Margwise does

A student walks a lamp-lit road at night. In each town they spend two flasks of oil on the activity they would enjoy most. There are no marks and no wrong answers. Along the way they open a few "lamp locks", short puzzles that quietly add a rough signal about strengths. In about 15 minutes they get:

- **Their interest shape**: six interest areas on a radar chart, with an honest note when the shape is unclear.
- **16 career fields, ranked for them**, each with careers to look at and why they fit.
- **A real path for each field**: the Class 11 and 12 subjects for CBSE, ICSE/ISC or a state board, the entrance exams, the degree, a plan B if the first route does not work, and how to compare colleges.
- **What the work pays and where it is heading**: US median pay and 2025 to 2035 projected job change from BLS, and India pay bands from the Periodic Labour Force Survey.
- **How AI is changing the job.** Careers with high AI exposure are flagged, with the tasks where AI is already used today and the tasks where no AI use has been seen yet. The level comes from the U.S. Bureau of Labor Statistics' 2026 AI exposure categories, which combine five studies. Real use comes from the Anthropic Economic Index. The app says plainly that exposure is relative and not a forecast of job loss.
- **Studying and working abroad**, inside each field: two routes (bachelor's and master's abroad, or bachelor's in India and master's abroad) across eight countries, with costs, scholarships and settling rules, each figure marked official, secondary or estimate.
- **A one-page summary for parents** to read together, save or print.

## Why it is different

**The architecture is the product.** Career advice goes stale: exam rules, fees, visas and the effect of AI all change every few months. Margwise is built so that updating it is a routine, not a rewrite.

| What | How |
| --- | --- |
| Facts are data, not copy | Careers, exams, pay, AI exposure and abroad costs live in structured files with a source, a licence, a trust level and a refresh cadence for every item (`data/sources.yaml`). |
| One key joins everything | Every career carries a SOC code, so each new dataset attaches automatically. Adding a career is one line. |
| Updates are a command | `python3 pipeline/run.py --fetch` re-reads the public sources, rebuilds, validates and writes a change report. A weekly job can open the pull request for you. |
| Bad data cannot ship | A quality gate checks ranges, sources, freshness and consistency. The first run already caught two real defects. |
| Review without exposure | Facts are checked as single, shuffled tasks with random ids, so reviewers never see the product, the scoring or a whole field. Their answers load back into a report. |
| Honest by construction | Every figure shows how trustworthy it is. Flat or one-note walks are flagged instead of dressed up as results. |
| Fast and cheap to run | The game is one static page with the knowledge base inside it. No database is needed to play. |

Read the full design in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Who it is for

- **Students, Class 9 to 12**, who want to explore without being tested.
- **Parents**, who get a plain summary, real numbers and questions to ask.
- **Schools and counsellors**, who can run a controlled group with labelled invite codes and see which group each tester came from, with results and feedback.

## Status, honestly

- Live as a controlled test for named adult testers. Not yet cleared for Class 9 to 12 students.
- The interest model is not yet validated against an established inventory. The plan is in [docs/CALIBRATION.md](docs/CALIBRATION.md).
- Interest fit uses US O*NET profiles. India pay is a broad group average. AI exposure is US-based. All of this is stated in the app.
- Verifiable parental consent and regional languages are not built yet. Automatic deletion is built but switched off (see docs/ARCHITECTURE.md).

## Try it and run it

```bash
# rebuild the knowledge base offline from the committed snapshots
python3 pipeline/run.py

# re-read the live public sources first
python3 pipeline/run.py --fetch

# build the game (needs: pip install pillow)
python3 app/build.py

# deploy the hosted test build (needs Cloudflare credentials)
npx wrangler pages deploy hosting/public --project-name margwise
```

## Repository map

| Folder | Contents |
| --- | --- |
| `app/` | The game page, its art, the build script and test scripts |
| `data/` | Raw snapshots, curated content, the source registry, schemas, releases |
| `pipeline/` | The runner, the quality gate and the change report |
| `hosting/` | Cloudflare Pages Functions (tester API), database schema, admin page |
| `docs/` | Architecture, calibration plan, review process, art brief, adult track plan and workflows, AI layer design, career graph, skills intake, matching |

## Data sources and credits

- O*NET OnLine, U.S. Department of Labor, Employment and Training Administration (CC BY 4.0). Margwise has modified this information. USDOL/ETA has not approved, endorsed or tested these modifications. O*NET® is a trademark of USDOL/ETA.
- Anthropic Economic Index, observed exposure and task data (CC BY).
- U.S. Bureau of Labor Statistics, AI exposure categories and 2025 to 2035 employment projections (August 2026).
- Periodic Labour Force Survey 2025 (MoSPI), via the India Labour Observatory tables.
- Exam bodies, NIRF, and official education and immigration pages for the abroad view. Each is linked where it is used.
