// POST /api/v1/email/start  {invite, birthYear, email, turnstile}  (SPEC 9, BACKEND ADR-04, T3.4)
// Order: keys and Turnstile -> age -> limits -> invite and address look-ups -> per-address limits -> store the code, send it after the reply.
//  * Under 18: the only thing written is one count in `under18` (per invite, per day). Not the address, not the IP bucket, nothing else.
//  * No account discovery: a known and an unknown address take the same steps and give the same answer. An unknown address while sign-up is
//    switched off, or with no active invite, gets a decoy `email_codes` row (hashes of random values, nothing is sent), so verifying it later behaves the same.
//  * The code is 6 digits, stored only as a keyed hash, for 15 minutes and 5 tries. A new request replaces the old code. The link token is
//    32 random bytes, also stored only as a hash. Neither is logged. The address is used to send, and is not stored here.
//  * The email goes out in the background (deps.background = waitUntil). The reply never waits for the provider, so timing and errors tell nothing.
//  * D36: an existing account logs in without an active invite; an invite is needed only to create an account.
import { defineRoute, ok, fail, readJson } from './http.js';
import { SCHEMAS } from './api_schemas.js';
import { keysProblem, ageAllowed, ageBand, emailHash, codeHash, linkHash, decoyHash, newCode, newLinkToken, CODE_LIFE, normaliseEmail } from './keys.js';
import { ipLimited, sentCounts, hourKey, dayKey, LIMITS } from './limits.js';
import { codeMessage } from './email_send.js';
import { bump, today } from './ops.js';

const SAME_ANSWER = 'If this address can sign in, we have sent a code. It works for 15 minutes.';

export async function activeAdultInvite(deps, code) {
  const row = await deps.db.prepare('SELECT id, active, track, expires_at FROM invites WHERE code = ?').bind(String(code).toLowerCase()).first();
  return row && row.active === 1 && row.track === 'adult' && (row.expires_at == null || row.expires_at > deps.now()) ? row : null;
}

export const handle = defineRoute('POST /api/v1/email/start', async (request, deps, { rid }) => {
  if (keysProblem(deps) || !deps.turnstile) return fail('unavailable', { rid });
  const r = await readJson(request, { max: 4096, schema: SCHEMAS.email_start, rid }); if (r.response) return r.response;
  const b = r.value, now = deps.now();

  let human; try { human = await deps.turnstile(b.turnstile); } catch { return fail('unavailable', { rid }); }
  if (!human) return fail('forbidden', { rid, message: 'The check did not pass. Please try again.' });

  const year = new Date(now).getUTCFullYear();
  if (!ageAllowed(year, b.birthYear)) {   // nothing is stored but one count
    const inv = await deps.db.prepare("SELECT id FROM invites WHERE code = ? AND track = 'adult'").bind(b.invite.toLowerCase()).first();
    await deps.db.prepare('INSERT INTO under18 (invite_id, day, n) VALUES (?, ?, 1) ON CONFLICT(invite_id, day) DO UPDATE SET n = n + 1').bind(inv ? inv.id : 0, dayKey(now)).run();
    return fail('refused_age', { rid });
  }

  if (await ipLimited(deps, request, 'e:', LIMITS.startPerIpHour)) return fail('rate_limited', { rid });
  // Not set up, or no origin for the link: the same answer for every address, so it tells nothing about any one of them.
  if (!deps.email || (deps.config.environment === 'production' && !deps.config.appOrigin)) return fail('unavailable', { rid });

  // The same steps, in the same order, for every address (ADR-13). The invite is looked up for all of them (D36): a known address needs no
  // active invite to log in; a new address needs one to get a code at all. With no usable invite, a new address is treated as a stranger
  // (a decoy row, nothing sent), so the answer never says whether an address has an account.
  const invite = await activeAdultInvite(deps, b.invite);
  const eh = await emailHash(deps, b.email);
  const known = await deps.db.prepare("SELECT id FROM testers WHERE email_hash = ? AND track = 'adult'").bind(eh).first();
  const counts = await sentCounts(deps, eh);
  if (counts.hour >= LIMITS.codesPerAddressHour || counts.day >= LIMITS.codesPerAddressDay) return fail('rate_limited', { rid });
  if (deps.config.emailDailyCap > 0 && await today(deps, 'codes_sent') >= deps.config.emailDailyCap) return fail('unavailable', { rid });

  const send = !!known || (deps.flags.adultSignup && !!invite);
  const code = send ? newCode(deps) : null, link = send ? newLinkToken(deps) : null;
  const ch = send ? await codeHash(deps, eh, code) : await decoyHash(deps, 'code'), lh = send ? await linkHash(deps, link) : await decoyHash(deps, 'link');
  await deps.db.batch([
    deps.db.prepare('INSERT INTO email_sends (email_hash, day, n) VALUES (?, ?, 1) ON CONFLICT(email_hash, day) DO UPDATE SET n = n + 1').bind(eh, hourKey(now)),
    deps.db.prepare('INSERT INTO email_sends (email_hash, day, n) VALUES (?, ?, 1) ON CONFLICT(email_hash, day) DO UPDATE SET n = n + 1').bind(eh, dayKey(now)),
    deps.db.prepare('INSERT INTO email_codes (email_hash, code_hash, link_hash, expires_at, tries, invite_id, age_band, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?) ON CONFLICT(email_hash) DO UPDATE SET code_hash = excluded.code_hash, link_hash = excluded.link_hash, expires_at = excluded.expires_at, tries = 0, invite_id = excluded.invite_id, age_band = excluded.age_band, created_at = excluded.created_at')
      .bind(eh, ch, lh, now + CODE_LIFE, invite ? invite.id : null, ageBand(year, b.birthYear), now),
  ]);
  if (send) {
    // The reply never waits for the provider and never depends on it, so a known and an unknown address cannot be told apart by time or by an
    // error (B1). A failed send is counted in email_errors (and the health check raises it); the person asks for a new code.
    const to = normaliseEmail(b.email), origin = deps.config.appOrigin || new URL(request.url).origin;
    deps.background(async () => {
      try { await deps.email.send(codeMessage({ to, code, link: `${origin}/work/#link=${link}` })); await bump(deps, 'codes_sent'); }
      catch { try { await bump(deps, 'email_errors'); } catch { /* nobody is waiting */ } }
    });
  }
  return ok({ message: SAME_ANSWER }, { rid });
});
