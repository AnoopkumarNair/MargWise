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
    for (let k = 0; k <= j.choices.length; k++) { const s = J(M.step(M.JOURNEY_BANK, j.choices.slice(0, k))); assert.equal(s.done, j.steps[k].done); assert.equal(s.draft, j.steps[k].draft); assert.deepEqual(J(M.walkStatus(M.JOURNEY_BANK, j.choices.slice(0, k))), j.steps[k].status); assert.equal(s.scene ? s.scene.id : null, j.steps[k].scene); }
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
// With the fitted per-field offsets (data/fieldbias.json), held-out seeds give a top field at about 1.2-1.6x fair share and no field at zero.
test('field ranking benchmark: no field dominates or vanishes across the 120 ordered profiles', () => {
  const C = loadContent(), K = C.fieldK || 4, tab = C.fieldRef, B = C.fieldBias || {}, wins = {}; C.fields.forEach(f => wins[f.id] = 0);
  const ps = idealProfiles(M, 7777).map(p => ({ profile: J(p.profile) })); assert.equal(ps.length, 120);
  for (const p of ps) { const raw = rawFieldScores(M, C, p.profile, K); let best = null, bs = -1; for (const f of C.fields) { const s = pctOf(tab[f.id], raw[f.id]) + .002 * raw[f.id] + (B[f.id] || 0); if (s > bs) { bs = s; best = f.id; } } wins[best]++; }
  const fair = 120 / C.fields.length, ratios = Object.values(wins).map(w => w / fair);
  assert.ok(Math.max(...ratios) <= 1.9, 'a field wins too often: ' + JSON.stringify(wins));
  const never = Object.entries(wins).filter(([, w]) => w < 1).map(([k]) => k);
  assert.ok(never.length <= 1, 'fields that never rank first: ' + never.join(','));
});

// ---- journey-v2: no second look, draft at 8, optional sharpen ----
const TYPES = ['R', 'I', 'A', 'S', 'E', 'C'];
const mainOf = s => s.options.map(o => Object.entries(o.loads).sort((a, b) => b[1] - a[1])[0][0]);
const levelsRand = seed => { let t = seed >>> 0; const r = () => { t = (t + 1831565813) >>> 0; let e = t; e = Math.imul(e ^ (e >>> 15), e | 1); e ^= e + Math.imul(e ^ (e >>> 7), e | 61); return ((e ^ (e >>> 14)) >>> 0) / 4294967296; }; const lv = {}; TYPES.forEach(a => lv[a] = r()); return lv; };
test('v2: the engine never asks a scene twice and has no echo or consistency flag', () => {
  assert.equal(M.ENGINE_VERSION, 'journey-v2-draft'); assert.ok(!('echoAfter' in M.CONFIG) && !('minStops' in M.CONFIG));
  for (let i = 0; i < 60; i++) {
    const ch = M.playJourney(levelsRand(i + 1), 7000 + i, M.JOURNEY_BANK, .8), ids = ch.map(c => c.sceneId);
    assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(x => !x.includes('~echo')) && ch.every(c => c.echoOf === undefined));
    for (let k = 0; k <= ch.length; k++) assert.ok(!('echo' in M.step(M.JOURNEY_BANK, ch.slice(0, k))));
    const r = M.journeyResult(M.JOURNEY_BANK, ch); assert.ok(!('consistency' in r)); assert.equal(r.stopsPlayed, ch.length);
  }
});
test('v2: the draft is ready exactly at 8 stops, and never earlier or the walk ends before it', () => {
  for (let i = 0; i < 60; i++) {
    const ch = M.playJourney(levelsRand(i + 100), 8000 + i, M.JOURNEY_BANK, .8); assert.ok(ch.length >= 8);
    for (let k = 0; k <= ch.length; k++) {
      const part = ch.slice(0, k), st = J(M.walkStatus(M.JOURNEY_BANK, part));
      assert.equal(M.draftReady(M.JOURNEY_BANK, part), k >= 8); assert.equal(st.draftReady, k >= 8); assert.equal(M.step(M.JOURNEY_BANK, part).draft, k >= 8);
      if (k < 8) assert.ok(!M.isDone(M.JOURNEY_BANK, part)); assert.equal(M.isDone(M.JOURNEY_BANK, part), st.done);
    }
    assert.ok(M.isDone(M.JOURNEY_BANK, ch) && ch.length <= 15);
  }
});
test('v2: each of the 6 types is a main card in at least 4 of the first 8 stops, whatever the student taps', () => {
  for (let i = 0; i < 80; i++) {
    const ch = i < 60 ? M.playJourney(levelsRand(i + 500), 9000 + i, M.JOURNEY_BANK, .8) : (() => { const c = []; for (let g = 0; g < 8; g++) { const s = M.step(M.JOURNEY_BANK, c); const o = s.scene.options[(i + g) % 4]; c.push({ sceneId: s.scene.id, spent: i % 2 ? {} : { [o.id]: 2 } }); } return c; })();
    const n = Object.fromEntries(TYPES.map(a => [a, 0])); for (const c of ch.slice(0, 8)) mainOf(M.JOURNEY_BANK.scenes.find(s => s.id === c.sceneId)).forEach(t => n[t]++);
    for (const a of TYPES) assert.ok(n[a] >= 4, `walk ${i}: ${a} is a main card in only ${n[a]} of 8`);
  }
});
test('v2: deterministic, and a draft uses the same scoring as the full result', () => {
  const lv = levelsRand(42), a = M.playJourney(lv, 77, M.JOURNEY_BANK, .8), b = M.playJourney(lv, 77, M.JOURNEY_BANK, .8); assert.deepEqual(a, b);
  for (let k = 0; k <= a.length; k++) assert.deepEqual(J(M.step(M.JOURNEY_BANK, a.slice(0, k))), J(M.step(M.JOURNEY_BANK, a.slice(0, k))));
  const draft = a.slice(0, 8), r1 = J(M.journeyResult(M.JOURNEY_BANK, draft)), r2 = J(M.journeyResult(M.JOURNEY_BANK, draft)); assert.deepEqual(r1, r2); assert.equal(r1.stopsPlayed, 8);
  assert.ok(!('tally' in M.walkStatus(M.JOURNEY_BANK, draft)) && !('theta' in M.walkStatus(M.JOURNEY_BANK, draft)));
});
test('v2: old saved walks that contain second-look entries are scored as if the repeats were not there', () => {
  const ch = M.playJourney(levelsRand(9), 31, M.JOURNEY_BANK, .8).slice(0, 8), withEcho = [...ch, { sceneId: ch[0].sceneId + '~echo', echoOf: ch[0].sceneId, spent: {} }];
  assert.deepEqual(J(M.journeyResult(M.JOURNEY_BANK, withEcho)), J(M.journeyResult(M.JOURNEY_BANK, ch)));
});
