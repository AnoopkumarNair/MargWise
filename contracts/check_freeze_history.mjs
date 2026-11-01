// Freeze history check (contracts/FROZEN.md, review finding S6). freeze.mjs checks the files against the lock in the same tree; this
// checks the lock and the amendment list against main, so a branch cannot rewrite the freeze history and the lock together.
// Run: node contracts/check_freeze_history.mjs [--base <git ref>]     (CI runs it with fetch-depth 0)
//
// Rules, comparing the working tree with the base (default: main, then origin/main):
//   1. amendments.json: the base's entries are still there, unchanged and in the same order. New entries are only appended.
//   2. freeze.lock.json: the base's recorded amendments are still there, unchanged and in the same order. No version went down.
//   3. A contract file whose lock hash changed (or that was added or removed) is covered by a bumped version that governs it, or by
//      a new amendment (in the lock and in amendments.json) that names it.
//   4. Every amendment in amendments.json names a deviation ("deviation": "docs/adult/deviations.md D14"), and that entry in
//      docs/adult/deviations.md mentions the amendment id and has a Decision line that starts with "decided by owner".
//   5. Additive only: a changed *.schema.json or bands.json whose governing versions were NOT bumped (an amendment) may not remove a
//      property, add a required field, remove an enum or bands value, remove a type, turn additionalProperties off, or tighten a
//      min/max limit. With a version bump these are allowed (that is what the bump is for).
// Limits of rule 5: it compares the same JSON paths in the two files; it does not follow $ref, and does not reason about pattern,
// format, oneOf/anyOf/allOf, if/then or prefixItems changes. A change it cannot see still needs the architect's review (CODEOWNERS).
// Rule 4 trusts the text of deviations.md; contracts/ itself needs the owner's review (.github/CODEOWNERS).
// If the base cannot be read: a warning and exit 0, except under CI=true, where it fails. A file that does not exist on the base
// (before the first merge of contracts/) is skipped with a warning.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { governing } from './freeze.mjs';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const INT_VERSIONS = ['PROFILE_V', 'SLICE_V', 'API_V'];
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const bumped = (k, was, now) => INT_VERSIONS.includes(k) ? Number.isInteger(was[k]) && now[k] > was[k] : was[k] !== undefined && was[k] !== now[k];

// Rule 1 and the first half of rule 2: `base` must be a prefix of `now`, entry by entry.
export function appendOnly(base, now, what) {
  const out = [];
  base.forEach((b, i) => {
    const n = now[i];
    if (!n) out.push(`${what}: entry ${b.id || i} was removed (entries are never removed)`);
    else if (canon(n) !== canon(b)) out.push(`${what}: entry ${b.id || i} was changed or moved (existing entries are immutable; append a new one)`);
  });
  return out;
}

// Rules 2 and 3 on two locks. `amendIds` are the ids of amendments new in this change (in the lock).
export function lockProblems(baseLock, lock) {
  const out = [], was = baseLock.versions || {}, now = lock.versions || {};
  out.push(...appendOnly(baseLock.amendments || [], lock.amendments || [], 'freeze.lock.json amendments'));
  for (const k of INT_VERSIONS) if (Number.isInteger(was[k]) && now[k] < was[k]) out.push(`${k} went down from ${was[k]} to ${now[k]} since the base`);
  const added = (lock.amendments || []).slice((baseLock.amendments || []).length);
  const named = new Set(added.flatMap(a => Object.keys(a.files || {})));
  for (const f of changedFiles(baseLock, lock)) {
    const gov = governing(f) || [];
    if (gov.some(k => bumped(k, was, now))) continue;
    if (named.has(f)) continue;
    out.push(`${f} changed in freeze.lock.json since the base without a bump of ${gov.join(' or ') || 'its version'} and without a new amendment that names it`);
  }
  return out;
}
export function changedFiles(baseLock, lock) {
  const a = baseLock.files || {}, b = lock.files || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter(f => !a[f] || !b[f] || a[f].sha256 !== b[f].sha256);
}
// Files that changed but whose governing versions did not go up: these must be additive (rule 5).
export function unbumpedFiles(baseLock, lock) {
  const was = baseLock.versions || {}, now = lock.versions || {};
  return changedFiles(baseLock, lock).filter(f => !(governing(f) || []).some(k => bumped(k, was, now)));
}

// Rule 4.
export function deviationProblems(amendments, deviationsText) {
  const out = [];
  const blocks = {};
  for (const part of deviationsText.split(/^### /m).slice(1)) { const m = /^(D[0-9]+)\./.exec(part); if (m) blocks[m[1]] = part; }
  for (const a of amendments) {
    const m = /deviations\.md\s+(D[0-9]+)\b/.exec(a.deviation || '');
    if (!m) { out.push(`amendment ${a.id}: "deviation" must name its entry, such as "docs/adult/deviations.md D14"`); continue; }
    const b = blocks[m[1]];
    if (!b) { out.push(`amendment ${a.id}: ${m[1]} is not in docs/adult/deviations.md`); continue; }
    if (!new RegExp('\\b' + a.id + '\\b').test(b)) out.push(`amendment ${a.id}: deviations.md ${m[1]} does not mention ${a.id}`);
    const d = /^- Decision:\s*(.*)$/m.exec(b);
    if (!d || !/^decided by owner\b/i.test(d[1])) out.push(`amendment ${a.id}: deviations.md ${m[1]} must have a Decision line that starts with "decided by owner"`);
  }
  return out;
}

// Rule 5 on one file. Returns the narrowing changes from `base` to `now` (an empty list means additive only).
export function narrowing(base, now, where = '') {
  const out = [];
  if (!base || typeof base !== 'object' || Array.isArray(base)) return out;
  if (!now || typeof now !== 'object' || Array.isArray(now)) { out.push(`${where || '/'}: was an object, is now ${JSON.stringify(now)}`); return out; }
  if (base.properties && typeof base.properties === 'object') {
    for (const k of Object.keys(base.properties)) {
      if (!now.properties || !(k in now.properties)) out.push(`${where}/properties/${k}: property removed`);
    }
  }
  if (Array.isArray(now.required)) {
    const had = new Set(Array.isArray(base.required) ? base.required : []);
    for (const k of now.required) if (!had.has(k)) out.push(`${where}/required: ${k} is now required`);
  }
  for (const key of ['enum', 'values']) {
    if (!Array.isArray(base[key])) continue;
    const have = new Set((now[key] || []).map(canon));
    for (const v of base[key]) if (!have.has(canon(v))) out.push(`${where}/${key}: value ${JSON.stringify(v)} removed`);
  }
  if (base.type !== undefined) {
    const t = x => Array.isArray(x) ? x : x === undefined ? [] : [x];
    const have = new Set(t(now.type));
    if (now.type !== undefined) for (const v of t(base.type)) if (!have.has(v)) out.push(`${where}/type: ${v} removed`);
  }
  if (base.additionalProperties !== false && now.additionalProperties === false) out.push(`${where}/additionalProperties: turned off`);
  for (const k of ['maxLength', 'maxItems', 'maximum', 'maxProperties']) {
    if (now[k] !== undefined && (base[k] === undefined || now[k] < base[k])) out.push(`${where}/${k}: lowered from ${base[k] === undefined ? 'none' : base[k]} to ${now[k]}`);
  }
  for (const k of ['minLength', 'minItems', 'minimum', 'minProperties']) {
    if (now[k] !== undefined && (base[k] === undefined ? (k === 'minimum' || now[k] > 0) : now[k] > base[k])) out.push(`${where}/${k}: raised from ${base[k] === undefined ? 'none' : base[k]} to ${now[k]}`);
  }
  if (base.const !== undefined && canon(base.const) !== canon(now.const)) out.push(`${where}/const: changed`);
  for (const k of Object.keys(base)) {
    if (['enum', 'values', 'required', 'type', 'const'].includes(k)) continue;
    const b = base[k], n = now[k];
    if (k === 'properties' || k === '$defs' || k === 'definitions' || k === 'patternProperties') {
      for (const p of Object.keys(b || {})) if (n && p in n) out.push(...narrowing(b[p], n[p], `${where}/${k}/${p}`));
    } else if (b && typeof b === 'object' && !Array.isArray(b)) {
      if (n && typeof n === 'object') out.push(...narrowing(b, n, `${where}/${k}`));
    }
  }
  return out;
}

// ---- git
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }); }
export function resolveBase(asked) {
  for (const ref of asked ? [asked] : ['main', 'origin/main']) {
    try { git(['rev-parse', '--verify', '--quiet', ref + '^{commit}']); return ref; } catch { /* try the next one */ }
  }
  return null;
}
function atBase(ref, rel) {
  try { git(['cat-file', '-e', `${ref}:${rel}`]); } catch { return undefined; }
  return git(['show', `${ref}:${rel}`]);
}

export function run({ base: asked = null, ci = process.env.CI === 'true' } = {}) {
  const problems = [], warnings = [];
  const ref = resolveBase(asked);
  if (!ref) {
    const msg = `cannot read ${asked || 'main or origin/main'} from git`;
    if (ci) problems.push(msg + ' (CI must check out with fetch-depth: 0)'); else warnings.push(msg + ': freeze history not checked');
    return { ref, problems, warnings };
  }
  const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const amend = read('amendments.json').amendments || [], lock = read('freeze.lock.json');
  const deviations = fs.readFileSync(path.join(ROOT, 'docs', 'adult', 'deviations.md'), 'utf8');
  problems.push(...deviationProblems(amend, deviations));

  const baseAmendText = atBase(ref, 'contracts/amendments.json');
  if (baseAmendText === undefined) warnings.push(`contracts/amendments.json is not on ${ref}: append-only check skipped`);
  else problems.push(...appendOnly(JSON.parse(baseAmendText).amendments || [], amend, 'amendments.json'));

  const baseLockText = atBase(ref, 'contracts/freeze.lock.json');
  if (baseLockText === undefined) { warnings.push(`contracts/freeze.lock.json is not on ${ref}: lock history and additive checks skipped`); return { ref, problems, warnings }; }
  const baseLock = JSON.parse(baseLockText);
  problems.push(...lockProblems(baseLock, lock));
  const newIds = new Set((lock.amendments || []).slice((baseLock.amendments || []).length).map(a => a.id));
  for (const id of newIds) if (!amend.some(a => a.id === id)) problems.push(`freeze.lock.json records new amendment ${id}, which is not in amendments.json`);
  for (const f of unbumpedFiles(baseLock, lock)) {
    if (!(f.endsWith('.schema.json') || f === 'bands.json')) continue;
    const before = atBase(ref, 'contracts/' + f);
    const now = fs.existsSync(path.join(DIR, f)) ? fs.readFileSync(path.join(DIR, f), 'utf8') : undefined;
    if (before === undefined) continue;                                          // a new file is additive
    if (now === undefined) { problems.push(`${f}: removed without a version bump`); continue; }
    for (const n of narrowing(JSON.parse(before), JSON.parse(now))) problems.push(`${f}: not additive without a version bump: ${n}`);
  }
  return { ref, problems, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('--base');
  const { ref, problems, warnings } = run({ base: i > 0 ? process.argv[i + 1] : null });
  for (const w of warnings) console.warn('warning: ' + w);
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(`freeze history ok against ${ref || '(no base)'}`);
}
