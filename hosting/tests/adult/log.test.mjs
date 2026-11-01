import test from 'node:test';
import assert from 'node:assert/strict';
import { logLine, LOG_FIELDS, makeLogger } from '../../core/log.js';
import { defineRoute, readJson, ok } from '../../core/http.js';
import { makeFakeDeps } from '../../core/deps.js';

test('a log line has exactly the ADR-10 fields', () => {
  const l = JSON.parse(logLine({ ts: 1, rid: 'abcdef0123456789', route: 'GET /api/v1/health', status: 200, ms: 3.4, release: 'r1', api_v: 1, error_code: null }));
  assert.deepEqual(Object.keys(l), ['ts', 'rid', 'route', 'status', 'ms', 'release', 'api_v', 'error_code']);
  assert.deepEqual(Object.keys(l), LOG_FIELDS); assert.equal(l.ms, 3);
});
test('extra fields and odd values are dropped, not logged', () => {
  const l = JSON.parse(logLine({ ts: 1, rid: 'me@example.com', route: 'POST /api/v1/email/start?code=123456', status: 200, body: '{"email":"a@b.c"}', email: 'a@b.c', token: 't', ip: '1.2.3.4', error_code: 'a@b.c', release: 'has space' }));
  assert.deepEqual(Object.keys(l), LOG_FIELDS);
  assert.equal(l.rid, null); assert.equal(l.route, '?'); assert.equal(l.error_code, null); assert.equal(l.release, null);
  assert.ok(!JSON.stringify(l).match(/@|1\.2\.3\.4|123456/));
});
test('a failing sink cannot break a request', () => { assert.doesNotThrow(() => makeLogger(() => { throw new Error('x'); })({ ts: 1 })); });

test('a real request carrying an email, a code, a token, an IP and a body leaves none of them in the log', async () => {
  const deps = makeFakeDeps();
  const h = defineRoute('POST /api/v1/email/start', async (req, d, { rid }) => { const r = await readJson(req, { rid }); return r.response || ok({}, { rid }); });
  const body = JSON.stringify({ email: 'person@example.com', code: '482913', token: 'tok-abcdef-SECRET', note: 'my resume text' });
  await h(new Request('https://x.test/api/v1/email/start?link=LINKSECRET', { method: 'POST', body, headers: { 'content-type': 'application/json', authorization: 'Bearer tok-abcdef-SECRET', 'cf-connecting-ip': '203.0.113.77' } }), deps);
  await h(new Request('https://x.test/api/v1/email/start', { method: 'POST', body: '{bad person@example.com', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.77' } }), deps);
  assert.equal(deps.logs.length, 2);
  for (const line of deps.logs) {
    for (const s of ['person@example.com', '@', '482913', 'SECRET', '203.0.113.77', 'resume', 'LINKSECRET', 'Bearer']) assert.ok(!line.includes(s), s + ' leaked in ' + line);
    assert.deepEqual(Object.keys(JSON.parse(line)), LOG_FIELDS);
  }
});
