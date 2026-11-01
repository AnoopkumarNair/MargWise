import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { runInvariants, format, FEEDBACK_MAX, FREE_TEXT_STRING_MAX, isFreeText } from '../../tools/check_invariants.mjs';
import { readFileSync } from 'node:fs';
import { createFakeDb } from './fakedb.mjs';
import { versions } from '../../core/versions.js';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tools/check_invariants.mjs');
const NOW = 1760000000000, DAY = 86400000;
const run = async db => Object.fromEntries((await runInvariants(db, { now: NOW })).map(r => [r.id, r]));
const withAdult = () => createFakeDb();   // 0001_adult.sql is part of the migrations now
const beforeAdult = () => createFakeDb({ upTo: 0 });   // the baseline only: the checks that need the adult tables say 'n/a'
const sql = (db, s, ...a) => db.prepare(s).bind(...a).run();
const tester = (db, id, extra = {}) => sql(db, 'INSERT INTO testers (id, name, created_at, track, age_band, email_hash, counsellor_id, klass, source, invite_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  id, 'N', NOW, extra.track ?? null, extra.age_band ?? null, extra.email_hash ?? null, extra.counsellor_id ?? null, extra.klass ?? null, extra.source ?? null, extra.invite_id ?? null);
const student = (db, id) => sql(db, 'INSERT INTO testers (id, name, created_at) VALUES (?, ?, ?)', id, 'N', NOW);
const event = (db, tid, type, data) => sql(db, 'INSERT INTO events (tester_id, ts, type, data) VALUES (?, ?, ?, ?)', tid, NOW, type, JSON.stringify(data));

test('a clean database passes; planned checks say when they start to apply', async () => {
  const r = await run(beforeAdult());
  for (const id of [2, 8]) assert.equal(r[id].status, 'pass', `${id}: ${r[id].violations}`);
  assert.equal(r[6].status, 'fail', 'the inventory lists the adult tables, so a database without them is not current');
  for (const id of [1, 3, 4, 5, 7, 9]) { assert.equal(r[id].status, 'n/a', id); assert.match(r[id].note, /not applicable until T/, id); }
  const adult = await run(withAdult());
  for (const id of [1, 2, 4, 5, 7, 9]) assert.equal(adult[id].status, 'pass', `${id}: ${adult[id].violations}`);
  assert.equal(adult[3].status, 'n/a'); assert.match(adult[3].note, /registry/, 'the real registry is empty until the first accepted release');
});

const REG = (...entries) => { const f = path.join(mkdtempSync(path.join(tmpdir(), 'reg-')), 'id_registry.json'); writeFileSync(f, JSON.stringify({ registry_version: 1, entries })); return f; };
const live = id => ({ id, kind: 'skill', label: 'x', first_release: 'r', status: 'live', replaced_by: null, note: '' });
test('3: profile ids must be live or a tombstone with a replacement (counts only in the message)', async () => {
  const registryPath = REG(live('skl:1'), live('occ:15-1252.00'), { ...live('skl:old'), status: 'tombstone', replaced_by: ['skl:1'] }, { ...live('skl:gone'), status: 'tombstone', replaced_by: null });
  const put = async (db, data) => sql(db, 'INSERT INTO profiles VALUES (?, 1, 1, ?, NULL, NULL, ?)', 'a' + Math.random(), JSON.stringify(data), NOW);
  const r3 = async db => (await runInvariants(db, { now: NOW, registryPath }))[2];
  let db = withAdult(); await put(db, { v: 1, roles: [{ occ: 'occ:15-1252.00' }], skills: [{ id: 'skl:1' }, { id: 'skl:old' }] }); assert.equal((await r3(db)).status, 'pass');
  db = withAdult(); await put(db, { v: 1, roles: [], skills: [{ id: 'skl:gone' }, { id: 'skl:nowhere' }] }); const bad = await r3(db); assert.equal(bad.status, 'fail'); assert.match(bad.violations.join(), /2 id\(s\)/); assert.ok(!bad.violations.join().includes('skl:'), 'ids are not repeated: a profile is personal');
  db = withAdult(); await sql(db, "INSERT INTO profiles VALUES ('a9', 1, 1, 'not json', NULL, NULL, ?)", NOW); assert.equal((await r3(db)).status, 'fail');
  assert.equal((await run(beforeAdult()))[3].status, 'n/a');
});
test('7: an adult result event without job_release or matcher_version is a violation; other events are not checked', async () => {
  let db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' });
  await event(db, 'a1', 'road_added', { from: 'occ:1', to: 'occ:2', job_release: 'r1', matcher_version: '1.0.0' }); await event(db, 'a1', 'intake', { source: 'upload', mode: 'none' }); await event(db, 'a1', 'feedback', { about: 'road' });
  assert.equal((await run(db))[7].status, 'pass');
  for (const type of ['profile_saved', 'roads_viewed', 'road_opened', 'road_added']) { const d = withAdult(); await tester(d, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' }); await event(d, 'a1', type, { job_release: 'r1' }); assert.match((await run(d))[7].violations.join(), /1 adult result event/, type); }
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' }); await event(db, 'a1', 'road_added', { job_release: '', matcher_version: '1' }); assert.equal((await run(db))[7].status, 'fail');
  db = withAdult(); await student(db, 's1'); await event(db, 's1', 'result', { code: ['I'] }); assert.equal((await run(db))[7].status, 'pass', 'a student result event is not an adult result event');
});

test('1: an adult without age band or email hash, a duplicate hash, and a non-adult with a hash', async () => {
  let db = withAdult(); await tester(db, 'a1', { track: 'adult', email_hash: 'h1' }); assert.match((await run(db))[1].violations.join(), /without age_band or email_hash/);
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s' }); assert.equal((await run(db))[1].status, 'fail');
  db = withAdult(); db.raw.exec('DROP INDEX testers_email');   // the unique index normally stops this; the check is for a damaged copy
  await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' }); await tester(db, 'a2', { track: 'adult', age_band: '30s', email_hash: 'h' });
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
  await event(db, 'a1', 'feedback', { text: 'x'.repeat(1500) }); assert.equal((await run(db))[2].status, 'pass', 'exactly the contract cap is fine');
  await event(db, 'a1', 'feedback', { text: 'x'.repeat(1501) }); assert.match((await run(db))[2].violations.join(), /feedback text/);
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

test('2 agrees with the contracts: the feedback cap and the longest id', () => {
  const ev = JSON.parse(readFileSync(new URL('../../../contracts/events.schema.json', import.meta.url), 'utf8'));
  assert.equal(FEEDBACK_MAX, ev.$defs.feedback.properties.text.maxLength);
  const maxId = Math.max(...JSON.stringify(ev).match(/"maxLength":\s*\d+/g).map(m => Number(m.split(':')[1])).filter(n => n !== FEEDBACK_MAX));
  assert.equal(FREE_TEXT_STRING_MAX, maxId);
  const occ80 = 'occ:ai-' + 'a'.repeat(73); assert.equal(occ80.length, 80); assert.match(occ80, new RegExp(ev.$defs.road_added.properties.to.pattern, 'u'));
  assert.equal(isFreeText(occ80), false); assert.equal(isFreeText('occ:13-2011.00'), false); assert.equal(isFreeText('1.0.0'), false);
  assert.equal(isFreeText('a'.repeat(81)), true); assert.equal(isFreeText('worked at acme'), true);
});
test('2: an 80-character occupation id in an adult event is not free text; a short sentence is', async () => {
  let db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' });
  await event(db, 'a1', 'road_added', { from: 'occ:13-2011.00', to: 'occ:ai-' + 'a'.repeat(73), job_release: 'abc123', matcher_version: '1.0.0' });
  assert.equal((await run(db))[2].status, 'pass', String((await run(db))[2].violations));
  db = withAdult(); await tester(db, 'a1', { track: 'adult', age_band: '30s', email_hash: 'h' });
  await event(db, 'a1', 'road_opened', { note: 'my old boss' }); assert.match((await run(db))[2].violations.join(), /free text outside capped feedback/);
});
test('2: D1 platform tables (_cf_*) are skipped, like the data inventory skips them', async () => {
  const db = createFakeDb(); await db.exec("CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value TEXT); INSERT INTO _cf_KV VALUES ('a', 'x@y')");
  assert.equal((await run(db))[2].status, 'pass');
  const db2 = createFakeDb(); await db2.exec("CREATE TABLE xcfx (v TEXT); INSERT INTO xcfx VALUES ('x@y')");
  assert.match((await run(db2))[2].violations.join(), /xcfx\.v/, 'only the exact _cf_ prefix is skipped');
});
test('the command line reads the .sql text from wrangler d1 export', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'inv-sql-'));
  const good = path.join(d, 'good.sql'); writeFileSync(good, readFileSync(new URL('../../migrations/0000_baseline.sql', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../../migrations/0001_adult.sql', import.meta.url), 'utf8') + "\nINSERT INTO testers (id, name, created_at) VALUES ('t1', 'N', 1);\n");
  const r = spawnSync(process.execPath, [TOOL, '--db', good], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stdout + r.stderr);
  const bad = path.join(d, 'bad.sql'); writeFileSync(bad, readFileSync(good, 'utf8') + "INSERT INTO events (tester_id, ts, type, data) VALUES ('ghost', 1, 'x', '{}');\n");
  assert.equal(spawnSync(process.execPath, [TOOL, '--db', bad], { encoding: 'utf8' }).status, 1);
  assert.equal(spawnSync(process.execPath, [TOOL, '--db'], { encoding: 'utf8' }).status, 2);
});

test('8: the static check on matcher/match.js reads ALLOWED_INPUT_FIELDS and the source', async () => {
  const { matcherInputProblems } = await import('../../tools/check_invariants.mjs');
  const ok = ['roles', 'roles[].occ', 'skills', 'skills[].id'];
  assert.deepEqual(matcherInputProblems('const a = profile.roles; const b = s.id; // a comment may say gender', ok), []);
  assert.match(matcherInputProblems('const g = p.gender;', ok).join(), /reads \.gender/);
  assert.match(matcherInputProblems('const c = x.commission;', ok).join(), /reads \.commission/);
  assert.match(matcherInputProblems('const v = profile[k];', ok).join(), /computed key/);
  assert.match(matcherInputProblems('const v = profile.creds;', ok).join(), /profile.creds, which is not in ALLOWED_INPUT_FIELDS/);
  assert.match(matcherInputProblems('', [...ok, 'age_band']).join(), /lists age_band/);
  assert.match(matcherInputProblems('', []).join(), /no ALLOWED_INPUT_FIELDS/);
  const none = (await runInvariants(createFakeDb(), { matcherPath: '/nonexistent/match.js' })).find(r => r.id === 8);
  assert.equal(none.status, 'n/a');
});
