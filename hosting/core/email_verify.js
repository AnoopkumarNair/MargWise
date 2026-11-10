// POST /api/v1/email/verify  {email, code} or {link}  (SPEC 9, BACKEND ADR-04, ADR-20, T3.4)
// A good code or link is used up. A known address gets {token} (an adult session). A new address gets {needsProfile: true, pending}: the
// 30-minute token that email/complete needs. A code allows 5 tries and then the row is void; an expired or voided row is `expired`.
// A wrong, unknown or already-used code or link is `invalid_code`, so nothing says whether an address has an account.
import { defineRoute, ok, fail, readJson, checkContract } from './http.js';
import { SCHEMAS } from './api_schemas.js';
import { keysProblem, emailHash, codeHash, linkHash, safeEqual, mintSession, mintPending, normaliseEmail, CODE_TRIES } from './keys.js';
import { ipLimited, LIMITS } from './limits.js';
import { bump } from './ops.js';

export const handle = defineRoute('POST /api/v1/email/verify', async (request, deps, { rid }) => {
  if (keysProblem(deps)) return fail('unavailable', { rid });
  const r = await readJson(request, { max: 2048, schema: SCHEMAS.email_verify, rid }); if (r.response) return r.response;
  const body = r.value, byLink = 'link' in body;
  // the schema alone cannot say "one of": the body must also fit exactly one form
  if (!checkContract(SCHEMAS.email_verify.$defs[byLink ? 'by_link' : 'by_code'], body).ok) return fail('bad_request', { rid });
  if (await ipLimited(deps, request, 'v:', LIMITS.verifyPerIpHour)) return fail('rate_limited', { rid });
  const now = deps.now();

  const eh = byLink ? null : await emailHash(deps, body.email);
  const row = byLink
    ? await deps.db.prepare('SELECT email_hash, code_hash, link_hash, expires_at, tries, invite_id, age_band FROM email_codes WHERE link_hash = ?').bind(await linkHash(deps, body.link)).first()
    : await deps.db.prepare('SELECT email_hash, code_hash, link_hash, expires_at, tries, invite_id, age_band FROM email_codes WHERE email_hash = ?').bind(eh).first();
  if (!row) { await bump(deps, 'code_failures'); return fail('invalid_code', { rid }); }
  if (row.expires_at <= now || row.tries >= CODE_TRIES) return fail('expired', { rid });

  if (!byLink) {
    // count the try first, in one statement, so two parallel guesses cannot both get the last try
    const t = await deps.db.prepare('UPDATE email_codes SET tries = tries + 1 WHERE email_hash = ? AND tries < ? AND expires_at > ?').bind(row.email_hash, CODE_TRIES, now).run();
    if (!t.meta || t.meta.changes !== 1) return fail('expired', { rid });
    if (!safeEqual(await codeHash(deps, row.email_hash, body.code), row.code_hash)) { await bump(deps, 'code_failures'); return fail('invalid_code', { rid }); }
  }
  // single use: whoever deletes the row owns the sign-in
  const used = await deps.db.prepare('DELETE FROM email_codes WHERE email_hash = ? AND code_hash = ? AND link_hash = ?').bind(row.email_hash, row.code_hash, row.link_hash).run();
  if (!used.meta || used.meta.changes !== 1) return fail('invalid_code', { rid });

  const t = await deps.db.prepare("SELECT id, email FROM testers WHERE email_hash = ? AND track = 'adult'").bind(row.email_hash).first();
  if (t) {
    // The address is not in any later request, so it is kept now, when the person typed it (only the code form carries it): needed to
    // recompute the hash if EMAIL_KEY is ever rotated (ADR-04). The link form leaves it as it is.
    if (!byLink && t.email == null) await deps.db.prepare('UPDATE testers SET email = ?, key_v = ? WHERE id = ? AND email IS NULL').bind(normaliseEmail(body.email), deps.config.signKeyV, t.id).run();
    else await deps.db.prepare('UPDATE testers SET key_v = ? WHERE id = ?').bind(deps.config.signKeyV, t.id).run();
    return ok({ token: await mintSession(deps, t.id) }, { rid });
  }
  if (!deps.flags.adultSignup) return fail('unavailable', { rid });
  if (!Number.isInteger(row.invite_id) || row.invite_id < 1 || !row.age_band) return fail('invalid_code', { rid });
  return ok({ needsProfile: true, pending: await mintPending(deps, { emailHash: row.email_hash, inviteId: row.invite_id, ageBand: row.age_band }) }, { rid });
});
