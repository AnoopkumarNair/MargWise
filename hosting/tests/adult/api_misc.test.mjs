// TEST_PLAN layer 5, cross-cutting: the logs of every adult endpoint, the feature switches, the generated schemas, the Pages adapters, the SQL guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { handle as startH } from '../../core/email_start.js';
import { handle as verifyH } from '../../core/email_verify.js';
import { handle as completeH } from '../../core/email_complete.js';
import { handleGet, handlePut } from '../../core/profile.js';
import { handleExport, handleDelete, handleLogoutAll } from '../../core/account.js';
import { handle as eventH } from '../../core/events.js';
import { handle as metricsH } from '../../core/metrics.js';
import { handle as healthH } from '../../core/health.js';
import { render, NAMES } from '../../tools/gen_api_schemas.mjs';
import { SCHEMAS } from '../../core/api_schemas.js';
import { checkSqlStrings } from '../migration_guard.mjs';
import { onRequest as startA } from '../../functions/api/v1/email/start.js';
import { onRequest as verifyA } from '../../functions/api/v1/email/verify.js';
import { onRequest as completeA } from '../../functions/api/v1/email/complete.js';
import { onRequest as profileA } from '../../functions/api/v1/me/profile.js';
import { onRequest as exportA } from '../../functions/api/v1/me/export.js';
import { onRequest as deleteA } from '../../functions/api/v1/me/delete.js';
import { onRequest as logoutA } from '../../functions/api/v1/me/logout-all.js';
import { onRequest as eventA } from '../../functions/api/v1/event.js';
import { onRequest as metricsA } from '../../functions/api/v1/admin/metrics.js';
import { createFakeDb } from './fakedb.mjs';
import { world, req, json, signUp, KEYS, GRAPH_ASSETS, T0, HOUR } from './api_helpers.mjs';
import { clearReleaseCache } from '../../core/release_ids.js';

const H = { startH, verifyH, completeH };
const PROFILE = JSON.parse(readFileSync(new URL('../../../contracts/examples/profile--spec6.json', import.meta.url), 'utf8'));

test('logs: a full journey through every adult endpoint writes no email, name, code, link, token, IP, id or body', async () => {
  const w = world(); const ip = '198.51.100.201', email = 'distinct.person@mailbox.example';
  const { token } = await signUp(w, { handlers: H, email, nickname: 'UniqueNickZed', ip });
  const id = token.split('.')[1], eh = w.db.raw.prepare('SELECT email_hash FROM testers').get().email_hash;
  const calls = [
    handleGet(req('GET', '/api/v1/me/profile', { token, ip }), w.deps),
    handlePut(req('PUT', '/api/v1/me/profile', { token, ip, body: { rev: 0, data: PROFILE } }), w.deps),
    eventH(req('POST', '/api/v1/event', { token, ip, body: { type: 'feedback', eid: 'e-secret-0001', data: { about: 'road', from: 'occ:13-2011.00', to: 'occ:13-2051.00', worth_exploring: true, kind_agree: true, rating: 4, text: 'SecretFeedbackText', job_release: 'abc123', matcher_version: '1.0.0' } } }), w.deps),
    handleExport(req('POST', '/api/v1/me/export', { token, ip, body: {} }), w.deps),
    metricsH(req('GET', '/api/v1/admin/metrics', { ip, headers: { 'x-admin-key': KEYS.ADMIN_KEY } }), w.deps),
    metricsH(req('GET', '/api/v1/admin/metrics', { ip, headers: { 'x-admin-key': 'WrongAdminKeyText12345' } }), w.deps),
    handlePut(req('PUT', '/api/v1/me/profile', { token, ip, body: { rev: 1, data: { ...PROFILE, skills: [{ id: 'skl:SecretUnknownId', strength: 'used' }] } } }), w.deps),
    handleLogoutAll(req('POST', '/api/v1/me/logout-all', { token, ip, body: {} }), w.deps),
    handleDelete(req('POST', '/api/v1/me/delete', { token: 'v1.garbage', ip, body: { confirm: 'DELETE' } }), w.deps),
  ];
  for (const r of calls) await r;
  const log = w.deps.logs.join('\n'), mail = w.outbox[0].text;
  const secrets = [email, 'distinct.person', 'mailbox.example', 'UniqueNickZed', ip, token, id, eh, 'SecretFeedbackText', 'SecretUnknownId', 'WrongAdminKeyText', 'e-secret-0001', /code is (\d{6})/.exec(mail)[1], /#link=([A-Za-z0-9_-]+)/.exec(mail)[1], 'occ:13-2011.00', ...Object.values(KEYS)];
  for (const s of secrets) assert.ok(!log.includes(s), 'the log contains ' + s);
  assert.ok(w.deps.logs.length >= 12);
  for (const l of w.deps.logged()) { assert.deepEqual(Object.keys(l).sort(), ['api_v', 'error_code', 'ms', 'release', 'rid', 'route', 'status', 'ts']); assert.match(l.route, /^[A-Z]+ \/api\/v1\/[a-z0-9/-]+$/); }
  const routes = new Set(w.deps.logged().map(l => l.route));
  for (const r of ['POST /api/v1/email/start', 'POST /api/v1/email/verify', 'POST /api/v1/email/complete', 'GET /api/v1/me/profile', 'PUT /api/v1/me/profile', 'POST /api/v1/event', 'POST /api/v1/me/export', 'POST /api/v1/me/logout-all', 'POST /api/v1/me/delete', 'GET /api/v1/admin/metrics']) assert.ok(routes.has(r), r);
  // the database holds no raw IP and no token either
  const dump = JSON.stringify(['joins', 'admin_fail', 'meta', 'ops_daily', 'audit', 'email_codes', 'email_sends'].map(t => w.db.raw.prepare(`SELECT * FROM ${t}`).all()));
  for (const s of [ip, token, 'distinct.person']) assert.ok(!dump.includes(s), 'a table holds ' + s);
});

test('feature switches: each one off on its own leaves the rest working', async () => {
  // ADULT_SIGNUP off: no new accounts, existing ones keep working (also covered in email_flow.test.mjs)
  const w = world(); const { token } = await signUp(w, { handlers: H }); w.deps.flags.adultSignup = false;
  assert.equal((await handleGet(req('GET', '/api/v1/me/profile', { token }), w.deps)).status, 404, 'profile reads work with sign-up off');
  assert.equal((await handlePut(req('PUT', '/api/v1/me/profile', { token, body: { rev: 0, data: PROFILE } }), w.deps)).status, 200);
  // AI_ENABLED and SHOW_DEMAND off (their defaults) change nothing in the account endpoints
  assert.equal(w.deps.flags.aiEnabled, false); assert.equal(w.deps.flags.showDemand, false);
  assert.equal((await handleExport(req('POST', '/api/v1/me/export', { token, body: {} }), w.deps)).status, 200);
  const h = await json(await healthH(req('GET', '/api/v1/health'), w.deps)); assert.equal(h.body.flags.adult_signup, false); assert.equal(h.body.ai_enabled, false);
  // EMAIL_DRY_RUN: on by default outside production, off in production
  assert.equal(world().deps.flags.emailDryRun, true); assert.equal(world({ env: { ENVIRONMENT: 'production' } }).deps.flags.emailDryRun, false);
  // with every switch at its default, a fresh deployment refuses sign-ups but still answers health
  const closed = world({ env: { ADULT_SIGNUP: undefined } }); assert.equal(closed.deps.flags.adultSignup, false);
  assert.equal((await healthH(req('GET', '/api/v1/health'), closed.deps)).status, 200);
});

test('the generated request schemas equal the contracts, and cover every request the handlers read', () => {
  assert.equal(readFileSync(new URL('../../core/api_schemas.js', import.meta.url), 'utf8'), render(), 'run node hosting/tools/gen_api_schemas.mjs');
  for (const n of NAMES) assert.ok(SCHEMAS[n] && SCHEMAS[n].$id.endsWith(n + '.request.schema.json'), n);
  assert.ok(Object.isFrozen(SCHEMAS) && Object.isFrozen(SCHEMAS.email_start.properties));
  const used = new Set(); for (const f of readdirSync(new URL('../../core/', import.meta.url)).filter(f => /\.js$/.test(f))) for (const m of readFileSync(new URL('../../core/' + f, import.meta.url), 'utf8').matchAll(/SCHEMAS\.([a-z_]+)/g)) used.add(m[1]);
  for (const n of used) assert.ok(NAMES.includes(n), n + ' is used but not generated');
});

test('SQL in the new handlers is parameterised and written as plain string literals (the migration guard)', () => {
  assert.deepEqual(checkSqlStrings(), []);
  const src = readdirSync(new URL('../../core/', import.meta.url)).filter(f => /\.js$/.test(f)).map(f => readFileSync(new URL('../../core/' + f, import.meta.url), 'utf8')).join('\n');
  assert.ok(!/\.prepare\([^)]*\$\{/.test(src));
});

test('every Pages adapter is one line that builds deps from env and calls the pure handler', async () => {
  for (const f of ['email/start', 'email/verify', 'email/complete', 'me/profile', 'me/export', 'me/delete', 'me/logout-all', 'event', 'admin/metrics']) {
    const src = readFileSync(new URL('../../functions/api/v1/' + f + '.js', import.meta.url), 'utf8').trim().split('\n');
    assert.equal(src.length, 3, f + ' is two imports and one line'); assert.match(src[2], /^export const onRequest = /);
  }
  clearReleaseCache();
  const env = { DB: createFakeDb(), ...KEYS, ADULT_SIGNUP: '1', EMAIL_FROM: 'a@b.test', ASSETS: { fetch: async r => { const p = new URL(r.url).pathname; return p in GRAPH_ASSETS ? Response.json(GRAPH_ASSETS[p]) : new Response('no', { status: 404 }); } } };
  env.DB.raw.prepare("INSERT INTO invites (code, label, created_at, track, active) VALUES ('adult1', 'p', ?, 'adult', 1)").run(Date.now());
  // the real deps: Turnstile is not stubbed, so a call with no network would fail closed; with no TURNSTILE_SECRET the route is unavailable
  const noTs = await startA({ request: req('POST', '/api/v1/email/start', { body: { invite: 'adult1', birthYear: 1990, email: 'a@example.com', turnstile: 'x' } }), env: { ...env, TURNSTILE_SECRET: undefined } });
  assert.equal(noTs.status, 503);
  for (const [fn, method, path] of [[profileA, 'GET', '/api/v1/me/profile'], [profileA, 'PUT', '/api/v1/me/profile'], [exportA, 'POST', '/api/v1/me/export'], [deleteA, 'POST', '/api/v1/me/delete'], [logoutA, 'POST', '/api/v1/me/logout-all'], [eventA, 'POST', '/api/v1/event'], [verifyA, 'POST', '/api/v1/email/verify'], [completeA, 'POST', '/api/v1/email/complete']]) {
    const r = await fn({ request: req(method, path, { body: method === 'GET' ? undefined : {} }), env }); assert.ok([400, 401].includes(r.status), `${method} ${path} ${r.status}`);
  }
  assert.equal((await profileA({ request: req('DELETE', '/api/v1/me/profile'), env })).status, 405, 'other methods are 405');
  assert.equal((await metricsA({ request: req('GET', '/api/v1/admin/metrics'), env })).status, 403);
});

test('database down: sign-in and profile answer unavailable (503), not internal; nothing is stored or leaked', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H }); w.db.setBroken();
  for (const [fn, request] of [[startH, req('POST', '/api/v1/email/start', { body: { invite: 'adult1', birthYear: 1990, email: 'a@example.com', turnstile: 'ok' } })], [handleGet, req('GET', '/api/v1/me/profile', { token })], [handleExport, req('POST', '/api/v1/me/export', { token, body: {} })], [eventH, req('POST', '/api/v1/event', { token, body: { type: 'road_added', eid: 'e-12345678', data: { from: 'occ:1', to: 'occ:2', job_release: 'a', matcher_version: '1.0.0' } } })]]) {
    const r = await json(await fn(request, w.deps)); assert.equal(r.status, 503, request.url); assert.equal(r.body.error.code, 'unavailable'); assert.ok(!JSON.stringify(r.body).includes('D1_ERROR'));
  }
  const bug = world(); bug.db.batch = () => { throw new TypeError('our bug'); };
  assert.equal((await startH(req('POST', '/api/v1/email/start', { body: { invite: 'adult1', birthYear: 1990, email: 'a@example.com', turnstile: 'ok' } }), bug.deps)).status, 500);
});
