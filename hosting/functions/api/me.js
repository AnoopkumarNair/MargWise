import { json, safeEq, sign, readJson, keyOk } from './_util.js';
// A signed-in tester's saved results: the most recent attempts (newest first), each a compact snapshot the game can replay.
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Not available right now.' }, 503);
  const r = await readJson(request, 2000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
  const id = String(b.testerId || ''); if (!safeEq(String(b.token || ''), await sign(id, env.SIGN_KEY))) return json({ error: 'Not allowed.' }, 403);
  const t = await env.DB.prepare('SELECT 1 AS x FROM testers WHERE id = ?').bind(id).first(); if (!t) return json({ error: 'Not allowed.' }, 403);
  const rows = await env.DB.prepare("SELECT ts, data FROM events WHERE tester_id = ? AND type = 'snapshot' ORDER BY ts DESC LIMIT 5").bind(id).all();
  const attempts = []; for (const x of rows.results || []) { try { attempts.push({ ts: x.ts, ...JSON.parse(x.data) }); } catch { /* skip a damaged row */ } }
  const pr = await env.DB.prepare("SELECT ts, data FROM events WHERE tester_id = ? AND type = 'progress' ORDER BY ts DESC LIMIT 1").bind(id).first();
  let progress = null; if (pr) { try { progress = { ts: pr.ts, ...JSON.parse(pr.data) }; } catch { /* damaged row */ } }
  return json({ attempts, progress });
}
