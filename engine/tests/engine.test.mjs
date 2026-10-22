// Run: node --test engine/tests/
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'fs'; import path from 'path';
import { loadEngine, loadContent, ROOT, idealProfiles, rawFieldScores, pctOf } from './lib.mjs';
const M = loadEngine(), G = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine', 'tests', 'golden.json'), 'utf8'));
const J = x => JSON.parse(JSON.stringify(x));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('bank matches the golden file (scene and option loads unchanged)', () => {
  assert.equal(M.JOURNEY_BANK.version, G.engineVersion);
  assert.deepEqual(J(M.JOURNEY_BANK.scenes).map(s => ({ id: s.id, options: s.options.map(o => ({ id: o.id, loads: o.loads })) })), G.bank);
});
test('journeys reproduce golden results and step sequence', () => {
  for (const j of G.journeys) {
    for (let k = 0; k <= j.choices.length; k++) { const s = J(M.step(M.JOURNEY_BANK, j.choices.slice(0, k))); assert.equal(s.done, j.steps[k].done); assert.equal(!!s.echo, !!j.steps[k].echo); assert.equal(s.scene ? s.scene.id : null, j.steps[k].scene); }
    const r = J(M.journeyResult(M.JOURNEY_BANK, j.choices));
    for (const a of Object.keys(j.result.profile)) near(r.profile[a], j.result.profile[a]);
    for (const a of Object.keys(j.result.scores)) near(r.scores[a], j.result.scores[a]);
    assert.deepEqual(r.code.code, j.result.code); assert.equal(r.confidence, j.result.confidence); assert.equal(r.lowEngagement, j.result.lowEngagement);
  }
});
test('career fit reproduces golden correlations', () => {
  for (const g of G.careers) { const got = J(M.careerPaths(g.profile, g.careers)); assert.deepEqual(got.map(x => x.careerId), g.fit.map(x => x.careerId)); got.forEach((x, i) => near(x.r, g.fit[i].r)); }
});
test('display order is a seeded permutation and matches golden', () => {
  for (const d of G.display) {
    const sc = M.JOURNEY_BANK.scenes.find(s => s.id === d.scene), o = J(M.displayOptions(sc, d.seed)).map(x => x.id);
    assert.deepEqual(o, d.order); assert.deepEqual(o.slice().sort(), J(sc.options).map(x => x.id).sort());
    assert.deepEqual(J(M.displayOptions(sc, d.seed)).map(x => x.id), o);
  }
});
test('determinism: same choices give identical results', () => {
  const j = G.journeys[3]; assert.deepEqual(J(M.journeyResult(M.JOURNEY_BANK, j.choices)), J(M.journeyResult(M.JOURNEY_BANK, j.choices)));
});
test('spend-nothing journey is flagged as no signal / low engagement, never a confident result', () => {
  const j = G.journeys.find(x => x.kind === 'spend-nothing'), r = M.journeyResult(M.JOURNEY_BANK, j.choices);
  assert.ok(r.lowEngagement || r.confidence === 'low' || r.noSignal, JSON.stringify({ c: r.confidence, l: r.lowEngagement }));
});
test('scores stay in 0..40', () => { for (const j of G.journeys) for (const v of Object.values(M.journeyResult(M.JOURNEY_BANK, j.choices).scores)) assert.ok(v >= 0 && v <= 40); });

// Regression guard on field ranking. Measured today (seeds 4000/100/7777): the top field wins 2.3-2.5x its fair share of the 120 profiles;
// one or two fields (science) almost never rank first. Thresholds sit just above that so it cannot silently get worse. The skew is structural (more A/S-trait fields) and documented in docs/CALIBRATION.md;
// this test stops it getting worse unnoticed and checks the shipped reference tables are not stale.
test('field ranking benchmark: no field dominates or vanishes across the 120 ordered profiles', () => {
  const C = loadContent(), K = C.fieldK || 4, tab = C.fieldRef, wins = {}; C.fields.forEach(f => wins[f.id] = 0);
  const ps = idealProfiles(M, 4000).map(p => ({ profile: J(p.profile) })); assert.equal(ps.length, 120);
  for (const p of ps) { const raw = rawFieldScores(M, C, p.profile, K); let best = null, bs = -1; for (const f of C.fields) { const s = pctOf(tab[f.id], raw[f.id]) + .002 * raw[f.id]; if (s > bs) { bs = s; best = f.id; } } wins[best]++; }
  const fair = 120 / C.fields.length, ratios = Object.values(wins).map(w => w / fair);
  assert.ok(Math.max(...ratios) <= 2.8, 'a field wins too often: ' + JSON.stringify(wins));
  const never = Object.entries(wins).filter(([, w]) => w < 2).map(([k]) => k);
  assert.ok(never.length <= 3, 'fields that never rank first: ' + never.join(','));
});
