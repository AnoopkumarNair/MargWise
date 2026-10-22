import { json, safeEq, sign, ipHash, readJson, keyOk } from './_util.js';
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Sign-up is not available right now.' }, 503);
  const r = await readJson(request, 4000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
  const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40), code = String(b.code || '').trim().toLowerCase();
  if (!name) return json({ error: 'Please add your name.' }, 400);
  if (b.consent !== true) return json({ error: 'Please tick the box to continue.' }, 400);
  const need = String(env.INVITE_CODE || '').trim(), ip = await ipHash(request, env.SIGN_KEY), now = Date.now();
  await env.DB.prepare('DELETE FROM joins WHERE ts < ?').bind(now - 86400000).run();
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind(ip, now - 3600000).first();
  if (mine && mine.n >= 40) return json({ error: 'Too many attempts from this connection. Please try again later.' }, 429);
  const act = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE active = 1').first();
  let inviteId = null;
  {   // fail closed: a code is always required; with no master code and no active invite, sign-ups are shut
    let ok = !!need && safeEq(code, need.toLowerCase());
    if (!ok && code) {
      const row = await env.DB.prepare('SELECT id, max_uses, uses, expires_at, active FROM invites WHERE code = ?').bind(code).first();
      if (row && row.active === 1 && (!row.expires_at || row.expires_at > now) && (row.max_uses == null || row.uses < row.max_uses)) { ok = true; inviteId = row.id; }
    }
    if (!need && !(act && act.n > 0)) return json({ error: 'Sign-ups are closed right now.' }, 403);
    if (!ok) { await env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now).run(); return json({ error: 'That invite code is not right, or it is no longer active.' }, 403); }
  }
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at > ?').bind(now - 3600000).first();
  if (recent && recent.n >= 80) return json({ error: 'Too many sign-ups right now. Please try again later.' }, 429);
  const id = crypto.randomUUID();
  await env.DB.batch([env.DB.prepare('INSERT INTO testers (id, name, created_at, ua, invite_id) VALUES (?, ?, ?, NULL, ?)').bind(id, name, now, inviteId), env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now)].concat(inviteId ? [env.DB.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ?').bind(inviteId)] : []));
  return json({ testerId: id, token: await sign(id, env.SIGN_KEY) });
}
