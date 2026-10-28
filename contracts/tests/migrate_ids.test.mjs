// ADR-05: ids are mapped through the registry on read. Run: node --test contracts/tests/
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { migrateIds, registryMap } from '../migrate_ids.js';
import { validate } from '../validate.js';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROFILE = JSON.parse(fs.readFileSync(path.join(DIR, 'profile.schema.json'), 'utf8'));
const entry = (id, kind, status = 'live', replaced_by = null) => ({ id, kind, label: id, first_release: 'r1', status, replaced_by, note: '' });
const REG = [
  entry('occ:13-2011.00', 'occupation'), entry('occ:13-2051.00', 'occupation'), entry('occ:13-2041.00', 'occupation'),
  entry('occ:13-2011.01', 'occupation', 'tombstone', ['occ:13-2011.00']),
  entry('occ:13-2099.01', 'occupation', 'tombstone', ['occ:13-2051.00', 'occ:13-2041.00']),
  entry('skl:2.A.2.a', 'skill'), entry('skl:2.A.2.b', 'skill'), entry('tec:python', 'skill'), entry('tec:pandas', 'skill'),
  entry('skl:2.A.2.z', 'skill', 'tombstone', ['skl:2.A.2.a']),
  entry('tec:old-tool', 'skill', 'tombstone', null),
  entry('tec:gone-empty', 'skill', 'tombstone', []),
  entry('tec:pydata', 'skill', 'tombstone', ['tec:python', 'tec:pandas']),
  entry('tec:chain-1', 'skill', 'tombstone', ['tec:chain-2']), entry('tec:chain-2', 'skill', 'tombstone', ['tec:python']),
  entry('tec:loop-a', 'skill', 'tombstone', ['tec:loop-b']), entry('tec:loop-b', 'skill', 'tombstone', ['tec:loop-a']),
  entry('cred:aws-saa', 'credential'), entry('cred:aws-saa-c02', 'credential', 'tombstone', ['cred:aws-saa'])
];
const base = (skills = [], roles = [{ occ: 'occ:13-2011.00', level: 3, industry: 'bfsi', years: '3-7', current: true }], creds = []) =>
  ({ v: 1, rev: 3, roles, skills, creds, job_release: 'abc123', matcher_version: '1.0.0' });

test('live ids are unchanged, and nothing is reported', () => {
  const p = base([{ id: 'skl:2.A.2.a', strength: 'strong', last: 2026 }], undefined, [{ id: 'cred:aws-saa', year: 2024, expires: 2027 }]);
  const r = migrateIds(p, REG);
  assert.deepEqual(r.profile, p); assert.notEqual(r.profile, p);
  assert.deepEqual([r.mapped, r.dropped, r.unknown, r.changed], [[], [], [], false]);
});
test('a tombstone with a replacement is mapped, keeping strength and year', () => {
  const r = migrateIds(base([{ id: 'skl:2.A.2.z', strength: 'used', last: 2024 }]), REG);
  assert.deepEqual(r.profile.skills, [{ id: 'skl:2.A.2.a', strength: 'used', last: 2024 }]);
  assert.deepEqual(r.mapped, [{ from: 'skl:2.A.2.z', to: ['skl:2.A.2.a'], field: 'skills' }]);
  assert.deepEqual(r.dropped, []); assert.equal(r.changed, true);
});
test('a tombstone without a replacement is removed and listed in dropped', () => {
  const r = migrateIds(base([{ id: 'tec:old-tool', strength: 'strong' }, { id: 'tec:gone-empty', strength: 'used' }, { id: 'tec:python', strength: 'used' }]), REG);
  assert.deepEqual(r.profile.skills, [{ id: 'tec:python', strength: 'used' }]);
  assert.deepEqual(r.dropped, ['tec:old-tool', 'tec:gone-empty']); assert.deepEqual(r.mapped, []); assert.equal(r.changed, true);
});
test('an unknown id is kept as it is and reported in unknown', () => {
  const p = base([{ id: 'tec:never-published', strength: 'used' }], [{ occ: 'occ:99-9999.00', level: 1, industry: 'it', years: '0-1', current: true }]);
  const r = migrateIds(p, REG);
  assert.deepEqual(r.profile, p);
  assert.deepEqual(r.unknown, ['occ:99-9999.00', 'tec:never-published']); assert.equal(r.changed, false);
});
test('an empty registry never empties a profile', () => {
  const p = base([{ id: 'skl:2.A.2.a', strength: 'strong' }]);
  const r = migrateIds(p, []);
  assert.deepEqual(r.profile, p); assert.equal(r.unknown.length, 2); assert.deepEqual(r.dropped, []);
});
test('the input is never changed', () => {
  const p = base([{ id: 'skl:2.A.2.z', strength: 'used' }, { id: 'tec:old-tool', strength: 'used' }], [{ occ: 'occ:13-2011.01', level: 3, industry: 'bfsi', years: '3-7', current: true }], [{ id: 'cred:aws-saa-c02', year: 2021, expires: 2024 }]);
  const copy = structuredClone(p), reg = structuredClone(REG);
  migrateIds(p, REG);
  assert.deepEqual(p, copy); assert.deepEqual(REG, reg);
});
test('a split skill becomes one entry per replacement', () => {
  const r = migrateIds(base([{ id: 'tec:pydata', strength: 'strong', last: 2025 }]), REG);
  assert.deepEqual(r.profile.skills, [{ id: 'tec:python', strength: 'strong', last: 2025 }, { id: 'tec:pandas', strength: 'strong', last: 2025 }]);
  assert.deepEqual(r.mapped, [{ from: 'tec:pydata', to: ['tec:python', 'tec:pandas'], field: 'skills' }]);
});
test('chains are followed; loops count as no replacement', () => {
  const r = migrateIds(base([{ id: 'tec:chain-1', strength: 'used' }, { id: 'tec:loop-a', strength: 'used' }]), REG);
  assert.deepEqual(r.profile.skills, [{ id: 'tec:python', strength: 'used' }]);
  assert.deepEqual(r.mapped, [{ from: 'tec:chain-1', to: ['tec:python'], field: 'skills' }]);
  assert.deepEqual(r.dropped, ['tec:loop-a']);
});
test('duplicates: a direct entry wins, then the stronger mapped one', () => {
  const r = migrateIds(base([{ id: 'skl:2.A.2.z', strength: 'strong', last: 2026 }, { id: 'skl:2.A.2.a', strength: 'rusty', last: 2015 }]), REG);
  assert.deepEqual(r.profile.skills, [{ id: 'skl:2.A.2.a', strength: 'rusty', last: 2015 }]);
  const r2 = migrateIds(base([{ id: 'tec:chain-1', strength: 'rusty', last: 2020 }, { id: 'tec:pydata', strength: 'strong', last: 2024 }]), REG);
  assert.deepEqual(r2.profile.skills, [{ id: 'tec:python', strength: 'strong', last: 2024 }, { id: 'tec:pandas', strength: 'strong', last: 2024 }]);
});
test('roles: a tombstoned occupation is mapped; a split one takes the first and asks', () => {
  const r = migrateIds(base([], [{ occ: 'occ:13-2011.01', level: 3, industry: 'bfsi', years: '3-7', current: true }, { occ: 'occ:13-2099.01', level: 2, industry: 'it', years: '1-3', current: false }]), REG);
  assert.deepEqual(r.profile.roles.map(x => x.occ), ['occ:13-2011.00', 'occ:13-2051.00']);
  assert.equal(r.profile.roles[1].level, 2);
  assert.deepEqual(r.mapped, [{ from: 'occ:13-2011.01', to: ['occ:13-2011.00'], field: 'roles' }, { from: 'occ:13-2099.01', to: ['occ:13-2051.00', 'occ:13-2041.00'], field: 'roles', pick: true }]);
});
test('credentials are mapped too', () => {
  const r = migrateIds(base([], undefined, [{ id: 'cred:aws-saa-c02', year: 2021, expires: 2024 }]), REG);
  assert.deepEqual(r.profile.creds, [{ id: 'cred:aws-saa', year: 2021, expires: 2024 }]);
});
test('a Map registry works the same as an array, and other shapes are refused', () => {
  const p = base([{ id: 'skl:2.A.2.z', strength: 'used' }]);
  assert.deepEqual(migrateIds(p, registryMap(REG)), migrateIds(p, REG));
  assert.throws(() => migrateIds(p, { ids: REG }), TypeError);
});
test('the mapped profile still validates against the profile contract', () => {
  const p = base([{ id: 'tec:pydata', strength: 'strong', last: 2025 }, { id: 'tec:old-tool', strength: 'used' }], [{ occ: 'occ:13-2099.01', level: 2, industry: 'it', years: '1-3', current: true }], [{ id: 'cred:aws-saa-c02', year: 2021, expires: null }]);
  const r = migrateIds(p, REG);
  const v = validate(PROFILE, r.profile); assert.ok(v.ok, JSON.stringify(v.errors));
});
test('profiles without the optional lists are fine', () => {
  const r = migrateIds({ v: 1, roles: [], skills: [] }, REG);
  assert.deepEqual(r.profile, { v: 1, roles: [], skills: [] }); assert.equal(r.changed, false);
});
