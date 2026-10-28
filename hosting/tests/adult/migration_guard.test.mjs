import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkSql, checkMigrations, checkSqlStrings, splitStatements } from '../migration_guard.mjs';

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
