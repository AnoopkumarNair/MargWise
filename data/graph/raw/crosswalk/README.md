# Crosswalks (T1.2): not fetched this round

Status: **blocked-host**. Nothing here is real data yet.

- SOC 2018 to SOC 2010, and SOC 2010 to ISCO-08, are BLS files (bls.gov/soc/soccrosswalks.htm). On 2026-10-29 `www.bls.gov` answered 403 to requests from the build environment: the proxy connected, and the BLS server refused the request (deviations D18, item 5). The files were not fetched.
- NCO-2015 to ISCO-08 has no official source yet (BUILD_PLAN T1.2: ask the owner).

What this means for the graph:

- `occupation.attrs` has no `isco` key. The graph build, checks and exports work without it.
- The slice field `occ.isco` is left out. PLFS pay (`pay_band_in`) waits for S2.

When the files can be read: put them in this folder, record the URLs, dates and the "chained and approximate" note in a `SOURCE.md` here, register them in `data/sources.yaml`, and add the join to `build_graph.py`.
