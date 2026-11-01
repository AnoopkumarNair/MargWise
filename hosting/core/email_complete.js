// POST /api/v1/email/complete  {pending, email, nickname, consent: true, research}  (SPEC 9, BACKEND ADR-20, T3.4)
// Creates the tester. Idempotent: the unique email_hash index means a repeat, or a second device finishing the same sign-up, gets a token for
// the same tester. The invite is checked again and one use is claimed in a single UPDATE (so max_uses cannot be overshot).
// The pending token carries no address (ADR-20). The body does (amendment A2, deviations D29): its keyed hash must equal the hash in the token,
// and the normalised address is stored in testers.email (SPEC 10, ADR-04) so email_hash can be recomputed if EMAIL_KEY is rotated.
import { defineRoute, ok, fail, readJson } from './http.js';
import { SCHEMAS } from './api_schemas.js';
import { keysProblem, readPending, mintSession, newUuid, emailHash, normaliseEmail, safeEqual } from './keys.js';
import { dayKey } from './limits.js';
import { bump } from './ops.js';

const CLEAN = /[\u0000-\u001f\u007f<>@]/g;
const BAD_INVITE = 'That invite code is not right, or it is no longer active.';

export const handle = defineRoute('POST /api/v1/email/complete', async (request, deps, { rid }) => {
  if (keysProblem(deps)) return fail('unavailable', { rid });
  const r = await readJson(request, { max: 2048, schema: SCHEMAS.email_complete, rid }); if (r.response) return r.response;
  const b = r.value, now = deps.now();
  const p = await readPending(deps, b.pending); if (!p.ok) return fail(p.code, { rid });

  // the address must be the one that was verified: compare keyed hashes, so the token never holds it. Never logged, never in an error.
  if (typeof b.email !== 'string' || !safeEqual(await emailHash(deps, b.email), p.emailHash)) return fail('bad_request', { rid });

  // A pending token is not revoked by "log out everywhere" or by delete on its own, so check both here (S4): an account whose tok_after is at
  // or after the token's issue time is not opened again, and an address deleted since the token was issued (a short-lived `del:` row in meta,
  // see account.js) is not made again.
  const gone = await deps.db.prepare('SELECT v FROM meta WHERE k = ?').bind('del:' + p.emailHash).first();
  if (gone && Number(gone.v) >= p.iat) return fail('unauthorized', { rid });
  const existing = () => deps.db.prepare("SELECT id, tok_after FROM testers WHERE email_hash = ? AND track = 'adult'").bind(p.emailHash).first();
  const done = async t => {
    if (t.tok_after != null && t.tok_after >= p.iat) return fail('unauthorized', { rid });
    // an account made before the address was stored (N1): fill it in now, the body carries a checked address
    await deps.db.prepare('UPDATE testers SET key_v = ?, email = COALESCE(email, ?) WHERE id = ?').bind(deps.config.signKeyV, normaliseEmail(b.email), t.id).run();
    return ok({ token: await mintSession(deps, t.id) }, { rid });
  };
  const again = await existing(); if (again) return done(again);

  if (!deps.flags.adultSignup) return fail('unavailable', { rid });
  const name = b.nickname.replace(CLEAN, '').trim().slice(0, 40); if (!name) return fail('bad_request', { rid });
  // the invite must still be active and for adults; claim one use atomically
  const claim = await deps.db.prepare("UPDATE invites SET uses = uses + 1 WHERE id = ? AND active = 1 AND track = 'adult' AND (expires_at IS NULL OR expires_at > ?) AND (max_uses IS NULL OR uses < max_uses)").bind(p.inviteId, now).run();
  if (!claim.meta || claim.meta.changes !== 1) return fail('forbidden', { rid, message: BAD_INVITE });

  const id = newUuid(deps);
  const ins = await deps.db.prepare("INSERT OR IGNORE INTO testers (id, name, created_at, ua, invite_id, source, consent_on, track, age_band, email, email_hash, research_ok, key_v) VALUES (?, ?, ?, NULL, ?, NULL, ?, 'adult', ?, ?, ?, ?, ?)")
    .bind(id, name, now, p.inviteId, dayKey(now), p.ageBand, normaliseEmail(b.email), p.emailHash, b.research ? 1 : 0, deps.config.signKeyV).run();
  if (!ins.meta || ins.meta.changes !== 1) {   // lost a race with another device: give the use back and answer for the tester that won
    await deps.db.prepare('UPDATE invites SET uses = uses - 1 WHERE id = ? AND uses > 0').bind(p.inviteId).run();
    const won = await existing(); if (!won) return fail('internal', { rid });
    return done(won);
  }
  await bump(deps, 'signups');
  return ok({ token: await mintSession(deps, id) }, { rid });
});
