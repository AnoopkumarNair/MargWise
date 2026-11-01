// The account client (account/api.js, session.js, age.js, notice.js) with a fake fetch and a fake localStorage. No browser, no server.
//   node --test app/adult/tests/unit/account_api.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const mem = new Map();
globalThis.window = { localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } };
const U = p => import(pathToFileURL(APP + p).href);
const session = await U('account/session.js'), { makeApi, sayError, NETWORK } = await U('account/api.js'), age = await U('account/age.js'), nt = await U('account/notice.js');

const tok = n => 'v1.' + '0123456789abcdef0123456789abcdef0123'.slice(0, 8) + '-0000-0000-0000-000000000000' + '.' + String(1761000000000 + n) + '.' + 'a'.repeat(64);
const reply = (status, body, headers = {}) => ({ status, headers: { get: k => headers[k.toLowerCase()] || null }, json: async () => { if (body === undefined) throw new Error('not json'); return body; } });
function fake(handler) { const calls = []; return { calls, fetchFn: async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length); } }; }
const reset = () => { mem.clear(); session.clearToken(); };

test('a call sends JSON to /api/v1 with the Bearer token and no cookies', async () => {
  reset(); session.setToken(tok(1));
  const f = fake(() => reply(200, { ok: true, rev: 3 }));
  const r = await makeApi({ fetchFn: f.fetchFn }).put('/me/profile', { rev: 2, data: { v: 1 } });
  assert.equal(r.ok, true); assert.equal(r.body.rev, 3);
  const c = f.calls[0];
  assert.equal(c.url, '/api/v1/me/profile'); assert.equal(c.init.method, 'PUT'); assert.equal(c.init.credentials, 'omit');
  assert.equal(c.init.headers.authorization, 'Bearer ' + tok(1)); assert.equal(c.init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(c.init.body), { rev: 2, data: { v: 1 } });
});

test('sign-in calls carry no token even when one is stored', async () => {
  reset(); session.setToken(tok(1));
  const f = fake(() => reply(200, { ok: true, message: 'x' }));
  await makeApi({ fetchFn: f.fetchFn }).post('/email/start', { a: 1 }, { auth: false });
  assert.equal(f.calls[0].init.headers.authorization, undefined);
});

test('a reply with x-session-token replaces the stored token (D33); a bad one is ignored', async () => {
  reset(); session.setToken(tok(1));
  const api = makeApi({ fetchFn: fake(() => reply(200, { ok: true }, { 'x-session-token': tok(2) })).fetchFn });
  await api.get('/me/profile');
  assert.equal(session.getToken(), tok(2)); assert.equal(mem.get('mw_adult_token'), tok(2));
  const api2 = makeApi({ fetchFn: fake(() => reply(200, { ok: true }, { 'x-session-token': 'junk' })).fetchFn });
  await api2.get('/me/profile'); assert.equal(session.getToken(), tok(2));
  // with no token sent, a header is not trusted
  reset();
  await makeApi({ fetchFn: fake(() => reply(200, { ok: true }, { 'x-session-token': tok(3) })).fetchFn }).get('/health');
  assert.equal(session.getToken(), null);
});

test('401 unauthorized clears the token; other errors keep it', async () => {
  reset(); session.setToken(tok(1));
  const r = await makeApi({ fetchFn: fake(() => reply(401, { ok: false, error: { code: 'unauthorized', message: 'Please sign in again.' } })).fetchFn }).get('/me/profile');
  assert.equal(r.ok, false); assert.equal(r.error.code, 'unauthorized'); assert.equal(session.getToken(), null); assert.equal(mem.size, 0);
  session.setToken(tok(1));
  await makeApi({ fetchFn: fake(() => reply(503, { ok: false, error: { code: 'unavailable', message: 'later' } })).fetchFn }).get('/me/profile');
  assert.equal(session.getToken(), tok(1));
});

test('409 conflict keeps the body, so the current version can be offered', async () => {
  reset(); session.setToken(tok(1));
  const cur = { rev: 4, data: { v: 1, roles: [], skills: [] } };
  const r = await makeApi({ fetchFn: fake(() => reply(409, { ok: false, error: { code: 'conflict', message: 'x' }, current: cur })).fetchFn }).put('/me/profile', { rev: 1, data: {} });
  assert.equal(r.error.code, 'conflict'); assert.deepEqual(r.body.current, cur);
});

test('no reply, or a reply that is not JSON, is an error object and never a throw', async () => {
  reset();
  const a = await makeApi({ fetchFn: async () => { throw new TypeError('offline'); } }).get('/health');
  assert.deepEqual(a, { ok: false, status: 0, body: null, error: NETWORK }); assert.match(sayError(a), /could not reach/);
  const b = await makeApi({ fetchFn: fake(() => reply(502, undefined)).fetchFn }).get('/health');
  assert.equal(b.ok, false); assert.equal(b.error.code, 'bad_reply');
  const c = await makeApi({ fetchFn: fake(() => reply(200, [1])).fetchFn }).get('/health');
  assert.equal(c.ok, false);
});

test('storage that throws does not break the session: the token lives in memory for the visit', async () => {
  reset();
  const keep = globalThis.window.localStorage;
  globalThis.window.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(session.setToken(tok(5)), true); assert.equal(session.getToken(), tok(5));
  session.clearToken(); assert.equal(session.getToken(), null);
  globalThis.window.localStorage = keep;
});

test('the session stores only a well-formed token, and nothing when nobody signs in', () => {
  reset(); assert.equal(session.getToken(), null); assert.equal(mem.size, 0);
  assert.equal(session.setToken('<script>'), false); assert.equal(mem.size, 0);
  session.rememberInvite('adult1'); session.rememberInvite('bad code!'); assert.equal(mem.get('mw_adult_invite'), 'adult1');
});

test('the age gate matches the server rule (D30): this year minus the birth year must be at least 19', () => {
  const now = Date.UTC(2026, 10, 1);
  assert.equal(age.ageAllowed(2007, now), true); assert.equal(age.ageAllowed(2008, now), false); assert.equal(age.ageAllowed(1990, now), true);
  assert.equal(age.latestBirthYear(now), 2007);
  assert.equal(age.parseYear(' 1990 ', now), 1990);
  for (const bad of ['', 'abc', '199', '19900', '2027', '1899', '19.9', null]) assert.equal(age.parseYear(bad, now), null, String(bad));
  // the server file says the same
  assert.match(readFileSync(new URL('../../../../hosting/core/keys.js', import.meta.url), 'utf8'), /AGE_GATE_GAP\s*=\s*19/);
});

test('the notice file parses: a title, sections, two ticks, and its blanks are flagged', () => {
  const n = nt.parseNotice(readFileSync(APP + 'notice.md', 'utf8'));
  assert.equal(nt.noticeComplete(n), true);
  assert.match(n.title, /Before you make an account/);
  const heads = n.blocks.filter(b => b.t === 'h').map(b => b.text);
  for (const h of ['What we keep', 'What we do not keep', 'Who sees it', 'Your choices', 'Questions or complaints']) assert.ok(heads.includes(h), h);
  assert.match(n.research, /^Optional/);
  assert.equal(n.blanks, true, 'the draft still has blanks for the owner');
  const full = nt.parseNotice('# T\n\nHello.\n\n## A\n- one\n- two\n[required] yes\n[optional] maybe');
  assert.equal(full.blanks, false); assert.deepEqual(full.blocks.at(-1), { t: 'ul', items: ['one', 'two'] });
  assert.equal(nt.noticeComplete(nt.parseNotice('# T\nonly text')), false, 'without the ticks it is not usable');
});
