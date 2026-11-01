# S4 demo: accounts and saving (8 minutes)

What slice S4 shows: a working adult can use Margwise with no account, or make one (age first, email code or link, nickname, notice), save the profile, log in on another device, fix a clash between two devices, download everything we keep, delete it, and log out everywhere. This is a test build (`dev-unaccepted`), never deployed. No email is sent: the code is printed in the terminal.

## Set up (once)

```bash
python3 pipeline/run.py                 # career graph and job files, offline
python3 app/adult/build.py --dev        # builds /work/
cd hosting
# a local database with the migrations (local only, never remote)
npx wrangler@4 d1 migrations apply DB --local
npx wrangler@4 d1 execute DB --local --command "INSERT INTO invites (code,label,created_at,track,active) VALUES ('demo1','demo',strftime('%s','now')*1000,'adult',1)"
# keys are test values; EMAIL_DRY_RUN_PRINT prints the code and link here; Cloudflare's test secret for Turnstile always passes
npx wrangler@4 pages dev public --d1 DB \
  -b SIGN_KEY=local-sign-key-0123456789abcdef0123 -b EMAIL_KEY=local-email-key-0123456789abcdef01 -b CODE_KEY=local-code-key-0123456789abcdef012 \
  -b IP_KEY=local-ip-key-0123456789abcdef01234567 -b TURNSTILE_SECRET=1x0000000000000000000000000000000AA \
  -b EMAIL_FROM=hello@margwise.test -b ADULT_SIGNUP=1 -b EMAIL_DRY_RUN=1 -b EMAIL_DRY_RUN_PRINT=1 -b RELEASE_ID=dev-unaccepted
# open http://localhost:8788/work/?c=demo1
```

A `--dev` build has no human-check widget (no `TURNSTILE_SITEKEY`), so the page sends a placeholder; the test secret accepts it. To see the real widget, build with `TURNSTILE_SITEKEY=1x00000000000000000000AA` (Cloudflare's test key; needs network).

If `wrangler` cannot start here, the e2e suite runs the same handlers: `cd app/adult/tests && npm ci && node --test e2e/s4.test.mjs`.

## The demo

| Step | Do this | You should see |
| --- | --- | --- |
| 1 | Open `/work/?c=demo1`. Press **Start**, **No resume: type your job title**, pick "Accountants and Auditors", continue to the roads. | The roads, and a box "Keep this for later (optional)". The network tab shows no call to `/api/`. The header says **Log in**. |
| 2 | Press **Make an account to save**. Type a birth year 18 years back. | "We cannot open an account for you ... born in 2007 or earlier. We have not sent or saved anything." No request was made. |
| 3 | Go back (Start again is not needed: use the browser back). Type a year 30 years back. | The email step. The invite code is already filled in. |
| 4 | Type an email, press **Send me a code**. | "If this address can sign in, we have sent a code." The terminal prints the code and a link. |
| 5 | Type a wrong code, then the right one. | "That code did not work", then the nickname step. |
| 6 | Read the notice. Leave the research box off. Type a nickname, tick the required box, press **Make my account**. | The roads come back with "Saved to your account." The header says **My account**. |
| 7 | Change your skills (untick one), continue to the roads. | "You have changes that are not saved yet." Press **Save to my account**: "Saved to your account." |
| 8 | In a private window, open `/work/?c=demo1#/login`. Enter the birth year, the same email, press **Send me a code**, type the new code. | Your saved profile opens on the roads: this is another device. |
| 9 | In the private window, untick another skill and save. Back in the first window, untick a different skill and press **Save to my account**. | "Which profile do you want to keep?" with both versions described. Press **Keep mine**: it saves on top. (The other button, **Use the saved profile**, opens the newer one.) |
| 10 | Open **My account**, press **Download my data**. | A file `margwise-my-data-<date>.json` with a table per kind of data. Open it and read it. |
| 11 | In the private window, open My account, **Log out everywhere**. In the first window open My account. | "Your session has ended. Please log in again." |
| 12 | Log in again, open My account. Type `delete`, then `DELETE`, press **Delete my data**. | The button waits for `DELETE`. Afterwards: "Your account and data are deleted." and **Log in** in the header. |
| 13 | Open the sign-in link from the terminal (`.../work/#link=...`) for a new email. | The address bar shows `#/link`, not the token. A new address goes to the nickname step. |

## What is not real yet

- No email leaves the machine. The real sender (Cloudflare Email Service) must be checked on the preview deployment (D34).
- The notice has two blanks (retention period, grievance contact) and needs the owner's wording sign-off (D39). A real build refuses sign-up while a blank is left.
- Log-in asks for the invite code and birth year again (D36). Research opt-out has no button yet (D38).
- The human check (Turnstile) needs a site key and the preview deployment to confirm the `/work/` policy (D37).
- Saves send no analytics event yet.

## Checks behind it

```bash
node --test app/adult/tests/unit/*.test.mjs app/adult/tests/privacy/static.test.mjs app/adult/tests/intake/*.test.mjs
cd app/adult/tests && npm ci && node --test --test-concurrency=1 e2e/*.test.mjs privacy/*.e2e.mjs
```

`e2e/s4.test.mjs` signs up, saves, logs in on a second device, causes and settles a conflict both ways, downloads the export, deletes, logs out everywhere, follows the emailed link, and checks that a signed-out journey makes no call to the API and that a signed-in resume journey sends only ids.
