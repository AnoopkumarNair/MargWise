import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { normaliseRoad, normaliseResult, runMatch, tierFromCoverage, coveragePercent } from '../../matcher_adapter.js';
import { validate } from '../../../../contracts/validate_lib.js';

const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const slice = J('../../dev/fixtures/graph/slices/13-2011.00.json');
const schema = J('../../../../contracts/profile.schema.json');
const top = slice.needs.slice().sort((a, b) => b.w - a.w).slice(0, 25);
const profile = (n, strength = 'used') => ({ v: 1, roles: [{ occ: slice.occ.id, level: 2, industry: 'other', years: '2-5', current: true }],
  skills: top.slice(0, n).map(s => ({ id: s.id, strength })), priorities: { pay: 1, ai_safe: 1, short_move: 1, demand: 1, enjoy: 0 }, job_release: 'dev-unaccepted' });
const real = existsSync(new URL('../../../../matcher/match.js', import.meta.url)) ? (await import('../../../../matcher/match.js')).match : null;

test('tierFromCoverage uses the SPEC 7.3 cut-offs', () => {
  assert.equal(tierFromCoverage(0.7), 'adjacent'); assert.equal(tierFromCoverage(0.699), 'stretch');
  assert.equal(tierFromCoverage(0.4), 'stretch'); assert.equal(tierFromCoverage(0.399), 'leap');
});

test('the coverage percent never contradicts the reach badge (floored, review finding S3)', () => {
  assert.equal(coveragePercent(0.3969), 39); assert.equal(tierFromCoverage(0.3969), 'leap');   // csr-real-near: rounding showed 40% on a Leap
  assert.equal(coveragePercent(0.398), 39); assert.equal(coveragePercent(0.4), 40); assert.equal(coveragePercent(0.6999), 69); assert.equal(coveragePercent(0.7), 70);
  assert.equal(coveragePercent(0.29), 29); assert.equal(coveragePercent(0.57), 57); assert.equal(coveragePercent(1), 100); assert.equal(coveragePercent(0), 0);
  const badgeFromPercent = p => p >= 70 ? 'adjacent' : p >= 40 ? 'stretch' : 'leap';
  for (let i = 0; i <= 10000; i++) { const c = i / 10000; assert.equal(badgeFromPercent(coveragePercent(c)), tierFromCoverage(c), String(c)); }
});

test('the profile the app builds passes contracts/profile.schema.json', () => {
  const r = validate(schema, profile(5)); assert.ok(r.ok, JSON.stringify(r.errors));
});

test('normaliseRoad reads the matcher 1.0.x shape (reach, gap, status)', () => {
  const raw = { id: 'occ:13-2051.00', label: 'Financial and Investment Analysts', reach: 'stretch', coverage: 0.5, score: 0.61, kind: null, flags: [], bridges: null, level: { target: null, fit: null },
    gap: [{ id: 'tec:sql', label: 'SQL database queries', w: 0.4, cover: 0, ai: 'mixed', people_do: false }, { id: 'skl:2.B.1.c', w: 0.2, cover: 0.3, ai: 'people_do', people_do: true }],
    components: { pay: { value: 0.5, norm: 0.5, weight: 1, status: 'not_yet_measured' }, ai_safe: { value: 0.62, norm: 1, weight: 1, status: 'measured' }, short: { value: 0.5, norm: 0, weight: 1, status: 'measured' }, demand: { value: 0.5, norm: 0.5, weight: 1, status: 'not_yet_measured' }, enjoy: { value: 0.5, norm: 0.5, weight: 0, status: 'not_yet_measured' } } };
  const r = normaliseRoad(raw, slice, profile(3));
  assert.equal(r.tier, 'stretch'); assert.equal(r.move, null); assert.deepEqual(r.bridges, []); assert.equal(r.fit, null);
  assert.equal(r.gaps.length, 2); assert.equal(r.gaps[0].label, 'SQL database queries');
  assert.match(r.gaps[0].reason, /did not tick/); assert.match(r.gaps[1].reason, /30%.*People still do this/);
  assert.equal(r.gaps[1].label, 'Persuasion'); // label filled from the target's needs
  const byKey = Object.fromEntries(r.components.map(c => [c.key, c]));
  assert.equal(byKey.pay.measured, false); assert.equal(byKey.ai_safe.measured, true); assert.equal(byKey.short_move.value, 0.5); assert.equal(byKey.demand.measured, false);
  assert.equal(r.signals.pay.value.startsWith('PLFS'), true); assert.equal(r.signals.demand, null); assert.equal(r.signals.ai.value, 0.38);
});

test('normaliseRoad reads flags, kind, bridges and fit in the result.schema.json shape', () => {
  const r = normaliseRoad({ id: 'occ:13-2051.00', reach: 'adjacent', coverage: 0.8, gap: [], kind: 'up', level: { target: 3, fit: 'in' }, flags: ['needs_relocation'], bridges: ['cred:x'], components: {}, score: 0.7 }, slice, profile(3));
  assert.equal(r.tier, 'adjacent'); assert.equal(r.move, 'up'); assert.equal(r.fit, 'in'); assert.deepEqual(r.bridges, [{ label: 'cred:x' }]);
  assert.match(r.flags[0].text, /move to another city/);
  assert.ok(r.components.every(c => c.measured === false && c.value === null));   // no component given: nothing is measured
});

test('without a reach the tier comes from coverage', () => {
  const r = normaliseRoad({ id: 'occ:13-2051.00', kind: null, coverage: 0.45, gap: [], components: {}, score: 0 }, slice, profile(3));
  assert.equal(r.move, null); assert.equal(r.tier, 'stretch');
});

test('normaliseResult keeps a steady order: score, then coverage, then id', () => {
  const a = { id: 'occ:b', coverage: 0.5, score: 0.5 }, b = { id: 'occ:a', coverage: 0.5, score: 0.5 }, c = { id: 'occ:c', coverage: 0.9, score: 0.9 };
  const r = normaliseResult({ version: '1.0.1', roads: [a, b, c] }, slice, profile(1));
  assert.deepEqual(r.roads.map(x => x.id), ['occ:c', 'occ:a', 'occ:b']);
});

test('a missing signal is null, never zero', () => {
  const r = normaliseRoad({ id: 'occ:15-2051.00', reach: 'leap', coverage: 0.1, gap: [], components: {}, score: 0 }, slice, profile(1));
  assert.equal(r.signals.demand, null); assert.equal(r.signals.pay, null);
});

test('real matcher: runs on the fixture slice and is deterministic', { skip: !real }, () => {
  const a = runMatch(real, profile(10), slice), b = runMatch(real, profile(10), slice);
  assert.deepEqual(a, b);
  assert.ok(a.roads.length >= 5); assert.match(a.version, /^\d+\.\d+\.\d+$/);
  for (const r of a.roads) { assert.ok(r.coverage >= 0 && r.coverage <= 1); assert.ok(['adjacent', 'stretch', 'leap'].includes(r.tier)); }
});

test('real matcher: more ticked skills never lower coverage', { skip: !real }, () => {
  const lo = runMatch(real, profile(5), slice), hi = runMatch(real, profile(20), slice);
  for (const r of lo.roads) assert.ok(hi.roads.find(x => x.id === r.id).coverage >= r.coverage);
});

test('real matcher: priorities move the order but not the coverage', { skip: !real }, () => {
  const p1 = profile(8), p2 = profile(8); p1.priorities = { pay: 0, ai_safe: 5, short_move: 0, demand: 0, enjoy: 0 }; p2.priorities = { pay: 0, ai_safe: 0, short_move: 5, demand: 0, enjoy: 0 };
  const a = runMatch(real, p1, slice), b = runMatch(real, p2, slice);
  assert.notDeepEqual(a.roads.map(r => r.id), b.roads.map(r => r.id));
  for (const r of a.roads) assert.equal(b.roads.find(x => x.id === r.id).coverage, r.coverage);
});
