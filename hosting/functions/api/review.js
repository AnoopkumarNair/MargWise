import { json, safeEq, readJson, ipHash, keyOk, mintToken } from './_util.js';
// Counsellor workspace. A counsellor works for one school: they add students (counsellor-led), lock their own top 3 BEFORE the app's result is returned
// (enforced here, not in the page), review the result, log follow-ups and pull a report. Keys are personal and school-scoped; the admin key sees everything.
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const FID = /^[a-z]{2,8}$/, CODE = /^[0-9A-F]{6}$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
const USE = ['yes', 'with changes', 'no'], SURE = ['sure', 'unsure'], VIEW = ['changed', 'same', 'unsure'], SEC = ['subjects', 'exams', 'degree', 'colleges', 'abroad', 'pay', 'ai'], SECV = ['ok', 'change', 'missing'];
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(x => x.toString(16).padStart(2, '0')).join('');
const csvCell = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const codeOf = id => id.replace(/-/g, '').slice(0, 6).toUpperCase();
async function authed(request, env) {
  const key = (request.headers.get('x-counsellor-key') || '').trim(), now = Date.now(), ip = keyOk(env.SIGN_KEY) ? await ipHash(request, env.SIGN_KEY) : 'x';
  const f = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ip = ? AND ts > ?').bind('c:' + ip, now - 900000).first();
  if (f && f.n >= 30) return { status: 429 };
  if (keyOk(env.ADMIN_KEY) && safeEq(key, env.ADMIN_KEY)) return { status: 200, admin: true, id: null, name: 'admin', invite_id: null };
  const c = key.length >= 12 ? await env.DB.prepare('SELECT id, name, invite_id FROM counsellors WHERE key_hash = ? AND active = 1').bind(await sha(key)).first() : null;
  if (!c) { await env.DB.prepare('INSERT INTO admin_fail (ip, ts) VALUES (?, ?)').bind('c:' + ip, now).run(); return { status: 403 }; }
  await env.DB.prepare('UPDATE counsellors SET last_used = ? WHERE id = ?').bind(now, c.id).run();
  return { status: 200, admin: false, ...c };
}
// a counsellor sees their own school; students they added themselves stay private to them
const visible = (t, me) => me.admin || (t.invite_id != null && t.invite_id === me.invite_id && (t.counsellor_id == null || t.counsellor_id === me.id));
async function findTester(env, code, me) {
  const rows = (await env.DB.prepare("SELECT id, name, invite_id, counsellor_id, source, klass, followup_ok FROM testers WHERE substr(upper(replace(id, '-', '')), 1, 6) = ?").bind(code).all()).results;
  const t = rows.length === 1 ? rows[0] : null; return t && visible(t, me) ? t : null;
}
async function appTop(env, id, since) {   // the first result after the counsellor locked their picks; a replay later cannot change what is compared
  let e = since ? await env.DB.prepare("SELECT data FROM events WHERE tester_id = ? AND type = 'fields' AND ts >= ? ORDER BY id ASC LIMIT 1").bind(id, since).first() : null;
  if (!e) e = await env.DB.prepare("SELECT data FROM events WHERE tester_id = ? AND type = 'fields' AND (? IS NULL OR ts < ?) ORDER BY id DESC LIMIT 1").bind(id, since || null, since || null).first();
  if (!e) return null; try { const o = JSON.parse(e.data).order; return Array.isArray(o) ? o.slice(0, 6) : null; } catch { return null; }
}
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
async function report(env, me, from, to, csv) {
  const f = DATE.test(from) ? Date.parse(from + 'T00:00:00Z') : 0, t = DATE.test(to) ? Date.parse(to + 'T23:59:59Z') : Date.now() + 86400000;
  const rows = (await env.DB.prepare("SELECT t.id, t.name, t.klass, t.source, r.baseline, r.blind, r.sure, r.app_top, r.overlap, r.use_it, r.view_after, r.baseline_at, r.reviewed_at, EXISTS(SELECT 1 FROM events e WHERE e.tester_id = t.id AND e.type = 'fields') AS fin FROM testers t LEFT JOIN reviews r ON r.tester_id = t.id AND (? OR r.counsellor_id = ?) WHERE (? OR (t.invite_id = ? AND (t.counsellor_id IS NULL OR t.counsellor_id = ?))) AND t.created_at BETWEEN ? AND ? ORDER BY t.created_at").bind(me.admin ? 1 : 0, me.id, me.admin ? 1 : 0, me.invite_id, me.id, f, t).all()).results;
  const done = rows.filter(r => r.reviewed_at), n = done.length;
  if (csv) return new Response([['student_code', 'student', 'class', 'how_joined', 'finished_game', 'own_top3', 'blind', 'sure', 'app_top3', 'match_of_3', 'would_use', 'view_after_chat', 'reviewed_on']].concat(rows.map(r => [codeOf(r.id), r.name, r.klass || '', r.source === 'counsellor' ? 'counsellor-led' : 'self', r.fin ? 'yes' : 'no', r.baseline || '', r.blind === 1 ? 'yes' : r.baseline ? 'no' : '', r.sure || '', r.app_top ? JSON.parse(r.app_top).slice(0, 3).join(' ') : '', r.overlap ?? '', r.use_it || '', r.view_after || '', r.reviewed_at ? ymd(r.reviewed_at) : ''])).map(r => r.map(csvCell).join(',')).join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="counsellor-report.csv"', 'cache-control': 'no-store' } });
  // averages are shown from 5 reviews because fewer is too few to mean anything (not a privacy control: the counsellor sees their own students by name)
  const totals = n >= 5 ? { reviewed: n, avgMatchOf3: +(done.reduce((a, r) => a + r.overlap, 0) / n).toFixed(2), wouldUse: { yes: done.filter(r => r.use_it === 'yes').length, withChanges: done.filter(r => r.use_it === 'with changes').length, no: done.filter(r => r.use_it === 'no').length } } : { reviewed: n, note: 'Averages are shown from 5 reviews; fewer is too few to mean anything.' };
  return json({ students: rows.length, finished: rows.filter(r => r.fin).length, totals, rows: rows.map(r => ({ code: codeOf(r.id), name: r.name, klass: r.klass, led: r.source === 'counsellor', finished: !!r.fin, state: r.reviewed_at ? 'reviewed' : r.baseline_at ? 'picks saved' : 'new', match: r.overlap ?? null, use: r.use_it || null })) });
}
export async function onRequest({ request, env }) {
  const me = await authed(request, env); if (me.status !== 200) return json({ error: me.status === 429 ? 'Too many wrong keys. Try again in 15 minutes.' : 'Not allowed.' }, me.status);
  const u = new URL(request.url), now = Date.now(), q = u.searchParams;
  if (request.method === 'GET' && q.get('report')) return report(env, me, q.get('from') || '', q.get('to') || '', q.get('report') === 'csv');
  if (request.method === 'GET' && !q.get('code')) {   // my students: no typing of codes, no chance of mixing students up
    if (me.admin) return json({ students: [] });
    const rows = (await env.DB.prepare("SELECT t.id, t.name, t.klass, t.source, t.consent_on, r.baseline_at, r.reviewed_at, EXISTS(SELECT 1 FROM events e WHERE e.tester_id = t.id AND e.type = 'fields') AS has_result FROM testers t LEFT JOIN reviews r ON r.tester_id = t.id AND r.counsellor_id = ? WHERE t.invite_id = ? AND (t.counsellor_id IS NULL OR t.counsellor_id = ?) ORDER BY t.created_at DESC LIMIT 300").bind(me.id, me.invite_id, me.id).all()).results;
    return json({ counsellor: me.name, students: rows.map(r => ({ code: codeOf(r.id), name: r.name, klass: r.klass || '', led: r.source === 'counsellor', consent_on: r.consent_on || null, state: r.reviewed_at ? 'done' : r.baseline_at ? 'baselined' : 'new', finished: !!r.has_result })) });
  }
  if (request.method === 'GET') {
    const code = clean(q.get('code'), 8).toUpperCase(); if (!CODE.test(code)) return json({ error: 'A student code is 6 letters or digits, for example 3F9A2C.' }, 400);
    const t = await findTester(env, code, me); if (!t) return json({ error: 'No student found with that code. Check it with the student.' }, 404);
    const r = await env.DB.prepare('SELECT counsellor_id, baseline, baseline_at, app_top, overlap, overlap6, reviewed_at FROM reviews WHERE tester_id = ?').bind(t.id).first();
    const fu = (await env.DB.prepare('SELECT months, stream, used, note FROM followups WHERE tester_id = ? ORDER BY months').bind(t.id).all()).results;
    if (!r) return json({ name: t.name, led: t.source === 'counsellor', state: 'new', followups: fu, followupOk: !!t.followup_ok });
    if (!me.admin && r.counsellor_id !== me.id) return json({ name: t.name, state: 'taken' });
    const top = r.app_top ? JSON.parse(r.app_top) : await appTop(env, t.id, r.baseline_at);
    return json({ name: t.name, led: t.source === 'counsellor', state: r.reviewed_at ? 'done' : 'baselined', baseline: JSON.parse(r.baseline), appTop: top ? top.slice(0, 3) : null, overlap: r.reviewed_at ? r.overlap : null, followups: fu, followupOk: !!t.followup_ok });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const rj = await readJson(request, 6000); if (rj.err) return json({ error: rj.err }, rj.status); const b = rj.b;
  if (b.action === 'addStudent') {
    if (me.admin) return json({ error: 'Use a counsellor key to add students.' }, 400);
    const name = clean(b.name, 40), klass = clean(b.klass, 10), on = clean(b.consent_on, 10), fup = b.followup === true ? 1 : 0;
    if (!name) return json({ error: 'Add the student\'s first name.' }, 400);
    if (b.consent !== true || !DATE.test(on) || Number.isNaN(Date.parse(on)) || new Date(on + 'T00:00:00Z').toISOString().slice(0, 10) !== on || Date.parse(on) > now + 86400000 || Date.parse(on) < now - 730 * 86400000) return json({ error: 'Tick that a signed parent consent sheet is on file, and give its date.' }, 400);
    const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE counsellor_id = ? AND created_at > ?').bind(me.id, now - 86400000).first(); if (cnt && cnt.n >= 60) return json({ error: 'Daily limit reached.' }, 429);
    const id = crypto.randomUUID();
    await env.DB.batch([env.DB.prepare('INSERT INTO testers (id, name, created_at, ua, invite_id, source, counsellor_id, klass, consent_on, followup_ok) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)').bind(id, name, now, me.invite_id, 'counsellor', me.id, klass, on, fup), env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'student_added', JSON.stringify({ counsellor_id: me.id }))]);
    return json({ ok: true, code: codeOf(id) });
  }
  const code = clean(b.code, 8).toUpperCase(); if (!CODE.test(code)) return json({ error: 'Bad student code.' }, 400);
  const t = await findTester(env, code, me); if (!t) return json({ error: 'No student found with that code.' }, 404);
  const ex = await env.DB.prepare('SELECT baseline, baseline_at, reviewed_at, counsellor_id FROM reviews WHERE tester_id = ?').bind(t.id).first();
  if (b.action === 'start') {   // hands the device to a counsellor-led student; picks must be locked first so the review stays blind
    if (t.source !== 'counsellor') return json({ error: 'This student signs in on their own device.' }, 400);
    if (!ex) return json({ error: 'Lock in your own top 3 first, then start the game.' }, 409);
    if (!keyOk(env.SIGN_KEY)) return json({ error: 'Not available right now.' }, 503);
    return json({ testerId: t.id, token: await mintToken(t.id, env.SIGN_KEY), name: t.name });
  }
  if ((b.action === 'remove' || b.action === 'followup') && ex && !me.admin && ex.counsellor_id !== me.id) return json({ error: 'Another counsellor reviewed this student.' }, 403);
  if (b.action === 'remove') {   // withdrawal: everything about the student goes, and the removal is logged without the name
    await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE tester_id = ?').bind(t.id), env.DB.prepare('DELETE FROM reviews WHERE tester_id = ?').bind(t.id), env.DB.prepare('DELETE FROM followups WHERE tester_id = ?').bind(t.id), env.DB.prepare('DELETE FROM testers WHERE id = ?').bind(t.id), env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'student_removed', JSON.stringify({ by: me.name }))]);
    return json({ ok: true });
  }
  if (b.action === 'followup') {
    if (!t.followup_ok) return json({ error: 'This student\'s consent sheet does not cover follow-up checks, so none can be saved.' }, 400);
    const months = Number(b.months); if (![3, 6, 12].includes(months)) return json({ error: 'Choose 3, 6 or 12 months.' }, 400);
    await env.DB.prepare('INSERT INTO followups (tester_id, months, stream, used, note, counsellor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tester_id, months) DO UPDATE SET stream = excluded.stream, used = excluded.used, note = excluded.note, created_at = excluded.created_at').bind(t.id, months, clean(b.stream, 60), ['yes', 'partly', 'no'].includes(b.used) ? b.used : null, clean(b.note, 600), me.id, now).run();
    return json({ ok: true });
  }
  if (b.action === 'baseline') {
    if (ex) return json({ error: 'Your own picks are already saved for this student and are locked.' }, 409);
    const picks = Array.isArray(b.picks) ? b.picks.map(x => clean(x, 8)) : [], who = me.admin ? (clean(b.counsellor, 40) || 'admin') : me.name;
    if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every(p => FID.test(p))) return json({ error: 'Choose exactly 3 different fields.' }, 400);
    const seen = await appTop(env, t.id);   // blind = the student had not yet reached the results when the counsellor locked their picks
    try { await env.DB.prepare('INSERT INTO reviews (tester_id, code, counsellor, counsellor_id, baseline, baseline_at, blind, career_note, sure) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(t.id, code, who, me.id, JSON.stringify(picks), now, seen ? 0 : 1, clean(b.career_note, 120), SURE.includes(b.sure) ? b.sure : null).run(); } catch { return json({ error: 'Your own picks are already saved for this student and are locked.' }, 409); }
    return json({ ok: true });
  }
  if (b.action === 'review') {
    if (!ex) return json({ error: 'Save your own top 3 first.' }, 409);
    if (!me.admin && ex.counsellor_id !== me.id) return json({ error: 'Another counsellor saved the picks for this student.' }, 403);
    if (ex.reviewed_at) return json({ error: 'This review is already submitted.' }, 409);
    const top = await appTop(env, t.id, ex.baseline_at); if (!top) return json({ error: 'This student has not reached the results yet.' }, 409);
    const base = JSON.parse(ex.baseline), o3 = base.filter(p => top.slice(0, 3).includes(p)).length, o6 = base.filter(p => top.includes(p)).length;
    const use = USE.includes(String(b.use)) ? String(b.use) : null; if (!use) return json({ error: 'Choose whether you would use this with a real student.' }, 400);
    const sec = {}; if (b.sections && typeof b.sections === 'object') for (const k of SEC) if (SECV.includes(b.sections[k])) sec[k] = b.sections[k];
    await env.DB.prepare('UPDATE reviews SET app_top = ?, overlap = ?, overlap6 = ?, missed = ?, wrong = ?, wrong_field = ?, use_it = ?, notes = ?, sections = ?, view_after = ?, reviewed_at = ? WHERE tester_id = ? AND reviewed_at IS NULL').bind(JSON.stringify(top), o3, o6, clean(b.missed, 600), clean(b.wrong, 600), clean(b.wrongField, 60), use, clean(b.notes, 800), JSON.stringify(sec), VIEW.includes(b.view_after) ? b.view_after : null, now, t.id).run();
    return json({ ok: true, overlap: o3 });
  }
  return json({ error: 'Unknown action.' }, 400);
}
