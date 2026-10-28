// The machine-checked invariants (BACKEND.md, "Invariants"). Usage:
//   node hosting/tools/check_invariants.mjs                 build a fresh test database from the migrations and check it (CI)
//   node hosting/tools/check_invariants.mjs --db export.sqlite   check a local SQLite copy of a production export (owner, monthly and after each migration; opened read-only)
//   node hosting/tools/check_invariants.mjs --db export.sql      the same from the SQL text `wrangler d1 export` writes: it is loaded into a
//                                                                 temporary in-memory database first (nothing is written to disk)
// Exit code 0 = no violation, 1 = a violation, 2 = could not run. Output names tables, columns and counts, never values. Invariants that cannot apply yet say so.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventoryProblems, INVENTORY } from '../core/data_inventory.js';
import { versions } from '../core/versions.js';

export const EVENT_DATA_MAX = 6000;        // events.data cap in functions/api/event.js
export const PROFILE_DATA_MAX = 32768;     // ADR-06
export const FEEDBACK_MAX = 1500;          // feedback text cap: contracts/events.schema.json data.text maxLength (a test keeps them equal)
export const FREE_TEXT_STRING_MAX = 80;    // the longest id the contracts allow (occ ids are up to 80 characters)
// Any other string in an adult event is an id, a version, a number as text or an enum word: the contract patterns allow no spaces
// and at most 80 characters. So a string with whitespace, or longer than 80, is free text.
export const isFreeText = x => typeof x === 'string' && (x.length > FREE_TEXT_STRING_MAX || /\s/.test(x));
const DAY = 86400000;
const ident = s => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw new Error('unsafe identifier'); return '"' + s + '"'; };   // names come from the schema, never from users

async function tableCols(db, t) { return (await db.prepare('SELECT name, type FROM pragma_table_info(?)').bind(t).all()).results; }
async function hasTable(db, t) { return !!(await db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").bind(t).first()); }
async function hasCol(db, t, c) { return (await tableCols(db, t)).some(x => x.name === c); }
const count = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).first()).n;
const pass = (id, title, note = '') => ({ id, title, status: 'pass', note, violations: [] });
const fail = (id, title, violations) => ({ id, title, status: 'fail', note: '', violations });
const na = (id, title, note) => ({ id, title, status: 'n/a', note, violations: [] });
const verdict = (id, title, v) => v.length ? fail(id, title, v) : pass(id, title);

export async function runInvariants(db, { now = Date.now(), profileV = versions.PROFILE_V } = {}) {
  const out = [];
  const adultReady = (await hasTable(db, 'testers')) && (await hasCol(db, 'testers', 'track'));

  { // 1
    const id = 1, title = 'Every adult tester has track=adult, an age band and a unique email hash';
    if (!adultReady) out.push(na(id, title, 'not applicable until T3.1 (migration 0001_adult.sql adds testers.track, age_band, email_hash)'));
    else {
      const v = [];
      const a = await count(db, "SELECT COUNT(*) AS n FROM testers WHERE track = 'adult' AND (age_band IS NULL OR age_band = '' OR email_hash IS NULL OR email_hash = '')");
      if (a) v.push(`testers: ${a} adult row(s) without age_band or email_hash`);
      const d = await count(db, 'SELECT COUNT(*) AS n FROM (SELECT email_hash FROM testers WHERE email_hash IS NOT NULL GROUP BY email_hash HAVING COUNT(*) > 1)');
      if (d) v.push(`testers: ${d} email_hash value(s) used more than once`);
      const w = await count(db, "SELECT COUNT(*) AS n FROM testers WHERE email_hash IS NOT NULL AND (track IS NULL OR track <> 'adult')");
      if (w) v.push(`testers: ${w} row(s) with an email_hash that are not adults`);
      out.push(verdict(id, title, v));
    }
  }

  { // 2
    const id = 2, title = 'No resume text; no @ outside testers.email; no free text except capped feedback';
    const v = [];
    // Platform tables are skipped: sqlite_*, D1's own _cf_* tables and d1_migrations (the same list as the data inventory).
    for (const t of (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name <> 'd1_migrations'").all()).results) {
      for (const c of await tableCols(db, t.name)) {
        if (t.name === 'testers' && c.name === 'email') continue;
        if (/INT|REAL|NUM/i.test(c.type) && c.type) continue;
        const n = await count(db, `SELECT COUNT(*) AS n FROM ${ident(t.name)} WHERE CAST(${ident(c.name)} AS TEXT) LIKE '%@%'`);
        if (n) v.push(`${t.name}.${c.name}: ${n} value(s) contain @`);
      }
    }
    const big = await count(db, 'SELECT COUNT(*) AS n FROM events WHERE LENGTH(data) > ?', EVENT_DATA_MAX);
    if (big) v.push(`events.data: ${big} value(s) longer than ${EVENT_DATA_MAX} characters`);
    if (await hasTable(db, 'profiles')) {
      const p = await count(db, 'SELECT COUNT(*) AS n FROM profiles WHERE LENGTH(data) > ?', PROFILE_DATA_MAX);
      if (p) v.push(`profiles.data: ${p} value(s) longer than ${PROFILE_DATA_MAX} characters`);
    }
    if (adultReady) {   // adult events carry ids and numbers; only feedback may hold text, and it is capped
      const rows = (await db.prepare("SELECT e.type, e.data FROM events e JOIN testers t ON t.id = e.tester_id WHERE t.track = 'adult'").all()).results;
      let free = 0, longFeedback = 0;
      const walk = (x, depth = 0) => { if (typeof x === 'string') { if (isFreeText(x)) free++; } else if (x && typeof x === 'object' && depth < 6) for (const y of Object.values(x)) walk(y, depth + 1); };
      for (const r of rows) {
        let d; try { d = JSON.parse(r.data); } catch { free++; continue; }
        if (r.type === 'feedback') { const t = d && d.text; if (typeof t === 'string' && t.length > FEEDBACK_MAX) longFeedback++; if (d) { const { text, ...rest } = d; walk(rest); } } else walk(d);
      }
      if (free) v.push(`events: ${free} adult event(s) with free text outside capped feedback`);
      if (longFeedback) v.push(`events: ${longFeedback} adult feedback text(s) over ${FEEDBACK_MAX} characters`);
    }
    out.push(verdict(id, title, v));
  }

  out.push(na(3, 'Every id in every profile is in the id registry', 'not applicable until T1.x (data/graph/id_registry.json, F0.2) and T3.1 (profiles table)'));

  { // 4
    const id = 4, title = 'Every profile v is at most PROFILE_V, and rev is at least 1';
    if (!(await hasTable(db, 'profiles'))) out.push(na(id, title, 'not applicable until T3.1 (profiles table)'));
    else {
      const v = [];
      const a = await count(db, 'SELECT COUNT(*) AS n FROM profiles WHERE v IS NULL OR v > ? OR v < 1', profileV); if (a) v.push(`profiles: ${a} row(s) with v above PROFILE_V=${profileV} or missing`);
      const b = await count(db, 'SELECT COUNT(*) AS n FROM profiles WHERE rev IS NULL OR rev < 1'); if (b) v.push(`profiles: ${b} row(s) with rev below 1`);
      out.push(verdict(id, title, v));
    }
  }

  { // 5
    const id = 5, title = 'No email_codes row is older than 24 hours (and no email_sends row older than 7 days)';
    if (!(await hasTable(db, 'email_codes'))) out.push(na(id, title, 'not applicable until T3.1 (email_codes table)'));
    else {
      const v = [];
      const a = await count(db, 'SELECT COUNT(*) AS n FROM email_codes WHERE created_at < ?', now - DAY); if (a) v.push(`email_codes: ${a} row(s) older than 24 hours`);
      if (await hasTable(db, 'email_sends')) { const cut = new Date(now - 7 * DAY).toISOString().slice(0, 10); const b = await count(db, 'SELECT COUNT(*) AS n FROM email_sends WHERE day < ?', cut); if (b) v.push(`email_sends: ${b} row(s) older than 7 days`); }
      out.push(verdict(id, title, v));
    }
  }

  { // 6
    const id = 6, title = 'No data remains for deleted testers; every stored table is in the data inventory';
    const v = [...await inventoryProblems(db)];
    if (await hasTable(db, 'testers')) for (const t of INVENTORY) {
      if (t.status !== 'live' || t.erase.key !== 'tester_id' || !(await hasTable(db, t.table))) continue;
      const n = await count(db, `SELECT COUNT(*) AS n FROM ${ident(t.table)} WHERE ${ident('tester_id')} NOT IN (SELECT id FROM testers)`);
      if (n) v.push(`${t.table}: ${n} row(s) belong to a tester that no longer exists`);
    }
    out.push(verdict(id, title, v));
  }

  out.push(na(7, 'Every result event carries job_release and matcher_version', 'not applicable until T3.x/T5.x (adult result events; the adult event handler)'));
  out.push(na(8, 'The matcher inputs contain no commercial or demographic field', 'not applicable until T2.x (matcher/match.js and its allowed-fields list); this is a static check on that file'));

  { // 9 (data side; the query side is tested per endpoint in T3.x)
    const id = 9, title = 'No adult appears in any student or counsellor view, and no student in an adult view (data)';
    if (!adultReady) out.push(na(id, title, 'not applicable until T3.1 (testers.track). The per-endpoint query tests come with the adult handlers'));
    else {
      const v = [];
      const q = async (label, sql) => { const n = await count(db, sql); if (n) v.push(`${label}: ${n} row(s)`); };
      await q('adult testers linked to a counsellor, class or counsellor-led source', "SELECT COUNT(*) AS n FROM testers WHERE track = 'adult' AND (counsellor_id IS NOT NULL OR klass IS NOT NULL OR source = 'counsellor')");
      await q('counsellor reviews about adult testers', "SELECT COUNT(*) AS n FROM reviews WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult')");
      await q('follow-ups about adult testers', "SELECT COUNT(*) AS n FROM followups WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult')");
      await q('students holding adult-only fields (email, email_hash, age_band)', "SELECT COUNT(*) AS n FROM testers WHERE (track IS NULL OR track <> 'adult') AND (email IS NOT NULL OR email_hash IS NOT NULL OR age_band IS NOT NULL)");
      if (await hasCol(db, 'invites', 'track')) {
        await q('adult testers who joined with a student invite', "SELECT COUNT(*) AS n FROM testers t JOIN invites i ON i.id = t.invite_id WHERE t.track = 'adult' AND (i.track IS NULL OR i.track <> 'adult')");
        await q('students who joined with an adult invite', "SELECT COUNT(*) AS n FROM testers t JOIN invites i ON i.id = t.invite_id WHERE (t.track IS NULL OR t.track <> 'adult') AND i.track = 'adult'");
      }
      out.push(verdict(id, title, v));
    }
  }
  return out;
}

export function format(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'n/a '}  ${r.id}. ${r.title}${r.note ? '  (' + r.note + ')' : ''}`);
    for (const x of r.violations) lines.push('        - ' + x);
  }
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const i = process.argv.indexOf('--db');
    const { createFakeDb, openFakeDbFile, openFakeDbFromSql } = await import('../tests/adult/fakedb.mjs');
    const file = i > 0 ? process.argv[i + 1] : null;
    if (i > 0 && !file) throw new Error('--db needs a file: a SQLite database or the .sql text from wrangler d1 export');
    const db = !file ? createFakeDb() : /\.sql$/i.test(file) ? openFakeDbFromSql(file) : openFakeDbFile(file);
    const results = await runInvariants(db);
    console.log(format(results));
    const bad = results.filter(r => r.status === 'fail').length;
    console.log(bad ? `\n${bad} invariant(s) violated.` : `\nNo violations (${results.filter(r => r.status === 'pass').length} checked, ${results.filter(r => r.status === 'n/a').length} not applicable yet).`);
    process.exit(bad ? 1 : 0);
  } catch (e) { console.error('could not run the invariant checker: ' + e.message); process.exit(2); }
}
