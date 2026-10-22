import { json, mintToken, ipHash, readJson, keyOk, retHash } from './_util.js';
// A returning self-signup tester on a new phone or laptop: exchange the return code shown on their results for a fresh token.
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Not available right now.' }, 503);
  const r = await readJson(request, 1000); if (r.err) return json({ error: r.err }, r.status);
  const raw = String(r.b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ip = 'r' + (await ipHash(request, env.SIGN_KEY)).slice(0, 15), now = Date.now();   // own bucket, so mistyped codes in a classroom cannot use up the sign-up allowance
  await env.DB.prepare('DELETE FROM joins WHERE ip LIKE ? AND ts < ?').bind('r%', now - 86400000).run();
  const glob = await env.DB.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind('rGLOBAL', now - 3600000).first();   // whole-site cap on wrong codes
  if (glob && glob.n >= 300) return json({ error: 'Too many attempts. Please try again later.' }, 429);
  const bad = await env.DB.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind(ip, now - 3600000).first();
  if (bad && bad.n >= 40) return json({ error: 'Too many attempts from this connection. Please try again later.' }, 429);
  const row = raw.length === 8 ? await env.DB.prepare("SELECT id, name FROM testers WHERE ret_hash = ? AND COALESCE(source, '') != 'counsellor'").bind(await retHash(raw, env.SIGN_KEY)).first() : null;
  if (!row) { await env.DB.batch([env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(ip, now), env.DB.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind('rGLOBAL', now)]); return json({ error: 'That login code is not right. It looks like ABCD-2345.' }, 403); }
  return json({ testerId: row.id, token: await mintToken(row.id, env.SIGN_KEY), name: row.name });
}
