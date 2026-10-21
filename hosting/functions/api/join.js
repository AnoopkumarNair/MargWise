import { json, safeEq, sign } from './_util.js';
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const name = String(b.name || '').trim().slice(0, 40), code = String(b.code || '').trim().toLowerCase();
  if (!name) return json({ error: 'Please add your name.' }, 400);
  if (b.consent !== true) return json({ error: 'Please tick the box to continue.' }, 400);
  const need = String(env.INVITE_CODE || '').trim();
  if (need && !safeEq(code, need.toLowerCase())) return json({ error: 'That invite code is not right.' }, 403);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at > ?').bind(Date.now() - 3600000).first();
  if (recent && recent.n >= 80) return json({ error: 'Too many sign-ups right now. Please try again later.' }, 429);
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO testers (id, name, created_at, ua) VALUES (?, ?, ?, ?)').bind(id, name, Date.now(), (request.headers.get('user-agent') || '').slice(0, 160)).run();
  return json({ testerId: id, token: await sign(id, env.SIGN_KEY) });
}
