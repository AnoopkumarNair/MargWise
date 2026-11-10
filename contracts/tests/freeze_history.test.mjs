// The freeze history check (contracts/check_freeze_history.mjs, review finding S6), on made-up states, so it does not depend on git.
import test from 'node:test'; import assert from 'node:assert/strict';
import { appendOnly, lockProblems, unbumpedFiles, deviationProblems, narrowing, run } from '../check_freeze_history.mjs';

const A1 = { id: 'A1', date: '2026-10-29', decision: 'Owner decision 2026-10-29', deviation: 'docs/adult/deviations.md D14', files: ['slice.schema.json'], versions: { SLICE_V: 1 } };
const A2 = { ...A1, id: 'A2', deviation: 'docs/adult/deviations.md D30', files: ['bands.json'] };
const V = { MATCHER_VERSION: '1.0.0', PROFILE_V: 1, SLICE_V: 1, API_V: 1 };
const lock = (files, versions = V, amendments = []) => ({ versions, files: Object.fromEntries(Object.entries(files).map(([f, h]) => [f, { sha256: h }])), amendments });
const BASE = lock({ 'slice.schema.json': 'a', 'bands.json': 'b', 'profile.schema.json': 'c' }, V, [{ id: 'A1', date: '2026-10-29', files: { 'slice.schema.json': 'a' } }]);

test('amendments may only be appended; existing entries are immutable', () => {
  assert.deepEqual(appendOnly([A1], [A1, A2], 'x'), []);
  assert.match(appendOnly([A1], [A2], 'x').join(), /changed or moved/);
  assert.match(appendOnly([A1, A2], [A1], 'x').join(), /A2 was removed/);
  assert.match(appendOnly([A1], [{ ...A1, summary: 'edited later' }], 'x').join(), /A1 was changed/);
  assert.match(appendOnly([A1, A2], [A2, A1], 'x').join(), /changed or moved/);
});

test('a lock change needs a version bump or a new amendment that names the file', () => {
  assert.deepEqual(lockProblems(BASE, BASE), []);
  const changed = lock({ 'slice.schema.json': 'a', 'bands.json': 'b', 'profile.schema.json': 'c2' }, V, BASE.amendments);
  assert.match(lockProblems(BASE, changed).join(), /profile.schema.json changed .* without a bump of PROFILE_V/);
  assert.deepEqual(lockProblems(BASE, { ...changed, versions: { ...V, PROFILE_V: 2 } }), []);
  const amended = lock({ 'slice.schema.json': 'a', 'bands.json': 'b2', 'profile.schema.json': 'c' }, V, [...BASE.amendments, { id: 'A2', date: '2026-11-01', files: { 'bands.json': 'b2' } }]);
  assert.deepEqual(lockProblems(BASE, amended), []);
  assert.deepEqual(unbumpedFiles(BASE, amended), ['bands.json']);   // so the additive check runs on it
  const wrongFile = lock({ 'slice.schema.json': 'a', 'bands.json': 'b', 'profile.schema.json': 'c2' }, V, amended.amendments);
  assert.match(lockProblems(BASE, wrongFile).join(), /profile.schema.json changed/);
  assert.match(lockProblems(BASE, lock({ 'slice.schema.json': 'a', 'bands.json': 'b', 'profile.schema.json': 'c' }, V, [])).join(), /A1 was removed/);
  assert.match(lockProblems({ ...BASE, versions: { ...V, SLICE_V: 2 } }, BASE).join(), /SLICE_V went down/);
  assert.match(lockProblems(BASE, lock({ 'slice.schema.json': 'a', 'bands.json': 'b' }, V, BASE.amendments)).join(), /profile.schema.json changed/);   // removed
});

test('every amendment has a deviation entry decided by the owner that names it', () => {
  const ok = '# x\n\n### D14. Slice amendment A1\n- Plan said: x\n- Decision: decided by owner 2026-10-29\n\n### D15. Other\n- Decision: proposed\n';
  assert.deepEqual(deviationProblems([A1], ok), []);
  assert.match(deviationProblems([A1], ok.replace('decided by owner 2026-10-29', 'proposed')).join(), /decided by owner/);
  assert.match(deviationProblems([A1], ok.replace('amendment A1', 'amendment')).join(), /does not mention A1/);
  assert.match(deviationProblems([{ ...A1, deviation: 'docs/adult/deviations.md D15' }], ok).join(), /decided by owner/);
  assert.match(deviationProblems([A2], ok).join(), /D30 is not in/);
  assert.match(deviationProblems([{ ...A1, deviation: undefined }], ok).join(), /must name its entry/);
});

test('the real amendments have their owner decisions in docs/adult/deviations.md', async () => {
  const fs = await import('node:fs');
  const am = JSON.parse(fs.readFileSync(new URL('../amendments.json', import.meta.url), 'utf8')).amendments;
  assert.deepEqual(deviationProblems(am, fs.readFileSync(new URL('../../docs/adult/deviations.md', import.meta.url), 'utf8')), []);
});

test('additive changes pass; narrowing ones are named', () => {
  const s = { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { type: 'string', enum: ['x', 'y'], maxLength: 10 }, b: { type: ['integer', 'null'], minimum: 0 }, c: { type: 'array', items: { type: 'object', properties: { d: { type: 'string' } } } } } };
  const copy = () => JSON.parse(JSON.stringify(s));
  assert.deepEqual(narrowing(s, copy()), []);
  const add = copy(); add.properties.e = { type: 'string' }; add.properties.a.enum.push('z'); add.properties.a.maxLength = 20; add.properties.b.type.push('string');
  assert.deepEqual(narrowing(s, add), []);
  const cases = [
    [n => delete n.properties.b, /properties\/b: property removed/],
    [n => n.required.push('b'), /required: b is now required/],
    [n => n.properties.a.enum.pop(), /enum: value "y" removed/],
    [n => { n.properties.b.type = ['integer']; }, /type: null removed/],
    [n => { n.properties.c.items.additionalProperties = false; }, /items\/additionalProperties: turned off/],
    [n => { n.properties.a.maxLength = 5; }, /maxLength: lowered/],
    [n => { n.properties.b.minimum = 1; }, /minimum: raised/],
    [n => delete n.properties.c.items.properties.d, /items\/properties\/d: property removed/],
  ];
  for (const [f, re] of cases) { const n = copy(); f(n); assert.match(narrowing(s, n).join('; '), re); }
  assert.match(narrowing({ years: { values: ['0-2', '2-5'] } }, { years: { values: ['2-5'] } }).join(), /values: value "0-2" removed/);   // bands.json
  assert.deepEqual(narrowing({ years: { values: ['0-2'] } }, { years: { values: ['0-2', '2-5'] } }), []);
});

test('an unreadable base is a warning locally and a failure in CI', () => {
  const local = run({ base: 'no-such-ref-for-the-test', ci: false });
  assert.equal(local.problems.length, 0); assert.match(local.warnings.join(), /cannot read/);
  assert.match(run({ base: 'no-such-ref-for-the-test', ci: true }).problems.join(), /cannot read .*fetch-depth/);
});
