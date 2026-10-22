import CLAIMS from './_claims.json';
import { json, safeEq, readJson, ipHash, keyOk, purgeOld, newRetCode, retHash } from './_util.js';
const safe = s => { try { return JSON.parse(s); } catch { return null; } };
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const csvCell = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const csvResp = (name, rows) => new Response(rows.map(r => r.map(csvCell).join(',')).join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="' + name + '"', 'cache-control': 'no-store' } });
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const genCode = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map(x => ALPHA[x % ALPHA.length]).join(''); };
const VERDICTS = { correct: 'correct', wrong: 'wrong', outdated: 'outdated', 'cannot find': 'cannot find', unclear: 'cannot find' };
export async function onRequest({ request, env }) {
  const u = new URL(request.url), key = request.headers.get('x-admin-key') || '', q = u.searchParams, m = request.method;
  const now0 = Date.now(), ip = keyOk(env.SIGN_KEY) ? await ipHash(request, env.SIGN_KEY) : 'x';
  const fails = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ip = ? AND ts > ?').bind('a:' + ip, now0 - 900000).first();
  if (fails && fails.n >= 30) return json({ error: 'Too many wrong keys. Try again in 15 minutes.' }, 429);
  if (!safeEq(key, env.ADMIN_KEY || '')) { await env.DB.prepare('INSERT INTO admin_fail (ip, ts) VALUES (?, ?)').bind('a:' + ip, now0).run(); await env.DB.prepare('DELETE FROM admin_fail WHERE ts < ?').bind(now0 - 86400000).run(); return json({ error: 'Not allowed.' }, 403); }
  const t = q.get('tester'), now = Date.now();
  if (q.get('endpilot') && m === 'POST') return json({ ok: true, result: await purgeOld(env, now, true, true) });   // end of pilot: delete everything except follow-up consent students' name, class and notes
  if (q.get('revoke') && m === 'POST') {   // a leaked token or return code: kill every token issued so far and the return code
    const r = await env.DB.prepare('UPDATE testers SET tok_after = ?, ret_hash = NULL WHERE id = ?').bind(now, String(q.get('revoke')).slice(0, 40)).run();
    await env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'revoke', '{}').run(); return json({ ok: true, changed: r.meta ? r.meta.changes : 0 });
  }
  if (q.get('purge') && m === 'POST') return json({ ok: true, purged: await purgeOld(env, now, true) });
  if (q.get('counsellors')) {   // personal, school-scoped counsellor keys. The key is shown once; only its hash is stored.
    if (m === 'GET') return json({ counsellors: (await env.DB.prepare('SELECT c.id, c.name, c.active, c.created_at, c.last_used, i.label AS school FROM counsellors c LEFT JOIN invites i ON i.id = c.invite_id ORDER BY c.id DESC').all()).results });
    const r = await readJson(request, 2000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
    if (m === 'POST') {
      const name = clean(b.name, 40), inv = Number(b.invite_id); if (!name || !Number.isInteger(inv)) return json({ error: 'Add the counsellor name and choose a school.' }, 400);
      if (!(await env.DB.prepare('SELECT 1 AS x FROM invites WHERE id = ?').bind(inv).first())) return json({ error: 'Unknown school.' }, 400);
      const ab = new Uint8Array(15); crypto.getRandomValues(ab); const key = [0, 1, 2].map(g => [...ab.slice(g * 5, g * 5 + 5)].map(x => ALPHA[x % ALPHA.length]).join('')).join('-');
      const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(x => x.toString(16).padStart(2, '0')).join('');
      await env.DB.prepare('INSERT INTO counsellors (name, invite_id, key_hash, active, created_at) VALUES (?, ?, ?, 1, ?)').bind(name, inv, h, now).run();
      await env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'counsellor_created', JSON.stringify({ name, invite_id: inv })).run();
      return json({ ok: true, key });
    }
    if (m === 'PUT') {   // hand a deactivated counsellor's students and reviews to another counsellor of the same school
      const from = Number(b.from), to = Number(b.to); if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return json({ error: 'Choose two different counsellors.' }, 400);
      const a = await env.DB.prepare('SELECT invite_id FROM counsellors WHERE id = ?').bind(from).first(), c = await env.DB.prepare('SELECT invite_id FROM counsellors WHERE id = ? AND active = 1').bind(to).first();
      if (!a || !c || a.invite_id !== c.invite_id) return json({ error: 'The new counsellor must be active and at the same school.' }, 400);
      await env.DB.batch([env.DB.prepare('UPDATE testers SET counsellor_id = ? WHERE counsellor_id = ?').bind(to, from), env.DB.prepare('UPDATE reviews SET counsellor_id = ?, counsellor = (SELECT name FROM counsellors WHERE id = ?) WHERE counsellor_id = ?').bind(to, to, from), env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'counsellor_reassign', JSON.stringify({ from, to }))]);
      return json({ ok: true });
    }
    if (m === 'PATCH') { const id = Number(b.id); if (!Number.isInteger(id)) return json({ error: 'id required' }, 400); await env.DB.prepare('UPDATE counsellors SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id).run(); await env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'counsellor_active', JSON.stringify({ id, active: !!b.active })).run(); return json({ ok: true }); }
    return json({ error: 'Method not allowed.' }, 405);
  }
  if (q.get('itemstats') && m === 'GET') {   // pilot item analysis: how often each card is picked and whether screen position matters (a flat spread is expected)
    const ev = (await env.DB.prepare("SELECT data FROM events WHERE type = 'place_done'").all()).results, pos = [0, 0, 0, 0], card = {}, shown = {}; let n = 0;
    for (const e of ev) { let d; try { d = JSON.parse(e.data); } catch { continue; } if (d.echo || !Array.isArray(d.order) || d.order.length !== 4) continue; n++;
      d.order.forEach((id, i) => { shown[id] = (shown[id] || 0) + 1; const sp = (d.spent || {})[id] || 0; pos[i] += sp; card[id] = (card[id] || 0) + sp; }); }
    const tot = pos.reduce((a, b) => a + b, 0);
    return json({ stops: n, oilByPosition: pos.map(v => tot ? +(v / tot).toFixed(3) : null), expectedPerPosition: .25, cards: Object.keys(shown).sort().map(id => ({ id, shown: shown[id], oilPerShowing: +(card[id] / shown[id]).toFixed(2) })) });
  }
  if (q.get('reviews') && m === 'GET') {
    const rows = (await env.DB.prepare('SELECT r.code, t.name, i.label AS school, r.counsellor, r.baseline, r.blind, r.sure, r.sections, r.view_after, r.career_note, r.app_top, r.overlap, r.overlap6, r.missed, r.wrong, r.wrong_field, r.use_it, r.notes, r.baseline_at, r.reviewed_at FROM reviews r JOIN testers t ON t.id = r.tester_id LEFT JOIN invites i ON i.id = t.invite_id ORDER BY r.baseline_at DESC').all()).results;
    if (q.get('reviews') === 'csv') return csvResp('counsellor-reviews.csv', [['student_code', 'student', 'school', 'counsellor', 'own_top3', 'blind', 'sure', 'career_in_mind', 'app_top6', 'top3_overlap', 'own_in_app_top6', 'app_missed', 'fact_wrong', 'fact_wrong_field', 'would_use', 'view_after_chat', 'section_feedback', 'notes', 'reviewed_at']].concat(rows.map(r => [r.code, r.name, r.school || 'master', r.counsellor, r.baseline, r.blind === 1 ? 'yes' : 'no', r.sure || '', r.career_note || '', r.app_top || '', r.overlap ?? '', r.overlap6 ?? '', r.missed || '', r.wrong || '', r.wrong_field || '', r.use_it || '', r.view_after || '', r.sections || '', r.notes || '', r.reviewed_at ? new Date(r.reviewed_at).toISOString() : ''])));
    const done = rows.filter(r => r.reviewed_at), n = done.length, sum = k => done.reduce((a, r) => a + (r[k] || 0), 0), missed = {};
    for (const r of done) { const top = JSON.parse(r.app_top || '[]').slice(0, 3); for (const p of JSON.parse(r.baseline)) if (!top.includes(p)) missed[p] = (missed[p] || 0) + 1; }
    return json({ reviews: rows, summary: { started: rows.length, done: n, sections: (() => { const o = {}; for (const r of done) { let x = {}; try { x = JSON.parse(r.sections || '{}'); } catch {} for (const [k, v] of Object.entries(x)) { (o[k] ||= { ok: 0, change: 0, missing: 0 })[v]++; } } return o; })(), avgTop3OverlapSureOnly: done.filter(r => r.sure === 'sure').length ? +(done.filter(r => r.sure === 'sure').reduce((a, r) => a + r.overlap, 0) / done.filter(r => r.sure === 'sure').length).toFixed(2) : null, blindReviews: done.filter(r => r.blind === 1).length, avgTop3OverlapBlindOnly: done.filter(r => r.blind === 1).length ? +(done.filter(r => r.blind === 1).reduce((a, r) => a + r.overlap, 0) / done.filter(r => r.blind === 1).length).toFixed(2) : null, avgTop3Overlap: n ? +(sum('overlap') / n).toFixed(2) : null, share2plus: n ? +(done.filter(r => r.overlap >= 2).length / n).toFixed(2) : null, avgOwnInTop6: n ? +(sum('overlap6') / n).toFixed(2) : null, wouldUse: { yes: done.filter(r => r.use_it === 'yes').length, withChanges: done.filter(r => r.use_it === 'with changes').length, no: done.filter(r => r.use_it === 'no').length }, factsFlagged: done.filter(r => r.wrong).length, fieldsCounsellorsPickedButAppMissed: missed } });
  }
  if (q.get('audit') && m === 'GET') return json({ audit: (await env.DB.prepare('SELECT ts, action, detail FROM audit ORDER BY id DESC LIMIT 100').all()).results });
  // ---- invite codes
  if (q.get('invites')) {
    if (m === 'GET') return json({ master: !!String(env.INVITE_CODE || '').trim(), invites: (await env.DB.prepare('SELECT id, code, label, max_uses, uses, expires_at, active, created_at FROM invites ORDER BY id DESC').all()).results });
    const r = await readJson(request, 4000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
    if (m === 'POST') {
      const label = clean(b.label, 40); if (!label) return json({ error: 'Add a label, for example the school or group name.' }, 400);
      let code = String(b.code || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || genCode(); if (code.length < 4) return json({ error: 'A code needs at least 4 letters or digits.' }, 400);
      const mx = b.max_uses === '' || b.max_uses == null ? null : Number(b.max_uses), ex = b.expires_at ? Number(b.expires_at) : null;
      if (mx !== null && !(Number.isInteger(mx) && mx > 0 && mx < 100000)) return json({ error: 'Use limit must be a whole number above 0.' }, 400);
      try { await env.DB.prepare('INSERT INTO invites (code, label, max_uses, uses, expires_at, active, created_at) VALUES (?, ?, ?, 0, ?, 1, ?)').bind(code, label, mx, Number.isFinite(ex) ? ex : null, now).run(); } catch { return json({ error: 'That code already exists. Try another.' }, 409); }
      return json({ ok: true, code });
    }
    if (m === 'PATCH') {
      const id = Number(b.id); if (!Number.isInteger(id)) return json({ error: 'id required' }, 400);
      const sets = [], vals = [];
      if (b.active !== undefined) { sets.push('active = ?'); vals.push(b.active ? 1 : 0); }
      if (b.label !== undefined) { sets.push('label = ?'); vals.push(clean(b.label, 40)); }
      if (b.max_uses !== undefined) { const mx = b.max_uses === '' || b.max_uses === null ? null : Number(b.max_uses); if (mx !== null && !(Number.isInteger(mx) && mx > 0)) return json({ error: 'Bad use limit.' }, 400); sets.push('max_uses = ?'); vals.push(mx); }
      if (b.expires_at !== undefined) { const ex = b.expires_at ? Number(b.expires_at) : null; sets.push('expires_at = ?'); vals.push(Number.isFinite(ex) ? ex : null); }
      if (!sets.length) return json({ error: 'Nothing to change.' }, 400);
      await env.DB.prepare('UPDATE invites SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run(); return json({ ok: true });
    }
    return json({ error: 'Method not allowed.' }, 405);
  }
  // ---- fact checks for reviewers
  const cl = q.get('claims');
  if (cl) {
    if (cl === 'generate' && m === 'POST') {
      const r = await readJson(request, 2000); if (r.err) return json({ error: r.err }, r.status);
      const size = Math.min(40, Math.max(5, Number(r.b.size) || 12));
      const items = JSON.parse(JSON.stringify(CLAIMS)); if (!Array.isArray(items) || !items.length) return json({ error: 'No claims found.' }, 500);
      for (let i = items.length - 1; i > 0; i--) { const a = new Uint32Array(1); crypto.getRandomValues(a); const j = a[0] % (i + 1); [items[i], items[j]] = [items[j], items[i]]; }
      const run = 'r' + now.toString(36), st = items.map((it, i) => { const id = /^[0-9a-f]{12}$/.test(it.cid || '') ? it.cid : (() => { const a = new Uint8Array(6); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); })(); return env.DB.prepare('INSERT INTO claims (id, run, batch, field_key, statement, urls) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET run = excluded.run, batch = excluded.batch').bind(id, run, Math.floor(i / size) + 1, clean(it.key, 80), clean(it.statement, 900), clean(it.urls, 900)); });
      for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
      return json({ ok: true, run, tasks: items.length, batches: Math.ceil(items.length / size) });
    }
    if (cl === 'ledger' && m === 'GET') {   // latest verdict per stable claim id; save as data/ledger.json for the pipeline
      const rows = (await env.DB.prepare('SELECT cr.claim_id AS cid, cr.verdict, cr.says, cr.checked_on, cr.reviewer, cr.applied FROM claim_reviews cr WHERE cr.id = (SELECT MAX(id) FROM claim_reviews WHERE claim_id = cr.claim_id)').all()).results;
      return new Response(JSON.stringify({ exported_at: new Date(now).toISOString(), claims: rows }, null, 1), { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="ledger.json"', 'cache-control': 'no-store' } });
    }
    if (cl === 'runs' && m === 'GET') {
      const rs = (await env.DB.prepare('SELECT run, COUNT(*) AS tasks, MAX(batch) AS batches FROM claims GROUP BY run ORDER BY run DESC LIMIT 20').all()).results, out = [];
      for (const x of rs) { const c = await env.DB.prepare('SELECT cr.verdict AS v, COUNT(*) AS n FROM claim_reviews cr JOIN claims c ON c.id = cr.claim_id WHERE c.run = ? GROUP BY cr.verdict').bind(x.run).all(); out.push({ ...x, verdicts: Object.fromEntries(c.results.map(y => [y.v, y.n])) }); }
      return json({ runs: out });
    }
    if (cl === 'csv' && m === 'GET') {
      const run = clean(q.get('run'), 40), batch = q.get('batch');
      const rows = batch === 'all' ? (await env.DB.prepare('SELECT id, statement, urls FROM claims WHERE run = ? ORDER BY batch, id').bind(run).all()).results : (await env.DB.prepare('SELECT id, statement, urls FROM claims WHERE run = ? AND batch = ? ORDER BY id').bind(run, Number(batch) || 1).all()).results;
      return csvResp('fact-check-' + run + '-' + (batch === 'all' ? 'all' : 'batch' + (Number(batch) || 1)) + '.csv', [['task_id', 'statement', 'official_pages_to_check', 'verdict (correct / wrong / outdated / cannot find)', 'what the page says (paste the exact words)', 'date you checked']].concat(rows.map(x => [x.id, x.statement, x.urls, '', '', ''])));
    }
    if (cl === 'upload' && m === 'POST') {
      const r = await readJson(request, 400000); if (r.err) return json({ error: r.err }, r.status);
      const reviewer = clean(r.b.reviewer, 40) || 'owner', rows = Array.isArray(r.b.rows) ? r.b.rows.slice(0, 400) : [], st = []; let skipped = 0;
      for (const x of rows) {
        const id = clean(x.id, 60), vd = VERDICTS[clean(x.verdict, 30).toLowerCase()];
        if (!id || !vd) { skipped++; continue; }
        const ok = await env.DB.prepare('SELECT 1 AS x FROM claims WHERE id = ?').bind(id).first(); if (!ok) { skipped++; continue; }
        st.push(env.DB.prepare('INSERT INTO claim_reviews (claim_id, reviewer, verdict, says, checked_on, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, reviewer, vd, clean(x.says, 1200), clean(x.checked_on, 20), now));
      }
      for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
      return json({ ok: true, saved: st.length, skipped });
    }
    if (cl === 'report' && m === 'GET') {
      const run = clean(q.get('run'), 40);
      const rows = (await env.DB.prepare('SELECT c.id, c.field_key, c.statement, c.urls, cr.reviewer, cr.verdict, cr.says, cr.checked_on, cr.applied, cr.id AS rid FROM claims c LEFT JOIN claim_reviews cr ON cr.claim_id = c.id WHERE c.run = ? ORDER BY c.field_key, c.id').bind(run).all()).results;
      const by = {}; for (const x of rows) { (by[x.id] ||= { id: x.id, field_key: x.field_key, statement: x.statement, urls: x.urls, reviews: [] }); if (x.verdict) by[x.id].reviews.push({ rid: x.rid, reviewer: x.reviewer, verdict: x.verdict, says: x.says, checked_on: x.checked_on, applied: x.applied }); }
      const all = Object.values(by).map(c => { const vs = new Set(c.reviews.map(r => r.verdict)); return { ...c, status: !c.reviews.length ? 'unreviewed' : vs.size > 1 ? 'disagree' : [...vs][0] === 'correct' ? 'correct' : 'needs change' }; });
      if (q.get('format') === 'csv') return csvResp('fact-check-report-' + run + '.csv', [['field_key', 'status', 'statement', 'reviewer', 'verdict', 'what the page says', 'date checked', 'applied']].concat(all.filter(c => c.status !== 'correct').flatMap(c => c.reviews.length ? c.reviews.map(r => [c.field_key, c.status, c.statement, r.reviewer, r.verdict, r.says, r.checked_on, r.applied ? 'yes' : 'no']) : [[c.field_key, c.status, c.statement, '', '', '', '', '']])));
      return json({ run, items: all });
    }
    if (cl === 'applied' && m === 'POST') {
      const r = await readJson(request, 20000); if (r.err) return json({ error: r.err }, r.status);
      const ids = (Array.isArray(r.b.ids) ? r.b.ids : []).slice(0, 400).map(x => Number(x)).filter(Number.isInteger);
      for (let i = 0; i < ids.length; i += 50) await env.DB.batch(ids.slice(i, i + 50).map(id => env.DB.prepare('UPDATE claim_reviews SET applied = 1 WHERE id = ?').bind(id)));
      return json({ ok: true, n: ids.length });
    }
    return json({ error: 'Unknown fact-check action.' }, 400);
  }
  // ---- testers
  if (q.get('newcode') && m === 'POST') {   // a tester lost their login code: only its hash is stored, so issue a new one (the old one stops working)
    const id = clean(q.get('newcode'), 40), row = await env.DB.prepare("SELECT id FROM testers WHERE id = ? AND COALESCE(source, '') != 'counsellor'").bind(id).first();
    if (!row) return json({ error: 'No self sign-up tester with that id.' }, 404);
    const code = newRetCode();
    await env.DB.batch([env.DB.prepare('UPDATE testers SET ret_hash = ? WHERE id = ?').bind(await retHash(code, env.SIGN_KEY), id), env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'login_code_reissued', JSON.stringify({ id }))]);
    return json({ ok: true, code });
  }
  if (q.get('merge') && m === 'POST') {   // the same person signed up twice: move everything from one row onto the row that is kept, then remove the empty row
    const r = await readJson(request, 1000); if (r.err) return json({ error: r.err }, r.status);
    const from = clean(r.b.from, 40), into = clean(r.b.into, 40);
    if (!from || !into || from === into) return json({ error: 'Choose two different testers.' }, 400);
    const cols = 'id, name, source, invite_id, ret_hash, counsellor_id, klass, consent_on, followup_ok';
    const a = await env.DB.prepare('SELECT ' + cols + ' FROM testers WHERE id = ?').bind(from).first(), k = await env.DB.prepare('SELECT ' + cols + ' FROM testers WHERE id = ?').bind(into).first();
    if (!a || !k) return json({ error: 'One of these testers no longer exists. Press Load again.' }, 404);
    if ((a.source || '') !== (k.source || '')) return json({ error: 'One was added by a counsellor and the other signed up alone, so they are not merged.' }, 409);
    if ((a.invite_id || null) !== (k.invite_id || null)) return json({ error: 'They joined with different invite codes, so they are not merged.' }, 409);
    const rv = await env.DB.prepare('SELECT COUNT(*) AS n FROM reviews WHERE tester_id IN (?, ?)').bind(from, into).first();
    if (rv && rv.n > 1) return json({ error: 'Both have a counsellor review. Keep both, or delete the review you do not need first.' }, 409);
    const fu = await env.DB.prepare('SELECT COUNT(*) AS n FROM followups f WHERE f.tester_id = ? AND EXISTS (SELECT 1 FROM followups g WHERE g.tester_id = ? AND g.months = f.months)').bind(from, into).first();
    if (fu && fu.n) return json({ error: 'Both have a follow-up note for the same month, so they are not merged.' }, 409);
    const moved = await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE tester_id = ?').bind(from).first();
    await env.DB.batch([
      // event ids are unique per tester; a clash is the same event sent twice, so the copy already on the kept row wins
      env.DB.prepare('UPDATE OR IGNORE events SET tester_id = ? WHERE tester_id = ?').bind(into, from),
      env.DB.prepare('DELETE FROM events WHERE tester_id = ?').bind(from),
      env.DB.prepare('UPDATE reviews SET tester_id = ? WHERE tester_id = ?').bind(into, from),
      env.DB.prepare('UPDATE followups SET tester_id = ? WHERE tester_id = ?').bind(into, from),
      // the kept row keeps its own return code; it takes the other one only if it had none
      env.DB.prepare('UPDATE testers SET ret_hash = COALESCE(ret_hash, ?), counsellor_id = COALESCE(counsellor_id, ?), klass = COALESCE(klass, ?), consent_on = COALESCE(consent_on, ?), followup_ok = MAX(COALESCE(followup_ok, 0), ?) WHERE id = ?').bind(a.ret_hash, a.counsellor_id, a.klass, a.consent_on, a.followup_ok || 0, into),
      env.DB.prepare('DELETE FROM testers WHERE id = ?').bind(from),
      env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'tester_merged', JSON.stringify({ from, into, events: moved ? moved.n : 0 }))
    ]);
    return json({ ok: true, events: moved ? moved.n : 0 });
  }
  if (m === 'DELETE') {
    if (!t) return json({ error: 'tester required' }, 400);
    await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE tester_id = ?').bind(t), env.DB.prepare('DELETE FROM reviews WHERE tester_id = ?').bind(t), env.DB.prepare('DELETE FROM followups WHERE tester_id = ?').bind(t), env.DB.prepare('DELETE FROM testers WHERE id = ?').bind(t)]);
    return json({ ok: true });
  }
  if (t) { const r = await env.DB.prepare('SELECT ts, type, data, session_id FROM events WHERE tester_id = ? ORDER BY id').bind(t).all(); return json({ events: r.results }); }
  const tes = (await env.DB.prepare('SELECT t.id, t.name, t.created_at, i.label AS source, t.invite_id, t.source AS kind FROM testers t LEFT JOIN invites i ON i.id = t.invite_id ORDER BY t.created_at DESC').all()).results;
  const ev = (await env.DB.prepare("SELECT tester_id, type, data, ts FROM events WHERE type IN ('result','self','areas','feedback','walk_start','place_done','fields','apt','context') ORDER BY id").all()).results;
  const by = {}; for (const e of ev) { (by[e.tester_id] ||= []).push(e); }
  const out = tes.map(x => {
    const es = by[x.id] || [], last = ty => { const f = es.filter(e => e.type === ty); return f.length ? safe(f[f.length - 1].data) : null; };
    return { ...x, walks: es.filter(e => e.type === 'walk_start').length, places: es.filter(e => e.type === 'place_done').length, lastTs: es.length ? es[es.length - 1].ts : x.created_at, result: last('result'), self: last('self'), areas: last('areas'), feedback: last('feedback'), fields: last('fields'), apt: last('apt'), ctx: last('context') };
  });
  return json({ testers: out });
}
