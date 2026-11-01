// Version guard (SPEC 7.5, TEST_PLAN layer 2): a golden output may change only together with MATCHER_VERSION.
// golden.lock.json holds the matcher version and, per golden case, a SHA-256 of the case's expectations and of the full
// match() output. A new case may be added at any version; a changed or removed case needs a version bump.
// Run: node matcher/tests/version_guard.mjs           check (exit 1 on a problem; match.test.mjs runs the same check)
//      node matcher/tests/version_guard.mjs --write   rewrite the lock. Refuses while a case changed and the version did not
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { MATCHER_VERSION, match } from '../match.js';
import { TESTS, golden, caseInputs, canon, sha, readJson } from './lib.mjs';

export const LOCK = path.join(TESTS, 'golden.lock.json');

export function current() {
  const cases = {};
  for (const c of golden().cases) cases[c.id] = sha(canon({ expect: c.expect, output: match(...caseInputs(c)) }));
  return { matcher_version: MATCHER_VERSION, cases };
}

// Problems that block: a case whose hash changed or that was removed while the version stayed the same.
export function check(lock = readJson(LOCK), now = current()) {
  const out = [];
  if (lock.matcher_version !== now.matcher_version) {
    out.push(`MATCHER_VERSION is ${now.matcher_version} but the lock has ${lock.matcher_version}: run node matcher/tests/version_guard.mjs --write`);
    return out;
  }
  for (const [id, h] of Object.entries(lock.cases)) {
    if (!(id in now.cases)) out.push(`golden case ${id} was removed without a MATCHER_VERSION bump`);
    else if (now.cases[id] !== h) out.push(`golden case ${id} changed output or expectations without a MATCHER_VERSION bump`);
  }
  for (const id of Object.keys(now.cases)) if (!(id in lock.cases)) out.push(`golden case ${id} is new: run node matcher/tests/version_guard.mjs --write`);
  return out;
}

function write() {
  const now = current();
  if (fs.existsSync(LOCK)) {
    const blocking = check(readJson(LOCK), now).filter(p => !p.includes('is new') && !p.includes('but the lock has'));
    if (blocking.length) { for (const p of blocking) console.error(p); console.error('Bump MATCHER_VERSION first.'); return 1; }
  }
  fs.writeFileSync(LOCK, JSON.stringify({ _doc: 'Written by node matcher/tests/version_guard.mjs --write. Do not edit by hand.', ...now }, null, 1) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), LOCK)} (${Object.keys(now.cases).length} cases, version ${now.matcher_version})`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--write') process.exit(write());
  const problems = check();
  for (const p of problems) console.error(p);
  if (!problems.length) console.log('golden outputs match the lock for MATCHER_VERSION ' + MATCHER_VERSION);
  process.exit(problems.length ? 1 : 0);
}
