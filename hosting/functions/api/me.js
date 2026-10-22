import { json, readJson, keyOk, checkToken } from './_util.js';
// A signed-in tester's saved results: the most recent attempts (newest first), each a compact snapshot the game can replay.
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Not available right now.' }, 503);
  const r = await readJson(request, 2000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
  const id = String(b.testerId || ''); if (!(await checkToken(env, id, b.token))) return json({ error: 'Not allowed.' }, 403);
  const rows = await env.DB.prepare("SELECT ts, data FROM events WHERE tester_id = ? AND type = 'snapshot' ORDER BY ts DESC LIMIT 5").bind(id).all();
  const attempts = []; let full = false;   // only the newest walk with a result is sent in full; older ones are a summary
  for (const x of rows.results || []) { try { const d = JSON.parse(x.data); if (!full && !d.noSignal && d.code && d.code.length) { full = true; attempts.push({ ts: x.ts, ...d }); } else attempts.push({ ts: x.ts, code: d.code || [], noSignal: !!d.noSignal }); } catch { /* skip a damaged row */ } }
  const pr = await env.DB.prepare("SELECT ts, data FROM events WHERE tester_id = ? AND type = 'progress' ORDER BY ts DESC LIMIT 1").bind(id).first();
  let progress = null; if (pr) { try { progress = { ts: pr.ts, ...JSON.parse(pr.data) }; } catch { /* damaged row */ } }
  return json({ attempts, progress });
}
