// BACKEND ADR-15, T3.2: students and adults share tables but never mix. With an adult in the database, every existing student, admin and
// counsellor endpoint returns what it returned before, and the adult is invisible. join.js refuses adult codes. Tokens do not cross.
import test from 'node:test';
import assert from 'node:assert/strict';
import './json_loader.mjs';
import { createFakeDb } from './fakedb.mjs';
import { onRequestPost as join } from '../../functions/api/join.js';
import { onRequestPost as resume } from '../../functions/api/resume.js';
import { onRequestPost as meSaved } from '../../functions/api/me.js';
import { onRequestPost as eventStudent } from '../../functions/api/event.js';
import { onRequestGet as config } from '../../functions/api/config.js';
const { onRequest: admin } = await import('../../functions/api/admin.js');
import { onRequest as counsellor } from '../../functions/api/review.js';
import { mintToken, retHash, purgeOld } from '../../functions/api/_util.js';
import { makeFakeDeps } from '../../core/deps.js';
import { mintSession } from '../../core/keys.js';
import { KEYS, T0, DAY } from './api_helpers.mjs';

const ENV = { SIGN_KEY: KEYS.SIGN_KEY, ADMIN_KEY: 'admin-key-for-isolation-tests-1234' };
const COUNSELLOR_KEY = 'counsellor-key-1234';
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(x => x.toString(16).padStart(2, '0')).join('');
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', S1 = '11111111-1111-4111-8111-111111111111', S2 = '22222222-2222-4222-8222-222222222222';
const run = (db, sql, ...a) => db.raw.prepare(sql).run(...a);

async function fixture({ adult }) {
  const db = createFakeDb();
  run(db, "INSERT INTO invites (id, code, label, created_at, track) VALUES (1, 'school1', 'School A', ?, NULL)", T0);
  run(db, 'INSERT INTO counsellors (id, name, invite_id, key_hash, active, created_at) VALUES (1, ?, 1, ?, 1, ?)', 'Ms Rao', await sha(COUNSELLOR_KEY), T0);
  run(db, "INSERT INTO testers (id, name, created_at, invite_id, ret_hash) VALUES (?, 'Stu One', ?, 1, ?)", S1, T0 - 5 * DAY, await retHash('ABCD-2345', ENV.SIGN_KEY));
  run(db, "INSERT INTO testers (id, name, created_at, invite_id, source, counsellor_id, klass, consent_on, followup_ok) VALUES (?, 'Stu Two', ?, 1, 'counsellor', 1, '10A', '2025-10-01', 1)", S2, T0 - 4 * DAY);
  const ev = (id, type, data, ts = T0 - DAY) => run(db, 'INSERT INTO events (tester_id, ts, type, data) VALUES (?, ?, ?, ?)', id, ts, type, JSON.stringify(data));
  ev(S1, 'walk_start', { seed: 1 }); ev(S1, 'place_done', { order: ['s01-A', 's01-B', 's01-C', 's01-D'], spent: { 's01-A': 2 }, echo: false });
  ev(S1, 'fields', { order: ['eng', 'med', 'law'], scores: [1, 2, 3] }); ev(S1, 'result', { code: ['I', 'R', 'A'] }); ev(S1, 'feedback', { look: 4, text: 'fun' });
  ev(S2, 'place_done', { order: ['s02-A', 's02-B', 's02-C', 's02-D'], spent: { 's02-B': 1 }, echo: false }); ev(S2, 'fields', { order: ['eng', 'law'], scores: [1, 2] });
  run(db, "INSERT INTO reviews (tester_id, code, counsellor, counsellor_id, baseline, baseline_at, blind) VALUES (?, '222222', 'Ms Rao', 1, '[\"eng\",\"law\",\"med\"]', ?, 0)", S2, T0 - 3 * DAY);
  run(db, "INSERT INTO followups (tester_id, months, stream, created_at) VALUES (?, 3, 'sci', ?)", S2, T0);
  if (adult) {
    run(db, "INSERT INTO invites (id, code, label, created_at, track) VALUES (2, 'adult1', 'AdultLabelX', ?, 'adult')", T0);
    // the adult row is also given the student invite and a return code on purpose: only the track filter can keep it out
    run(db, "INSERT INTO testers (id, name, created_at, invite_id, track, age_band, email_hash, ret_hash, key_v) VALUES (?, 'AdultNameX', ?, 1, 'adult', '25-34', ?, ?, 1)", A_ID, T0 - 2 * DAY, 'ee'.repeat(32), await retHash('ZZZZ-9999', ENV.SIGN_KEY));
    ev(A_ID, 'place_done', { order: ['s09-A', 's09-B', 's09-C', 's09-D'], spent: { 's09-A': 2 }, echo: false }); ev(A_ID, 'result', { code: ['E', 'C', 'S'] }); ev(A_ID, 'feedback', { text: 'AdultSecretText' }); ev(A_ID, 'fields', { order: ['adultfield'], scores: [9] });
    run(db, "INSERT INTO profiles (tester_id, v, rev, data, updated_at) VALUES (?, 1, 1, '{\"v\":1}', ?)", A_ID, T0);
  }
  return db;
}
const env = db => ({ DB: db, ...ENV });
const A = (db, qs, method = 'GET', body) => admin({ request: new Request('https://x.test/api/admin' + qs, { method, headers: { 'x-admin-key': ENV.ADMIN_KEY, 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: body ? JSON.stringify(body) : undefined }), env: env(db) });
const C = (db, qs, method = 'GET', body) => counsellor({ request: new Request('https://x.test/api/review' + qs, { method, headers: { 'x-counsellor-key': COUNSELLOR_KEY, 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: body ? JSON.stringify(body) : undefined }), env: env(db) });
const post = (fn, db, body, extraEnv = {}) => fn({ request: new Request('https://x.test/api/x', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '5.6.7.8' }, body: JSON.stringify(body) }), env: { ...env(db), ...extraEnv } });
const text = async r => r.text();
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (['lastTs', 'created_at'].includes(k) ? undefined : v)));

test('admin views: with an adult present the answers are exactly the answers without one, and the adult is not in them', async () => {
  const [without, withA] = [await fixture({ adult: false }), await fixture({ adult: true })];
  for (const qs of ['', '?itemstats=1', '?reviews=1', '?reviews=csv', '?audit=1', '?counsellors=1']) {
    const a = await A(without, qs), b = await A(withA, qs); assert.equal(a.status, b.status, qs);
    const ta = await text(a), tb = await text(b); assert.equal(ta, tb, 'admin ' + (qs || 'testers list') + ' differs when an adult exists');
    for (const mark of ['AdultNameX', 'AdultSecretText', A_ID, 'adultfield']) assert.ok(!tb.includes(mark), qs + ' shows the adult: ' + mark);
  }
  const list = await (await A(withA, '')).json(); assert.deepEqual(list.testers.map(t => t.name).sort(), ['Stu One', 'Stu Two']);
  const one = await (await A(withA, '?tester=' + S1)).json(); assert.equal(one.events.length, 5);
  const adultEvents = await (await A(withA, '?tester=' + A_ID)).json(); assert.deepEqual(adultEvents.events, [], 'the adult\'s events are not readable here');
  assert.equal((await (await A(withA, '?itemstats=1')).json()).stops, 2, 'the adult\'s place_done is not in the item statistics');
});
test('admin actions never reach an adult: delete, new return code and merge answer "not found"; students still work', async () => {
  const db = await fixture({ adult: true });
  let r = await A(db, '?tester=' + A_ID, 'DELETE'); assert.equal(r.status, 404);
  r = await A(db, '?newcode=' + A_ID, 'POST'); assert.equal(r.status, 404);
  r = await A(db, '?merge=1', 'POST', { from: A_ID, into: S1 }); assert.equal(r.status, 404); r = await A(db, '?merge=1', 'POST', { from: S1, into: A_ID }); assert.equal(r.status, 404);
  const n = tbl => db.raw.prepare(`SELECT COUNT(*) AS n FROM ${tbl} WHERE tester_id = ?`).get(A_ID).n;
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM testers WHERE id = ?').get(A_ID).n, 1); assert.equal(n('events'), 4); assert.equal(n('profiles'), 1);
  r = await A(db, '?newcode=' + S1, 'POST'); assert.equal(r.status, 200, 'a student still gets a new return code');
  r = await A(db, '?tester=' + S1, 'DELETE'); assert.equal(r.status, 200); assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM testers WHERE id = ?').get(S1).n, 0);
});
test('admin revoke is by id and sets tok_after only; it also reaches an adult (the owner\'s way to cut a leaked adult session)', async () => {
  const db = await fixture({ adult: true }); const r = await A(db, '?revoke=' + A_ID, 'POST'); assert.equal(r.status, 200);
  assert.equal(db.raw.prepare('SELECT tok_after FROM testers WHERE id = ?').get(A_ID).tok_after > 0, true);
});
test('admin invites: the list shows the track; a new invite can be for students (the default) or adults; anything else is refused', async () => {
  const db = await fixture({ adult: true });
  const list = await (await A(db, '?invites=1')).json(); assert.deepEqual(Object.fromEntries(list.invites.map(i => [i.code, i.track])), { school1: 'student', adult1: 'adult' });
  let r = await (await A(db, '?invites=1', 'POST', { label: 'Group', code: 'grp-student' })).json(); assert.equal(r.ok, true); assert.equal(r.track, 'student');
  r = await (await A(db, '?invites=1', 'POST', { label: 'Pilot', code: 'grp-adult', track: 'adult' })).json(); assert.equal(r.track, 'adult');
  r = await (await A(db, '?invites=1', 'POST', { label: 'Pilot', code: 'grp-x', track: 'student' })).json(); assert.equal(r.track, 'student');
  assert.equal((await A(db, '?invites=1', 'POST', { label: 'Pilot', code: 'grp-bad', track: 'teacher' })).status, 400);
  assert.deepEqual(db.raw.prepare("SELECT code, track FROM invites WHERE code LIKE 'grp-%' ORDER BY code").all().map(x => [x.code, x.track]), [['grp-adult', 'adult'], ['grp-student', null], ['grp-x', null]]);
  assert.equal((await A(db, '?counsellors=1', 'POST', { name: 'Mr X', invite_id: 2 })).status, 400, 'a counsellor cannot be attached to an adult invite');
  assert.equal((await A(db, '?counsellors=1', 'POST', { name: 'Mr X', invite_id: 1 })).status, 200);
});

test('counsellor views: the same answers with an adult present, even one given the school\'s invite; the adult\'s code finds nothing', async () => {
  const [without, withA] = [await fixture({ adult: false }), await fixture({ adult: true })];
  for (const qs of ['', '?report=1', '?report=csv', '?code=' + S2.replace(/-/g, '').slice(0, 6).toUpperCase()]) {
    const a = await C(without, qs), b = await C(withA, qs); assert.equal(a.status, b.status, qs);
    const ta = await text(a), tb = await text(b); assert.equal(ta, tb, 'counsellor ' + (qs || 'list') + ' differs');
    for (const mark of ['AdultNameX', 'AAAAAA', A_ID, 'adultfield']) assert.ok(!tb.includes(mark), qs + ' shows the adult');
  }
  const r = await C(withA, '?code=AAAAAA'); assert.equal(r.status, 404);
  const rr = await C(withA, '', 'POST', { action: 'baseline', code: 'AAAAAA', picks: ['eng', 'law', 'med'] }); assert.equal(rr.status, 404);
  const start = await C(withA, '', 'POST', { action: 'start', code: 'AAAAAA' }); assert.equal(start.status, 404);
  assert.equal(withA.raw.prepare('SELECT COUNT(*) AS n FROM reviews WHERE tester_id = ?').get(A_ID).n, 0);
  const students = (await (await C(withA, '')).json()).students; assert.equal(students.length, 2);
});

test('join.js: a student code works; an adult code is refused with the adult link, claims nothing and counts nothing', async () => {
  const db = await fixture({ adult: true }); db.raw.exec("INSERT INTO invites (code, label, created_at, track) VALUES ('ok-student', 's', 1, NULL)");
  const good = await post(join, db, { name: 'New Student', code: 'ok-student', consent: true }); assert.equal(good.status, 200); const b = await good.json(); assert.ok(b.testerId && b.token);
  assert.equal(db.raw.prepare("SELECT track FROM testers WHERE id = ?").get(b.testerId).track, null, 'a student row has no track');
  const j0 = db.raw.prepare('SELECT COUNT(*) AS n FROM joins').get().n, t0 = db.raw.prepare('SELECT COUNT(*) AS n FROM testers').get().n;
  const bad = await post(join, db, { name: 'Someone', code: 'adult1', consent: true }); assert.equal(bad.status, 403);
  assert.deepEqual(await bad.json(), { error: 'Use the link for working adults: /work/' });
  const bad2 = await post(join, db, { name: 'Someone', code: 'ADULT1', consent: true }); assert.equal(bad2.status, 403, 'case does not matter');
  assert.equal(db.raw.prepare("SELECT uses FROM invites WHERE code = 'adult1'").get().uses, 0); assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM testers').get().n, t0);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM joins').get().n, j0, 'a mistaken door is not a failed guess');
  const wrong = await post(join, db, { name: 'Someone', code: 'nope', consent: true }); assert.equal(wrong.status, 403); assert.match((await wrong.json()).error, /not right/);
});
test('join.js and config: with only an adult invite active, student sign-up is closed and the sign-up page says so', async () => {
  const db = createFakeDb(); db.raw.exec("INSERT INTO invites (code, label, created_at, track) VALUES ('adult1', 'a', 1, 'adult')");
  const c = await config({ env: env(db) }); assert.deepEqual(await c.json(), { needsCode: true, open: false });
  const r = await post(join, db, { name: 'X', code: 'whatever', consent: true }); assert.equal(r.status, 403); assert.match((await r.json()).error, /closed/);
  db.raw.exec("INSERT INTO invites (code, label, created_at, track) VALUES ('stu', 's', 1, NULL)"); assert.deepEqual(await (await config({ env: env(db) })).json(), { needsCode: true, open: true });
});
test('join.js hourly sign-up cap counts students only', async () => {
  const db = createFakeDb(); db.raw.exec("INSERT INTO invites (code, label, created_at, track) VALUES ('stu', 's', 1, NULL)");
  const ins = db.raw.prepare("INSERT INTO testers (id, name, created_at, track, age_band, email_hash) VALUES (?, 'x', ?, 'adult', '25-34', ?)");
  for (let i = 0; i < 100; i++) ins.run('ad-' + i, Date.now(), 'h' + i);
  assert.equal((await post(join, db, { name: 'S', code: 'stu', consent: true })).status, 200, 'a hundred adult sign-ups do not use up the student allowance');
});

test('tokens do not cross: an adult token fails student endpoints, and a student token fails adult endpoints', async () => {
  const db = await fixture({ adult: true }); const adultDeps = makeFakeDeps({ db, now: Date.now(), env: { ...KEYS } });
  const adultToken = await mintSession(adultDeps, A_ID);
  const sTok = await mintToken(S1, ENV.SIGN_KEY);
  for (const fn of [eventStudent, meSaved]) {
    assert.equal((await post(fn, db, { testerId: S1, token: sTok, events: [] })).status, 200, 'the student token works');
    assert.equal((await post(fn, db, { testerId: A_ID, token: adultToken, events: [] })).status, 403, 'the adult token does not');
    assert.equal((await post(fn, db, { testerId: A_ID, token: await mintToken(A_ID, ENV.SIGN_KEY), events: [] })).status, 403, 'not even a student-format token for an adult id');
  }
  const { handleGet } = await import('../../core/profile.js');
  const res = await handleGet(new Request('https://x.test/api/v1/me/profile', { headers: { authorization: 'Bearer ' + sTok } }), adultDeps); assert.equal(res.status, 401);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE tester_id = ? AND type = 'x'").get(A_ID).n, 0);
});
test('resume.js: a return code never signs an adult in as a student', async () => {
  const db = await fixture({ adult: true });
  const ok = await post(resume, db, { code: 'ABCD-2345' }); assert.equal(ok.status, 200); assert.equal((await ok.json()).testerId, S1);
  const adult = await post(resume, db, { code: 'ZZZZ-9999' }); assert.equal(adult.status, 403);
});

test('the student purge and end-of-pilot delete leave adults alone; student behaviour is as before', async () => {
  const db = await fixture({ adult: true }); run(db, 'UPDATE testers SET created_at = ? WHERE id = ?', 1, A_ID);   // an old adult
  const res = await purgeOld({ ...env(db), RETENTION_DAYS: '30' }, T0 + 60 * DAY, true);
  assert.equal(res.deleted, 1, 'Stu One only: Stu Two is kept for follow-up'); assert.equal(res.keptForFollowUp, 1);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM testers WHERE id = ?').get(A_ID).n, 1); assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM events WHERE tester_id = ?').get(A_ID).n, 4); assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM profiles').get().n, 1);
  const end = await A(db, '?endpilot=1', 'POST'); assert.equal(end.status, 200);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM testers WHERE id = ?').get(A_ID).n, 1, 'the end-of-pilot student deletion does not touch adults');
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM testers WHERE track IS NULL').get().n, 1, 'Stu Two stays: the follow-up consent keeps their row');
  // RETENTION_DAYS_STUDENT is read for students (falling back to RETENTION_DAYS); with neither set an automatic purge does nothing
  const d2 = await fixture({ adult: true });
  assert.equal(await purgeOld(env(d2), T0 + 400 * DAY), null);
  assert.equal((await purgeOld({ ...env(d2), RETENTION_DAYS_STUDENT: '1' }, T0 + 400 * DAY)).deleted, 1);
  assert.equal(d2.raw.prepare('SELECT COUNT(*) AS n FROM testers WHERE id = ?').get(A_ID).n, 1);
});
