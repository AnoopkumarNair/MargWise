import { json, safeEq, ipHash, readJson, keyOk, purgeOld, retHash, newRetCode, mintToken } from './_util.js';
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Sign-up is not available right now.' }, 503);
  const r = await readJson(request, 4000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
  const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40), code = String(b.code || '').trim().toLowerCase();
  if (!name) return json({ error: 'Please add your name.' }, 400);
  if (b.consent !== true) return json({ error: 'Please tick the box to continue.' }, 400);
  const need = String(env.INVITE_CODE || '').trim(), ip = await ipHash(request, env.SIGN_KEY), now = Date.now();
  await env.DB.prepare('DELETE FROM joins WHERE ts < ?').bind(now - 86400000).run();
  try { await purgeOld(env, now); } catch (e) { /* retention must never block sign-up; failure shows as a missing audit row */ }
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind(ip, now - 3600000).first();
  if (mine && mine.n >= 40) return json({ error: 'Too many attempts from this connection. Please try again later.' }, 429);
  const act = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE active = 1').first();
  let inviteId = null;
  {   // fail closed: a code is always required; with no master code and no active invite, sign-ups are shut
    let ok = !!need && safeEq(code, need.toLowerCase());
    if (!ok && code) {
      const row = await env.DB.prepare('SELECT id FROM invites WHERE code = ?').bind(code).first();
      // atomic claim: the limit, expiry and switch are all checked inside the UPDATE, so concurrent sign-ups cannot overshoot max_uses
      if (row) { const c = await env.DB.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?) AND (max_uses IS NULL OR uses < max_uses)').bind(row.id, now).run(); if (c.meta && c.meta.changes === 1) { ok = true; inviteId = row.id; } }
    }
    if (!need && !(act && act.n > 0)) return json({ error: 'Sign-ups are closed right now.' }, 403);
    if (!ok) { await env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now).run(); return json({ error: 'That invite code is not right, or it is no longer active.' }, 403); }
  }
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at > ?').bind(now - 3600000).first();
  if (recent && recent.n >= 80) return json({ error: 'Too many sign-ups right now. Please try again later.' }, 429);
  const id = crypto.randomUUID();
  const ret = newRetCode();
  await env.DB.batch([env.DB.prepare('INSERT INTO testers (id, name, created_at, ua, invite_id, ret_hash) VALUES (?, ?, ?, NULL, ?, ?)').bind(id, name, now, inviteId, await retHash(ret, env.SIGN_KEY)), env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now)]);
  return json({ testerId: id, token: await mintToken(id, env.SIGN_KEY), returnCode: ret });
}
