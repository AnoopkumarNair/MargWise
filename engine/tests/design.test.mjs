// Design checks on the question bank: balance, coverage, and that no single stop decides the result. Run: node --test engine/tests/design.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { loadEngine, loadContent, A, permutations3, rawFieldScores, pctOf } from './lib.mjs';
const M = loadEngine(), bank = M.JOURNEY_BANK, J = x => JSON.parse(JSON.stringify(x));
const prim = o => Object.entries(o.loads).sort((a, b) => b[1] - a[1])[0];
test('every card has one main load of 1 and one related load of at most 0.5; four different main types per stop', () => {
  for (const s of bank.scenes) { assert.equal(s.options.length, 4); const ps = s.options.map(o => { const e = Object.entries(o.loads).sort((a, b) => b[1] - a[1]); assert.equal(e[0][1], 1); assert.ok(e.length === 2 && e[1][1] <= .5, s.id); return e[0][0]; }); assert.equal(new Set(ps).size, 4, s.id + ' repeats a type'); }
});
test('every type is a main card in at least 8 stops, and every pair of types is contrasted at least twice', () => {
  const cov = {}, pair = {}; A.forEach(a => cov[a] = 0);
  for (const s of bank.scenes) { const t = s.options.map(o => prim(o)[0]); t.forEach(x => cov[x]++); for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const k = [t[i], t[j]].sort().join(''); pair[k] = (pair[k] || 0) + 1; } }
  for (const a of A) assert.ok(cov[a] >= 8, a + ' only in ' + cov[a]);
  for (const x of A) for (const y of A) if (x < y) assert.ok((pair[x + y] || 0) >= 2, x + y);
});
test('no single stop decides the top field: dropping any one stop changes the top field in at most 25% of simulated journeys', () => {
  const C = loadContent(), F = C.fields.map(f => f.id), B = C.fieldBias || {}, perms = permutations3(), K = C.fieldK || 4;
  const rank = prof => { const raw = rawFieldScores(M, C, prof, K); return F.map(f => [f, pctOf(C.fieldRef[f], raw[f]) + .002 * raw[f] + (B[f] || 0)]).sort((a, b) => b[1] - a[1])[0][0]; };
  const chg = {}, n = {};
  for (let i = 0; i < 60; i++) {
    const p = perms[(i * 2) % perms.length], lv = {}; A.forEach(a => lv[a] = .1); lv[p[0]] = 1; lv[p[1]] = .8; lv[p[2]] = .6;
    const ch = J(M.playJourney(lv, 3000 + i * 13, bank, .8, lv)), base = rank(J(M.journeyResult(bank, ch).profile));
    for (const c of ch) { if (c.echoOf) continue; const rest = ch.filter(x => x !== c && x.echoOf !== c.sceneId); if (rest.length < 4) continue; n[c.sceneId] = (n[c.sceneId] || 0) + 1; if (rank(J(M.journeyResult(bank, rest).profile)) !== base) chg[c.sceneId] = (chg[c.sceneId] || 0) + 1; }
  }
  const worst = Math.max(...Object.keys(n).map(k => (chg[k] || 0) / n[k])); console.log('worst single-stop influence on the top field:', worst.toFixed(2));
  assert.ok(worst <= .25, 'a single stop changes the top field in ' + worst.toFixed(2) + ' of journeys');
});
