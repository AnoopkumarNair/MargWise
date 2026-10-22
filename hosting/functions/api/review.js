import { json, safeEq, readJson, ipHash, keyOk } from './_util.js';
// Counsellor review. The counsellor must lock in their own top 3 BEFORE the app's result is returned (enforced here, not in the page).
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const FID = /^[a-z]{2,8}$/, CODE = /^[0-9A-F]{6}$/;
const USE = ['yes', 'with changes', 'no'];
async function authed(request, env) {
  const key = request.headers.get('x-counsellor-key') || '', now = Date.now(), ip = keyOk(env.SIGN_KEY) ? await ipHash(request, env.SIGN_KEY) : 'x';
  const f = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ip = ? AND ts > ?').bind(ip, now - 900000).first();
  if (f && f.n >= 8) return 429;
  const ok = (String(env.COUNSELLOR_KEY || '').length >= 12 && safeEq(key, env.COUNSELLOR_KEY)) || (keyOk(env.ADMIN_KEY) && safeEq(key, env.ADMIN_KEY));
  if (!ok) { await env.DB.prepare('INSERT INTO admin_fail (ip, ts) VALUES (?, ?)').bind(ip, now).run(); return 403; }
  return 200;
}
async function findTester(env, code) {
  const rows = (await env.DB.prepare("SELECT id, name FROM testers WHERE substr(upper(replace(id, '-', '')), 1, 6) = ?").bind(code).all()).results;
  return rows.length === 1 ? rows[0] : null;
}
async function appTop(env, id) {
  const e = await env.DB.prepare("SELECT data FROM events WHERE tester_id = ? AND type = 'fields' ORDER BY id DESC LIMIT 1").bind(id).first();
  if (!e) return null; try { const o = JSON.parse(e.data).order; return Array.isArray(o) ? o.slice(0, 6) : null; } catch { return null; }
}
export async function onRequest({ request, env }) {
  const st = await authed(request, env); if (st !== 200) return json({ error: st === 429 ? 'Too many wrong keys. Try again in 15 minutes.' : 'Not allowed.' }, st);
  const u = new URL(request.url), now = Date.now();
  if (request.method === 'GET') {
    const code = clean(u.searchParams.get('code'), 8).toUpperCase(); if (!CODE.test(code)) return json({ error: 'A student code is 6 letters or digits, for example 3F9A2C.' }, 400);
    const t = await findTester(env, code); if (!t) return json({ error: 'No student found with that code. Check it with the student.' }, 404);
    const r = await env.DB.prepare('SELECT counsellor, baseline, app_top, overlap, overlap6, reviewed_at FROM reviews WHERE tester_id = ?').bind(t.id).first();
    if (!r) return json({ name: t.name, state: 'new' });
    const top = await appTop(env, t.id);
    return json({ name: t.name, state: r.reviewed_at ? 'done' : 'baselined', baseline: JSON.parse(r.baseline), appTop: top ? top.slice(0, 3) : null, overlap: r.reviewed_at ? r.overlap : null });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const rj = await readJson(request, 6000); if (rj.err) return json({ error: rj.err }, rj.status); const b = rj.b;
  const code = clean(b.code, 8).toUpperCase(); if (!CODE.test(code)) return json({ error: 'Bad student code.' }, 400);
  const t = await findTester(env, code); if (!t) return json({ error: 'No student found with that code.' }, 404);
  const ex = await env.DB.prepare('SELECT baseline, reviewed_at FROM reviews WHERE tester_id = ?').bind(t.id).first();
  if (b.action === 'baseline') {
    if (ex) return json({ error: 'Your own picks are already saved for this student and are locked.' }, 409);
    const picks = Array.isArray(b.picks) ? b.picks.map(x => clean(x, 8)) : [], who = clean(b.counsellor, 40);
    if (!who) return json({ error: 'Add your name.' }, 400);
    if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every(p => FID.test(p))) return json({ error: 'Choose exactly 3 different fields.' }, 400);
    await env.DB.prepare('INSERT INTO reviews (tester_id, code, counsellor, baseline, baseline_at) VALUES (?, ?, ?, ?, ?)').bind(t.id, code, who, JSON.stringify(picks), now).run();
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
