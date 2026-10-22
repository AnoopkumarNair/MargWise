import { json, sign, ipHash, readJson, keyOk, retHash } from './_util.js';
// A returning self-signup tester on a new phone or laptop: exchange the return code shown on their results for a fresh token.
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Not available right now.' }, 503);
  const r = await readJson(request, 1000); if (r.err) return json({ error: r.err }, r.status);
  const raw = String(r.b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ip = await ipHash(request, env.SIGN_KEY), now = Date.now();
  const bad = await env.DB.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind(ip, now - 3600000).first();
  if (bad && bad.n >= 40) return json({ error: 'Too many attempts from this connection. Please try again later.' }, 429);
  const row = raw.length === 8 ? await env.DB.prepare('SELECT id, name FROM testers WHERE ret_hash = ?').bind(await retHash(raw, env.SIGN_KEY)).first() : null;
  if (!row) { await env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now).run(); return json({ error: 'That return code is not right. It looks like ABCD-2345.' }, 403); }
  return json({ testerId: row.id, token: await sign(row.id, env.SIGN_KEY), name: row.name });
}
