// The contract freeze (contracts/FROZEN.md): every contract file matches its hash in freeze.lock.json, and a file can change
// only together with the version that governs it. Fix a failure with: bump the version, then node contracts/freeze.mjs --write.
import test from 'node:test'; import assert from 'node:assert/strict';
import { contractFiles, governing, current, readLock, compare, lockFor, readAmendments, amendProblems, amendmentRecordProblems } from '../freeze.mjs';
import { versions } from '../versions.js';

test('every contract file matches freeze.lock.json, and the lock has the current versions', () => {
  const problems = compare(readLock(), current());
  assert.deepEqual(problems.map(p => p.message), []);
});
test('every owner amendment in amendments.json is applied in the lock, and the lock records no other', () => {
  assert.deepEqual(amendmentRecordProblems(readLock(), readAmendments()), []);
  for (const a of readAmendments()) {
    assert.match(a.decision, /owner/i, a.id); assert.ok(a.files.length, a.id);
    for (const [k, v] of Object.entries(a.versions)) assert.equal(readLock().amendments.find(x => x.id === a.id).versions[k], v, a.id + ' ' + k);
  }
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

// Amendments (FROZEN.md): a change without a version bump, only with an owner decision that names the file.
const amendment = (files, extra = {}) => ({ id: 'A9', date: '2026-10-29', decision: 'Owner decision 2026-10-29 (test)', summary: 'a test amendment that changes things', files, versions: { SLICE_V: now.versions.SLICE_V, PROFILE_V: now.versions.PROFILE_V, API_V: now.versions.API_V }, ...extra });
test('an amendment covers exactly the files it names, and is recorded in the lock', () => {
  const changed = edit(now, 'slice.schema.json');
  assert.deepEqual(amendProblems(lock, changed, amendment(['slice.schema.json'])), []);
  assert.match(amendProblems(lock, changed, amendment(['bands.json'])).join(), /does not name it/);
  const both = edit(changed, 'profile.schema.json');
  assert.match(amendProblems(lock, both, amendment(['slice.schema.json'])).join(), /profile.schema.json changed but amendment A9 does not name it/);
  const after = lockFor(changed, lock, amendment(['slice.schema.json']));
  assert.deepEqual(compare(after, changed), []);
  assert.equal(after.amendments.at(-1).id, 'A9'); assert.equal(after.amendments.at(-1).files['slice.schema.json'], changed.files['slice.schema.json']);
  assert.match(amendProblems(after, edit(changed, 'slice.schema.json'), amendment(['slice.schema.json'])).join(), /already in freeze.lock.json/, 'an amendment id is used once');
});
test('an amendment needs an owner decision, a date, the versions it keeps, and no slice release yet', () => {
  const changed = edit(now, 'slice.schema.json');
  assert.match(amendProblems(lock, changed, amendment(['slice.schema.json'], { decision: 'the lane wanted it' })).join(), /owner decision/);
  assert.match(amendProblems(lock, changed, amendment(['slice.schema.json'], { date: 'today' })).join(), /YYYY-MM-DD/);
  assert.match(amendProblems(lock, changed, amendment(['slice.schema.json'], { versions: {} })).join(), /must state the SLICE_V/);
  assert.match(amendProblems(lock, changed, amendment(['slice.schema.json'], { versions: { SLICE_V: 2 } })).join(), /keeps SLICE_V at 2/);
  assert.match(amendProblems(lock, changed, amendment(['slice.schema.json']), true).join(), /must bump SLICE_V/);
  assert.deepEqual(amendProblems(lock, edit(now, 'profile.schema.json'), amendment(['profile.schema.json']), true), [], 'the slice release does not block a profile amendment');
  assert.deepEqual(amendProblems(lock, now, null), ['no such amendment in amendments.json']);
  assert.ok(amendProblems(lock, { ...changed, versions: { ...changed.versions, API_V: 0 } }, amendment(['slice.schema.json'], { versions: { SLICE_V: 1 } })).some(m => /went down/.test(m)));
});
test('the lock and amendments.json must agree', () => {
  const a = amendment(['slice.schema.json']), after = lockFor(edit(now, 'slice.schema.json'), lock, a);
  assert.deepEqual(amendmentRecordProblems(after, [a]), []);
  assert.match(amendmentRecordProblems(after, []).join(), /missing from amendments.json/);
  assert.match(amendmentRecordProblems(lock, [a]).join(), /not applied/);
  assert.match(amendmentRecordProblems(after, [{ ...a, files: ['bands.json'] }]).join(), /differs/);
});
