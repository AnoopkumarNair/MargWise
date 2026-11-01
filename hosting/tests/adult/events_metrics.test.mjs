// TEST_PLAN layer 5, events (T3.6) and operations counters (T3.7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { handle as startH } from '../../core/email_start.js';
import { handle as verifyH } from '../../core/email_verify.js';
import { handle as completeH } from '../../core/email_complete.js';
import { handle as eventH, EVENTS_PER_DAY } from '../../core/events.js';
import { handle as metricsH } from '../../core/metrics.js';
import { handle as healthH } from '../../core/health.js';
import { handleGet } from '../../core/profile.js';
import { bump, today, METRICS } from '../../core/ops.js';
import { runInvariants } from '../../tools/check_invariants.mjs';
import { world, req, json, signUp, matches, KEYS, T0, DAY } from './api_helpers.mjs';

const H = { startH, verifyH, completeH };
const ex = f => JSON.parse(readFileSync(new URL('../../../contracts/examples/' + f, import.meta.url), 'utf8'));
const post = (w, token, body, o = {}) => eventH(req('POST', '/api/v1/event', { token, body, raw: o.raw }), w.deps);
const rows = (w, sql, ...a) => w.db.raw.prepare(sql).all(...a);
const TYPES = ['intake', 'profile_saved', 'roads_viewed', 'road_opened', 'road_added', 'feedback'];

test('every adult event example is accepted, stored as typed JSON, and matches the response contract', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H });
  for (const t of TYPES) {
    const r = await json(await post(w, token, ex(`events--${t}.json`))); assert.equal(r.status, 200, t); matches('event.response', r.body);
  }
  const stored = rows(w, 'SELECT type, data, eid, ts, session_id FROM events ORDER BY id'); assert.equal(stored.length, 6);
  assert.deepEqual(stored.map(r => r.type), TYPES);
  for (const r of stored) { assert.equal(r.ts, T0); assert.equal(r.session_id, null); assert.ok(JSON.parse(r.data)); assert.ok(r.eid); }
  assert.equal(JSON.parse(stored[5].data).text, 'The gap list made sense.');
});
test('invalid events are refused: unknown type, another type\'s field, free text, an email in feedback, a missing release, a long feedback text', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H });
  for (const f of readdirSync(new URL('../../../contracts/examples/invalid/', import.meta.url)).filter(f => /^events--/.test(f))) {
    const r = await json(await post(w, token, ex('invalid/' + f))); assert.equal(r.status, 400, f); assert.equal(r.body.error.code, 'bad_request');
  }
  for (const t of ['join', 'result', 'snapshot', 'self', '__proto__', 'constructor', '', 5, null]) assert.equal((await post(w, token, { type: t, eid: 'e-12345678', data: {} })).status, 400, 'type ' + String(t));
  const base = ex('events--feedback.json');
  assert.equal((await post(w, token, { ...base, eid: 'e-fb-1500a', data: { ...base.data, text: 'x'.repeat(1500) } })).status, 200, 'the cap itself is fine');
  assert.equal((await post(w, token, { ...base, eid: 'e-fb-1501a', data: { ...base.data, text: 'x'.repeat(1501) } })).status, 400);
  for (const bad of [{ ...base, extra: 1 }, { ...base, eid: 'short' }, { ...base, eid: 'has space in it' }, { type: 'feedback', eid: 'e-12345678' }, { ...base, data: { ...base.data, tester_id: 'x' } }, { ...ex('events--road_opened.json'), data: { ...ex('events--road_opened.json').data, text: 'hello' } }])
    assert.equal((await post(w, token, bad)).status, 400, JSON.stringify(bad).slice(0, 70));
  assert.equal((await post(w, token, undefined, { raw: 'x'.repeat(13000) })).status, 413);
  assert.equal((await post(w, token, undefined, { raw: '[]' })).status, 400);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM events')[0].n, 1, 'only the 1500-character feedback was stored');
});
test('events: a repeat eid is accepted and stored once; another person can use the same eid; the token decides who', async () => {
  const w = world(); const a = (await signUp(w, { handlers: H })).token, b = (await signUp(w, { handlers: H, email: 'b@example.com' })).token;
  const e = ex('events--road_added.json');
  assert.equal((await post(w, a, e)).status, 200); assert.equal((await post(w, a, e)).status, 200);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM events WHERE tester_id = ?', a.split('.')[1])[0].n, 1);
  assert.equal((await post(w, b, e)).status, 200); assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM events')[0].n, 2);
  assert.equal((await post(w, undefined, e)).status, 401); assert.equal((await post(w, 'v1.bad', e)).status, 401);
  const same = await Promise.all([1, 2, 3].map(() => post(w, a, { ...e, eid: 'e-parallel-1' }))); assert.deepEqual(same.map(r => r.status), [200, 200, 200]);
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM events WHERE eid = 'e-parallel-1'")[0].n, 1);
});
test('events: capped per person per day; a retry of a stored event still succeeds at the cap; the next day starts again', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H }); const id = token.split('.')[1];
  const ins = w.db.raw.prepare("INSERT INTO events (tester_id, ts, type, data, eid) VALUES (?, ?, 'road_added', '{}', ?)");
  for (let i = 0; i < EVENTS_PER_DAY; i++) ins.run(id, T0 - 1000, 'fill-' + String(i).padStart(4, '0'));
  const e = ex('events--road_added.json');
  const r = await json(await post(w, token, e)); assert.equal(r.status, 429); assert.equal(r.body.error.code, 'rate_limited');
  assert.equal((await post(w, token, { ...e, eid: 'fill-0003' })).status, 200, 'a retry of an event we already have');
  w.clock.advance(DAY + 2000); assert.equal((await post(w, token, e)).status, 200);
});
test('stored events pass the invariant checker (no free text outside feedback, results carry the release and matcher version)', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H });
  for (const t of TYPES) await post(w, token, ex(`events--${t}.json`));
  const inv = await runInvariants(w.db, { now: T0 }); assert.deepEqual(inv.filter(x => x.status === 'fail'), []);
  assert.equal(inv.find(x => x.id === 2).status, 'pass');
});

test('metrics: the owner key is needed; wrong keys are counted and locked out after 30 in 15 minutes', async () => {
  const w = world(); const m = (key, ip = '5.5.5.5') => metricsH(req('GET', '/api/v1/admin/metrics', { headers: key ? { 'x-admin-key': key } : {}, ip }), w.deps);
  assert.equal((await m(undefined)).status, 403); assert.equal((await m('wrong')).status, 403);
  assert.equal((await m(KEYS.ADMIN_KEY)).status, 200);
  for (let i = 0; i < 30; i++) await m('guess-' + i);
  const locked = await json(await m(KEYS.ADMIN_KEY)); assert.equal(locked.status, 429, 'even the right key waits once the bucket is locked out');
  assert.equal((await m(KEYS.ADMIN_KEY, '6.6.6.6')).status, 200, 'another bucket is fine');
  w.clock.advance(15 * 60000 + 1000); assert.equal((await m(KEYS.ADMIN_KEY)).status, 200);
  const none = world({ env: { ADMIN_KEY: '' } }); assert.equal((await metricsH(req('GET', '/api/v1/admin/metrics', { headers: { 'x-admin-key': '' } }), none.deps)).status, 503, 'no admin key set: closed');
  const short = world({ env: { ADMIN_KEY: 'short' } }); assert.equal((await metricsH(req('GET', '/api/v1/admin/metrics', { headers: { 'x-admin-key': 'short' } }), short.deps)).status, 503);
  assert.equal((await metricsH(req('POST', '/api/v1/admin/metrics', { headers: { 'x-admin-key': KEYS.ADMIN_KEY } }), w.deps)).status, 405);
});
test('metrics: aggregates only, with the counters, the under-18 totals and the head counts; nothing about a person', async () => {
  const w = world(); const ip = '4.4.4.4';
  await signUp(w, { handlers: H, email: 'private.person@example.com' }); await signUp(w, { handlers: H, email: 'other@example.com' });
  await startH(req('POST', '/api/v1/email/start', { body: { invite: 'adult1', birthYear: 2020, email: 'kid@example.com', turnstile: 'ok' }, ip }), w.deps);
  await verifyH(req('POST', '/api/v1/email/verify', { body: { email: 'private.person@example.com', code: '000000' }, ip }), w.deps);
  const { token } = await signUp(w, { handlers: H, email: 'third@example.com' }); await handleGet(req('GET', '/api/v1/me/profile', { token }), w.deps);
  const r = await json(await metricsH(req('GET', '/api/v1/admin/metrics', { headers: { 'x-admin-key': KEYS.ADMIN_KEY } }), w.deps)); assert.equal(r.status, 200);
  const day = r.body.days.find(d => d.day === '2025-10-20').metrics;
  assert.equal(day.signups, 3); assert.equal(day.codes_sent, 3); assert.equal(day.code_failures, 1); assert.equal(day.under18_refusals, 1); assert.ok(day.requests >= 12);
  assert.deepEqual(r.body.totals, { adult_testers: 3, profiles: 0, open_codes: 0 });
  assert.equal(r.body.health.db, true); assert.ok(!('flags' in r.body) && r.body.health.flags);
  const text = JSON.stringify(r.body);
  for (const secret of ['private.person', 'example.com', 'kid@', ip, token, ...Object.values(KEYS)]) assert.ok(!text.includes(secret), 'metrics leak ' + secret);
  for (const k of Object.keys(day)) assert.ok([...METRICS, 'under18_refusals'].includes(k), k);
});
test('counters: a 5xx is counted, bump() ignores unknown names and a broken database, and the health route is not counted', async () => {
  const w = world(); assert.equal(await bump(w.deps, 'signups'), true); assert.equal(await bump(w.deps, 'signups', 2), true); assert.equal(await today(w.deps, 'signups'), 3);
  assert.equal(await bump(w.deps, 'made_up'), false); assert.equal(await bump(w.deps, 'signups', 0), false); assert.equal(await bump(w.deps, 'signups', 1.5), false);
  await healthH(req('GET', '/api/v1/health'), w.deps); assert.equal(await today(w.deps, 'requests'), 0);
  const buggy = world(); buggy.db.batch = () => { throw new TypeError('boom'); };   // an unexpected bug inside a handler: internal, and counted
  const bad = await startH(req('POST', '/api/v1/email/start', { body: { invite: 'adult1', birthYear: 1990, email: 'a@example.com', turnstile: 'ok' } }), buggy.deps);
  assert.equal(bad.status, 500); assert.equal((await bad.json()).error.code, 'internal');
  assert.equal(await today(buggy.deps, 'http_5xx'), 1); assert.equal(await today(buggy.deps, 'requests'), 1);
  w.db.setBroken(); assert.equal(await bump(w.deps, 'signups'), false); assert.equal(await today(w.deps, 'signups'), 0);
});
