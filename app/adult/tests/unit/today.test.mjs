// "Your job today" and drill helpers (today_model.js). Dates are fixed: nothing here reads the clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageMonths, freshness, cadenceOf, factFreshness, ratingsLine, splitTasks, sortedNeeds, latestSignal, rolesNeeding, skillLabel } from '../../today_model.js';

const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const slice = J('../../dev/fixtures/graph/slices/13-2011.00.json');
const TODAY = '2026-10-30';

test('ageMonths counts a bare year or month as the end of that period', () => {
  assert.equal(ageMonths('2026-10', TODAY), 0); assert.equal(ageMonths('2025-10-01', TODAY), 12);
  assert.equal(ageMonths('2022', TODAY), 46);   // end of 2022 to October 2026
  assert.equal(ageMonths('2030', TODAY), 0, 'a date in the future is not negative');
  assert.equal(ageMonths('soon', TODAY), null); assert.equal(ageMonths('2022-13', TODAY), null);
  assert.equal(ageMonths('2022-08', new Date(Date.UTC(2026, 9, 30))), 50);
});

test('freshness: fresh up to 2x cadence, greyed above 2x, hidden above 3x (SPEC 5.5)', () => {
  const f = age => freshness('2026-10', 12, new Date(Date.UTC(2026, 9 + age, 15))).state;   // asOf end of Oct 2026, age months later
  assert.equal(f(0), 'fresh'); assert.equal(f(24), 'fresh');
  assert.equal(f(25), 'grey'); assert.equal(f(36), 'grey');
  assert.equal(f(37), 'hidden'); assert.equal(f(60), 'hidden');
});

test('freshness with no cadence never greys or hides', () => {
  assert.equal(freshness('2010', null, TODAY).state, 'unknown');
  assert.equal(freshness('2010', 0, TODAY).state, 'unknown');
  assert.equal(freshness('bad', 12, TODAY).state, 'unknown');
});

test('the slice carries no cadence today, so no fact is greyed (reported to the owner)', () => {
  assert.equal(cadenceOf(slice, slice.needs[0].src), null);
  assert.equal(factFreshness(slice, slice.needs[0], TODAY).state, 'unknown');
  const withCadence = { ...slice, sources: slice.sources.map(s => ({ ...s, cadence_months: 12 })) };
  assert.equal(cadenceOf(withCadence, slice.needs[0].src), 12);
  assert.ok(['fresh', 'grey', 'hidden'].includes(factFreshness(withCadence, { as_of: '2019', src: slice.needs[0].src }, TODAY).state));
  assert.equal(factFreshness(withCadence, { as_of: '2019', src: slice.needs[0].src }, TODAY).state, 'hidden');
});

test('ratingsLine uses the occupation ratings, else the needs dates, else says so', () => {
  const o = { occ: { ratings: { oldest: '2021-06', newest: '2024-02' } }, needs: [] };
  assert.equal(ratingsLine(o), 'Skill ratings collected 2021 to 2024 (US)');
  assert.equal(ratingsLine({ occ: { ratings: { oldest: '2022-08', newest: '2022-08' } }, needs: [] }), 'Skill ratings collected in 2022 (US)');
  assert.equal(ratingsLine({ occ: {}, needs: [{ as_of: '2020-01' }, { as_of: '2023' }] }), 'Skill ratings collected 2020 to 2023 (US)');
  assert.match(ratingsLine({ occ: {}, needs: [] }), /not in this data/);
});

test('splitTasks: AI use seen, no AI use seen, and no data are three separate lists', () => {
  const t = splitTasks([{ ai_mode: 'automation' }, { ai_mode: 'augmentation' }, { ai_mode: 'used' }, { ai_mode: 'none' }, { ai_mode: 'unknown' }, { ai_mode: 'none' }]);
  assert.deepEqual([t.used.length, t.none.length, t.unknown.length], [3, 2, 1]);
  assert.deepEqual(splitTasks(null), { used: [], none: [], unknown: [] });
  const real = splitTasks(slice.tasks); assert.equal(real.used.length + real.none.length + real.unknown.length, slice.tasks.length);
});

test('sortedNeeds and latestSignal', () => {
  const n = sortedNeeds(slice); for (let i = 1; i < n.length; i++) assert.ok(n[i - 1].w >= n[i].w);
  assert.equal(latestSignal([{ kind: 'pay_band_in', period: '2023', value: 'a' }, { kind: 'pay_band_in', period: '2024', value: 'b' }, { kind: 'ai_obs', period: '2030', value: 1 }], 'pay_band_in').value, 'b');
  assert.equal(latestSignal([], 'pay_band_in'), null);
});

test('rolesNeeding lists the current job and its targets that need a skill, most important first', () => {
  const id = slice.targets.length ? slice.targets[0].needs[0].id : slice.needs[0].id;
  const r = rolesNeeding(slice, id);
  assert.ok(r.length >= 1);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].w >= r[i].w);
  for (const x of r) assert.ok(x.occ.id.startsWith('occ:'));
  assert.deepEqual(rolesNeeding(slice, 'skl:nope'), []);
  assert.equal(skillLabel(slice, id) !== null, true); assert.equal(skillLabel(slice, 'skl:nope'), null);
  const own = slice.needs[0].id; assert.equal(rolesNeeding(slice, own).some(x => x.current), true);
});
