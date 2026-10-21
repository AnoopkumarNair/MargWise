import { json, safeEq } from './_util.js';
export async function onRequest({ request, env }) {
  const u = new URL(request.url), key = request.headers.get('x-admin-key') || u.searchParams.get('key') || '';
  if (!safeEq(key, env.ADMIN_KEY || '')) return json({ error: 'Not allowed.' }, 403);
  const t = u.searchParams.get('tester');
  if (request.method === 'DELETE') {
    if (!t) return json({ error: 'tester required' }, 400);
    await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE tester_id = ?').bind(t), env.DB.prepare('DELETE FROM testers WHERE id = ?').bind(t)]);
    return json({ ok: true });
  }
  if (t) { const r = await env.DB.prepare('SELECT ts, type, data, session_id FROM events WHERE tester_id = ? ORDER BY ts, id').bind(t).all(); return json({ events: r.results }); }
  const tes = (await env.DB.prepare('SELECT id, name, created_at, ua FROM testers ORDER BY created_at DESC').all()).results;
  const ev = (await env.DB.prepare("SELECT tester_id, type, data, ts FROM events WHERE type IN ('result','self','areas','feedback','walk_start','place_done','fields') ORDER BY ts").all()).results;
  const by = {}; for (const e of ev) { (by[e.tester_id] ||= []).push(e); }
  const out = tes.map(x => {
    const es = by[x.id] || [], last = (ty) => { const f = es.filter(e => e.type === ty); return f.length ? JSON.parse(f[f.length - 1].data) : null; };
    return { ...x, walks: es.filter(e => e.type === 'walk_start').length, places: es.filter(e => e.type === 'place_done').length, lastTs: es.length ? es[es.length - 1].ts : x.created_at, result: last('result'), self: last('self'), areas: last('areas'), feedback: last('feedback'), fields: last('fields') };
  });
  return json({ testers: out });
}
