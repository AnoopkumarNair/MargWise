# S4 review: accounts and saving

Independent security, privacy and correctness review of slice S4, `git diff 2042c21..HEAD` (c6c2d18 T3.1 to 60afd36 A2), branch `ccr-4a84cc2e-h7kisr`. Reviewed on 2026-11-01 against CLAUDE.md, SPEC 8 to 10, BACKEND ADR-04/05/06/11/13/15/16/20, TEST_PLAN layers 4 and 5, and `contracts/FROZEN.md`. No code was changed.

## Checks run (all green)

- `node --test 'contracts/tests/*.test.mjs' 'hosting/tests/adult/*.test.mjs'`: 388 pass
- `node --test app/adult/tests/unit/*.test.mjs`: 73 pass
- `node hosting/tests/util.test.mjs`, `node contracts/freeze.mjs` (35 files match, A2 recorded), `node hosting/tools/check_invariants.mjs` (8 pass, 1 n/a)
- `python3 app/adult/build.py --dev`, then `node --test --test-concurrency=1 e2e/s4.test.mjs`: 8 pass. The working tree stayed clean.

## What is sound

- **Tokens.** They match ADR-20 exactly. The MAC covers the track and the key version. The pending key is derived and separate. Checks run in the stated order (shape, key version, constant-time MAC, then time). Every failure is one 401. The tester id comes only from the token. A student token never passes `/api/v1/me/*`, and an adult token never passes `checkToken` (`_util.js:17`, tested).
- **Codes.** A code is 6 digits without bias and stored only as an HMAC. A try is counted before the compare, in one conditional UPDATE, so parallel guesses cannot share the last try. A code or link is single use through a conditional DELETE. A new code voids the old one. The link token has 256 bits and only its hash is stored.
- **Turnstile fails closed.** No secret means `unavailable`, and so do a network error, a non-200 reply or a timeout. Only `success === true` passes (`turnstile.js`, `email_start.js:29-30`).
- **Under 18.** The only write is one `under18` count. No IP bucket, address or hash is stored: the refusal comes before `ipLimited` (`email_start.js:33-37`). The app refuses before it sends anything.
- **SQL.** Every new query is parameterised. The only concatenated SQL is the existing admin PATCH, whose column list is fixed.
- **Logs.** `log.js` allows only 8 fixed fields, so no handler can log a body, an address or a token. The dry-run mailer keeps messages in memory only.
- **Track isolation.** Every student, admin and counsellor query that lists or acts on testers, events or reviews now carries a track filter or rejects adults. `student_isolation.test.mjs` compares outputs byte for byte with and without an adult present. The remaining unfiltered statements (`admin.js:19` revoke, `:39` counsellor reassign, `:157-170` merge after filtered look-ups, `review.js:53-83` after the filtered `findTester`, `me.js`/`event.js` behind `checkToken`) are safe.
- **Profile PUT.** It is contract-checked with a 32 KB cap. Every graph id field (`roles.occ`, `skills.id`, `creds.id`) is checked against `ids.json`, and the write fails closed when the list cannot be loaded. `rev` uses `WHERE rev = ?` and an INSERT that does nothing when a row exists. A 409 carries the current document, and the app never merges.
- **Export and delete** cover every inventory table with `erase.key` (`account.js:16-51`). Delete runs in one batch and its audit row holds no identity.
- **The A2 amendment** is correct. The keyed hash of the address is compared with the token's hash in constant time, a mismatch is `bad_request` and the address never appears in an error. The address is stored normalised. The amendment is recorded in `amendments.json`, `FROZEN.md` and the lock, with D29 "decided by owner". The app asks for the address when the link is opened on another device.
- **Frontend.** The token lives only in localStorage under one key, never in a URL. The emailed link's token is in the fragment and `history.replaceState` removes it at once (`app.js:45-50`). `Referrer-Policy: no-referrer` applies. All data is rendered as text nodes, and `credentials: 'omit'` is set. A 401 clears the token.

## Findings, ranked

### Blockers (before any real person signs up)

**B1. Known and unknown addresses can be told apart on `email/start` while `ADULT_SIGNUP` is off.** `hosting/core/email_start.js:51-67`
- Failure: with sign-up off (the default, and the likely state once the first testers are in), a known address takes the send path and waits for `deps.email.send` (a network call to the provider). An unknown address writes a decoy row and returns at once. Anyone with one active invite code and a Turnstile pass can time `email/start` and learn whether an address has an account.
- There is also an error oracle. When the provider fails, a known address gets `unavailable` ("We could not send your code") and an unknown one gets the usual success message.
- Rule broken: ADR-13 ("the same timing path for known and unknown addresses") and SPEC 9 ("Always answer...").
- Fix: make both paths take the same time and give the same answer.
  - Send in the background with `ctx.waitUntil` (pass it through deps), so the reply never waits for the provider, and answer `ok` on both paths. Count provider errors in `email_errors` and raise a health alert.
  - Or always call a mailer: for an unknown address, call a no-op that waits about as long as the real send.
  - Add a test that the reply does not depend on `deps.email.send` resolving or throwing.

**B2. The notice says things the system does not do, and leaves out things it does.** `app/adult/notice.md:20,24`
- "Delete your account and your data, at any time. It is done at once." ADR-11 requires the notice to say that deleted data can stay in backups (D1 Time Travel and the monthly export, up to 60 days). It does not.
- "Who sees it" names only the email service. Cloudflare Turnstile sees the person's IP address and browser signals on every sign-in. Cloudflare also hosts the data. The third-party rule in CLAUDE.md needs at least the plain fact in the notice.
- The notice is a draft awaiting the owner (D39), so this does not block the merge. It does block the first real sign-up.
- Fix:
  - Add "Deleted data can stay in our backups for up to 60 days, then it is gone."
  - Add "Cloudflare, which runs the site, checks that you are a person when you ask for a code."

### Should fix

**S1. The adult purge runs only from `email/start`.** `hosting/core/email_start.js:40`; `purge.js:21`
- Failure: sessions last 31 days, so returning people rarely call `email/start`. On a day with no code requests, nothing is purged:
  - `email_codes` rows outlive 24 hours (this breaks invariant 5);
  - `email_sends` rows outlive 7 days;
  - adults past `RETENTION_DAYS_ADULT` stay, although the notice promises deletion "[[retention period]] after you join".
- Fix: call `purgeAdultDaily(deps)` once a day from every adult route, for example inside `authenticate()` or in `defineRoute` for `/api/v1/*`. It already runs at most once a day and swallows errors. Add a test that `GET /me/profile` alone triggers it.

**S2. A logged-in person is locked out when their invite expires or is switched off (D36).** `email_start.js:42-43`
- `activeAdultInvite` runs before the address is looked up, so a known address needs an active, unexpired adult invite to get a code. When the owner closes a cohort's invite, everyone in that cohort loses access to their saved data, unless they still hold a session. They can still delete through an old session, but cannot sign in to export.
- Fix (owner decision, D36 option b is the right one):
  - When the address is known, skip the invite check and use the invite only for new addresses. The answer stays the same either way, and the timing must stay equal too (see B1).
  - At minimum, let an inactive or expired adult invite still work for addresses that already have an account.

**S3. A refresh can outlive "Log out everywhere".** `hosting/core/auth.js:13-20`
- `authenticate` checks `tok_after`, then mints a refreshed token with `iat = now` at mint time.
- Failure: a request that is checked just before `logout-all` commits, and mints just after, returns a token with `iat > tok_after`. The other device keeps a valid 31-day session. The window is small but real with two tabs.
- Fix: issue the header only when a conditional UPDATE succeeds, `UPDATE testers SET key_v = ? WHERE id = ? AND track = 'adult' AND (tok_after IS NULL OR tok_after < ?)`, bound to the token's `iat`. Also mint with an `iat` read before that UPDATE.

**S4. A pending token can mint sessions after log-out-everywhere or delete, for up to 30 minutes.** `hosting/core/email_complete.js:25-26, 31-36`
- The idempotent path (`done`) mints a fresh session for anyone holding a valid pending token. It ignores `tok_after`. After `me/delete`, the same token can make the account again while the invite has uses left.
- ADR-20 accepts "need not be single use". It did not consider revocation.
- Fix: on the idempotent path, refuse (`unauthorized`) when `tok_after` is set and `tok_after >= p.iat`. Have `me/delete` and `logout-all` set the rule by time; for delete, keep a short-lived `meta` row holding the deleted email hash, or accept the risk and say so in deviations.

**S5. Data-collection text in the UI beyond the notice (owner preference, HANDOFF "Do not explain data collection in the UI").**
- `app/adult/account/flow.js:48` "We ask this first, to check your age. We do not keep the year." and `:79` "We check your age each time. We do not keep the year."
- `app/adult/account/flow.js:63` "We have not sent or saved anything." This is also wrong after a server-side `refused_age`: a count was saved, and the birth year and address were sent.
- `app/adult/screens/account.js:94` "It lists your nickname, your saved jobs and skills and your settings." This is also incomplete: the export also holds the email address, age band, invite, consent date, research choice, events and code counters.
- `app/adult/screens/welcome.js:33` now reads "...Nothing leaves your device... Nothing is stored on a server unless you make an account and choose to save." The intake privacy line must stay, but the new clause is inaccurate: making an account stores the nickname, address and age band even with no save. It also contradicts "Nothing leaves your device".
- Fix:
  - Cut the hints to the task ("The year you were born", "For example 1990").
  - Make the refusal "We cannot open an account for you." with no claim.
  - Make the account line "Download everything we keep about you, as a file."
  - Put the welcome line back as it was before S4, minus "Close the tab and it is gone", or end it at "...stays on this page unless you make an account."

**S6. The notice's purpose for the address is wrong.** `app/adult/notice.md:8`
- "Your email address, and a scrambled form of it, so you can sign in." The stored address is not used to sign in, because the person types it every time. It is kept so the keyed hash can be recomputed after a key rotation (ADR-04, inventory).
- Fix: "Your email address, and a scrambled form of it. We use them to find your account when you sign in."

**S7. People who never make an account leave keyed hashes without seeing the notice.** `email_start.js:53-58`
- Every code request writes `email_sends` rows (7 days) and an `email_codes` row (24 hours) under the keyed address hash. This includes decoys for unknown addresses while sign-up is off. These people never see the notice, and the hashes are pseudonymous personal data.
- Fix: one line on the "About this data" page, or in a short privacy page linked from the email step, saying that a scrambled form of the address is kept for 7 days to limit requests. Also make the inventory row for `email_sends` say it covers addresses with no account.

**S8. `EMAIL_DRY_RUN_PRINT` can put codes and addresses in platform logs.** `hosting/core/deps.js:45`
- With `EMAIL_DRY_RUN_PRINT=1` on preview or production (where dry run is the default on preview), every code, link and address goes to `console.log`, which is Cloudflare's log stream. D34 only says "leave it unset".
- Fix: honour the print flag only when `ENVIRONMENT` is unset or `local`, and refuse it when `isProduction(env)`, as for the other safe defaults.

**S9. The inventory text is out of date after A2 and D31.** `hosting/core/data_inventory.js:31,41`
- `testers.email` says "Filled in at the next code sign-in". Since A2 it is stored at sign-up.
- Its `who` is `['nobody']`, but the export shows it to the person.
- `joins.ip` says "Network address (as received)". Adult rows hold a keyed 16-hex hash with a prefix. This inventory text is meant to feed the notice (ADR-14).
- Fix: update the purposes. Set `email.who` to `['tester']`, and describe `joins.ip` as "a keyed hash of the network address bucket (adult) or the address (student)".

### Nits

- **N1.** `email_complete.js:26` The idempotent path does not fill `testers.email` for an account made before A2 with `email IS NULL`. The body now carries a checked address, so fill it there too, as `email_verify.js:41` does.
- **N2.** `email_start.js:61` The link origin falls back to `request.url`. Require `APP_ORIGIN` when `isProduction(env)`, so a preview alias or an unexpected Host can never end up in a sign-in email.
- **N3.** `keys.js:54` and `deps.js:24-26`:
  - `SIGN_KEY_PREV_UNTIL` unset means the old key is accepted forever. ADR-04 says 31 days. Default to refusing the previous key without an end date, or warn in `/health`.
  - `keysProblem` does not check that `SIGN_KEY_V` is 1 to 999. A value of 1000 would mint tokens that fail the regex, so everyone is logged out.
  - Rotating `SIGN_KEY` also breaks every student return code (`retHash` uses it). Add this to the runbook.
- **N4.** `turnstile.js:13` The `hostname` (and `action`) in the siteverify reply is not checked. Also refuse Cloudflare's always-pass test secret when `isProduction(env)`.
- **N5.** `limits.js:18-22`, `email_start.js:50` The IP-bucket count then insert, and the site-wide cap check then send, are not atomic. Bursts can go a little over. This is acceptable at pilot scale. Say so in D31.
- **N6.** `email_complete.js:31-36` The invite claim and the INSERT are separate statements. An INSERT that throws (not ignored) leaves a use claimed. Run them in a `batch`, or give the use back in a `catch`.
- **N7.** `metrics.js:380` `safeEqual` returns early on a length mismatch, which leaks the admin key's length. Compare HMACs of both values instead, as elsewhere.
- **N8.** `join.js:252` A student-side guess of an adult code gets a distinct message, even for an inactive or expired code, and is not counted in `joins`. Count it, and answer the generic "not right" unless the adult invite is active.
- **N9.** `email_start.js:33-37` The under-18 path is not IP-limited (only Turnstile), so `under18` counts can be inflated. This is low risk. Note it beside the metric.
- **N10.** `profile.js:51-60` If `me/delete` commits between `authenticate` and the profile INSERT, an orphan profile row is left. Invariant 6 would catch it. Add `AND EXISTS (SELECT 1 FROM testers WHERE id = ? AND track = 'adult')` to the INSERT and UPDATE.
- **N11.** `account/turnstile.js` Once loaded, Cloudflare's script stays in the page and can read the token in localStorage. D37 accepts this, but write it down in D37 or ADR-13 as an accepted risk.
- **N12.** `account/flow.js:181` The client sends `idempotency_key`. The schema allows it but the server ignores it. This is harmless; drop it or use it.

## Open owner decisions this review depends on

D30 (age gap 19), D36 (log-in without an invite: see S2), D38 (research opt-out endpoint), D39 (notice wording and the two blanks: see B2, S6).
