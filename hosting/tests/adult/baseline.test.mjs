import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createFakeDb, createLegacyDb, describeSchema, MIGRATIONS_DIR } from './fakedb.mjs';

test('baseline on an empty database equals schema.sql to schema12.sql applied in order (tables, columns, indexes)', () => {
  const a = describeSchema(createFakeDb({ upTo: 0 })), b = describeSchema(createLegacyDb());
  assert.deepEqual(a, b);
  assert.ok(Object.keys(b.tables).length >= 10, 'sanity: the legacy schema was really read');
  assert.ok('tok_after' in Object.fromEntries(b.tables.testers.map(c => [c.name, 1])), 'schema12 applied');
});

test('the legacy loader orders schema10 to schema12 after schema9 (numeric, not text, order)', () => {
  const t = describeSchema(createLegacyDb()).tables.testers.map(c => c.name);
  assert.deepEqual(t.slice(-3), ['followup_ok', 'ret_hash', 'tok_after']);
});

test('the baseline warns in its first lines that it must never run on production', () => {
  const head = readFileSync(MIGRATIONS_DIR + '/0000_baseline.sql', 'utf8').split('\n').slice(0, 8).join('\n');
  assert.match(head, /NEVER APPLY/);
});

test('wrangler.toml points migrations_dir at the migrations folder, relative to hosting/', () => {
  const toml = readFileSync(MIGRATIONS_DIR + '/../wrangler.toml', 'utf8');
  const m = /^migrations_dir\s*=\s*"([^"]+)"/m.exec(toml); assert.ok(m, 'migrations_dir is set');
  assert.equal(path.resolve(MIGRATIONS_DIR, '..', m[1]), MIGRATIONS_DIR);
  assert.match(toml, /^preview_database_id\s*=\s*"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/m, 'the preview id was set by the owner (2026-10-29) and must be a D1 uuid');
  assert.ok(!toml.includes('database_id = "fdd227d1'), 'the preview database must not be the live binding');
});

import { splitStatements } from '../migration_guard.mjs';
test('every baseline statement is CREATE ... IF NOT EXISTS (so the runbook wording about its risk stays true)', () => {
  const stmts = splitStatements(readFileSync(MIGRATIONS_DIR + '/0000_baseline.sql', 'utf8'));
  assert.ok(stmts.length >= 10);
  for (const s of stmts) assert.match(s.text.replace(/\s+/g, ' '), /^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /, s.text.slice(0, 60));
});
