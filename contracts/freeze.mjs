// The contract freeze (contracts/FROZEN.md). freeze.lock.json holds a SHA-256 hash of every contract file and the versions
// they were frozen at. A contract file may change only together with the version that governs it (contracts/README, "Version bumps").
// Run: node contracts/freeze.mjs           check the files against the lock (exit 1 on any difference; the tests do the same)
//      node contracts/freeze.mjs --write   rewrite the lock after a change. Refuses while a changed file's version is not bumped
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import { versions } from './versions.js';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const LOCK = 'freeze.lock.json';
const INT_VERSIONS = ['PROFILE_V', 'SLICE_V', 'API_V'];

// The contract files: every schema outside examples/, the bands and the generated event module.
export function contractFiles(dir = DIR) {
  return fs.readdirSync(dir, { recursive: true }).map(f => f.split(path.sep).join('/'))
    .filter(f => !f.startsWith('examples/') && !f.startsWith('tests/') && !f.startsWith('node_modules/') && (f.endsWith('.schema.json') || f === 'bands.json' || f === 'event_schemas.js'))
    .sort();
}
// The versions that may cover a change to a file. Bumping any one of them allows the change.
export function governing(file) {
  if (file === 'profile.schema.json') return ['PROFILE_V'];
  if (file === 'slice.schema.json' || file === 'skills_index.schema.json') return ['SLICE_V'];
  if (file === 'bands.json') return ['PROFILE_V', 'SLICE_V', 'API_V'];   // bands feed the profile, the slices and the API
  if (['api/error.schema.json', 'api/me_profile_get.response.schema.json', 'api/me_profile_put.request.schema.json'].includes(file)) return ['API_V', 'PROFILE_V'];   // carry a copy of the profile
  if (file.startsWith('api/') || file === 'events.schema.json' || file === 'extract.schema.json' || file === 'event_schemas.js') return ['API_V'];
  return null;
}
export const hash = text => crypto.createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');

export function current(dir = DIR, v = versions) {
  const files = {};
  for (const f of contractFiles(dir)) files[f] = hash(fs.readFileSync(path.join(dir, f), 'utf8'));
  return { versions: { ...v }, files };
}
export function readLock(dir = DIR) {
  const p = path.join(dir, LOCK);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
// A version counts as bumped when it went up (the whole numbers) or changed (MATCHER_VERSION).
const bumped = (k, was, now) => INT_VERSIONS.includes(k) ? Number.isInteger(was[k]) && now[k] > was[k] : was[k] !== now[k];

// Compare the lock with the files now. Returns [{file, kind, message}]:
//   kind 'bump'  a file changed, appeared or disappeared while none of its versions went up: bump one, then --write
//   kind 'stale' the change is covered by a bump (or only the versions changed), but the lock was not rewritten: run --write
//   kind 'down'  a whole-number version went down
//   kind 'unmapped' a contract file that no version governs (add it to governing())
export function compare(lock, now) {
  const out = [];
  if (!lock) return [{ file: LOCK, kind: 'stale', message: `${LOCK} is missing: run node contracts/freeze.mjs --write` }];
  const was = lock.versions || {};
  for (const k of INT_VERSIONS) if (Number.isInteger(was[k]) && now.versions[k] < was[k]) out.push({ file: 'versions.js', kind: 'down', message: `${k} went down from ${was[k]} to ${now.versions[k]}` });
  const names = [...new Set([...Object.keys(lock.files || {}), ...Object.keys(now.files)])].sort();
  for (const f of names) {
    const a = (lock.files || {})[f], b = now.files[f];
    const had = a && a.sha256, what = !a ? 'is new' : !b ? 'was removed' : had !== b ? 'changed' : null;
    const gov = governing(f);
    if (!gov) { out.push({ file: f, kind: 'unmapped', message: `${f} is a contract file that no version governs (contracts/freeze.mjs governing())` }); continue; }
    if (!what) continue;
    if (gov.some(k => bumped(k, was, now.versions))) out.push({ file: f, kind: 'stale', message: `${f} ${what} and ${gov.join(' or ')} was bumped: run node contracts/freeze.mjs --write` });
    else out.push({ file: f, kind: 'bump', message: `${f} ${what} after the freeze without a version bump: bump ${gov.join(' or ')} in versions.js and versions.json (contracts/README), then run node contracts/freeze.mjs --write` });
  }
  if (!out.length && JSON.stringify(was) !== JSON.stringify(now.versions)) out.push({ file: 'versions.js', kind: 'stale', message: `versions changed since the lock was written: run node contracts/freeze.mjs --write` });
  return out;
}

export function lockFor(now, prev) {
  const files = {};
  for (const [f, sha256] of Object.entries(now.files)) files[f] = { sha256, version: governing(f) };
  return {
    _doc: 'Contract freeze lock (contracts/FROZEN.md). Written by node contracts/freeze.mjs --write; never edit by hand. contracts/tests/freeze.test.mjs fails when a contract file differs from its hash here, and --write refuses unless one of the versions in "version" went up.',
    frozen: (prev && prev.frozen) || 'S0',
    versions: now.versions,
    files,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const write = process.argv.includes('--write'), lock = readLock(), now = current();
  const problems = lock ? compare(lock, now) : [];
  const blocking = problems.filter(p => p.kind !== 'stale');
  if (write) {
    if (blocking.length) { for (const p of blocking) console.error(p.message); console.error('freeze.lock.json not written'); process.exit(1); }
    fs.writeFileSync(path.join(DIR, LOCK), JSON.stringify(lockFor(now, lock), null, 2) + '\n');
    console.log(`wrote ${LOCK}: ${Object.keys(now.files).length} contract files`);
  } else {
    const all = lock ? problems : compare(null, now);
    for (const p of all) console.error(p.message);
    if (all.length) process.exit(1);
    console.log(`contracts match ${LOCK} (${Object.keys(now.files).length} files)`);
  }
}
