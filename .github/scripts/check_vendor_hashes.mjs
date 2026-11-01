// Checks every file in hosting/public/vendor/ against the table in its VERSIONS.md.
// Fails on a hash mismatch, a listed file that is missing, or a vendored file that is not listed.
// Also checks that each file in app/vendor/ (the game's source copy, which app/build.py copies into
// hosting/public/vendor/ without wiping it) is listed and has the same hash, so the two never drift.
// Run from the repo root: node .github/scripts/check_vendor_hashes.mjs [vendorDir] [sourceDir]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

export function checkVendor(dir = 'hosting/public/vendor', sourceDir = 'app/vendor') {
  const table = join(dir, 'VERSIONS.md');
  const walk = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
  if (!existsSync(table)) return { errors: [`${table} is missing`], count: 0 };
  const listed = new Map();
  for (const line of readFileSync(table, 'utf8').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 4 || !/^`.+`$/.test(cells[1])) continue;     // rows start with a `path` cell
    listed.set(cells[1].slice(1, -1), cells[3].replace(/`/g, '').toLowerCase());
  }
  const errors = [];
  const actual = new Set();
  for (const p of walk(dir)) {
    const rel = relative(dir, p).split(sep).join('/');
    if (rel === 'VERSIONS.md') continue;
    actual.add(rel);
    if (!listed.has(rel)) { errors.push(`not listed in VERSIONS.md: ${rel}`); continue; }
    const sum = sha(p);
    if (sum !== listed.get(rel)) errors.push(`hash mismatch: ${rel} (file ${sum}, table ${listed.get(rel)})`);
  }
  for (const rel of listed.keys()) if (!actual.has(rel)) errors.push(`listed but missing: ${rel}`);
  if (sourceDir && existsSync(sourceDir)) {
    for (const p of walk(sourceDir)) {
      const rel = relative(sourceDir, p).split(sep).join('/');
      if (!listed.has(rel)) { errors.push(`${sourceDir}/${rel} is not listed in VERSIONS.md (run python3 app/build.py and add its row)`); continue; }
      if (sha(p) !== listed.get(rel)) errors.push(`${sourceDir}/${rel} differs from the hash in VERSIONS.md (run python3 app/build.py)`);
    }
  }
  return { errors, count: actual.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, count } = checkVendor(process.argv[2], process.argv[3]);
  if (errors.length) { for (const e of errors) console.error('FAIL ' + e); process.exit(1); }
  console.log(`ok   ${count} vendored files match VERSIONS.md`);
}
