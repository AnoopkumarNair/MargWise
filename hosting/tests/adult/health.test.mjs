import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../../core/health.js';
import { onRequestGet } from '../../functions/api/v1/health.js';
import { makeFakeDeps } from '../../core/deps.js';
import { createFakeDb } from './fakedb.mjs';
import { versions } from '../../core/versions.js';
import { checkContract } from '../../core/http.js';
import { readFileSync } from 'node:fs';

const SCHEMA = JSON.parse(readFileSync(new URL('../../../contracts/api/health.response.schema.json', import.meta.url), 'utf8'));
const matches = b => { const v = checkContract(SCHEMA, b); assert.ok(v.ok, JSON.stringify(v.errors)); };

const get = () => new Request('https://x.test/api/v1/health', { headers: { 'cf-connecting-ip': '198.51.100.9' } });
const SECRETS = { SIGN_KEY: 'sign-key-aaaaaaaaaaaaaaaaaaaaaaaa', EMAIL_KEY: 'email-key-bbbbbbbbbbbbbbbbbbbbbbb', CODE_KEY: 'code-key-ccccccccccccccccccccccc', IP_KEY: 'ip-key-dddddddddddddddddddddddd', TURNSTILE_SECRET: 'ts-secret-eeee', AI_API_KEY: 'ai-key-ffff' };

test('healthy: database up, release, api_v, switches, email configured', async () => {
  const d = makeFakeDeps({ db: createFakeDb(), env: { ...SECRETS, RELEASE_ID: 'r-2026-10', EMAIL_FROM: 'a@example.org', AI_ENABLED: '1' } });
  const res = await handle(get(), d); assert.equal(res.status, 200);
  const b = await res.json();
  assert.deepEqual(b, { ok: true, db: true, release: 'r-2026-10', api_v: versions.API_V, ai_enabled: true, email_configured: true, flags: { adult_signup: false, ai_enabled: true, email_dry_run: true, show_demand: false } });
  matches(b);
  assert.ok(res.headers.get('x-request-id'));
});
test('email not configured when EMAIL_FROM is missing', async () => {
  assert.equal((await (await handle(get(), makeFakeDeps({ db: createFakeDb() }))).json()).email_configured, false);
});
test('database down: 503 unavailable, still reports the rest', async () => {
  const db = createFakeDb(); db.setBroken(); const res = await handle(get(), makeFakeDeps({ db }));
  assert.equal(res.status, 503); const b = await res.json();
  assert.equal(b.ok, false); assert.equal(b.error.code, 'unavailable'); assert.equal(b.db, false); assert.equal(b.api_v, versions.API_V);
  matches(b);
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
test('the real handler output matches the health schema in every state (200 and 503, switches on and off)', async () => {
  for (const env of [{}, { ...SECRETS, AI_ENABLED: '1', EMAIL_FROM: 'a@example.org', ENVIRONMENT: 'production', ADULT_SIGNUP: 'on', SHOW_DEMAND: 'yes' }, { AI_ENABLED: '1' }]) {
    const up = await handle(get(), makeFakeDeps({ db: createFakeDb(), env })); assert.equal(up.status, 200); matches(await up.json());
    const db = createFakeDb(); db.setBroken(); const down = await handle(get(), makeFakeDeps({ db, env })); assert.equal(down.status, 503); matches(await down.json());
  }
});
test('ai_enabled needs the switch and a key; the switch alone shows in flags', async () => {
  const b = await (await handle(get(), makeFakeDeps({ db: createFakeDb(), env: { AI_ENABLED: '1' } }))).json();
  assert.equal(b.ai_enabled, false); assert.equal(b.flags.ai_enabled, true);
  const c = await (await handle(get(), makeFakeDeps({ db: createFakeDb(), env: { AI_ENABLED: '0', AI_API_KEY: 'k' } }))).json();
  assert.equal(c.ai_enabled, false);
});
test('the environment name is not reported', async () => {
  const b = await (await handle(get(), makeFakeDeps({ db: createFakeDb(), env: { ENVIRONMENT: 'production' } }))).json();
  assert.ok(!('environment' in b)); assert.equal(b.flags.email_dry_run, false);
});
