# Margwise — Red-Team Security Assessment

Date: 2026-10-22
Scope: Local instance only (`wrangler pages dev`, D1 schema.sql..schema9.sql, port 8801).
Production (margwise.byteheaven.in) was never touched. Attack scripts: `/tmp/rt-attacks/`.
Test secrets used: `SIGN_KEY=0123…`, `ADMIN_KEY=adminkey-1234567890`, `INVITE_CODE=pilot1`.

This is an attacker-minded assessment. The code is, on the whole, defensively written:
every DB call is parameterized, output is escaped or `textContent`, CSV is formula-guarded,
invite claims are atomic, and auth fails closed. The findings below are mostly hardening and
privacy/compliance gaps rather than direct compromises.

---

## Findings

### MEDIUM-1 — Shared IP lockout denies admin **and** all counsellors (availability)
`functions/api/admin.js:12-14` and `functions/api/review.js:10-18` share one `admin_fail`
table keyed on `ipHash(cf-connecting-ip)`. 8 failures in 15 min from an IP block **both** the
admin and every counsellor on that IP, and admin failures and counsellor failures count toward
the same counter.

Proof (same IP, 8 wrong keys, then the correct keys):
```
for i in 1..8: curl -H "x-admin-key: wrong$i" /api/admin    # seed failures
curl -H "x-admin-key: adminkey-1234567890" /api/admin
  -> {"error":"Too many wrong keys. Try again in 15 minutes."}
curl -H "x-counsellor-key: adminkey-1234567890" /api/review
  -> {"error":"Too many wrong keys. Try again in 15 minutes."}
```
Impact: a school behind shared NAT (common) self-DoSes — one person's typos, or a malicious
student on the same network, lock out the whole school's counsellors and the admin for 15 min
during a pilot. Insider/low-effort availability attack.
Fix: key the lockout on the key/account identity, not only the IP; keep separate counters for
admin vs counsellor; and let a *correct* key through (or reset the counter on success) so a
flood of bad attempts can't deny a holder of the real key.

### MEDIUM-2 — Incomplete erasure: `audit` retains withdrawn minors' identifiers
`review.js:69,83` and `_util.js:36` write student code + `consent_on` + `counsellor_id` into
`audit.detail`, and neither the counsellor `remove`, the admin `DELETE`, nor `purgeOld`
(`everything`/end-of-pilot) ever delete or redact `audit` rows.

Proof: add a student, then remove them; the tester row is gone but audit still holds them:
```
testers rows for code 4C05E3 -> "n": 0
audit rows LIKE '%4C05E3%':
  {"code":"4C05E3","counsellor_id":1,"consent_on":"2026-10-01"}   (student_added)
  {"code":"4C05E3","by":"Alice"}                                  (student_removed)
```
Impact: for minors, the "right to be forgotten" / withdrawal is not honoured — a reversible
identifier (the code is the first 6 hex of the tester id, the same handle counsellors use and
keep in their own report CSV), the consent date, and the responsible counsellor persist
indefinitely after deletion, and survive end-of-pilot wipe.
Fix: on removal, delete that student's `audit` rows too (or never store the code/`consent_on`
in audit — log an opaque counter instead); trim/purge `audit` at end-of-pilot.

### LOW-1 — `/admin/claims.json` is world-readable (61 KB internal corpus)
Served unauthenticated as a static file.
```
curl /admin/claims.json -> HTTP 200  application/json  61206 bytes
```
No student PII, but the full fact-check corpus (statements, source URLs, `risk` labels, stable
`cid`s) is internal content exposed to anyone who guesses the path. The server already reads it
via `env.ASSETS.fetch` server-side (`admin.js:78`), so it need not be public.
Fix: move the data file out of `public/` (e.g. serve it only through the key-gated API), or
accept it as published content if that is intended.

### LOW-2 — Game-page CSP allows `'unsafe-inline'` scripts
`public/_headers`: the game `/*` policy is `script-src 'self' 'unsafe-inline'`, while
`/admin/*` and `/counsellor/*` correctly use `script-src 'self'` (no inline). The game page is
the surface minors use. No reflected-injection sink exists today (names strip `<>`), but
`unsafe-inline` means any future injection on that page would execute.
Fix: move the inline game bootstrap to an external file (or nonce/hash it) and drop
`'unsafe-inline'`.

### LOW-3 — Tester tokens never expire and cannot be revoked
`event.js:33` accepts `HMAC(testerId, SIGN_KEY)` with no time or version component.
```
replaying the original join token hours later -> {"ok":true,"n":1}
```
Impact: a token leaked from a shared device's `localStorage` or the counsellor handoff grants
indefinite event-write for that tester. Low (write-only, bounded data, per-tester daily cap).
Fix: sign `testerId|issuedAt` with a max age, or add a per-tester token version that can be
bumped to invalidate.

### LOW-4 — Arbitrary/back-dated consent date accepted in `addStudent`
`review.js:66` validates only format and an upper bound (`now + 1d`).
```
addStudent consent_on=1900-01-01 -> {"ok":true,"code":"CF4107"}
```
Impact: consent records can carry implausible dates; weakens the integrity of the consent
audit for minors. (`consent=false` and far-future dates are correctly rejected.)
Fix: enforce a sensible lower bound (e.g. within the pilot window) and record who attested.

### LOW-5 — Supply chain: unpinned Actions + broad token on data-refresh
`.github/workflows/*`: all actions are pinned to mutable tags, not commit SHAs. `data-refresh`
runs the third-party `peter-evans/create-pull-request@v6` with `contents: write` +
`pull-requests: write` and processes freshly fetched external data. `build-check` declares no
`permissions` block (inherits the repo default). The workflow does not auto-merge (it opens a
`needs-review` PR), which limits impact.
Fix: pin every action to a full commit SHA; add `permissions: contents: read` to `build-check`;
keep the human-review gate on data-refresh.

### INFO — D1 `database_id` committed in `wrangler.toml`
Not a credential on its own (access still requires Cloudflare account auth), but it identifies
the resource. Low concern; note for completeness.

### INFO — Admin/counsellor SPA pages are public; no true 404
`/admin/`, `/admin/admin.js`, `/counsellor/` return 200 (normal — keys are entered client-side
and the API enforces auth). Unknown paths return `index.html` with HTTP 200 (SPA fallback),
so there is no real 404; cosmetic only.

---

## Attacks that FAILED (controls that held)

- **No-key / wrong-key access** to `/api/admin`, `/api/review`, `/api/event` → `403 Not allowed`
  (admin key in URL query also rejected; header-only).
- **Forged / empty tester token** → `403`. `event` requires a valid HMAC *and* that the tester
  row exists.
- **SQL injection** via `name`, `testerId`, counsellor `code`, and JSON fields → all
  parameterized; `'; DROP TABLE testers;--` stored as a literal name, no effect.
- **Cross-school IDOR**: SchoolB counsellor reading a SchoolA student by code → `404` (the
  `visible()` check enforces same-school + ownership). Cross-counsellor review takeover → `403`.
- **Invite race vs max_uses**: 12 concurrent joins against `max_uses=2` → exactly 2 succeeded,
  `uses=2`. The atomic `UPDATE … WHERE uses < max_uses` prevents overshoot.
- **Prototype pollution** via `__proto__` in the JSON body → no global pollution; validators
  build fresh objects and reject non-plain / array bodies.
- **Stored XSS** via feedback text / name: `join`/`clean` strip `<>`; the admin page escapes
  every value with `esc()`; the counsellor page uses `textContent` only; `/admin` and
  `/counsellor` CSP is `default-src 'none'; script-src 'self'` (no inline) → injected markup is
  inert even if it reached the DOM.
- **CSV formula injection**: a student named `=cmd|calc!A1` exports as `'=cmd|calc!A1`
  (apostrophe-prefixed) in both the server (`admin.js`/`review.js` `csvCell`) and client CSV.
- **Oversized body** → `413 Too large`; **malformed JSON** → `400 Bad request`; no stack traces
  or file paths in any error response.
- **Server source exposure**: `/wrangler.toml`, `/api/_util.js`, `/.gitignore`,
  `/functionsWorker-*.map` all return the SPA `index.html`, not file contents — server code and
  config are not served.
- **Secrets**: none in tracked files, none added in git history; no hardcoded keys (all via
  `env.*`). No external scripts/fonts (GSAP + fonts vendored); `connect-src 'self'`.
- **Consent gates**: `consent=false` and far-future dates rejected; follow-up save blocked
  unless `followup_ok` is set.
- **Clickjacking**: `X-Frame-Options: DENY` + `frame-ancestors 'none'` on every path.

---

## Could NOT be tested here (production-only controls)

- **`cf-connecting-ip` spoofing**: locally the header is honoured, so the per-IP join cap
  (40/hr) and the lockout can be bypassed by varying it (confirmed locally). In production
  Cloudflare overwrites `cf-connecting-ip` at the edge (the Pages bundle includes
  `strip-cf-connecting-ip-header`), so real-world effectiveness depends on the CF edge and is
  not testable off-platform. The rate-limit/lockout design is only as strong as that edge
  behaviour — worth confirming on the live deployment.
- Cloudflare WAF, edge rate-limiting and bot protection.
- Real strength and storage of `ADMIN_KEY` / `SIGN_KEY` (Cloudflare dashboard secrets; test
  placeholders were used).
- Whether `.wrangler/` build artifacts/source maps are reachable on the deployed site (CF Pages
  does not serve them; confirmed inert locally).
- Repo-level GitHub settings: default `GITHUB_TOKEN` permissions and the "Allow Actions to
  create and approve PRs" toggle that data-refresh depends on.
