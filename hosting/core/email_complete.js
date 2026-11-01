// POST /api/v1/email/complete  {pending, nickname, consent: true, research}  (SPEC 9, BACKEND ADR-20, T3.4)
// Creates the tester. Idempotent: the unique email_hash index means a repeat, or a second device finishing the same sign-up, gets a token for
// the same tester. The invite is checked again and one use is claimed in a single UPDATE (so max_uses cannot be overshot).
// The pending token carries no address, so testers.email stays empty until the next code sign-in (see email_verify.js, deviations.md).
import { defineRoute, ok, fail, readJson } from './http.js';
import { SCHEMAS } from './api_schemas.js';
import { keysProblem, readPending, mintSession, newUuid } from './keys.js';
import { dayKey } from './limits.js';
import { bump } from './ops.js';

const CLEAN = /[\u0000-\u001f\u007f<>@]/g;
const BAD_INVITE = 'That invite code is not right, or it is no longer active.';

export const handle = defineRoute('POST /api/v1/email/complete', async (request, deps, { rid }) => {
  if (keysProblem(deps)) return fail('unavailable', { rid });
  const r = await readJson(request, { max: 2048, schema: SCHEMAS.email_complete, rid }); if (r.response) return r.response;
  const b = r.value, now = deps.now();
  const p = await readPending(deps, b.pending); if (!p.ok) return fail(p.code, { rid });

  const existing = () => deps.db.prepare("SELECT id FROM testers WHERE email_hash = ? AND track = 'adult'").bind(p.emailHash).first();
  const done = async id => { await deps.db.prepare('UPDATE testers SET key_v = ? WHERE id = ?').bind(deps.config.signKeyV, id).run(); return ok({ token: await mintSession(deps, id) }, { rid }); };
  const again = await existing(); if (again) return done(again.id);

  if (!deps.flags.adultSignup) return fail('unavailable', { rid });
  const name = b.nickname.replace(CLEAN, '').trim().slice(0, 40); if (!name) return fail('bad_request', { rid });
  // the invite must still be active and for adults; claim one use atomically
  const claim = await deps.db.prepare("UPDATE invites SET uses = uses + 1 WHERE id = ? AND active = 1 AND track = 'adult' AND (expires_at IS NULL OR expires_at > ?) AND (max_uses IS NULL OR uses < max_uses)").bind(p.inviteId, now).run();
  if (!claim.meta || claim.meta.changes !== 1) return fail('forbidden', { rid, message: BAD_INVITE });

  const id = newUuid(deps);
  const ins = await deps.db.prepare("INSERT OR IGNORE INTO testers (id, name, created_at, ua, invite_id, source, consent_on, track, age_band, email, email_hash, research_ok, key_v) VALUES (?, ?, ?, NULL, ?, NULL, ?, 'adult', ?, NULL, ?, ?, ?)")
    .bind(id, name, now, p.inviteId, dayKey(now), p.ageBand, p.emailHash, b.research ? 1 : 0, deps.config.signKeyV).run();
  if (!ins.meta || ins.meta.changes !== 1) {   // lost a race with another device: give the use back and answer for the tester that won
    await deps.db.prepare('UPDATE invites SET uses = uses - 1 WHERE id = ? AND uses > 0').bind(p.inviteId).run();
    const won = await existing(); if (!won) return fail('internal', { rid });
    return done(won.id);
  }
  await bump(deps, 'signups');
  return ok({ token: await mintSession(deps, id) }, { rid });
});
