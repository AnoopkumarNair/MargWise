import test from 'node:test';
import assert from 'node:assert/strict';
import { INVENTORY, byName, personTables, inventoryProblems } from '../../core/data_inventory.js';
import { createFakeDb } from './fakedb.mjs';

test('the inventory agrees with the migrated database: every table and column, nothing extra', async () => {
  assert.deepEqual(await inventoryProblems(createFakeDb()), []);
});

test('every entry says purpose, retention, who sees it and how it is deleted', () => {
  for (const t of INVENTORY) {
    assert.ok(['live', 'planned'].includes(t.status), t.table);
    for (const k of ['purpose', 'retention', 'deletion']) assert.ok(typeof t[k] === 'string' && t[k].length > 5, `${t.table}.${k}`);
    assert.ok(Array.isArray(t.who) && t.who.length > 0 && t.who.every(w => ['tester', 'owner', 'counsellor', 'nobody'].includes(w)), t.table + '.who');
    assert.ok(t.erase && 'key' in t.erase, t.table + '.erase');
    for (const [c, f] of Object.entries(t.fields)) assert.ok(f.purpose && f.purpose.length > 3, `${t.table}.${c}`);
  }
});

test('adult tables from SPEC 10 are listed, and counsellors never see adult data', () => {
  for (const n of ['email_codes', 'email_sends', 'profiles', 'under18', 'ai_calls', 'ops_daily']) assert.equal(byName[n].status, 'planned', n);
  for (const n of ['profiles', 'email_codes', 'ai_calls']) assert.ok(!byName[n].who.includes('counsellor'), n);
  assert.ok(byName.testers.fields.email_hash.planned && byName.testers.fields.email.planned);
});

test('tables that hold a person are findable by deletion', () => {
  const m = Object.fromEntries(personTables().map(t => [t.table, t.key]));
  assert.equal(m.testers, 'id'); assert.equal(m.events, 'tester_id'); assert.equal(m.reviews, 'tester_id'); assert.equal(m.followups, 'tester_id');
  assert.equal(m.profiles, 'tester_id'); assert.equal(m.email_codes, 'email_hash');
});

test('a new table with tester_id that is not in the inventory is caught', async () => {
  const db = createFakeDb(); await db.exec('CREATE TABLE sneaky (tester_id TEXT, x TEXT)');
  const p = await inventoryProblems(db); assert.ok(p.some(m => /sneaky is not in the data inventory/.test(m)), p.join());
});
test('a new column that is not in the inventory is caught', async () => {
  const db = createFakeDb(); await db.exec('ALTER TABLE testers ADD COLUMN phone TEXT');
  assert.ok((await inventoryProblems(db)).some(m => /testers\.phone/.test(m)));
});
test('a planned table that has landed, or a live one that vanished, is caught', async () => {
  const db = createFakeDb(); await db.exec('CREATE TABLE profiles (tester_id TEXT, v INTEGER, rev INTEGER, data TEXT, job_release TEXT, matcher_version TEXT, updated_at INTEGER)');
  assert.ok((await inventoryProblems(db)).some(m => /profiles exists, so its inventory status must change/.test(m)));
  const d2 = createFakeDb(); await d2.exec('DROP TABLE followups');
  assert.ok((await inventoryProblems(d2)).some(m => /lists table followups but the database has none/.test(m)));
});
test('an inventory entry with the wrong erase key is caught', async () => {
  const db = createFakeDb(); await db.exec('CREATE TABLE email_codes (email_hash TEXT)');
  const p = await inventoryProblems(db); assert.ok(p.some(m => /email_codes exists/.test(m)));
});
