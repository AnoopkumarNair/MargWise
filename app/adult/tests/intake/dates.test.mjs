// Date patterns and the year (intake/roles.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDateRange, yearOf } from '../../intake/roles.js';

const NOW = 2026;
const r = line => parseDateRange(line, NOW);
const pick = x => x && ({ s: x.startYear, sm: x.startMonth, e: x.endYear, em: x.endMonth, cur: x.current });

test('the five formats from the build plan', () => {
  assert.deepEqual(pick(r('Jan 2019 - Mar 2023')), { s: 2019, sm: 1, e: 2023, em: 3, cur: false });
  assert.deepEqual(pick(r('2019-2023')), { s: 2019, sm: null, e: 2023, em: null, cur: false });
  assert.deepEqual(pick(r('06/2019 - present')), { s: 2019, sm: 6, e: NOW, em: null, cur: true });
  assert.deepEqual(pick(r('2019 – Till date')), { s: 2019, sm: null, e: NOW, em: null, cur: true });
  assert.deepEqual(pick(r('Since 2021')), { s: 2021, sm: null, e: NOW, em: null, cur: true });
});

test('more shapes seen on real resumes', () => {
  const cases = [
    ['2019 – Present', { s: 2019, sm: null, e: NOW, em: null, cur: true }],
    ['2019 - present', { s: 2019, sm: null, e: NOW, em: null, cur: true }],
    ['06/2019', null],
    ['06/2019 - 03/2023', { s: 2019, sm: 6, e: 2023, em: 3, cur: false }],
    ['6/2019 – 12/2021', { s: 2019, sm: 6, e: 2021, em: 12, cur: false }],
    ['June 2019 to March 2023', { s: 2019, sm: 6, e: 2023, em: 3, cur: false }],
    ['Sept 2018 - Sept 2020', { s: 2018, sm: 9, e: 2020, em: 9, cur: false }],
    ['January, 2019 – present', { s: 2019, sm: 1, e: NOW, em: null, cur: true }],
    ["Jan'19 - Mar'23", { s: 2019, sm: 1, e: 2023, em: 3, cur: false }],
    ['2019-23', { s: 2019, sm: null, e: 2023, em: null, cur: false }],
    ['2012-15', { s: 2012, sm: null, e: 2015, em: null, cur: false }],
    ['2019 to 2023', { s: 2019, sm: null, e: 2023, em: null, cur: false }],
    ['2019 — 2023', { s: 2019, sm: null, e: 2023, em: null, cur: false }],
    ['Mar 2021 - Currently', { s: 2021, sm: 3, e: NOW, em: null, cur: true }],
    ['Aug 2020 – Till date', { s: 2020, sm: 8, e: NOW, em: null, cur: true }],
    ['2018 - till now', { s: 2018, sm: null, e: NOW, em: null, cur: true }],
    ['Since Jan 2021', { s: 2021, sm: 1, e: NOW, em: null, cur: true }],
    ['w.e.f. 2020', { s: 2020, sm: null, e: NOW, em: null, cur: true }],
    ['2020 - वर्तमान', { s: 2020, sm: null, e: NOW, em: null, cur: true }],
    ['Senior Analyst | Acme Ltd | Jan 2019 - Mar 2023 | Pune', { s: 2019, sm: 1, e: 2023, em: 3, cur: false }],
    ['January 2021 - Present (5 years 10 months)', { s: 2021, sm: 1, e: NOW, em: null, cur: true }],
  ];
  for (const [line, want] of cases) assert.deepEqual(pick(r(line)), want, line);
});

test('things that look like dates but are not a role period', () => {
  for (const line of ['12/08/1996', 'Date of Birth: 12-08-1996', '+91 98765 43210', 'Aadhaar 2345 6789 0123', 'PAN ABCDE1234F', 'Project 2019', 'Released in 2019',
    '2023 - 2019', '1850 - 1900', '2035 - 2040', 'Score 2019/2023', 'v2.2019.2023'])
    assert.equal(r(line), null, line);
});

test('the span: index and length point at the range inside the line', () => {
  const line = 'Analyst | Acme | Jan 2019 - Mar 2023 | Pune';
  const x = r(line);
  assert.equal(line.slice(x.index, x.index + x.length), 'Jan 2019 - Mar 2023');
});

test('"now" is passed in: year, Date, ISO string, or {year}', () => {
  assert.equal(yearOf(2026), 2026);
  assert.equal(yearOf(new Date(Date.UTC(2031, 5, 1, 12))), 2031);
  assert.equal(yearOf('2027-03-04'), 2027);
  assert.equal(yearOf({ year: 2028 }), 2028);
  assert.throws(() => yearOf(undefined));
  assert.throws(() => yearOf('soon'));
  assert.equal(parseDateRange('2019 - present', 2030).endYear, 2030, 'the end of a current role follows `now`');
});

test('no module in intake/ reads the clock', () => {
  for (const f of ['roles.js', 'read.js', 'match_dict.js', 'ambiguous.js', 'lines.js']) {
    const src = readFileSync(new URL('../../intake/' + f, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/new Date\s*\(\s*\)|Date\.now|performance\.now|Math\.random/.test(src), f + ' reads the clock or random');
    assert.ok(!/innerHTML|fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon/.test(src), f + ' touches the DOM, storage or the network');
  }
});
