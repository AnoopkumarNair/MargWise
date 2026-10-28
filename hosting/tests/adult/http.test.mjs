import test from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail, ERRORS, readJson, defineRoute, newRid, checkContract } from '../../core/http.js';
import { makeFakeDeps } from '../../core/deps.js';

const post = (body, headers = {}) => new Request('https://x.test/api/v1/t', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const schema = { type: 'object', required: ['n'], additionalProperties: false, properties: { n: { type: 'integer', minimum: 1 } } };

test('ok() and fail() carry the ADR-09 headers and shapes', async () => {
  for (const r of [ok({ a: 1 }, { rid: 'abc12345' }), fail('not_found', { rid: 'abc12345' })]) {
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('content-type'), 'application/json');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-request-id'), 'abc12345');
    assert.equal(r.headers.get('access-control-allow-origin'), null, 'same origin only');
  }
  assert.deepEqual(await ok({ a: 1 }).json(), { ok: true, a: 1 });
  const f = fail('conflict', { extra: { current: { rev: 3 } } }); assert.equal(f.status, 409);
  const b = await f.json(); assert.equal(b.ok, false); assert.equal(b.error.code, 'conflict'); assert.equal(typeof b.error.message, 'string'); assert.deepEqual(b.current, { rev: 3 });
});
test('every documented code has a status and a message, and the ADR-09 codes are present', () => {
  for (const c of ['rate_limited', 'invalid_code', 'expired', 'conflict', 'not_found', 'bad_request', 'unavailable']) assert.ok(ERRORS[c], c);
  for (const [c, [s, m]] of Object.entries(ERRORS)) { assert.ok(s >= 400 && s <= 599, c); assert.ok(m.length > 5, c); }
  assert.equal(ERRORS.rate_limited[0], 429);
});
test('an unknown code becomes internal rather than leaking', async () => {
  const f = fail('whatever'); assert.equal(f.status, 500); assert.equal((await f.json()).error.code, 'internal');
});
test('readJson accepts a good body and applies the schema', async () => {
  assert.deepEqual((await readJson(post({ n: 2 }), { schema })).value, { n: 2 });
  for (const bad of [{ n: 0 }, { n: 'x' }, {}, { n: 1, extra: 1 }]) { const r = await readJson(post(bad), { schema }); assert.equal(r.response.status, 400, JSON.stringify(bad)); }
});
test('readJson refuses wrong content type, bad JSON, non-objects and bad UTF-8', async () => {
  assert.equal((await readJson(post({}, { 'content-type': 'text/plain' }))).response.status, 400);
  for (const raw of ['{', '[]', '"s"', '1', 'null']) assert.equal((await readJson(post(raw))).response.status, 400, raw);
  const badUtf8 = new Request('https://x.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0x7b, 0xff, 0x7d]) });
  assert.equal((await readJson(badUtf8)).response.status, 400);
});
test('readJson enforces the size limit by header and by actual bytes', async () => {
  const big = JSON.stringify({ t: 'é'.repeat(600) });   // 1200 bytes, fewer characters
  const r = await readJson(post(big), { max: 1000 }); assert.equal(r.response.status, 413);
  assert.equal((await r.response.json()).error.code, 'too_large');
  const lie = await readJson(post('{}', { 'content-length': '5000' }), { max: 1000 }); assert.equal(lie.response.status, 413);
  assert.ok((await readJson(post(big), { max: 2000 })).value);
});
test('the validation error never echoes what the person sent', async () => {
  const r = await readJson(post({ n: 'me@example.com' }), { schema });
  assert.ok(!JSON.stringify(await r.response.json()).includes('example.com'));
});
test('a broken schema fails closed', () => { assert.equal(checkContract({ type: 'object', frobnicate: 1 }, {}).ok, false); });

test('defineRoute: request id on the response, method check, bug caught, one log line each', async () => {
  const deps = makeFakeDeps();
  const good = defineRoute('POST /api/v1/t', async (req, d, { rid }) => { const r = await readJson(req, { schema, rid }); return r.response || ok({ n: r.value.n }, { rid }); });
  const res = await good(post({ n: 4 }), deps); assert.equal(res.status, 200);
  assert.match(res.headers.get('x-request-id'), /^[0-9a-f]{16}$/);
  assert.equal((await good(new Request('https://x.test/', { method: 'GET' }), deps)).status, 405);
  const boom = defineRoute('POST /api/v1/boom', async () => { throw new Error('secret detail me@x.com'); });
  const b = await boom(post({}), deps); assert.equal(b.status, 500); assert.ok(!(await b.text()).includes('secret'));
  const lines = deps.logged(); assert.equal(lines.length, 3);
  assert.equal(lines[0].status, 200); assert.equal(lines[0].error_code, null); assert.equal(lines[1].error_code, 'bad_request'); assert.equal(lines[2].error_code, 'internal');
  assert.equal(lines[0].rid, res.headers.get('x-request-id'));
});
test('a handler that forgets the request id still gets one', async () => {
  const deps = makeFakeDeps(); const h = defineRoute('GET /api/v1/t', async () => ok());
  const r = await h(new Request('https://x.test/'), deps); assert.ok(r.headers.get('x-request-id').length >= 8);
});
test('request ids differ and come from the injected random', () => {
  const a = makeFakeDeps({ seed: 5 }), b = makeFakeDeps({ seed: 5 });
  assert.equal(newRid(a), newRid(b)); assert.notEqual(newRid(a), newRid(a));
});
