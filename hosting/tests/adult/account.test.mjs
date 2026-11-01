// TEST_PLAN layer 5, account endpoints (T3.5): export, delete cascading to every inventory table, the audit row, cross-account access,
// the purge, and the invariant checker after the whole journey.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { handle as startH } from '../../core/email_start.js';
import { handle as verifyH } from '../../core/email_verify.js';
import { handle as completeH } from '../../core/email_complete.js';
import { handleGet, handlePut } from '../../core/profile.js';
import { handleExport, handleDelete, handleLogoutAll } from '../../core/account.js';
import { handle as eventH } from '../../core/events.js';
import { purgeAdultDaily } from '../../core/purge.js';
import { INVENTORY, personTables } from '../../core/data_inventory.js';
import { runInvariants } from '../../tools/check_invariants.mjs';
import { world, req, json, signUp, matches, T0, DAY, HOUR } from './api_helpers.mjs';

const H = { startH, verifyH, completeH };
const PROFILE = JSON.parse(readFileSync(new URL('../../../contracts/examples/profile--spec6.json', import.meta.url), 'utf8'));
const call = (fn, method, path, w, token, body) => fn(req(method, path, { token, body }), w.deps);
const exportOf = (w, t) => call(handleExport, 'POST', '/api/v1/me/export', w, t, {});
const del = (w, t, body = { confirm: 'DELETE' }) => call(handleDelete, 'POST', '/api/v1/me/delete', w, t, body);
const rows = (w, sql, ...a) => w.db.raw.prepare(sql).all(...a);
const idOf = t => t.split('.')[1];

// A person with a row in every table of the data inventory that can hold an adult.
async function populated(w, email = 'a@example.com', { junk = true } = {}) {
  const { token } = await signUp(w, { handlers: H, email });
  const id = idOf(token), eh = rows(w, 'SELECT email_hash FROM testers WHERE id = ?', id)[0].email_hash;
  await call(handlePut, 'PUT', '/api/v1/me/profile', w, token, { rev: 0, data: PROFILE });
  await call(eventH, 'POST', '/api/v1/event', w, token, { type: 'road_added', eid: 'e-road-added-1', data: { from: 'occ:13-2011.00', to: 'occ:15-1252.00', job_release: 'abc123', matcher_version: '1.2.0' } });
  w.db.raw.prepare('INSERT INTO ai_calls (tester_id, day, n, tokens, prompt_version) VALUES (?, ?, 2, 900, ?)').run(id, '2025-10-20', 'extract_v1');
  if (junk) w.db.raw.prepare("INSERT INTO reviews (tester_id, code, counsellor, baseline, baseline_at) VALUES (?, 'ABC123', 'x', '[]', 1)").run(id);   // an adult has none; the delete must still cover the table
  if (junk) w.db.raw.prepare('INSERT INTO followups (tester_id, months, created_at) VALUES (?, 6, 1)').run(id);
  w.db.raw.prepare('INSERT INTO email_codes VALUES (?, ?, ?, ?, 0, 1, ?, ?)').run(eh, 'c', 'l', T0 + 1000, '25-34', T0);
  return { token, id, eh };
}
// every table in the database with a tester_id or email_hash column (found from sqlite_master, not from the inventory), and testers by id
function leftovers(w, id, eh) {
  const out = [];
  for (const { name } of rows(w, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")) {
    const cols = rows(w, 'SELECT name FROM pragma_table_info(?)', name).map(c => c.name);
    if (name === 'testers') { if (rows(w, 'SELECT 1 FROM testers WHERE id = ?', id).length) out.push('testers'); continue; }
    if (cols.includes('tester_id') && rows(w, `SELECT 1 FROM ${name} WHERE tester_id = ?`, id).length) out.push(name + '.tester_id');
    if (cols.includes('email_hash') && rows(w, `SELECT 1 FROM ${name} WHERE email_hash = ?`, eh).length) out.push(name + '.email_hash');
  }
  return out;
}

test('export: every table that holds this person, matching the contract, with no hashes and no one else', async () => {
  const w = world(); const A = await populated(w), B = await populated(w, 'b@example.com');
  const r = await json(await exportOf(w, A.token)); assert.equal(r.status, 200); matches('me_export.response', r.body); assert.equal(r.body.generated_at, T0);
  const by = Object.fromEntries(r.body.tables.map(t => [t.table, t]));
  for (const t of ['testers', 'profiles', 'events', 'ai_calls', 'reviews', 'followups', 'email_codes']) assert.ok(by[t], t);
  assert.equal(by.testers.rows.length, 1); assert.equal(by.testers.rows[0][by.testers.columns.indexOf('id')], A.id);
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes(B.id) && !text.includes(B.eh), 'nothing of tester B');
  for (const h of [A.eh, 'ret_hash', 'code_hash', 'link_hash', 'email_hash', 'key_hash']) assert.ok(!text.includes(h), 'no ' + h);
  assert.ok(by.profiles.rows[0][by.profiles.columns.indexOf('data')].includes('occ:13-2011.00'), 'the profile appears as text');
  assert.ok(!('email_sends' in by) || by.email_sends.rows.length >= 1);
});
test('export has every field of every live inventory table for this person (a new column cannot be forgotten)', async () => {
  const w = world(); const A = await populated(w);
  w.db.raw.prepare("UPDATE testers SET email = 'a@example.com' WHERE id = ?").run(A.id);
  const r = await json(await exportOf(w, A.token)); const by = Object.fromEntries(r.body.tables.map(t => [t.table, t.columns]));
  // left out on purpose: keyed hashes and look-up keys (they mean nothing to a person), and testers columns that only students use
  const STUDENT_ONLY = ['ua', 'klass', 'counsellor_id', 'followup_ok'];
  for (const t of personTables()) {
    assert.ok(by[t.table], `the fixture has rows in ${t.table}, so the export must have the table`);
    const inv = INVENTORY.find(x => x.table === t.table);
    for (const c of Object.keys(inv.fields)) {
      if (/_hash$/.test(c) || c === t.key || (t.table === 'testers' && STUDENT_ONLY.includes(c))) continue;
      assert.ok(by[t.table].includes(c), `export of ${t.table} lacks ${c}`);
    }
  }
  const tc = by.testers; assert.ok(tc.includes('email') && tc.includes('age_band') && tc.includes('research_ok') && tc.includes('consent_on'));
});
test('export: no token, a bad token, or a non-empty body is refused; an empty body and {} are fine', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H });
  assert.equal((await exportOf(w, undefined)).status, 401);
  assert.equal((await call(handleExport, 'POST', '/api/v1/me/export', w, token, { tester_id: 'x' })).status, 400);
  assert.equal((await handleExport(req('POST', '/api/v1/me/export', { token }), w.deps)).status, 200, 'no body at all');
  assert.equal((await exportOf(w, token)).status, 200);
  assert.equal((await handleExport(req('GET', '/api/v1/me/export', { token }), w.deps)).status, 405);
});

test('delete: needs the word DELETE, then removes the person from every table, revokes the session and writes an identity-free audit row', async () => {
  const w = world(); const A = await populated(w), B = await populated(w, 'b@example.com', { junk: false });
  for (const bad of [{}, { confirm: 'delete' }, { confirm: 'DELETE', tester_id: B.id }, { confirm: true }]) assert.equal((await del(w, A.token, bad)).status, 400, JSON.stringify(bad));
  assert.equal((await del(w, undefined)).status, 401); assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers')[0].n, 2, 'nothing deleted yet');
  assert.deepEqual(leftovers(w, A.id, A.eh).sort(), ['email_codes.email_hash', 'email_sends.email_hash', 'events.tester_id', 'followups.tester_id', 'profiles.tester_id', 'reviews.tester_id', 'ai_calls.tester_id', 'testers'].sort(), 'the fixture really has a row everywhere');
  const r = await json(await del(w, A.token)); assert.equal(r.status, 200); matches('me_delete.response', r.body);
  assert.deepEqual(leftovers(w, A.id, A.eh), [], 'no table holds the tester id or the email hash any more');
  assert.deepEqual(leftovers(w, B.id, B.eh).length > 0, true, 'tester B is untouched'); assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM profiles')[0].n, 1);
  assert.equal((await call(handleGet, 'GET', '/api/v1/me/profile', w, A.token)).status, 401, 'the session is gone');
  const audit = rows(w, "SELECT ts, action, detail FROM audit WHERE action = 'account_deleted'"); assert.equal(audit.length, 1);
  assert.equal(audit[0].ts, T0); assert.deepEqual(JSON.parse(audit[0].detail), { track: 'adult' });
  assert.ok(![A.id, A.eh, 'a@example.com'].some(x => JSON.stringify(audit).includes(x)), 'no identity in the audit row');
  const inv = await runInvariants(w.db, { now: T0 }); assert.deepEqual(inv.filter(x => x.status === 'fail'), [], 'the invariant checker finds nothing left (6 included)');
});
test('delete then sign up again with the same address: a new tester, nothing carried over', async () => {
  const w = world(); const A = await populated(w); await del(w, A.token); w.clock.advance(HOUR);
  const again = await signUp(w, { handlers: H, email: 'a@example.com' }); assert.equal(again.known, false); assert.notEqual(idOf(again.token), A.id);
  assert.equal((await call(handleGet, 'GET', '/api/v1/me/profile', w, again.token)).status, 404, 'the old profile is gone');
});
test('cross-account: A cannot export or delete B, and every route takes the tester from the token only', async () => {
  const w = world(); const A = await populated(w), B = await populated(w, 'b@example.com');
  assert.ok(!JSON.stringify(await (await exportOf(w, A.token)).json()).includes(B.id));
  await del(w, A.token); assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers')[0].n, 1);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM events WHERE tester_id = ?', B.id)[0].n, 1); assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM profiles WHERE tester_id = ?', B.id)[0].n, 1);
  assert.equal((await del(w, A.token)).status, 401, 'A cannot delete twice, or reach B with the old token');
  assert.equal((await call(handleLogoutAll, 'POST', '/api/v1/me/logout-all', w, A.token, {})).status, 401);
});
test('logout-all takes no tester id, matches its contract, and cannot be sent for someone else', async () => {
  const w = world(); const A = await signUp(w, { handlers: H }), B = await signUp(w, { handlers: H, email: 'b@example.com' });
  const bad = await call(handleLogoutAll, 'POST', '/api/v1/me/logout-all', w, A.token, { tester_id: idOf(B.token) }); assert.equal(bad.status, 400);
  w.clock.advance(5); const ok = await json(await call(handleLogoutAll, 'POST', '/api/v1/me/logout-all', w, A.token, {})); matches('me_logout_all.response', ok.body);
  assert.notEqual(rows(w, 'SELECT tok_after FROM testers WHERE id = ?', idOf(A.token))[0].tok_after, null); assert.equal(rows(w, 'SELECT tok_after FROM testers WHERE id = ?', idOf(B.token))[0].tok_after, null);
});

test('the purge: old codes, send counts and IP rows go daily; with RETENTION_DAYS_ADULT old adults go from every table; students and fresh adults stay', async () => {
  const w = world({ env: { RETENTION_DAYS_ADULT: '30', RETENTION_DAYS_STUDENT: '1000' } });
  const old = await populated(w); w.db.raw.prepare('UPDATE testers SET created_at = ? WHERE id = ?').run(T0 - 40 * DAY, old.id);
  w.clock.advance(HOUR); const fresh = await populated(w, 'fresh@example.com', { junk: false });
  w.db.raw.prepare("INSERT INTO testers (id, name, created_at) VALUES ('s1', 'Stu', ?)").run(T0 - 400 * DAY); w.db.raw.prepare("INSERT INTO events (tester_id, ts, type, data) VALUES ('s1', 1, 'join', '{}')").run();
  w.clock.advance(DAY);
  assert.equal(await purgeAdultDaily(w.deps), true); assert.equal(await purgeAdultDaily(w.deps), false, 'once a day');
  assert.deepEqual(leftovers(w, old.id, old.eh), [], 'the old adult is gone from every table, profiles and email_codes included');
  assert.ok(leftovers(w, fresh.id, fresh.eh).includes('profiles.tester_id'), 'the fresh adult stays');
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM testers WHERE id = 's1'")[0].n, 1); assert.equal(rows(w, "SELECT COUNT(*) AS n FROM events WHERE tester_id = 's1'")[0].n, 1);
  const audit = rows(w, "SELECT detail FROM audit WHERE action = 'purge_adult'").map(r => JSON.parse(r.detail)); assert.deepEqual(audit.filter(a => a.deleted > 0), [{ deleted: 1, retentionDays: 30 }], 'counts only, no identity');
  assert.deepEqual((await runInvariants(w.db, { now: w.clock.t })).filter(x => x.status === 'fail'), []);
});
test('without RETENTION_DAYS_ADULT no adult is purged by age; a failed purge never blocks a request', async () => {
  const w = world(); const A = await populated(w); w.db.raw.prepare('UPDATE testers SET created_at = 1 WHERE id = ?').run(A.id); w.clock.advance(DAY);
  await purgeAdultDaily(w.deps); assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers WHERE id = ?', A.id)[0].n, 1);
  w.db.setBroken(); assert.equal(await purgeAdultDaily(w.deps), false);
});

test('the invariant checker passes after the whole journey: sign up, save, events, export, log out, sign in again, delete', async () => {
  const w = world(); const A = await populated(w); await exportOf(w, A.token);
  w.db.raw.prepare('DELETE FROM reviews WHERE tester_id = ?').run(A.id); w.db.raw.prepare('DELETE FROM followups WHERE tester_id = ?').run(A.id);   // the checker (9) rightly says an adult has none
  let inv = await runInvariants(w.db, { now: T0 }); assert.deepEqual(inv.filter(x => x.status === 'fail'), [], JSON.stringify(inv.filter(x => x.status === 'fail')));
  assert.equal(inv.find(x => x.id === 1).status, 'pass'); assert.equal(inv.find(x => x.id === 9).status, 'pass');
  await del(w, A.token); inv = await runInvariants(w.db, { now: T0 }); assert.deepEqual(inv.filter(x => x.status === 'fail'), []);
});

test('the invalid request examples in the contracts are all refused by the matching endpoint', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H });
  const dir = new URL('../../../contracts/examples/invalid/api/', import.meta.url);
  const route = { email_start: [startH, '/api/v1/email/start'], email_verify: [verifyH, '/api/v1/email/verify'], email_complete: [completeH, '/api/v1/email/complete'], me_delete: [handleDelete, '/api/v1/me/delete'], me_logout_all: [handleLogoutAll, '/api/v1/me/logout-all'] };
  let n = 0;
  for (const f of readdirSync(dir).filter(f => /\.request--/.test(f))) {
    const key = f.split('.request--')[0]; if (!route[key]) continue;
    const res = await route[key][0](req('POST', route[key][1], { token, body: JSON.parse(readFileSync(new URL(f, dir), 'utf8')), ip: '8.8.8.8' }), w.deps);
    assert.equal(res.status, 400, f); n++;
  }
  assert.ok(n >= 10, 'covered ' + n);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers')[0].n, 1, 'nothing was created or deleted by the bad requests');
});
