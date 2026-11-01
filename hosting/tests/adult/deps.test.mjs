import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeps, makeFakeDeps, buildConfig } from '../../core/deps.js';
import { createFakeDb } from './fakedb.mjs';
import { versions } from '../../core/versions.js';

test('makeDeps builds everything a handler may use from env', () => {
  const env = { DB: {}, ASSETS: { fetch() {} }, RELEASE_ID: 'rel-9', ENVIRONMENT: 'production', EMAIL_FROM: 'hi@example.org', AI_DAILY_CAP: '50', RETENTION_DAYS: '90', RETENTION_DAYS_ADULT: '30' };
  const d = makeDeps(env);
  assert.equal(d.db, env.DB); assert.equal(d.assets, env.ASSETS);
  assert.equal(typeof d.now(), 'number'); assert.equal(d.random(8).length, 8); assert.equal(typeof d.log, 'function');
  assert.equal(d.config.release, 'rel-9'); assert.equal(d.config.apiV, versions.API_V); assert.equal(d.config.aiDailyCap, 50);
  assert.deepEqual(d.config.retentionDays, { student: 90, adult: 30 });
  assert.equal(d.flags.emailDryRun, false);
});
test('defaults when env is empty', () => {
  const c = buildConfig({}); assert.equal(c.release, 'dev'); assert.equal(c.environment, 'local'); assert.deepEqual(c.retentionDays, { student: 0, adult: 0 }); assert.equal(c.aiDailyCap, 0);
  assert.equal(makeDeps({}).assets, null);
});
test('secrets are reachable by code but invisible to JSON and logging of config', () => {
  const c = buildConfig({ SIGN_KEY: 'sign-secret-value', EMAIL_KEY: 'e', CODE_KEY: 'c', IP_KEY: 'i' });
  assert.equal(c.secrets.sign, 'sign-secret-value');
  assert.ok(!JSON.stringify(c).includes('secret')); assert.ok(!Object.keys(c).includes('secrets'));
  assert.throws(() => { 'use strict'; c.secrets.sign = 'x'; });
});
test('random() returns random bytes on the real deps', () => { assert.notDeepEqual(makeDeps({}).random(16), makeDeps({}).random(16)); });
test('fake deps: injectable clock, repeatable random, captured logs', () => {
  const d = makeFakeDeps({ now: 1000, seed: 7 }), e = makeFakeDeps({ seed: 7 });
  assert.equal(d.now(), 1000); d.clock.advance(500); assert.equal(d.now(), 1500);
  assert.deepEqual(d.random(6), e.random(6)); assert.notDeepEqual(d.random(6), makeFakeDeps({ seed: 8 }).random(6));
  d.log({ ts: 1, status: 200 }); assert.equal(d.logs.length, 1); assert.equal(d.logged()[0].status, 200);
});
test('fake deps take a db, env settings and an asset map', async () => {
  const db = createFakeDb(); const d = makeFakeDeps({ db, env: { AI_ENABLED: '1' }, assets: { '/work/graph/r1/ids.json': { ids: ['a'] } } });
  assert.equal(d.db, db); assert.equal(d.flags.aiEnabled, true);
  assert.deepEqual(await (await d.assets.fetch(new Request('https://x.test/work/graph/r1/ids.json'))).json(), { ids: ['a'] });
  assert.equal((await d.assets.fetch(new Request('https://x.test/nope'))).status, 404);
});
