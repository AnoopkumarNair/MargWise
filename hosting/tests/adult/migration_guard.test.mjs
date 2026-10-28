import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkSql, checkMigrations, checkSqlStrings, checkPrepareCalls, splitStatements } from '../migration_guard.mjs';

const dirWith = files => { const d = mkdtempSync(path.join(tmpdir(), 'mg-')); for (const [n, s] of Object.entries(files)) writeFileSync(path.join(d, n), s); return d; };
const OK = 'CREATE TABLE IF NOT EXISTS t (a INTEGER);\n';

test('the real migrations pass', () => { assert.deepEqual(checkMigrations(), []); });
test('the real code has no string-built SQL', () => { assert.deepEqual(checkSqlStrings(), []); });

test('gaps, duplicates and a wrong start are reported', () => {
  assert.match(checkMigrations(dirWith({ '0000_a.sql': OK, '0002_b.sql': OK })).join(), /gap before 0002/);
  assert.match(checkMigrations(dirWith({ '0000_a.sql': OK, '0001_b.sql': OK, '0001_c.sql': OK })).join(), /duplicate number 0001/);
  assert.match(checkMigrations(dirWith({ '0001_a.sql': OK })).join(), /first migration must be 0000/);
  assert.match(checkMigrations(dirWith({ '0000_a.sql': OK, 'extra.sql': OK })).join(), /name must be/);
  assert.match(checkMigrations(dirWith({})).join(), /no migrations/);
  assert.deepEqual(checkMigrations(dirWith({ '0000_a.sql': OK, '0001_b.sql': OK })), []);
});

test('DROP, DELETE without WHERE and UPDATE without WHERE are refused', () => {
  assert.equal(checkSql('DROP TABLE t;').length, 1);
  assert.equal(checkSql('drop index i;').length, 1);
  assert.equal(checkSql('ALTER TABLE t DROP COLUMN a;').length, 1);
  assert.equal(checkSql('DELETE FROM t;').length, 1);
  assert.equal(checkSql('UPDATE t SET a = 1;').length, 1);
  assert.equal(checkSql('UPDATE t\n SET a = 1\n;').length, 1);
});

test('safe statements pass: WHERE present, and the words only inside strings or comments', () => {
  assert.deepEqual(checkSql('DELETE FROM t WHERE a = 1; UPDATE t SET a = 2 WHERE a = 1;'), []);
  assert.deepEqual(checkSql("-- we never DROP here\nINSERT INTO t VALUES ('DROP TABLE; DELETE FROM t');"), []);
  assert.deepEqual(checkSql('/* DROP TABLE t; */ CREATE TABLE x (a);'), []);
  assert.deepEqual(checkSql('CREATE TABLE dropped_items (a); ALTER TABLE t ADD COLUMN updated_x INTEGER;'), []);
});

test('the reviewed-destructive marker passes only its own statement', () => {
  assert.deepEqual(checkSql('DROP TABLE old; -- reviewed-destructive: ADR-03\n'), []);
  assert.deepEqual(checkSql('-- reviewed-destructive: ADR-03\nDROP TABLE old;'), []);
  assert.equal(checkSql('DROP TABLE old; -- reviewed-destructive: ADR-03\nDROP TABLE other;').length, 1);
  assert.equal(checkSql('DROP TABLE old; -- reviewed-destructive:\n').length, 1, 'the ADR id is required');
  assert.equal(checkSql('DROP TABLE old; -- ok\n').length, 1);
});

test('the report names the file and line', () => {
  const [m] = checkSql(OK + '\nDELETE FROM t;', '0003_x.sql'); assert.match(m, /^0003_x\.sql:3: DELETE without WHERE/);
  assert.equal(splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1").length, 2);
});

test('string-built SQL in handlers is caught, parameterised SQL is not', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'mgs-')); mkdirSync(path.join(d, 'x'));
  writeFileSync(path.join(d, 'x/a.js'), 'db.prepare("SELECT 1 WHERE a = " + id);\ndb.prepare(`SELECT ${id}`);\ndb.prepare("SELECT 1 WHERE a = ?").bind(id);\ndb.prepare(`SELECT 1 WHERE a = ?`);\n');
  const r = checkSqlStrings([d]); assert.equal(r.length, 2); assert.match(r[0], /a\.js:1/); assert.match(r[1], /a\.js:2/);
});

test('prepare( must get a plain string literal: variables, calls, joins and templates are caught', () => {
  const bad = [
    'db.prepare(sql)', 'db.prepare(q.trim())', 'db.prepare(buildSql(id))', "db.prepare('SELECT ' + col)", "db.prepare('SELECT 1'.concat(x))",
    "db.prepare('SELECT 1'.replace('1', x))", 'db.prepare(`SELECT ${x}`)', 'db.prepare(\n  "SELECT 1" +\n  x)', "db.prepare(cond ? 'A' : 'B')",
    'db.prepare(SQL)', "let SQL2 = 'SELECT 1'; db.prepare(SQL2)", "const LOWER = 'SELECT 1' + x; db.prepare(LOWER)", 'const T = `SELECT ${x}`; db.prepare(T)',
    "const s = 'SELECT 1'; db.prepare(s)",
  ];
  for (const src of bad) assert.equal(checkPrepareCalls(src).length, 1, src);
  const good = [
    "db.prepare('SELECT 1')", 'db.prepare("SELECT 1 WHERE a = ?").bind(a)', 'db.prepare(`SELECT 1\n WHERE a = ?`)', "db.prepare( 'SELECT \\' ok' )",
    "const SELECT_ONE = 'SELECT 1 WHERE a = ?';\ndb.prepare(SELECT_ONE).bind(a)", "db.prepare('SELECT 1', extra)",
  ];
  for (const src of good) assert.deepEqual(checkPrepareCalls(src), [], src);
  assert.match(checkPrepareCalls('x\ny\ndb.prepare(q)', 'a.js')[0], /^a\.js:3: /);
});
