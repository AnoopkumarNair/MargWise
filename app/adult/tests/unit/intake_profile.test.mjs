// intake_profile.js (S3): years bands from dates, levels, recency, the confirm model, and the profile pieces. Pure functions, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as P from '../../intake_profile.js';
import { findSkills } from '../../lookup.js';
import { pageText } from '../../intake_file.js';
import { validate } from '../../../../contracts/validate_lib.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

test('years bands follow bands.json: 0-2 is under 2 years, each band includes its lower bound', () => {
  const at = { 0: '0-2', 1: '0-2', 2: '2-5', 4: '2-5', 5: '5-8', 7: '5-8', 8: '8-12', 11: '8-12', 12: '12-18', 17: '12-18', 18: '18+', 40: '18+' };
  for (const [n, b] of Object.entries(at)) assert.equal(P.yearsBand(Number(n)), b, n + ' years');
  assert.equal(P.yearsBand(-1), null); assert.equal(P.yearsBand(null), null); assert.equal(P.yearsBand(1.5), null);
});

test('years in a role come from its dates; "present" counts to now; bad dates give nothing', () => {
  assert.equal(P.bandFromDates(2019, null, true, 2026), '5-8');
  assert.equal(P.bandFromDates(2014, 2018, false, 2026), '2-5');
  assert.equal(P.bandFromDates(2025, 2026, false, 2026), '0-2');
  assert.equal(P.bandFromDates(null, 2020, false, 2026), null);
  assert.equal(P.bandFromDates(2020, null, false, 2026), null);
  assert.equal(P.bandFromDates(2022, 2019, false, 2026), null);
});

test('the level starts from the years band and the title word overrides it (SPEC 7.2)', () => {
  assert.equal(P.levelFromBand('0-2'), 1); assert.equal(P.levelFromBand('18+'), 6);
  assert.equal(P.roleLevel('5-8', 'Accountant'), 3);
  assert.equal(P.roleLevel('2-5', 'Senior Accountant'), 3);
  assert.equal(P.roleLevel('5-8', 'Team Lead, Support'), 4);
  assert.equal(P.roleLevel('2-5', 'Manager'), 4);
  assert.equal(P.roleLevel('8-12', 'Senior Manager'), 5);
  assert.equal(P.roleLevel('2-5', 'Director of Finance'), 6);
  assert.equal(P.roleLevel('2-5', 'VP'), 6);
  assert.equal(P.roleLevel('8-12', 'Associate Consultant'), 2, 'associate is level 1 to 2');
  assert.equal(P.roleLevel('0-2', 'Associate'), 1);
  assert.equal(P.roleLevel('5-8', 'Headphone Tester'), 3, 'a word that only contains "head" does not count');
  assert.equal(P.roleLevel('5-8', ''), 3);
});

test('a skill last used within 3 years starts as Used, older as Rusty', () => {
  assert.equal(P.strengthFromYear(2026, 2026), 'used'); assert.equal(P.strengthFromYear(2023, 2026), 'used');
  assert.equal(P.strengthFromYear(2022, 2026), 'rusty'); assert.equal(P.strengthFromYear(2010, 2026), 'rusty');
  assert.equal(P.strengthFromYear(null, 2026), 'used');
});

test('the industry guess needs a clear winner', () => {
  assert.equal(P.guessIndustry('Credit underwriting for a bank, KYC checks'), 'bfsi');
  assert.equal(P.guessIndustry('Voice process, AHT and CSAT targets in a BPO'), 'bpm');
  assert.equal(P.guessIndustry('Java and Python developer, AWS cloud'), 'it');
  assert.equal(P.guessIndustry('Accountant at a school'), 'other');
  assert.equal(P.guessIndustry(''), 'other');
  assert.equal(P.guessIndustry('bank software'), 'other', 'a tie is no guess');
});

const found = {
  looksLikeResume: true,
  roles: [
    { titleText: 'Senior Accountant', occCandidates: [{ occ: 'occ:13-2011.00', label: 'Accountants and Auditors' }], startYear: 2019, endYear: null, current: true, sourceLine: 'Senior Accountant | 2019 - Present' },
    { titleText: 'Clerk', occCandidates: [{ occ: 'occ:43-3031.00', label: 'Bookkeeping Clerks' }, { occ: 'occ:13-2011.00', label: 'Accountants and Auditors' }], startYear: 2010, endYear: 2012, current: false },
    { titleText: 'Mystery', occCandidates: [], startYear: null, endYear: null, current: false },
  ],
  skills: [
    { id: 'tec:excel', label: 'Excel', sourceLine: 'Built models in Excel', roleIndex: 0, lastYear: 2026 },
    { id: 'skl:2.A.1.c', label: 'Writing', sourceLine: 'Writing reports', roleIndex: 1, lastYear: 2012 },
    { id: 'skl:2.A.2.a', label: 'Critical Thinking', sourceLine: 'Critical Thinking', roleIndex: -1, lastYear: null },
  ],
  creds: [{ name: 'CA Inter', sourceLine: 'CA Inter, 2012' }],
  warnings: [{ code: 'no_roles', message: 'We could not find your jobs.' }],
};
const occs = [{ id: 'occ:13-2011.00', label: 'Accountants and Auditors', slice: 'slices/13-2011.00.json' }, { id: 'occ:43-3031.00', label: 'Bookkeeping Clerks', slice: null }];

test('the confirm model picks the first occupation that has data, derives bands and strengths, and keeps source lines for display', () => {
  const m = P.toConfirmModel(found, occs, 2026);
  assert.equal(m.roles.length, 3);
  assert.deepEqual([m.roles[0].occ, m.roles[0].years, m.roles[0].yearsFromDates, m.roles[0].current], ['occ:13-2011.00', '5-8', true, true]);
  assert.deepEqual([m.roles[1].occ, m.roles[1].years], ['occ:13-2011.00', '2-5'], 'the clerk occupation has no data, so the next candidate is chosen');
  assert.equal(m.roles[1].candidates[0].ready, false);
  assert.deepEqual([m.roles[2].occ, m.roles[2].years], [null, ''], 'nothing matched, nothing guessed');
  assert.deepEqual(m.skills.map(s => [s.id, s.strength, s.roleKey]), [['tec:excel', 'used', 'r0'], ['skl:2.A.1.c', 'rusty', 'r1'], ['skl:2.A.2.a', 'used', null]]);
  assert.equal(m.skills[0].sourceLine, 'Built models in Excel');
  assert.deepEqual(m.warnings, ['We could not find your jobs.']);
  assert.deepEqual(m.creds.map(c => c.id), [null], 'credentials are dropped until the graph has them');
});

test('the profile pieces hold ids and bands only, and refuse a job with no occupation or no years', () => {
  const m = P.toConfirmModel(found, occs, 2026);
  let r = P.confirmedProfile(m);
  assert.match(r.error, /Pick the closest job for “Mystery”/); assert.equal(r.roleKey, 'r2');
  m.roles[2].include = false;
  r = P.confirmedProfile(m);
  assert.deepEqual(r.roles, [
    { occ: 'occ:13-2011.00', level: 3, industry: 'other', years: '5-8', current: true },
    { occ: 'occ:13-2011.00', level: 2, industry: 'other', years: '2-5', current: false }]);
  assert.deepEqual([...r.skills], [['tec:excel', 'used'], ['skl:2.A.1.c', 'rusty'], ['skl:2.A.2.a', 'used']]);
  assert.deepEqual([...r.last], [['tec:excel', 2026], ['skl:2.A.1.c', 2012]]);
  assert.equal(r.startRole.key, 'r0');
  m.roles[1].years = ''; assert.match(P.confirmedProfile(m).error, /how long/);
  m.roles[1].include = false; m.roles[1].years = '2-5';
  r = P.confirmedProfile(m);
  assert.ok(!r.skills.has('skl:2.A.1.c'), 'a removed job takes its skills with it');
  m.roles[0].include = false; assert.match(P.confirmedProfile(m).error, /at least one job/);
});

test('the strongest tap wins when a skill is listed twice, and a removed skill is left out', () => {
  const m = P.toConfirmModel(found, occs, 2026); m.roles[2].include = false;
  m.skills.push({ id: 'tec:excel', label: 'Excel', sourceLine: null, roleKey: null, lastYear: 2020, strength: 'strong', include: true, added: true });
  m.skills[2].include = false;
  const r = P.confirmedProfile(m);
  assert.equal(r.skills.get('tec:excel'), 'strong'); assert.ok(!r.skills.has('skl:2.A.2.a'));
  assert.equal(r.last.get('tec:excel'), 2026);
});

test('what is built from the confirmed pieces passes profile.schema.json; titles and source lines are in none of it', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'contracts', 'profile.schema.json'), 'utf8'));
  const m = P.toConfirmModel(found, occs, 2026); m.roles[2].include = false;
  const r = P.confirmedProfile(m);
  const profile = { v: 1, roles: r.roles, skills: [...r.skills].map(([id, strength]) => ({ id, strength, ...(r.last.has(id) ? { last: r.last.get(id) } : {}) })),
    lead: { people: '6-20', budget: false, expert: true }, job_release: 'dev-unaccepted' };
  assert.deepEqual(validate(schema, profile).errors || [], []);
  assert.equal(validate(schema, profile).ok, true);
  const dump = JSON.stringify(profile);
  for (const text of ['Senior Accountant', 'Built models in Excel', 'CA Inter', 'Writing reports']) assert.ok(!dump.includes(text), text);
});

test('the skill search ranks exact, then prefix, then word starts, and leaves out skills the person has', () => {
  const idx = [
    { id: 'tec:a', label: 'Microsoft Excel', alt: ['excel'], kind: 'technology' },
    { id: 'tec:b', label: 'Excel Macros', alt: [], kind: 'technology' },
    { id: 'skl:c', label: 'Accounting', alt: ['bookkeeping'], kind: 'skill' },
    { id: 'tec:d', label: 'Python', alt: [], kind: 'technology' }];
  assert.deepEqual(findSkills(idx, 'excel').map(s => s.id), ['tec:a', 'tec:b']);
  assert.deepEqual(findSkills(idx, 'book').map(s => s.id), ['skl:c'], 'other names count');
  assert.deepEqual(findSkills(idx, 'excel', 8, new Set(['tec:a'])).map(s => s.id), ['tec:b']);
  assert.deepEqual(findSkills(idx, 'x'), [], 'two letters to start');
  assert.deepEqual(findSkills(idx, 'zzzz'), []);
});

test('PDF text pieces become lines: end-of-line marks and a jump in height both break the line', () => {
  const items = [{ str: 'Senior', transform: [1, 0, 0, 1, 10, 700] }, { str: ' Accountant', transform: [1, 0, 0, 1, 50, 700], hasEOL: true },
    { str: 'Jan 2019 - Present', transform: [1, 0, 0, 1, 10, 680] }, { str: 'Excel', transform: [1, 0, 0, 1, 10, 660] }, { type: 'beginMarkedContent' }];
  assert.equal(pageText(items), 'Senior Accountant\nJan 2019 - Present\nExcel');
});
