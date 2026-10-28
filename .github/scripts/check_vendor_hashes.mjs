// Checks every file in hosting/public/vendor/ against the table in VERSIONS.md.
// Fails on a hash mismatch, a listed file that is missing, or a vendored file that is not listed.
// Run from the repo root: node .github/scripts/check_vendor_hashes.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const dir = 'hosting/public/vendor';
const table = join(dir, 'VERSIONS.md');
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

if (!existsSync(table)) { console.error(`FAIL ${table} is missing`); process.exit(1); }
const listed = new Map();
for (const line of readFileSync(table, 'utf8').split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length < 4 || !/^`.+`$/.test(cells[1])) continue;     // rows start with a `path` cell
  const hash = cells[3].replace(/`/g, '').toLowerCase();
  listed.set(cells[1].slice(1, -1), hash);
}
const errors = [];
const actual = new Set();
for (const p of walk(dir)) {
  const rel = relative(dir, p).split(sep).join('/');
  if (rel === 'VERSIONS.md') continue;
  actual.add(rel);
  if (!listed.has(rel)) { errors.push(`not listed in VERSIONS.md: ${rel}`); continue; }
  const sum = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (sum !== listed.get(rel)) errors.push(`hash mismatch: ${rel} (file ${sum}, table ${listed.get(rel)})`);
}
for (const rel of listed.keys()) if (!actual.has(rel)) errors.push(`listed but missing: ${rel}`);
if (errors.length) { for (const e of errors) console.error('FAIL ' + e); process.exit(1); }
console.log(`ok   ${actual.size} vendored files match VERSIONS.md`);
