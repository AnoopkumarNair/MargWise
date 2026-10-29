// The contract freeze (contracts/FROZEN.md): every contract file matches its hash in freeze.lock.json, and a file can change
// only together with the version that governs it. Fix a failure with: bump the version, then node contracts/freeze.mjs --write.
import test from 'node:test'; import assert from 'node:assert/strict';
import { contractFiles, governing, current, readLock, compare, lockFor } from '../freeze.mjs';
import { versions } from '../versions.js';

test('every contract file matches freeze.lock.json, and the lock has the current versions', () => {
  const problems = compare(readLock(), current());
  assert.deepEqual(problems.map(p => p.message), []);
});
test('the lock covers exactly the contract files, each governed by a version', () => {
  const lock = readLock(), files = contractFiles();
  assert.ok(files.length >= 30, `found ${files.length} contract files`);
  assert.deepEqual(Object.keys(lock.files).sort(), files);
  for (const f of files) { assert.ok(governing(f), f); assert.deepEqual(lock.files[f].version, governing(f), f); }
  assert.ok(files.includes('bands.json') && files.includes('event_schemas.js') && files.includes('api/event/road_added.request.schema.json'));
  assert.equal(lock.frozen, 'S0');
});

// The rules, on made-up states, so they are tested without touching the real files.
const now = current(), lock = lockFor(now, { frozen: 'S0' });
const edit = (state, f, v) => ({ versions: { ...state.versions, ...v }, files: { ...state.files, [f]: 'f'.repeat(64) } });
const kinds = ps => ps.map(p => `${p.file}:${p.kind}`);

test('a fresh lock matches', () => assert.deepEqual(compare(lock, now), []));
test('a changed file without a bump must be bumped', () => {
  assert.deepEqual(kinds(compare(lock, edit(now, 'profile.schema.json'))), ['profile.schema.json:bump']);
  assert.deepEqual(kinds(compare(lock, edit(now, 'api/event/feedback.request.schema.json', { PROFILE_V: versions.PROFILE_V + 1 }))), ['api/event/feedback.request.schema.json:bump'], 'the wrong version does not cover it');
});
test('a changed file with its version bumped only needs the lock rewritten', () => {
  assert.deepEqual(kinds(compare(lock, edit(now, 'profile.schema.json', { PROFILE_V: versions.PROFILE_V + 1 }))), ['profile.schema.json:stale']);
  assert.deepEqual(kinds(compare(lock, edit(now, 'api/error.schema.json', { PROFILE_V: versions.PROFILE_V + 1 }))), ['api/error.schema.json:stale'], 'a profile copy is covered by PROFILE_V');
  assert.deepEqual(kinds(compare(lock, edit(now, 'bands.json', { SLICE_V: versions.SLICE_V + 1 }))), ['bands.json:stale']);
});
test('new and removed files count as changes', () => {
  assert.deepEqual(kinds(compare(lock, edit(now, 'api/new_thing.request.schema.json'))), ['api/new_thing.request.schema.json:bump']);
  const gone = { versions: now.versions, files: { ...now.files } }; delete gone.files['extract.schema.json'];
  assert.deepEqual(kinds(compare(lock, gone)), ['extract.schema.json:bump']);
});
test('a version that goes down, a stale version list and an ungoverned file are reported', () => {
  assert.ok(kinds(compare(lock, { ...now, versions: { ...now.versions, API_V: 0 } })).includes('versions.js:down'));
  assert.deepEqual(kinds(compare(lock, { ...now, versions: { ...now.versions, MATCHER_VERSION: '9.9.9' } })), ['versions.js:stale']);
  assert.deepEqual(kinds(compare(lock, edit(now, 'notes.schema.json'))), ['notes.schema.json:unmapped']);
  assert.equal(governing('README.md'), null);
  assert.deepEqual(kinds(compare(null, now)), ['freeze.lock.json:stale']);
});
