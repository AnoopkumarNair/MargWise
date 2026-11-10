// The contract freeze (contracts/FROZEN.md). freeze.lock.json holds a SHA-256 hash of every contract file and the versions
// they were frozen at. A contract file may change only together with the version that governs it (contracts/README, "Version bumps").
// Run: node contracts/freeze.mjs           check the files against the lock (exit 1 on any difference; the tests do the same)
//      node contracts/freeze.mjs --write   rewrite the lock after a change. Refuses while a changed file's version is not bumped
//      node contracts/freeze.mjs --write --amend A1
//                                          rewrite the lock for an owner-approved amendment WITHOUT a version bump. Only for an additive
//                                          change made before anything with that version was released. The amendment must be listed in
//                                          amendments.json (id, date, owner decision, files, the versions it keeps); only the files it
//                                          names may differ, and it is recorded in the lock so it cannot be reused (FROZEN.md)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import { versions } from './versions.js';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const LOCK = 'freeze.lock.json';
export const AMENDMENTS = 'amendments.json';
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

export function lockFor(now, prev, applied = null) {
  const files = {};
  for (const [f, sha256] of Object.entries(now.files)) files[f] = { sha256, version: governing(f) };
  const amendments = [...((prev && prev.amendments) || [])];
  if (applied) amendments.push({ id: applied.id, date: applied.date, files: Object.fromEntries(applied.files.map(f => [f, now.files[f] || null])), versions: { ...now.versions } });
  const out = {
    _doc: 'Contract freeze lock (contracts/FROZEN.md). Written by node contracts/freeze.mjs --write; never edit by hand. contracts/tests/freeze.test.mjs fails when a contract file differs from its hash here, and --write refuses unless one of the versions in "version" went up, or an owner amendment in amendments.json names the file (--write --amend <id>).',
    frozen: (prev && prev.frozen) || 'S0',
    versions: now.versions,
    files,
  };
  if (amendments.length) out.amendments = amendments;
  return out;
}

// ---- Amendments: an owner-approved change to a frozen contract without a version bump (FROZEN.md, "Amendments").
export function readAmendments(dir = DIR) {
  const p = path.join(dir, AMENDMENTS);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).amendments || [] : [];
}
// True when a graph release has been accepted (data/releases/graph/latest.json). Then a slice contract change must bump SLICE_V.
export function sliceReleased(dir = DIR) { return fs.existsSync(path.join(dir, '..', 'data', 'releases', 'graph', 'latest.json')); }

// Why amendment `a` cannot be applied to go from `lock` to `now`. [] means it can. `released` says whether SLICE_V data was released.
export function amendProblems(lock, now, a, released = false) {
  const out = [];
  if (!a) return ['no such amendment in amendments.json'];
  if (!/^A[0-9]+$/.test(a.id || '')) out.push(`amendment id ${a.id} must look like A1`);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(a.date || '')) out.push(`amendment ${a.id}: date must be YYYY-MM-DD`);
  if (typeof a.decision !== 'string' || !/owner/i.test(a.decision)) out.push(`amendment ${a.id}: decision must name the owner decision that approved it`);
  if (typeof a.summary !== 'string' || a.summary.length < 10) out.push(`amendment ${a.id}: summary must say what changed`);
  if (!Array.isArray(a.files) || !a.files.length) { out.push(`amendment ${a.id}: files must list the contract files it changes`); return out; }
  if (((lock && lock.amendments) || []).some(x => x.id === a.id)) out.push(`amendment ${a.id} is already in ${LOCK}; a new change needs a new amendment`);
  for (const [k, v] of Object.entries(a.versions || {})) if (now.versions[k] !== v) out.push(`amendment ${a.id} keeps ${k} at ${v}, but versions.js has ${now.versions[k]}`);
  for (const p of compare(lock, now)) {
    if (p.kind === 'down' || p.kind === 'unmapped') { out.push(p.message); continue; }
    if (p.kind !== 'bump') continue;
    if (!a.files.includes(p.file)) { out.push(`${p.file} changed but amendment ${a.id} does not name it`); continue; }
    const gov = governing(p.file) || [];
    if (!gov.every(k => k in (a.versions || {}))) out.push(`amendment ${a.id} must state the ${gov.join(', ')} it keeps for ${p.file}`);
    if (released && gov.includes('SLICE_V')) out.push(`${p.file}: a graph release exists (data/releases/graph/latest.json), so this change must bump SLICE_V`);
  }
  return out;
}

// Every amendment in the lock is in amendments.json with the same date and files, and every listed amendment is applied.
export function amendmentRecordProblems(lock, list) {
  const out = [], inLock = (lock && lock.amendments) || [];
  for (const x of inLock) {
    const a = list.find(y => y.id === x.id);
    if (!a) out.push(`${LOCK} records amendment ${x.id}, which is missing from ${AMENDMENTS}`);
    else if (a.date !== x.date || JSON.stringify([...a.files].sort()) !== JSON.stringify(Object.keys(x.files).sort())) out.push(`amendment ${x.id} in ${AMENDMENTS} differs from the one recorded in ${LOCK}`);
  }
  for (const a of list) if (!inLock.some(x => x.id === a.id)) out.push(`amendment ${a.id} is listed in ${AMENDMENTS} but not applied: run node contracts/freeze.mjs --write --amend ${a.id}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const write = process.argv.includes('--write'), lock = readLock(), now = current();
  const ai = process.argv.indexOf('--amend'), amendId = ai > 0 ? process.argv[ai + 1] : null;
  const problems = lock ? compare(lock, now) : [];
  const blocking = problems.filter(p => p.kind !== 'stale');
  if (ai > 0 && !write) { console.error('--amend works only with --write'); process.exit(2); }
  if (write && amendId) {
    const a = readAmendments().find(x => x.id === amendId);
    const bad = amendProblems(lock, now, a || null, sliceReleased());
    if (bad.length) { for (const m of bad) console.error(m); console.error('freeze.lock.json not written'); process.exit(1); }
    fs.writeFileSync(path.join(DIR, LOCK), JSON.stringify(lockFor(now, lock, a), null, 2) + '\n');
    console.log(`wrote ${LOCK} with amendment ${a.id} (${a.files.join(', ')}); versions unchanged`);
  } else if (write) {
    if (blocking.length) { for (const p of blocking) console.error(p.message); console.error('freeze.lock.json not written (an owner amendment without a bump: --write --amend <id>, see FROZEN.md)'); process.exit(1); }
    fs.writeFileSync(path.join(DIR, LOCK), JSON.stringify(lockFor(now, lock), null, 2) + '\n');
    console.log(`wrote ${LOCK}: ${Object.keys(now.files).length} contract files`);
  } else {
    const all = lock ? [...problems, ...amendmentRecordProblems(lock, readAmendments()).map(message => ({ message }))] : compare(null, now);
    for (const p of all) console.error(p.message);
    if (all.length) process.exit(1);
    console.log(`contracts match ${LOCK} (${Object.keys(now.files).length} files)`);
  }
}
