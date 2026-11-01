// TEST_PLAN layer 5, profile (T3.5): tokens, the contract check, unknown ids, tombstone mapping, concurrent writes, cross-account access, sliding refresh.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { handle as startH } from '../../core/email_start.js';
import { handle as verifyH } from '../../core/email_verify.js';
import { handle as completeH } from '../../core/email_complete.js';
import { handleGet, handlePut } from '../../core/profile.js';
import { handleLogoutAll } from '../../core/account.js';
import { mintSession, readSession } from '../../core/keys.js';
import { mintToken } from '../../functions/api/_util.js';
import { world, req, json, signUp, matches, KEYS, T0, DAY, HOUR } from './api_helpers.mjs';

const H = { startH, verifyH, completeH };
const exJson = f => JSON.parse(readFileSync(new URL('../../../contracts/examples/' + f, import.meta.url), 'utf8'));
const PROFILE = exJson('profile--spec6.json');
const get = (w, token) => handleGet(req('GET', '/api/v1/me/profile', { token }), w.deps);
const put = (w, token, body) => handlePut(req('PUT', '/api/v1/me/profile', { token, body }), w.deps);
const rows = (w, sql, ...a) => w.db.raw.prepare(sql).all(...a);
async function two() { const w = world(); const a = await signUp(w, { handlers: H, email: 'a@example.com', nickname: 'A' }), b = await signUp(w, { handlers: H, email: 'b@example.com', nickname: 'B' }); return { w, a: a.token, b: b.token }; }

test('tokens: none, wrong scheme, garbage, a student token, a deleted tester and a non-adult row all give the same 401', async () => {
  const { w, a } = await two(); const id = a.split('.')[1];
  const sid = '22222222-2222-4222-8222-222222222222'; w.db.raw.prepare('INSERT INTO testers (id, name, created_at) VALUES (?, ?, ?)').run(sid, 'Student', T0);
  const studentAsAdult = await mintSession(w.deps, sid);   // a correctly signed token for a row that is not an adult
  const cases = [undefined, 'garbage', 'v1.x.y.z', await mintToken(sid, KEYS.SIGN_KEY, T0), studentAsAdult, a.slice(0, -2) + 'ff'];
  const seen = new Set();
  for (const t of cases) { const r = await json(await get(w, t)); assert.equal(r.status, 401, String(t).slice(0, 30)); seen.add(JSON.stringify(r.body)); }
  assert.equal(seen.size, 1, 'one answer for every failure');
  assert.equal((await handleGet(req('GET', '/api/v1/me/profile', { headers: { authorization: 'Basic ' + a } }), w.deps)).status, 401);
  assert.equal((await handleGet(req('GET', '/api/v1/me/profile', { headers: { authorization: 'Bearer ' + a + ' extra' } }), w.deps)).status, 401);
  assert.equal((await handleGet(req('GET', '/api/v1/me/profile', { headers: { authorization: 'bearer ' + a } }), w.deps)).status, 401, 'the scheme is case sensitive here');
  w.db.raw.prepare('DELETE FROM testers WHERE id = ?').run(id); assert.equal((await get(w, a)).status, 401);
  matches('error', (await json(await get(w, undefined))).body);
});
test('tokens: 31 days old is expired; the token never goes in a URL (a query string token is ignored)', async () => {
  const { w, a } = await two(); w.clock.advance(31 * DAY + 1000);
  assert.equal((await get(w, a)).status, 401);
  const r = await handleGet(new Request('https://app.test/api/v1/me/profile?token=' + a, { headers: { 'cf-connecting-ip': '1.1.1.1' } }), w.deps); assert.equal(r.status, 401);
});

test('GET before any save is not_found; the first save is rev 0 and gives rev 1; GET returns what was saved', async () => {
  const { w, a } = await two();
  let r = await json(await get(w, a)); assert.equal(r.status, 404); assert.equal(r.body.error.code, 'not_found'); matches('error', r.body);
  r = await json(await put(w, a, { rev: 0, data: PROFILE })); assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true, rev: 1 }); matches('me_profile_put.response', r.body);
  r = await json(await get(w, a)); assert.equal(r.status, 200); matches('me_profile_get.response', r.body);
  assert.equal(r.body.rev, 1); assert.deepEqual(r.body.data, PROFILE); assert.deepEqual(r.body.mapped, []); assert.deepEqual(r.body.dropped, []); assert.ok(!('rev' in r.body.data), 'rev is never inside the document');
  const row = rows(w, 'SELECT * FROM profiles')[0]; assert.equal(row.rev, 1); assert.equal(row.v, 1); assert.equal(row.job_release, 'abc123'); assert.equal(row.matcher_version, '1.0.0'); assert.equal(row.updated_at, T0);
  r = await json(await put(w, a, { rev: 1, data: { ...PROFILE, skills: [...PROFILE.skills, { id: 'tec:excel', strength: 'used' }] } })); assert.deepEqual(r.body, { ok: true, rev: 2 });
  assert.equal((await json(await get(w, a))).body.data.skills.length, 2);
});

test('concurrent edits: a stale rev is 409 with the current document, and the server never merges', async () => {
  const { w, a } = await two(); await put(w, a, { rev: 0, data: PROFILE });
  const mine = { ...PROFILE, priorities: { ...PROFILE.priorities, pay: 5 } }, theirs = { ...PROFILE, priorities: { ...PROFILE.priorities, pay: 0 } };
  assert.equal((await put(w, a, { rev: 1, data: theirs })).status, 200);
  const r = await json(await put(w, a, { rev: 1, data: mine })); assert.equal(r.status, 409); assert.equal(r.body.error.code, 'conflict'); matches('error', r.body);
  assert.equal(r.body.current.rev, 2); assert.deepEqual(r.body.current.data, theirs);
  assert.deepEqual((await json(await get(w, a))).body.data, theirs, 'nothing was merged or overwritten');
  // "Keep mine": the app resends with the new rev
  assert.deepEqual((await json(await put(w, a, { rev: 2, data: mine }))).body, { ok: true, rev: 3 });
  // a first save when a profile exists is also a conflict; a future rev is a conflict too
  assert.equal((await put(w, a, { rev: 0, data: PROFILE })).status, 409); assert.equal((await put(w, a, { rev: 9, data: PROFILE })).status, 409);
});
test('two writes from the same rev at once: exactly one wins', async () => {
  const { w, a } = await two(); await put(w, a, { rev: 0, data: PROFILE });
  const rs = await Promise.all([1, 2, 3, 4].map(i => put(w, a, { rev: 1, data: { ...PROFILE, priorities: { ...PROFILE.priorities, pay: i } } })));
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 409, 409, 409]); assert.equal(rows(w, 'SELECT rev FROM profiles')[0].rev, 2);
  const first = await Promise.all([put(w, (await signUp(w, { handlers: H, email: 'c@example.com' })).token, { rev: 0, data: PROFILE })]); assert.equal(first[0].status, 200);
});

test('schema rejection: every invalid profile example, extra fields, a rev inside the document, a missing rev', async () => {
  const { w, a } = await two();
  for (const f of readdirSync(new URL('../../../contracts/examples/invalid/', import.meta.url)).filter(f => /^profile--/.test(f))) {
    const r = await json(await put(w, a, { rev: 0, data: exJson('invalid/' + f) })); assert.equal(r.status, 400, f); assert.equal(r.body.error.code, 'bad_request');
  }
  for (const f of readdirSync(new URL('../../../contracts/examples/invalid/api/', import.meta.url)).filter(f => /^me_profile_put\.request--/.test(f))) {
    const r = await json(await put(w, a, exJson('invalid/api/' + f))); assert.equal(r.status, 400, f);
  }
  for (const bad of [{ rev: -1, data: PROFILE }, { rev: 1.5, data: PROFILE }, { rev: '0', data: PROFILE }, { data: PROFILE }, { rev: 0 }, { rev: 0, data: PROFILE, tester_id: 'x' }, { rev: 0, data: { ...PROFILE, name: 'Asha' } }, { rev: 0, data: { ...PROFILE, age_band: '25-34' } }])
    assert.equal((await put(w, a, bad)).status, 400, JSON.stringify(bad).slice(0, 50));
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM profiles')[0].n, 0, 'nothing was stored');
  assert.equal((await handlePut(req('PUT', '/api/v1/me/profile', { token: a, raw: 'x'.repeat(41000) }), w.deps)).status, 413);
  assert.equal((await handlePut(req('PUT', '/api/v1/me/profile', { token: a, raw: '{bad' }), w.deps)).status, 400);
});
test('the 32 KB limit: a profile that passes the contract but is too big is too_large', async () => {
  const { w, a } = await two();
  const skills = Array.from({ length: 300 }, (_, i) => ({ id: 'skl:' + ('a'.repeat(70) + i).slice(-76), strength: 'strong', last: 2026 }));
  const r = await json(await put(w, a, { rev: 0, data: { v: 1, roles: [], skills } })); assert.equal(r.status, 413); assert.equal(r.body.error.code, 'too_large');
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM profiles')[0].n, 0);
});

test('unknown ids are refused (skills, jobs, credentials); retired ids are not live; no id list means unavailable', async () => {
  const { w, a } = await two();
  for (const data of [{ ...PROFILE, skills: [{ id: 'skl:9.Z.9', strength: 'used' }] }, { ...PROFILE, roles: [{ ...PROFILE.roles[0], occ: 'occ:99-9999.00' }] }, { ...PROFILE, creds: [{ id: 'cred:nothing' }] }, { ...PROFILE, skills: [{ id: 'skl:2.A.2.z', strength: 'used' }] }]) {
    const r = await json(await put(w, a, { rev: 0, data })); assert.equal(r.status, 400, JSON.stringify(data.skills)); assert.equal(r.body.error.code, 'bad_request'); assert.match(r.body.error.message, /not in the current list/);
    assert.ok(!r.body.error.message.includes('skl:9'), 'the answer does not echo the id');
  }
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM profiles')[0].n, 0);
  const noAssets = world(); const t = (await signUp(noAssets, { handlers: H })).token; noAssets.deps.assets = null;
  const r = await json(await put(noAssets, t, { rev: 0, data: PROFILE })); assert.equal(r.status, 503); assert.equal(r.body.error.code, 'unavailable');
  noAssets.deps.assets = { fetch: async () => new Response('nope', { status: 500 }) }; assert.equal((await put(noAssets, t, { rev: 0, data: PROFILE })).status, 503);
});
test('the id list is loaded through env.ASSETS.fetch and cached per release (one load for many writes), and ids.json is used when present', async () => {
  let fetches = 0; const base = world(); const assets = { ...base.deps.assets };
  const w = world({ assets: { '/work/manifest.json': { release_id: 'r9', graph: { base: 'graph/r9/' } }, '/work/graph/r9/ids.json': { ids: ['skl:2.A.2.a', 'occ:13-2011.00', 'cred:aws-saa'] } } });
  const inner = w.deps.assets.fetch; w.deps.assets.fetch = async r => { fetches++; return inner(r); };
  const t = (await signUp(w, { handlers: H })).token;
  assert.equal((await put(w, t, { rev: 0, data: PROFILE })).status, 200); const afterFirst = fetches;
  for (let i = 1; i < 4; i++) assert.equal((await put(w, t, { rev: i, data: PROFILE })).status, 200);
  assert.equal(fetches - afterFirst, 3, 'only the small manifest is read again; the id list is served from memory');
  assert.equal((await put(w, t, { rev: 4, data: { ...PROFILE, skills: [{ id: 'tec:excel', strength: 'used' }] } })).status, 400, 'tec:excel is not in this ids.json');
  assert.ok(assets);
});
test('a bad manifest or a hostile release id fails closed', async () => {
  for (const manifest of [{ release_id: '../x', graph: { base: 'graph/x/' } }, { release_id: 'ok', graph: { base: '../../etc/' } }, { release_id: 'ok' }, 'junk']) {
    const w = world({ assets: { '/work/manifest.json': manifest } }); const t = (await signUp(w, { handlers: H })).token;
    assert.equal((await put(w, t, { rev: 0, data: PROFILE })).status, 503, JSON.stringify(manifest));
  }
});

test('a tombstone is mapped on read (and listed), an id with no replacement is dropped, and the stored row is not rewritten', async () => {
  const { w, a } = await two(); const id = a.split('.')[1];
  const stored = { ...PROFILE, skills: [{ id: 'skl:2.A.2.z', strength: 'used', last: 2025 }, { id: 'skl:2.A.9.q', strength: 'rusty' }, { id: 'skl:2.A.1.a', strength: 'strong' }] };
  w.db.raw.prepare('INSERT INTO profiles (tester_id, v, rev, data, job_release, matcher_version, updated_at) VALUES (?, 1, 4, ?, NULL, NULL, ?)').run(id, JSON.stringify(stored), T0);
  const r = await json(await get(w, a)); assert.equal(r.status, 200); matches('me_profile_get.response', r.body);
  assert.deepEqual(r.body.data.skills.map(s => s.id).sort(), ['skl:2.A.1.a', 'skl:2.A.2.a']);
  assert.deepEqual(r.body.mapped, [{ from: 'skl:2.A.2.z', to: ['skl:2.A.2.a'], field: 'skills' }]); assert.deepEqual(r.body.dropped, ['skl:2.A.9.q']); assert.equal(r.body.rev, 4);
  assert.equal(rows(w, 'SELECT data FROM profiles')[0].data, JSON.stringify(stored), 'the stored document changes only after the person saves');
  assert.equal(rows(w, 'SELECT rev FROM profiles')[0].rev, 4);
});
test('GET without a registry returns the stored document as it is; a stored v newer than the code is an internal error that shows nothing', async () => {
  const w = world({ assets: { '/work/manifest.json': { release_id: 'r1', graph: { base: 'graph/r1/' } }, '/work/graph/r1/ids.json': { ids: ['skl:2.A.2.a', 'occ:13-2011.00', 'cred:aws-saa'] } } });
  const t = (await signUp(w, { handlers: H })).token; await put(w, t, { rev: 0, data: PROFILE });
  const r = await json(await get(w, t)); assert.deepEqual(r.body.data, PROFILE); assert.deepEqual(r.body.mapped, []);
  w.db.raw.exec('UPDATE profiles SET v = 99'); const bad = await json(await get(w, t)); assert.equal(bad.status, 500); assert.equal(bad.body.error.code, 'internal'); assert.ok(!JSON.stringify(bad.body).includes('99'));
  w.db.raw.exec("UPDATE profiles SET v = 1, data = 'not json'"); assert.equal((await get(w, t)).status, 500);
});

test('cross-account: tester B never reads or changes tester A, and the body cannot name a tester', async () => {
  const { w, a, b } = await two(); await put(w, a, { rev: 0, data: PROFILE });
  assert.equal((await get(w, b)).status, 404, 'B has no profile; A is not shown');
  assert.equal((await put(w, b, { rev: 1, data: { ...PROFILE, skills: [{ id: 'skl:2.A.1.a', strength: 'rusty' }] } })).status, 409, 'B cannot update A: B has no row at rev 1');
  assert.equal((await put(w, b, { rev: 0, data: { ...PROFILE, skills: [{ id: 'skl:2.A.1.a', strength: 'rusty' }] } })).status, 200);
  assert.equal((await json(await get(w, a))).body.data.skills[0].id, 'skl:2.A.2.a', 'A is untouched');
  assert.equal((await json(await get(w, b))).body.data.skills[0].id, 'skl:2.A.1.a');
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM profiles')[0].n, 2);
  assert.equal((await put(w, b, { rev: 1, tester_id: a.split('.')[1], data: PROFILE })).status, 400);
  // the 409 shows the caller's own document only
  const c = await json(await put(w, a, { rev: 0, data: PROFILE })); assert.deepEqual(c.body.current.data, PROFILE);
});

test('sliding session: a token older than a day comes back renewed in x-session-token, at most once a day; a fresh token does not', async () => {
  const { w, a } = await two();
  assert.equal((await get(w, a)).headers.get('x-session-token'), null);
  w.clock.advance(DAY - 1000); assert.equal((await get(w, a)).headers.get('x-session-token'), null);
  w.clock.advance(2000); const res = await get(w, a); const fresh = res.headers.get('x-session-token'); assert.ok(fresh);
  const s = await readSession(w.deps, fresh); assert.equal(s.iat, w.clock.t); assert.equal(s.id, a.split('.')[1]);
  assert.equal((await get(w, fresh)).headers.get('x-session-token'), null, 'the renewed token is new, so no second renewal today');
  w.clock.advance(30 * DAY); assert.equal((await get(w, a)).status, 401, 'the old token still ends 31 days after it was issued');
  assert.equal((await get(w, fresh)).status, 404, 'the renewed one lives on (404: no profile saved here, but it is signed in)');
  assert.equal(rows(w, 'SELECT key_v FROM testers WHERE id = ?', a.split('.')[1])[0].key_v, 1);
});

test('logout everywhere (tok_after): every earlier token stops working; a new sign-in works', async () => {
  const { w, a, b } = await two(); await put(w, a, { rev: 0, data: PROFILE });
  const second = await mintSession(w.deps, a.split('.')[1]);   // a second device
  w.clock.advance(5);
  const r = await json(await handleLogoutAll(req('POST', '/api/v1/me/logout-all', { token: a, body: {} }), w.deps)); assert.equal(r.status, 200); matches('me_logout_all.response', r.body);
  for (const t of [a, second]) { assert.equal((await get(w, t)).status, 401); assert.equal((await put(w, t, { rev: 1, data: PROFILE })).status, 401); }
  assert.equal((await get(w, b)).status, 404, 'B is not affected');
  w.clock.advance(HOUR); await handleSignIn(w, 'a@example.com');
});
async function handleSignIn(w, email) {
  const o = await json(await startH(req('POST', '/api/v1/email/start', { body: { invite: 'adult1', birthYear: 1990, email, turnstile: 'ok' }, ip: '9.9.9.9' }), w.deps));
  assert.equal(o.status, 200); const code = /code is (\d{6})/.exec(w.outbox.at(-1).text)[1];
  const v = await json(await verifyH(req('POST', '/api/v1/email/verify', { body: { email, code }, ip: '9.9.9.9' }), w.deps)); assert.ok(v.body.token);
  const g = await json(await get(w, v.body.token)); assert.equal(g.status, 200, 'the new token works and the profile is still there'); assert.deepEqual(g.body.data, PROFILE);
}
