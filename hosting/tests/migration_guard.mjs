// CI guard for hosting/migrations (BACKEND ADR-03 rule 4). Run: node hosting/tests/migration_guard.mjs
// Fails on: file-number gaps or duplicates; DROP; DELETE without WHERE; UPDATE without WHERE.
// A statement is allowed through only if one of its lines carries `-- reviewed-destructive: ADR-<n>`.
// It also checks that SQL in hosting/core and hosting/functions/api/v1 is not built from strings (ADR-13: parameterised SQL only).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MARK = /--\s*reviewed-destructive:\s*ADR-\d+/i;

// Split SQL into statements. Strings and comments never confuse it. `text` has comments removed and string contents blanked.
export function splitStatements(sql) {
  const out = []; let text = '', line = 1, start = 1, marked = false, i = 0, sameLine = false;
  const flush = () => { if (text.trim()) out.push({ text: text.trim(), line: start, marked }); text = ''; marked = false; sameLine = true; };
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (c === '-' && n === '-') { let j = sql.indexOf('\n', i); if (j < 0) j = sql.length; if (MARK.test(sql.slice(i, j))) { if (sameLine && !text.trim() && out.length) out[out.length - 1].marked = true; else marked = true; } i = j; continue; }
    if (c === '/' && n === '*') { let j = sql.indexOf('*/', i + 2); j = j < 0 ? sql.length : j + 2; line += (sql.slice(i, j).match(/\n/g) || []).length; text += ' '; i = j; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1; while (j < sql.length) { if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; } j++; }
      line += (sql.slice(i, j + 1).match(/\n/g) || []).length; text += c + c; i = j + 1; continue;
    }
    if (c === ';') { flush(); i++; continue; }
    if (c === '\n') { line++; sameLine = false; }
    if (!text.trim() && !/\s/.test(c)) start = line;
    text += c; i++;
  }
  flush(); return out;
}

export function checkSql(sql, file = 'file.sql') {
  const bad = [];
  for (const s of splitStatements(sql)) {
    const t = s.text.replace(/\s+/g, ' '); let why = null;
    if (/\bDROP\b/i.test(t)) why = 'DROP';
    else if (/^DELETE\b/i.test(t) && !/\bWHERE\b/i.test(t)) why = 'DELETE without WHERE';
    else if (/^UPDATE\b/i.test(t) && !/\bWHERE\b/i.test(t)) why = 'UPDATE without WHERE';
    if (why && !s.marked) bad.push(`${file}:${s.line}: ${why} (add "-- reviewed-destructive: ADR-<n>" on the statement only if an ADR allows it)`);
  }
  return bad;
}

export function checkMigrations(dir = path.join(here, '../migrations')) {
  const bad = [];
  if (!existsSync(dir)) return [`${dir}: migrations folder is missing`];
  const files = readdirSync(dir).filter(f => !f.startsWith('.')).sort();
  const nums = [];
  for (const f of files) {
    const m = /^(\d{4})_[a-z0-9][a-z0-9_]*\.sql$/.exec(f);
    if (!m) { bad.push(`${f}: name must be NNNN_words.sql (lower case)`); continue; }
    nums.push(Number(m[1]));
    bad.push(...checkSql(readFileSync(path.join(dir, f), 'utf8'), f));
  }
  if (nums.length === 0) bad.push('no migrations found');
  nums.sort((a, b) => a - b);
  nums.forEach((n, i) => { if (i === 0 && n !== 0) bad.push(`first migration must be 0000, found ${String(n).padStart(4, '0')}`); else if (i > 0 && n === nums[i - 1]) bad.push(`duplicate number ${String(n).padStart(4, '0')}`); else if (i > 0 && n !== nums[i - 1] + 1) bad.push(`gap before ${String(n).padStart(4, '0')}`); });
  return bad;
}

// SQL must be a plain string literal (ADR-13). The first argument of every .prepare( must be one '...' or "..." string, or a
// `...` template without ${}, followed directly by ) or a comma. Anything else is reported: a variable, a call, a "+" join,
// .concat(), a template with ${}. A named constant is allowed only when the same file defines it as
// `const NAME = '<plain literal>';` with an UPPER_CASE name (so a reviewer can read the SQL where it is defined).
const readLiteral = (src, i) => {   // src[i] is a quote; returns the index just after the closing quote, or -1
  const q = src[i]; let j = i + 1;
  while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
  return j < src.length ? j + 1 : -1;
};
export function sqlConstants(src) {
  const ok = new Set();
  for (const m of src.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(?=['"`])/g)) {
    const at = m.index + m[0].length, end = readLiteral(src, at);
    if (end < 0) continue;
    if (src[at] === '`' && src.slice(at, end).includes('${')) continue;
    if (/^\s*[;\n]/.test(src.slice(end, end + 2)) || end === src.length) ok.add(m[1]);
  }
  return ok;
}
export function checkPrepareCalls(src, file = 'file.js') {
  const bad = [], consts = sqlConstants(src);
  for (const m of src.matchAll(/\.prepare\(\s*/g)) {
    const at = m.index + m[0].length, line = src.slice(0, m.index).split('\n').length;
    const report = why => bad.push(`${file}:${line}: ${why}; SQL must be a plain string literal, with values passed by ? and bind()`);
    if (`'"\``.includes(src[at])) {
      const end = readLiteral(src, at);
      if (end < 0) { report('unterminated string'); continue; }
      if (src[at] === '`' && src.slice(at, end).includes('${')) { report('SQL is built with ${}'); continue; }
      if (!/^\s*[),]/.test(src.slice(end, end + 40))) report('SQL is built from a string');
      continue;
    }
    const id = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/.exec(src.slice(at));
    if (id && consts.has(id[1])) continue;
    report(id ? `"${id[1]}" is not a const UPPER_CASE plain string defined in this file` : 'the SQL is not a string literal');
  }
  return bad;
}
export function checkSqlStrings(dirs = [path.join(here, '../core'), path.join(here, '../functions/api/v1')]) {
  const walk = d => existsSync(d) ? readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.m?js$/.test(f) ? [p] : []; }) : [];
  return dirs.flatMap(d => walk(d).flatMap(f => checkPrepareCalls(readFileSync(f, 'utf8'), path.relative(path.join(here, '..'), f))));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = [...checkMigrations(), ...checkSqlStrings()];
  if (bad.length) { console.error('migration guard FAILED:\n' + bad.map(b => '  ' + b).join('\n')); process.exit(1); }
  console.log('migration guard ok');
}
