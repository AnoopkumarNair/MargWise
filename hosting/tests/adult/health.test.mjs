import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../../core/health.js';
import { onRequestGet } from '../../functions/api/v1/health.js';
import { makeFakeDeps } from '../../core/deps.js';
import { createFakeDb } from './fakedb.mjs';
import { versions } from '../../core/versions.js';

const get = () => new Request('https://x.test/api/v1/health', { headers: { 'cf-connecting-ip': '198.51.100.9' } });
const SECRETS = { SIGN_KEY: 'sign-key-aaaaaaaaaaaaaaaaaaaaaaaa', EMAIL_KEY: 'email-key-bbbbbbbbbbbbbbbbbbbbbbb', CODE_KEY: 'code-key-ccccccccccccccccccccccc', IP_KEY: 'ip-key-dddddddddddddddddddddddd', TURNSTILE_SECRET: 'ts-secret-eeee', AI_API_KEY: 'ai-key-ffff' };

test('healthy: database up, release, api_v, switches, email configured', async () => {
  const d = makeFakeDeps({ db: createFakeDb(), env: { ...SECRETS, RELEASE_ID: 'r-2026-10', EMAIL_FROM: 'a@example.org', AI_ENABLED: '1' } });
  const res = await handle(get(), d); assert.equal(res.status, 200);
  const b = await res.json();
  assert.deepEqual(b, { ok: true, db: true, release: 'r-2026-10', api_v: versions.API_V, environment: 'local', flags: { adult_signup: false, ai_enabled: true, email_dry_run: true, show_demand: false }, email_configured: true });
  assert.ok(res.headers.get('x-request-id'));
});
test('email not configured when EMAIL_FROM is missing', async () => {
  assert.equal((await (await handle(get(), makeFakeDeps({ db: createFakeDb() }))).json()).email_configured, false);
});
test('database down: 503 unavailable, still reports the rest', async () => {
  const db = createFakeDb(); db.setBroken(); const res = await handle(get(), makeFakeDeps({ db }));
  assert.equal(res.status, 503); const b = await res.json();
  assert.equal(b.ok, false); assert.equal(b.error.code, 'unavailable'); assert.equal(b.db, false); assert.equal(b.api_v, versions.API_V);
});
test('no secret, address or IP appears in the response or the log', async () => {
  const d = makeFakeDeps({ db: createFakeDb(), env: { ...SECRETS, EMAIL_FROM: 'sender@example.org' } });
  const text = await (await handle(get(), d)).text() + d.logs.join('');
  for (const v of [...Object.values(SECRETS), 'sender@example.org', '198.51.100.9']) assert.ok(!text.includes(v), v);
});
test('only GET is allowed', async () => { assert.equal((await handle(new Request('https://x.test/api/v1/health', { method: 'POST' }), makeFakeDeps({ db: createFakeDb() }))).status, 405); });
test('the Pages adapter builds deps from env and answers', async () => {
  const res = await onRequestGet({ request: get(), env: { DB: createFakeDb(), RELEASE_ID: 'x1' } });
  assert.equal(res.status, 200); assert.equal((await res.json()).release, 'x1');
});
