// T3.7: the ADR-10 alert rules, on the metrics the endpoint really returns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, RULES } from '../../tools/health_watch.mjs';
import { handle as metricsH } from '../../core/metrics.js';
import { handle as healthH } from '../../core/health.js';
import { bump } from '../../core/ops.js';
import { world, req, json, KEYS, T0 } from './api_helpers.mjs';

const H = { ok: true, db: true };
const M = (metrics, limits = {}) => ({ ok: true, days: [{ day: '2025-10-20', metrics }], limits });
const rules = a => a.map(x => x.rule);

test('no alerts when all is well, and quiet days with few requests do not alert', () => {
  assert.deepEqual(evaluate({ health: H, metrics: M({ requests: 400, http_5xx: 2, codes_sent: 30, email_errors: 1, ai_calls: 20, ai_errors: 1 }, { ai_daily_cap: 100 }), now: T0 }), []);
  assert.deepEqual(evaluate({ health: H, metrics: M({ requests: 10, http_5xx: 5, codes_sent: 1, email_errors: 4 }), now: T0 }), [], 'under the minimum counts');
  assert.deepEqual(evaluate({ health: H, metrics: { ok: true, days: [] }, now: T0 }), [], 'a day with no counters');
});
test('health failing, or metrics not answering, alerts', () => {
  assert.deepEqual(rules(evaluate({ health: null, metrics: M({}), now: T0 })), ['health_failed']);
  assert.deepEqual(rules(evaluate({ health: { ok: false, db: false }, metrics: M({}), now: T0 })), ['health_failed']);
  assert.deepEqual(rules(evaluate({ health: H, metrics: null, now: T0 })), ['metrics_unavailable']);
});
test('5xx above 2 percent, email errors above 10 percent, AI errors above 10 percent, AI spend past 80 percent of the cap', () => {
  const at = metrics => rules(evaluate({ health: H, metrics: M(metrics, { ai_daily_cap: 100 }), now: T0 }));
  assert.deepEqual(at({ requests: 100, http_5xx: 3 }), ['http_5xx_rate']); assert.deepEqual(at({ requests: 100, http_5xx: 2 }), []);
  assert.deepEqual(at({ codes_sent: 8, email_errors: 2 }), ['email_error_rate']); assert.deepEqual(at({ codes_sent: 9, email_errors: 1 }), []);
  assert.deepEqual(at({ ai_calls: 20, ai_errors: 3 }), ['ai_error_rate']);
  assert.deepEqual(at({ ai_calls: 80 }), ['ai_spend_near_cap']); assert.deepEqual(at({ ai_calls: 79 }), []);
  assert.deepEqual(at({ requests: 100, http_5xx: 50, codes_sent: 0, email_errors: 20, ai_calls: 95, ai_errors: 50 }).sort(), ['ai_error_rate', 'ai_spend_near_cap', 'email_error_rate', 'http_5xx_rate']);
  assert.equal(RULES.http5xxRate, 0.02); assert.equal(RULES.emailErrorRate, 0.1);
});
test('the rules read the real metrics endpoint and health endpoint', async () => {
  const w = world(); for (let i = 0; i < 12; i++) await bump(w.deps, 'email_errors'); await bump(w.deps, 'codes_sent', 2);
  const metrics = (await json(await metricsH(req('GET', '/api/v1/admin/metrics', { headers: { 'x-admin-key': KEYS.ADMIN_KEY } }), w.deps))).body;
  const health = (await json(await healthH(req('GET', '/api/v1/health'), w.deps))).body;
  const alerts = evaluate({ health, metrics, now: T0 }); assert.deepEqual(rules(alerts), ['email_error_rate']);
  assert.ok(!JSON.stringify(alerts).includes('@'), 'only rule names and numbers');
});
