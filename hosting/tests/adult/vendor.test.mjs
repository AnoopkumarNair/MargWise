// The vendored-file check (.github/scripts/check_vendor_hashes.mjs) and app/build.py keeping hosting/public/vendor/VERSIONS.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkVendor } from '../../../.github/scripts/check_vendor_hashes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = s => createHash('sha256').update(s).digest('hex');
const setup = ({ table = true, files = { 'a.js': 'A' }, rows = { 'a.js': 'A' }, source } = {}) => {
  const d = mkdtempSync(path.join(tmpdir(), 'vendor-')), v = path.join(d, 'vendor'); mkdirSync(v);
  for (const [n, c] of Object.entries(files)) writeFileSync(path.join(v, n), c);
  if (table) writeFileSync(path.join(v, 'VERSIONS.md'), '| Path | Version | SHA-256 | Source |\n| --- | --- | --- | --- |\n' + Object.entries(rows).map(([n, c]) => `| \`${n}\` | 1 | \`${sha(c)}\` | x |`).join('\n') + '\n');
  let s = null; if (source) { s = path.join(d, 'src'); mkdirSync(s); for (const [n, c] of Object.entries(source)) writeFileSync(path.join(s, n), c); }
  return [v, s];
};

test('the real vendored files and the game source copy pass', () => {
  const r = checkVendor(path.join(ROOT, 'hosting/public/vendor'), path.join(ROOT, 'app/vendor'));
  assert.deepEqual(r.errors, []); assert.ok(r.count >= 4);
});
test('a missing VERSIONS.md, an unlisted file, a hash mismatch and a listed missing file all fail', () => {
  assert.match(checkVendor(...setup({ table: false })).errors.join(), /VERSIONS\.md is missing/);
  assert.match(checkVendor(...setup({ files: { 'a.js': 'A', 'b.js': 'B' } })).errors.join(), /not listed in VERSIONS\.md: b\.js/);
  assert.match(checkVendor(...setup({ files: { 'a.js': 'changed' } })).errors.join(), /hash mismatch: a\.js/);
  assert.match(checkVendor(...setup({ rows: { 'a.js': 'A', 'gone.js': 'G' } })).errors.join(), /listed but missing: gone\.js/);
});
test('a source file in app/vendor that differs from its row, or is not listed, fails', () => {
  assert.deepEqual(checkVendor(...setup({ source: { 'a.js': 'A' } })).errors, []);
  assert.match(checkVendor(...setup({ source: { 'a.js': 'new' } })).errors.join(), /differs from the hash/);
  assert.match(checkVendor(...setup({ source: { 'c.js': 'C' } })).errors.join(), /c\.js is not listed/);
});
test('app/build.py adds to hosting/public/vendor and never wipes it (VERSIONS.md lives there)', () => {
  const src = readFileSync(path.join(ROOT, 'app/build.py'), 'utf8');
  assert.match(src, /copytree\(os\.path\.join\(A, 'vendor'\), os\.path\.join\(H, 'vendor'\), dirs_exist_ok=True\)/);
  assert.doesNotMatch(src, /rmtree\(os\.path\.join\((H|tgt), 'vendor'\)/);
});
