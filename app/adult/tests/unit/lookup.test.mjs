// node --test app/adult/tests/unit/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalise, lookupTitle, suggestTitles, searchOccupations, findOccupations } from '../../lookup.js';

const fx = f => JSON.parse(readFileSync(new URL('../../dev/fixtures/graph/' + f, import.meta.url), 'utf8'));
const titles = fx('titles.json');
const occs = [
  { id: 'occ:13-2011.00', label: 'Accountants and Auditors', alt: ['Chartered Accountant'], slice: 'slices/13-2011.00.json' },
  { id: 'occ:15-1252.00', label: 'Software Developers', alt: ['Software Engineer'], slice: 'slices/15-1252.00.json' },
  { id: 'occ:15-2051.00', label: 'Data Scientists', alt: [], slice: null },
  { id: 'occ:11-3031.00', label: 'Financial Managers', alt: ['Controller'], slice: null },
  { id: 'occ:29-1141.00', label: 'Registered Nurses', alt: [], slice: null },
];

test('normalise: case, accents, punctuation, ampersand', () => {
  assert.equal(normalise('  Sr.  Software-Engineer  '), 'sr software engineer');
  assert.equal(normalise('Café & Bar'), 'cafe and bar');
  assert.equal(normalise('C++ / C# Developer'), 'c++ c# developer');
  assert.equal(normalise(null), '');
});

test('lookupTitle: exact match on the normalised title', () => {
  assert.deepEqual(lookupTitle(titles, 'Chartered  Accountant'), ['occ:13-2011.00']);
  assert.deepEqual(lookupTitle(titles, 'data analyst'), ['occ:15-2051.00', 'occ:15-2051.01']);
  assert.deepEqual(lookupTitle(titles, 'astronaut'), []);
  assert.deepEqual(lookupTitle(titles, ''), []);
  assert.deepEqual(lookupTitle(null, 'x'), []);
});

test('lookupTitle returns a copy', () => {
  const a = lookupTitle(titles, 'accountant'); a.push('x');
  assert.deepEqual(titles.accountant, ['occ:13-2011.00']);
});

test('suggestTitles: prefix first, then all words, shortest first', () => {
  const s = suggestTitles(titles, 'soft').map(x => x.title);
  assert.deepEqual(s, ['software engineer', 'software developer']);
  const w = suggestTitles(titles, 'engineer software').map(x => x.title);
  assert.ok(w.includes('software engineer'));
  assert.deepEqual(suggestTitles(titles, 'a'), []); // too short
});

test('suggestTitles: plural typed, singular stored', () => {
  assert.ok(suggestTitles(titles, 'accountants').some(x => x.title === 'accountant'));
});

test('searchOccupations: label, alt name, partial words; ranks the label first', () => {
  assert.equal(searchOccupations(occs, 'nurse')[0].id, 'occ:29-1141.00');
  assert.equal(searchOccupations(occs, 'controller')[0].id, 'occ:11-3031.00');
  assert.equal(searchOccupations(occs, 'financial')[0].id, 'occ:11-3031.00');
  assert.equal(searchOccupations(occs, 'data scientist')[0].id, 'occ:15-2051.00');
  assert.deepEqual(searchOccupations(occs, 'zzzz'), []);
  assert.deepEqual(searchOccupations(occs, ''), []);
});

test('findOccupations: title lookup first, then close titles, then label search', () => {
  const exact = findOccupations(titles, occs, 'Accountant');
  assert.equal(exact.source, 'title'); assert.equal(exact.exact, true);
  assert.deepEqual(exact.items.map(o => o.id), ['occ:13-2011.00']);
  const close = findOccupations(titles, occs, 'software');
  assert.equal(close.source, 'title'); assert.equal(close.exact, false);
  assert.deepEqual(close.items.map(o => o.id), ['occ:15-1252.00']);
  const fallback = findOccupations(titles, occs, 'registered nurse');
  assert.equal(fallback.source, 'label');
  assert.deepEqual(fallback.items.map(o => o.id), ['occ:29-1141.00']);
  const none = findOccupations(titles, occs, 'qwertyuiop');
  assert.equal(none.source, 'none'); assert.deepEqual(none.items, []);
});

test('findOccupations: a title that points at an unknown occupation id is dropped', () => {
  const r = findOccupations({ ghost: ['occ:99-9999.00'] }, occs, 'ghost');
  assert.deepEqual(r.items, []);
});

test('findOccupations: hostile input is only ever compared, never evaluated', () => {
  for (const t of ['<img src=x onerror=alert(1)>', '__proto__', 'constructor', "'; DROP TABLE x;--"]) {
    const r = findOccupations(titles, occs, t);
    assert.ok(Array.isArray(r.items));
  }
});
