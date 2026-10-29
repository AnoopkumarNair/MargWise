# FIXTURE graph (tests only)

Hand-written by the frontend lane so the adult app can be built and tested before the data lane delivers `data/graph/`. The values are made up. `app/adult/build.py` uses this folder only with `--dev --fixtures` (the e2e tests), or with `--dev` when `data/graph/slices/` does not exist (run `python3 pipeline/run.py` to make it). It is never used in a release build. Regenerate with `python3 app/adult/dev/fixtures/gen_fixture.py`. The slices follow the amended slice contract (A1): they carry `near` pairs and tasks with `used`, `none` and `unknown` AI use.
