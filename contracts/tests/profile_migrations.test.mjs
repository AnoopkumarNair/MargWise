// ADR-06: profile upgrades on read. Run: node --test contracts/tests/
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { upgrade, PROFILE_V, STEPS } from '../profile_migrations.js';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const spec6 = JSON.parse(fs.readFileSync(path.join(DIR, 'examples', 'profile--spec6.json'), 'utf8'));

test('PROFILE_V matches versions.json', () => {
  assert.equal(PROFILE_V, JSON.parse(fs.readFileSync(path.join(DIR, 'versions.json'), 'utf8')).PROFILE_V);
});
test('there is one step for every version below the current one', () => {
  for (let v = 1; v < PROFILE_V; v++) assert.equal(typeof STEPS[v], 'function', `missing step from v${v}`);
  assert.deepEqual(Object.keys(STEPS).map(Number).filter(v => v >= PROFILE_V), []);
});
test('v1 upgrade is a no-op that returns a copy', () => {
  const copy = structuredClone(spec6), out = upgrade(spec6);
  assert.deepEqual(out, spec6); assert.notEqual(out, spec6); assert.deepEqual(spec6, copy);
});
test('a newer, missing or bad v is refused', () => {
  assert.throws(() => upgrade({ ...spec6, v: PROFILE_V + 1 }), /newer than this code/);
  for (const v of [undefined, 0, '1', 1.5, null]) assert.throws(() => upgrade({ ...spec6, v }), /whole number/);
  for (const p of [null, [], 'x']) assert.throws(() => upgrade(p), TypeError);
});
