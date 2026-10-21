import { json, safeEq, sign, ipHash, readJson } from './_util.js';
export async function onRequestPost({ request, env }) {
  const r = await readJson(request, 4000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
  const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40), code = String(b.code || '').trim().toLowerCase();
  if (!name) return json({ error: 'Please add your name.' }, 400);
  if (b.consent !== true) return json({ error: 'Please tick the box to continue.' }, 400);
  const need = String(env.INVITE_CODE || '').trim();
  if (need && !safeEq(code, need.toLowerCase())) return json({ error: 'That invite code is not right.' }, 403);
  const ip = await ipHash(request, env.SIGN_KEY), now = Date.now();
  await env.DB.prepare('DELETE FROM joins WHERE ts < ?').bind(now - 86400000).run();
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind(ip, now - 3600000).first();
  if (mine && mine.n >= 12) return json({ error: 'Too many sign-ups from this connection. Please try again later.' }, 429);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at > ?').bind(now - 3600000).first();
  if (recent && recent.n >= 80) return json({ error: 'Too many sign-ups right now. Please try again later.' }, 429);
  const id = crypto.randomUUID();
  await env.DB.batch([env.DB.prepare('INSERT INTO testers (id, name, created_at, ua) VALUES (?, ?, ?, NULL)').bind(id, name, now), env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now)]);
  return json({ testerId: id, token: await sign(id, env.SIGN_KEY) });
}
