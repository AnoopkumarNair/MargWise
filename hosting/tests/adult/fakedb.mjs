// A stand-in for Cloudflare D1, built on Node's own SQLite (node:sqlite, Node 22+). TEST_PLAN layer 5, BACKEND ADR-03.
// It copies the D1 call shapes the code uses: prepare().bind().first() / .run() / .all() and DB.batch().
//   first()  -> the first row as a plain object, or null when there is no row (first('col') returns that column)
//   run()    -> { success, meta: { changes, last_row_id, duration, rows_read, rows_written, changed_db } }
//   all()    -> { success, results: [...], meta }
//   batch()  -> runs the statements in one transaction (all or nothing) and returns one result per statement
// It applies hosting/migrations/*.sql in numeric order. If node:sqlite is missing the tests fail loudly; they never skip.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) {
  throw new Error('fakedb needs node:sqlite (Node 22 or newer; this is ' + process.version + '). Install Node 22+ and run again. The API tests are not skipped on purpose. (' + e.message + ')');
}

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

// Migration files in numeric order. A name is NNNN_words.sql.
export function listMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

const bindable = v => v === undefined ? (() => { throw new Error('D1 cannot bind undefined; use null'); })() : typeof v === 'boolean' ? (v ? 1 : 0) : v;
const plain = r => (r == null ? null : { ...r });
const meta = (changes = 0, last = 0, read = 0) => ({ duration: 0, changes, last_row_id: last, changed_db: changes > 0, rows_read: read, rows_written: changes, served_by: 'fakedb' });

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args.map(bindable)); }
  _stmt() { this.db._guard(); return this.db.raw.prepare(this.sql); }
  async first(col) {
    const r = plain(this._stmt().get(...this.args));
    if (r === null) return null;
    if (col === undefined) return r;
    if (!(col in r)) throw new Error('no column ' + col);
    return r[col];
  }
  async run() { const x = this._stmt().run(...this.args); return { success: true, results: [], meta: meta(Number(x.changes), Number(x.lastInsertRowid)) }; }
  async all() { const rows = this._stmt().all(...this.args).map(plain); return { success: true, results: rows, meta: meta(0, 0, rows.length) }; }
  async raw() { return this._stmt().setReturnArrays(true).all(...this.args); }
  _exec() { const s = this._stmt(); if (/^\s*(select|pragma|with)\b/i.test(this.sql) || /\breturning\b/i.test(this.sql)) { const rows = s.all(...this.args).map(plain); return { success: true, results: rows, meta: meta(0, 0, rows.length) }; } const x = s.run(...this.args); return { success: true, results: [], meta: meta(Number(x.changes), Number(x.lastInsertRowid)) }; }
}

export class FakeD1 {
  constructor(raw) { this.raw = raw || new DatabaseSync(':memory:'); this.broken = false; this.queries = 0; }
  _guard() { if (this.broken) throw new Error('D1_ERROR: fakedb is set to broken'); this.queries++; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(stmts) {
    this._guard(); const out = [];
    this.raw.exec('BEGIN');
    try { for (const s of stmts) out.push(s._exec()); this.raw.exec('COMMIT'); } catch (e) { this.raw.exec('ROLLBACK'); throw e; }
    return out;
  }
  async exec(sql) { this._guard(); this.raw.exec(sql); return { count: 1, duration: 0 }; }
  // test helpers (not part of D1)
  setBroken(v = true) { this.broken = !!v; }
  tables() { return this.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name); }
  columns(table) { return this.raw.prepare('SELECT name FROM pragma_table_info(?) ORDER BY cid').all(table).map(r => r.name); }
  close() { this.raw.close(); }
}

// A fresh database with every migration applied. `upTo` (a number) stops after that migration; `dir` picks another folder.
export function createFakeDb({ dir = MIGRATIONS_DIR, upTo = Infinity } = {}) {
  const db = new FakeD1();
  for (const f of listMigrations(dir)) { if (parseInt(f, 10) > upTo) break; db.raw.exec(readFileSync(path.join(dir, f), 'utf8')); }
  return db;
}

// Open an existing SQLite file (for example a local copy of a production export) read-only, with the same D1 call shapes.
export function openFakeDbFile(file) { return new FakeD1(new DatabaseSync(file, { readOnly: true })); }

// The old way: schema.sql, schema2.sql ... schema12.sql in numeric order (schema10 sorts before schema2 as text, so sort as numbers).
export function createLegacyDb(hostingDir = path.resolve(MIGRATIONS_DIR, '..')) {
  const db = new FakeD1();
  const files = readdirSync(hostingDir).filter(f => /^schema\d*\.sql$/.test(f)).sort((a, b) => (parseInt(a.slice(6), 10) || 1) - (parseInt(b.slice(6), 10) || 1));
  for (const f of files) db.raw.exec(readFileSync(path.join(hostingDir, f), 'utf8'));
  return db;
}

// What a schema is made of: every table with its columns in order, and every index with its columns and flags. Used to compare two databases.
export function describeSchema(db) {
  const r = db.raw, out = { tables: {}, indexes: {} };
  for (const t of r.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    out.tables[t.name] = r.prepare('SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?) ORDER BY cid').all(t.name).map(c => ({ ...c }));
    for (const ix of r.prepare('SELECT name, "unique", origin, partial FROM pragma_index_list(?)').all(t.name)) {
      out.indexes[ix.name] = { table: t.name, unique: ix.unique, origin: ix.origin, partial: ix.partial, columns: r.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(ix.name).map(c => c.name) };
    }
  }
  return out;
}
