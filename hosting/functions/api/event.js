import { json, safeEq, sign } from './_util.js';
const TYPES = new Set(['join', 'walk_start', 'place_done', 'beat', 'context', 'result', 'fields', 'field_open', 'abroad', 'self', 'areas', 'feedback', 'error', 'walk_end']);
export async function onRequestPost({ request, env }) {
  const raw = await request.text(); if (raw.length > 120000) return json({ error: 'Too large.' }, 413);
  let b; try { b = JSON.parse(raw); } catch { return json({ error: 'Bad request.' }, 400); }
  const id = String(b.testerId || ''); if (!safeEq(String(b.token || ''), await sign(id, env.SIGN_KEY))) return json({ error: 'Not allowed.' }, 403);
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE tester_id = ? AND ts > ?').bind(id, Date.now() - 86400000).first();
  if (day && day.n > 4000) return json({ error: 'Daily limit reached.' }, 429);
  const evs = Array.isArray(b.events) ? b.events.slice(0, 40) : []; const session = String(b.session || '').slice(0, 16);
  const stmts = [];
  for (const e of evs) {
    if (!e || !TYPES.has(e.type)) continue;
    const data = JSON.stringify(e.data || {}).slice(0, 8000), ts = Number(e.ts) || Date.now();
    stmts.push(env.DB.prepare('INSERT INTO events (tester_id, session_id, ts, type, data) VALUES (?, ?, ?, ?, ?)').bind(id, session, ts, e.type, data));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, n: stmts.length });
}
