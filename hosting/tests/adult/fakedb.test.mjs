import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDb, listMigrations, FakeD1 } from './fakedb.mjs';

test('migrations are listed in numeric order', () => {
  const l = listMigrations(); assert.equal(l[0], '0000_baseline.sql');
  assert.deepEqual(l.map(f => parseInt(f, 10)), l.map(f => parseInt(f, 10)).sort((a, b) => a - b));
});

test('first() gives null when there is no row, a plain object when there is one, and a column on request', async () => {
  const db = createFakeDb();
  assert.equal(await db.prepare('SELECT * FROM meta WHERE k = ?').bind('nope').first(), null);
  await db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').bind('a', 'b').run();
  const row = await db.prepare('SELECT * FROM meta WHERE k = ?').bind('a').first();
  assert.deepEqual(row, { k: 'a', v: 'b' }); assert.equal(Object.getPrototypeOf(row), Object.prototype);
  assert.equal(await db.prepare('SELECT v FROM meta WHERE k = ?').bind('a').first('v'), 'b');
});

test('run() reports changes and the new row id', async () => {
  const db = createFakeDb();
  const r = await db.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(1, 'x', null).run();
  assert.equal(r.success, true); assert.equal(r.meta.changes, 1); assert.equal(r.meta.last_row_id, 1);
  const u = await db.prepare('UPDATE audit SET detail = ? WHERE action = ?').bind('d', 'none').run();
  assert.equal(u.meta.changes, 0);
});

test('all() gives { results } with plain rows, empty when nothing matches', async () => {
  const db = createFakeDb();
  assert.deepEqual((await db.prepare('SELECT * FROM meta').all()).results, []);
  await db.prepare('INSERT INTO meta (k, v) VALUES (?, ?), (?, ?)').bind('a', '1', 'b', '2').run();
  const r = await db.prepare('SELECT k FROM meta ORDER BY k').all();
  assert.deepEqual(r.results, [{ k: 'a' }, { k: 'b' }]); assert.equal(r.success, true);
});

test('bind() does not change the statement it was called on, and undefined is refused like D1', async () => {
  const db = createFakeDb(); const s = db.prepare('SELECT ? AS x');
  assert.equal((await s.bind(1).first()).x, 1); assert.equal((await s.bind(2).first()).x, 2);
  assert.throws(() => s.bind(undefined));
  assert.equal((await s.bind(true).first()).x, 1);
});

test('batch() is all or nothing and returns one result per statement', async () => {
  const db = createFakeDb();
  const res = await db.batch([db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').bind('a', '1'), db.prepare('SELECT COUNT(*) AS n FROM meta')]);
  assert.equal(res.length, 2); assert.equal(res[0].meta.changes, 1); assert.equal(res[1].results[0].n, 1);
  await assert.rejects(db.batch([db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').bind('b', '2'), db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').bind('a', 'dup')]));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM meta').first()).n, 1, 'the first insert was rolled back');
});

test('a broken database throws, like an unavailable D1', async () => {
  const db = createFakeDb(); db.setBroken();
  await assert.rejects(db.prepare('SELECT 1').first(), /broken/);
  db.setBroken(false); assert.ok(await db.prepare('SELECT 1 AS x').first());
});

test('constraints from the schema are enforced', async () => {
  const db = createFakeDb();
  await assert.rejects(db.prepare('INSERT INTO testers (id) VALUES (?)').bind('t1').run());
});

test('fakedb is a FakeD1', () => { assert.ok(createFakeDb() instanceof FakeD1); });
