# Margwise: notes for coding sessions

Margwise has two products on one codebase:

- **The student game:** a static page (`app/night-of-lamps.html`) with the knowledge base embedded.
- **The adult app:** in design and being built, at `/work/`. Its source of truth is `docs/adult/SPEC.md`, the slices and tickets are in `docs/adult/BUILD_PLAN.md`, the tests are in `docs/adult/TEST_PLAN.md`, the backend decisions are in `docs/adult/BACKEND.md`, and how agents work together is in `docs/adult/DELIVERY.md`. Older adult design docs explain the reasoning but are superseded where they differ.

## Commands

```bash
python3 pipeline/run.py              # offline rebuild + quality gate (must pass, must not change committed data)
python3 pipeline/run.py --fetch      # re-read public sources (network)
python3 pipeline/run.py --accept     # owner only: promote a reviewed build to data/releases/
python3 app/build.py                 # build the student game from the accepted release (needs pillow)
python3 engine/reference.py          # engine bundle vs independent Python reference
node --test engine/tests/engine.test.mjs engine/tests/design.test.mjs
node hosting/tests/util.test.mjs
npx wrangler pages dev hosting/public  # local server for pages + functions
```

CI (`.github/workflows/build-check.yml`) runs all of these and fails if a rebuild changes committed data.

## Rules

- **Never deploy, never apply SQL to the live D1 database, never push to `main`.** The owner does releases.
- **Facts are data with a source.** Every fact carries a source, a trust level (`official`, `secondary`, `estimate`, `observed`) and a date. Never write a fact into code or copy without one.
- **The scoring engine (`engine/`) and the adult matcher (`matcher/`) are deterministic and versioned.** Change behaviour only together with the version number and the golden tests.
- **Privacy.**
  - Minimum data; parameterised SQL only.
  - No personal data to any free AI tier or third party.
  - Resumes are processed in the browser, and only confirmed ids are stored.
- **No scraping of sites whose terms forbid it** (LinkedIn, Indeed, Naukri pages).
- **Independence.** No commission or referral fields anywhere near ranking.
- **Style.** Match the surrounding code: plain Python scripts, small ES modules, no frameworks, no bundler. Vendor browser libraries into `hosting/public/vendor/` (strict CSP, no CDNs).
- **Writing.** User-facing and documentation text: plain, short, active sentences; no jargon; say what the data is and is not.
