// Loads the intake fixtures (tests/fixtures/<id>/). Test-only.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));
// The date every fixture is read on, so that "present" always means the same year.
export const NOW = '2026-10-29';

export function fixtureIds() {
  return readdirSync(FIXTURES_DIR).filter(d => existsSync(FIXTURES_DIR + d + '/expected.json') && statSync(FIXTURES_DIR + d).isDirectory()).sort();
}
export function loadFixture(id) {
  const dir = FIXTURES_DIR + id + '/';
  return {
    id, dir,
    text: readFileSync(dir + 'resume.txt', 'utf8'),
    expected: JSON.parse(readFileSync(dir + 'expected.json', 'utf8')),
  };
}

// precision / recall against the fixture's own lists
//   recall    = share of mustFind found
//   falsePos  = ids found that are in mustNotFind
// (precision over everything found is not defined: we only label some ids, so we report the labelled ones.)
export function score(result, expected) {
  const found = new Set(result.skills.map(s => s.id));
  const must = expected.mustFind || [];
  const hit = must.filter(id => found.has(id));
  const bad = (expected.mustNotFind || []).filter(id => found.has(id));
  return {
    must: must.length, hit: hit.length, missed: must.filter(id => !found.has(id)),
    recall: must.length ? hit.length / must.length : 1,
    notWant: (expected.mustNotFind || []).length, falsePos: bad,
    labelledPrecision: hit.length + bad.length ? hit.length / (hit.length + bad.length) : 1,
  };
}
