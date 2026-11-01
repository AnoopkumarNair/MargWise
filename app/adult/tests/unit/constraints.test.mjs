// The six constraint questions: every choice is a value the contract allows (contracts/bands.json, profile.schema.json), and the profile that
// carries them passes the schema check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOURS, BUDGET, CITIES, CITY_LABEL, OPEN_EXTRA, OPEN_ORDER, PAY_FLOOR, MODE, cleanConstraints, summaryLines } from '../../constraints_model.js';
import { validate } from '../../../../contracts/validate_lib.js';

const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const bands = J('../../../../contracts/bands.json'), schema = J('../../../../contracts/profile.schema.json');

test('every choice on the screen is a value in bands.json, in the same order', () => {
  assert.deepEqual(HOURS.map(x => x[0]), bands.hours_month.values);
  assert.deepEqual(BUDGET.map(x => x[0]), bands.course_budget.values);
  assert.deepEqual(PAY_FLOOR.map(x => x[0]), bands.pay_floor_pct.values);
  assert.deepEqual(MODE.map(x => x[0]), bands.mode.values);
  assert.deepEqual(CITIES, bands.city_cluster.values);
  assert.deepEqual(OPEN_ORDER, bands.open_to.values);
  assert.deepEqual(OPEN_EXTRA.map(x => x[0]), ['open:india', 'open:remote', 'open:abroad']);
  for (const c of CITIES) assert.ok(CITY_LABEL[c], c);
});

test('cleanConstraints keeps known values only, once each, and drops the rest', () => {
  const c = cleanConstraints({ hours_month: '5-10', course_budget: 'nope', city: 'city:blr', open_to: ['open:remote', 'city:blr', 'open:remote', 'mars'], pay_floor_pct: -10, mode: 'hybrid', extra: 1 });
  assert.deepEqual(c, { hours_month: '5-10', city: 'city:blr', open_to: ['city:blr', 'open:remote'], pay_floor_pct: -10, mode: 'hybrid' });
  assert.deepEqual(cleanConstraints(null), {}); assert.deepEqual(cleanConstraints({ open_to: [] }), {});
  assert.deepEqual(cleanConstraints({ pay_floor_pct: 0 }), { pay_floor_pct: 0 }, 'zero is an answer, not a blank');
});

test('a profile with constraints passes the schema; a bad value is refused', () => {
  const base = { v: 1, roles: [{ occ: 'occ:13-2011.00', level: 2, industry: 'other', years: '2-5', current: true }], skills: [{ id: 'skl:2.A.1.a', strength: 'used' }],
    priorities: { pay: 1, ai_safe: 1, short_move: 3, demand: 1, enjoy: 0 }, job_release: 'dev-unaccepted' };
  const good = cleanConstraints({ hours_month: '0-5', course_budget: 'free', city: 'city:other', open_to: ['open:india', 'open:abroad'], pay_floor_pct: 20, mode: 'any' });
  assert.ok(validate(schema, { ...base, constraints: good }).ok);
  assert.equal(validate(schema, { ...base, constraints: { mode: 'moon' } }).ok, false);
});

test('summaryLines is plain and lists only what was answered', () => {
  assert.deepEqual(summaryLines({}), []);
  const L = summaryLines({ hours_month: '5-10', city: 'city:pnq', open_to: ['city:pnq', 'open:remote'], pay_floor_pct: -10 });
  assert.equal(L.length, 4); assert.match(L[2], /Pune, Remote only/); assert.match(L[3], /Up to 10% less/);
});
