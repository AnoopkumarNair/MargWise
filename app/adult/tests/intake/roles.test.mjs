// Role blocks and title -> occupation (intake/roles.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitRoles, occCandidates } from '../../intake/roles.js';
import { splitLines, sectionMap, headingKind } from '../../intake/lines.js';
import { loadGraph } from '../lib/graph.mjs';

const { titles, occupations } = loadGraph();
const NOW = 2026;
function roles(text) {
  const lines = splitLines(text);
  return splitRoles(lines, { titles, nowYear: NOW, sections: sectionMap(lines), occupations });
}
const brief = rs => rs.map(r => [r.titleText, r.startYear, r.endYear, r.current]);

test('title and company on the date line', () => {
  const rs = roles('Experience\nSenior Data Analyst | Acme Pvt Ltd | Jan 2019 - Mar 2023\n- did things\nData Analyst | Beta | 2016-2018\n- more');
  assert.deepEqual(brief(rs), [['Senior Data Analyst', 2019, 2023, false], ['Data Analyst', 2016, 2018, false]]);
});

test('title above the company above the date, and company above the title', () => {
  const a = roles('Experience\nSoftware Engineer\nAcme Pvt Ltd, Pune\n2019 - 2022\n- x\nAccountant\nBeta Traders\n2015 - 2019');
  assert.deepEqual(brief(a), [['Software Engineer', 2019, 2022, false], ['Accountant', 2015, 2019, false]]);
  const b = roles('Experience\nAcme Pvt Ltd\nSoftware Engineer\nJanuary 2019 - Present (7 years)\nPune\n- x');
  assert.deepEqual(brief(b), [['Software Engineer', 2019, NOW, true]]);
});

test('each block runs to the next block or the next heading', () => {
  const lines = splitLines('Experience\nAnalyst | A | 2020 - 2022\n- a1\n- a2\nManager | B | 2022 - Present\n- b1\nEducation\nB.Tech | 2014 - 2018');
  const rs = splitRoles(lines, { titles, nowYear: NOW, sections: sectionMap(lines) });
  assert.equal(rs.length, 2, 'education is not a role');
  assert.deepEqual(rs.map(r => [r.lines.from, r.lines.to]), [[1, 3], [4, 5]]);
});

test('a current role ends in the year passed in, never in the clock', () => {
  const rs = roles('Experience\nAnalyst | A | 2020 - Present');
  assert.equal(rs[0].endYear, NOW);
  const lines = splitLines('Experience\nAnalyst | A | 2020 - Present');
  const later = splitRoles(lines, { titles, nowYear: 2031, sections: sectionMap(lines) });
  assert.equal(later[0].endYear, 2031);
  assert.equal(later[0].current, true);
});

test('study dates are not roles, with or without headings', () => {
  assert.equal(roles('Education\nB.Tech, Computer Science, Some College, 2011 - 2015').length, 0);
  assert.equal(roles('Software Engineer, Acme (2019 - 2022)\nStudied B.Sc. Computer Science at Some College, 2013-2016.').length, 1);
  assert.equal(roles('Born in 1990. Date of birth 12/08/1996.').length, 0);
});

test('headings in two languages', () => {
  assert.equal(headingKind('अनुभव (Experience)'), 'experience');
  assert.equal(headingKind('WORK EXPERIENCE'), 'experience');
  assert.equal(headingKind('Professional Experience:'), 'experience');
  assert.equal(headingKind('Skills'), 'skills');
  assert.equal(headingKind('I have experience in sales'), null);
});

test('occupation candidates: exact title first, then level variants, at most 3', () => {
  const exact = occCandidates(titles, 'Software Engineer', occupations);
  assert.equal(exact[0].occ, 'occ:15-1252.00');
  assert.ok(exact.length <= 3);
  for (const t of ['Sr. Software Engineer', 'Software Engineer II', 'Software Engineer - II', 'Associate Software Engineer', 'Software Engineer (Trainee)', 'SDE', 'Senior Software Developer', 'Software Engineer L3']) {
    const c = occCandidates(titles, t, occupations);
    assert.ok(c.length >= 1 && c.length <= 3, t);
    assert.ok(c.some(x => x.occ === 'occ:15-1252.00'), t + ' -> ' + c.map(x => x.occ));
  }
  assert.equal(occCandidates(titles, 'Sr Accountant', occupations)[0].occ, 'occ:13-2011.00');
  assert.equal(occCandidates(titles, 'Customer Support Executive', occupations)[0].occ, 'occ:43-4051.00');
  assert.equal(occCandidates(titles, 'Quality Analyst', occupations)[0].occ, 'occ:15-1253.00');
});

test('every candidate has an id and a label; ranked, no duplicates', () => {
  for (const t of ['Data Analyst', 'Business Analyst', 'Team Lead', 'Process Associate', 'Nurse']) {
    const c = occCandidates(titles, t, occupations);
    assert.ok(c.length >= 1 && c.length <= 3, t);
    assert.equal(new Set(c.map(x => x.occ)).size, c.length);
    for (const x of c) { assert.match(x.occ, /^occ:/); assert.ok(x.label && typeof x.label === 'string'); }
  }
});

test('without an occupations list the label is the matched title', () => {
  const c = occCandidates(titles, 'Software Engineer');
  assert.equal(c[0].label, 'Software Engineer');
});

test('nothing sensible gives an empty list, and the same input gives the same list', () => {
  assert.deepEqual(occCandidates(titles, ''), []);
  assert.deepEqual(occCandidates(titles, 'zzqx vwk'), []);
  assert.deepEqual(occCandidates(titles, 'Data Analyst', occupations), occCandidates(titles, 'Data Analyst', occupations));
});
