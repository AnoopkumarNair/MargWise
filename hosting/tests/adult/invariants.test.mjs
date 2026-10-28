import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { runInvariants, format } from '../../tools/check_invariants.mjs';
import { createFakeDb } from './fakedb.mjs';
import { versions } from '../../core/versions.js';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tools/check_invariants.mjs');
const NOW = 1760000000000, DAY = 86400000;
// The adult tables as SPEC section 10 designs them. They are not migrated yet, so the tests add them here to prove the checks work.
const ADULT_DDL = `
ALTER TABLE testers ADD COLUMN track TEXT; ALTER TABLE testers ADD COLUMN age_band TEXT; ALTER TABLE testers ADD COLUMN email TEXT; ALTER TABLE testers ADD COLUMN email_hash TEXT;
ALTER TABLE invites ADD COLUMN track TEXT;
CREATE TABLE email_codes (email_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL, link_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, invite_id INTEGER, age_band TEXT, created_at INTEGER NOT NULL);
CREATE TABLE email_sends (email_hash TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (email_hash, day));
CREATE TABLE profiles (tester_id TEXT PRIMARY KEY, v INTEGER NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, job_release TEXT, matcher_version TEXT, updated_at INTEGER NOT NULL);`;

const run = async db => Object.fromEntries((await runInvariants(db, { now: NOW })).map(r => [r.id, r]));
const withAdult = () => { const db = createFakeDb(); db.raw.exec(ADULT_DDL); return db; };
const sql = (db, s, ...a) => db.prepare(s).bind(...a).run();
const tester = (db, id, extra = {}) => sql(db, 'INSERT INTO testers (id, name, created_at, track, age_band, email_hash, counsellor_id, klass, source, invite_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  id, 'N', NOW, extra.track ?? null, extra.age_band ?? null, extra.email_hash ?? null, extra.counsellor_id ?? null, extra.klass ?? null, extra.source ?? null, extra.invite_id ?? null);
const student = (db, id) => sql(db, 'INSERT INTO testers (id, name, created_at) VALUES (?, ?, ?)', id, 'N', NOW);
const event = (db, tid, type, data) => sql(db, 'INSERT INTO events (tester_id, ts, type, data) VALUES (?, ?, ?, ?)', tid, NOW, type, JSON.stringify(data));

test('a clean database passes; planned checks say when they start to apply', async () => {
  const r = await run(createFakeDb());
  for (const id of [2, 6]) assert.equal(r[id].status, 'pass', id);
  for (const id of [1, 3, 4, 5, 7, 8, 9]) { assert.equal(r[id].status, 'n/a', id); assert.match(r[id].note, /not applicable until T/, id); }
  const adult = await run(withAdult());
  for (const id of [1, 2, 4, 5, 9]) assert.equal(adult[id].status, 'pass', `${id}: ${adult[id].violations}`);
});

test('1: an adult without age band or email hash, a duplicate hash, and a non-adult with a hash', async () => {
  let db = withAdult(); await tester(db, 'a1', { track: 'adult', email_hash: 'h1' }); assert.match((await run(db))[1].violations.join(), /without age_band or email_hash/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s' }); assert.equal((await run(db))[1].status, 'fail');
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' }); await tester(db, 'a2', { track: 'adult', age_band: '30s', email_hash: 'h' });
  assert.match((await run(db))[1].violations.join(), /used more than once/);
  db = withAdult(); await tester(db, 's1', { email_hash: 'h' }); assert.match((await run(db))[1].violations.join(), /not adults/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' }); assert.equal((await run(db))[1].status, 'pass');
});

test('2: an @ anywhere but testers.email, an oversized event, and free text in an adult event', async () => {
  let db = createFakeDb(); await student(db, 't1'); await event(db, 't1', 'x', { note: 'write me at a@b.co' });
  assert.match((await run(db))[2].violations.join(), /events\.data: 1 value/);
  db = createFakeDb(); await sql(db, 'INSERT INTO testers (id, name, created_at) VALUES (?, ?, ?)', 't1', 'me@x.com', NOW); assert.match((await run(db))[2].violations.join(), /testers\.name/);
  db = createFakeDb(); await student(db, 't1'); await event(db, 't1', 'x', { t: 'a'.repeat(7000) }); assert.match((await run(db))[2].violations.join(), /longer than 6000/);
  db = withAdult(); await sql(db, 'INSERT INTO testers (id, name, created_at, email) VALUES (?, ?, ?, ?)', 'a1', 'N', NOW, 'ok@example.com'); assert.equal((await run(db))[2].status, 'pass', 'testers.email may hold @');
  db = withAdult(); await sql(db, 'INSERT INTO profiles VALUES (?, 1, 1, ?, NULL, NULL, ?)', 'a1', 'x'.repeat(33000), NOW); assert.match((await run(db))[2].violations.join(), /profiles\.data/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' });
  await event(db, 'a1', 'intake', { text: 'I worked at Acme as a developer for eight years and then moved to management of a team of ten' });
  assert.match((await run(db))[2].violations.join(), /free text outside capped feedback/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' });
  await event(db, 'a1', 'road_added', { ids: ['skl:2.A.1.a'], n: 3 }); await event(db, 'a1', 'feedback', { text: 'x'.repeat(900), rating: 4 });
  assert.equal((await run(db))[2].status, 'pass');
  await event(db, 'a1', 'feedback', { text: 'x'.repeat(1500) }); assert.match((await run(db))[2].violations.join(), /feedback text/);
});

test('4: profile version above PROFILE_V, or rev below 1', async () => {
  let db = withAdult(); await sql(db, 'INSERT INTO profiles VALUES (?, ?, 1, ?, NULL, NULL, ?)', 'a1', versions.PROFILE_V + 1, '{}', NOW); assert.match((await run(db))[4].violations.join(), /above PROFILE_V/);
  db = withAdult(); await sql(db, 'INSERT INTO profiles VALUES (?, ?, 0, ?, NULL, NULL, ?)', 'a1', 1, '{}', NOW); assert.match((await run(db))[4].violations.join(), /rev below 1/);
  db = withAdult(); await sql(db, 'INSERT INTO profiles VALUES (?, ?, 1, ?, NULL, NULL, ?)', 'a1', 1, '{}', NOW); assert.equal((await run(db))[4].status, 'pass');
});

test('5: an old email code and an old send count', async () => {
  let db = withAdult(); await sql(db, 'INSERT INTO email_codes VALUES (?, ?, ?, ?, 0, NULL, NULL, ?)', 'h', 'c', 'l', NOW, NOW - DAY - 1000); assert.match((await run(db))[5].violations.join(), /older than 24 hours/);
  db = withAdult(); await sql(db, 'INSERT INTO email_codes VALUES (?, ?, ?, ?, 0, NULL, NULL, ?)', 'h', 'c', 'l', NOW, NOW - DAY + 60000); assert.equal((await run(db))[5].status, 'pass');
  db = withAdult(); await sql(db, 'INSERT INTO email_sends VALUES (?, ?, 1)', 'h', '2020-01-01'); assert.match((await run(db))[5].violations.join(), /email_sends/);
});

test('6: data left behind for a deleted tester, and a table missing from the inventory', async () => {
  let db = createFakeDb(); await event(db, 'gone', 'x', {}); assert.match((await run(db))[6].violations.join(), /events: 1 row\(s\) belong to a tester that no longer exists/);
  db = createFakeDb(); await sql(db, "INSERT INTO reviews (tester_id, code, counsellor, baseline, baseline_at) VALUES ('gone', 'c', 'x', 'b', 1)"); assert.match((await run(db))[6].violations.join(), /reviews/);
  db = createFakeDb(); await sql(db, "INSERT INTO followups (tester_id, months, created_at) VALUES ('gone', 6, 1)"); assert.match((await run(db))[6].violations.join(), /followups/);
  db = createFakeDb(); await db.exec('CREATE TABLE notes (tester_id TEXT)'); assert.match((await run(db))[6].violations.join(), /notes is not in the data inventory/);
  db = createFakeDb(); await student(db, 't1'); await event(db, 't1', 'x', {}); assert.equal((await run(db))[6].status, 'pass');
});

test('9: adults mixed into counsellor data, students holding adult fields, invite tracks that do not match', async () => {
  let db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h', counsellor_id: 4 }); assert.match((await run(db))[9].violations.join(), /linked to a counsellor/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' });
  await sql(db, "INSERT INTO reviews (tester_id, code, counsellor, baseline, baseline_at) VALUES ('a1', 'c', 'x', 'b', 1)"); assert.match((await run(db))[9].violations.join(), /reviews about adult/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' }); await sql(db, "INSERT INTO followups (tester_id, months, created_at) VALUES ('a1', 6, 1)"); assert.match((await run(db))[9].violations.join(), /follow-ups about adult/);
  db = withAdult(); await tester(db, 's1', { age_band: '30s' }); assert.match((await run(db))[9].violations.join(), /students holding adult-only fields/);
  db = withAdult(); await sql(db, "INSERT INTO invites (id, code, label, created_at, track) VALUES (1, 'S', 's', 1, NULL), (2, 'A', 'a', 1, 'adult')");
  await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h', invite_id: 1 }); await tester(db, 's1', { invite_id: 2 });
  const v = (await run(db))[9].violations.join(); assert.match(v, /adult testers who joined with a student invite/); assert.match(v, /students who joined with an adult invite/);
});

test('a violation report never prints a stored value', async () => {
  const db = createFakeDb(); await student(db, 't1'); await event(db, 't1', 'x', { note: 'secret-person@example.com' });
  assert.ok(!format(await runInvariants(db, { now: NOW })).includes('secret-person'));
});

test('the command line: exit 0 when clean, 1 on a violation, 2 when it cannot run', () => {
  const clean = spawnSync(process.execPath, [TOOL], { encoding: 'utf8' }); assert.equal(clean.status, 0, clean.stderr); assert.match(clean.stdout, /No violations/);
  const f = path.join(mkdtempSync(path.join(tmpdir(), 'inv-')), 'export.sqlite');
  const raw = new DatabaseSync(f); raw.exec('CREATE TABLE testers (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, ua TEXT); CREATE TABLE events (id INTEGER PRIMARY KEY, tester_id TEXT, session_id TEXT, ts INTEGER, type TEXT, data TEXT, eid TEXT);');
  raw.exec("INSERT INTO events (tester_id, ts, type, data) VALUES ('ghost', 1, 'x', '{}')"); raw.close();
  const bad = spawnSync(process.execPath, [TOOL, '--db', f], { encoding: 'utf8' }); assert.equal(bad.status, 1, bad.stdout + bad.stderr); assert.match(bad.stdout, /FAIL/);
  assert.equal(spawnSync(process.execPath, [TOOL, '--db', '/nonexistent/x.sqlite'], { encoding: 'utf8' }).status, 2);
});
