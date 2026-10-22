import { json, safeEq, readJson, ipHash, keyOk } from './_util.js';
// Counsellor review. The counsellor must lock in their own top 3 BEFORE the app's result is returned (enforced here, not in the page).
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const FID = /^[a-z]{2,8}$/, CODE = /^[0-9A-F]{6}$/;
const USE = ['yes', 'with changes', 'no'];
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(x => x.toString(16).padStart(2, '0')).join('');
// Each counsellor has a personal key, scoped to one school (an invite). The admin key can see every school.
async function authed(request, env) {
  const key = request.headers.get('x-counsellor-key') || '', now = Date.now(), ip = keyOk(env.SIGN_KEY) ? await ipHash(request, env.SIGN_KEY) : 'x';
  const f = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ip = ? AND ts > ?').bind(ip, now - 900000).first();
  if (f && f.n >= 8) return { status: 429 };
  if (keyOk(env.ADMIN_KEY) && safeEq(key, env.ADMIN_KEY)) return { status: 200, admin: true, id: null, name: 'admin', invite_id: null };
  const c = key.length >= 12 ? await env.DB.prepare('SELECT id, name, invite_id FROM counsellors WHERE key_hash = ? AND active = 1').bind(await sha(key)).first() : null;
  if (!c) { await env.DB.prepare('INSERT INTO admin_fail (ip, ts) VALUES (?, ?)').bind(ip, now).run(); return { status: 403 }; }
  await env.DB.prepare('UPDATE counsellors SET last_used = ? WHERE id = ?').bind(now, c.id).run();
  return { status: 200, admin: false, ...c };
}
async function findTester(env, code, me) {
  const rows = (await env.DB.prepare("SELECT id, name, invite_id FROM testers WHERE substr(upper(replace(id, '-', '')), 1, 6) = ?").bind(code).all()).results;
  const t = rows.length === 1 ? rows[0] : null;
  return t && (me.admin || (t.invite_id != null && t.invite_id === me.invite_id)) ? t : null;   // a counsellor only ever sees their own school
}
async function appTop(env, id) {
  const e = await env.DB.prepare("SELECT data FROM events WHERE tester_id = ? AND type = 'fields' ORDER BY id DESC LIMIT 1").bind(id).first();
  if (!e) return null; try { const o = JSON.parse(e.data).order; return Array.isArray(o) ? o.slice(0, 6) : null; } catch { return null; }
}
export async function onRequest({ request, env }) {
  const me = await authed(request, env); if (me.status !== 200) return json({ error: me.status === 429 ? 'Too many wrong keys. Try again in 15 minutes.' : 'Not allowed.' }, me.status);
  const u = new URL(request.url), now = Date.now();
  if (request.method === 'GET' && !u.searchParams.get('code')) {   // my students: no typing of codes, no chance of mixing students up
    if (me.admin) return json({ students: [] });
    const rows = (await env.DB.prepare("SELECT t.id, t.name, r.baseline_at, r.reviewed_at, EXISTS(SELECT 1 FROM events e WHERE e.tester_id = t.id AND e.type = 'fields') AS has_result FROM testers t LEFT JOIN reviews r ON r.tester_id = t.id WHERE t.invite_id = ? ORDER BY t.created_at DESC LIMIT 300").bind(me.invite_id).all()).results;
    return json({ counsellor: me.name, students: rows.map(r => ({ code: r.id.replace(/-/g, '').slice(0, 6).toUpperCase(), name: r.name, state: r.reviewed_at ? 'done' : r.baseline_at ? 'baselined' : 'new', finished: !!r.has_result })) });
  }
  if (request.method === 'GET') {
    const code = clean(u.searchParams.get('code'), 8).toUpperCase(); if (!CODE.test(code)) return json({ error: 'A student code is 6 letters or digits, for example 3F9A2C.' }, 400);
    const t = await findTester(env, code, me); if (!t) return json({ error: 'No student found with that code. Check it with the student.' }, 404);
    const r = await env.DB.prepare('SELECT counsellor, baseline, app_top, overlap, overlap6, reviewed_at FROM reviews WHERE tester_id = ?').bind(t.id).first();
    if (!r) return json({ name: t.name, state: 'new' });
    const top = await appTop(env, t.id);
    return json({ name: t.name, state: r.reviewed_at ? 'done' : 'baselined', baseline: JSON.parse(r.baseline), appTop: top ? top.slice(0, 3) : null, overlap: r.reviewed_at ? r.overlap : null });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const rj = await readJson(request, 6000); if (rj.err) return json({ error: rj.err }, rj.status); const b = rj.b;
  const code = clean(b.code, 8).toUpperCase(); if (!CODE.test(code)) return json({ error: 'Bad student code.' }, 400);
  const t = await findTester(env, code, me); if (!t) return json({ error: 'No student found with that code.' }, 404);
  const ex = await env.DB.prepare('SELECT baseline, reviewed_at FROM reviews WHERE tester_id = ?').bind(t.id).first();
  if (b.action === 'baseline') {
    if (ex) return json({ error: 'Your own picks are already saved for this student and are locked.' }, 409);
    const picks = Array.isArray(b.picks) ? b.picks.map(x => clean(x, 8)) : [], who = me.admin ? (clean(b.counsellor, 40) || 'admin') : me.name;
    if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every(p => FID.test(p))) return json({ error: 'Choose exactly 3 different fields.' }, 400);
    await env.DB.prepare('INSERT INTO reviews (tester_id, code, counsellor, counsellor_id, baseline, baseline_at) VALUES (?, ?, ?, ?, ?, ?)').bind(t.id, code, who, me.id, JSON.stringify(picks), now).run();
    return json({ ok: true });
  }
  if (b.action === 'review') {
    if (!ex) return json({ error: 'Save your own top 3 first.' }, 409);
    if (ex.reviewed_at) return json({ error: 'This review is already submitted.' }, 409);
    const top = await appTop(env, t.id); if (!top) return json({ error: 'This student has not reached the results yet.' }, 409);
    const base = JSON.parse(ex.baseline), o3 = base.filter(p => top.slice(0, 3).includes(p)).length, o6 = base.filter(p => top.includes(p)).length;
    const use = USE.includes(String(b.use)) ? String(b.use) : null; if (!use) return json({ error: 'Choose whether you would use this with a real student.' }, 400);
    await env.DB.prepare('UPDATE reviews SET app_top = ?, overlap = ?, overlap6 = ?, missed = ?, wrong = ?, wrong_field = ?, use_it = ?, notes = ?, reviewed_at = ? WHERE tester_id = ?').bind(JSON.stringify(top), o3, o6, clean(b.missed, 600), clean(b.wrong, 600), clean(b.wrongField, 60), use, clean(b.notes, 800), now, t.id).run();
    return json({ ok: true, overlap: o3 });
  }
  return json({ error: 'Unknown action.' }, 400);
}
