// Regenerates golden.json from the shipped bundle. Run only when the engine is changed on purpose.
import fs from 'fs'; import { loadEngine, loadContent, A, permutations3, ROOT } from './lib.mjs'; import path from 'path';
const M = loadEngine(), bank = M.JOURNEY_BANK, C = loadContent();
const out = { engineVersion: bank.version, bank: bank.scenes.map(s => ({ id: s.id, options: s.options.map(o => ({ id: o.id, loads: o.loads })) })), journeys: [], careers: [], display: [] };
function mulberry(seed) { let t = seed >>> 0; return () => { t = (t + 1831565813) >>> 0; let e = t; e = Math.imul(e ^ (e >>> 15), e | 1); e ^= e + Math.imul(e ^ (e >>> 7), e | 61); return ((e ^ (e >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry(2026);
const perms = permutations3(); const journeys = [];
for (let i = 0; i < 40; i++) { const p = perms[(i * 7) % perms.length], lv = {}; A.forEach(a => lv[a] = .1); lv[p[0]] = 1; lv[p[1]] = .8; lv[p[2]] = .6; journeys.push({ kind: 'consistent', choices: M.playJourney(lv, 500 + i, bank, .8, lv) }); }
for (let i = 0; i < 20; i++) { const lv = {}; A.forEach(a => lv[a] = rnd()); journeys.push({ kind: 'random-levels', choices: M.playJourney(lv, 900 + i, bank, .8, lv) }); }
for (let i = 0; i < 20; i++) { let ch = [], g = 0; while (g++ < 40) { const s = M.step(bank, ch); if (s.done) break; const ids = s.scene.options.map(o => o.id), sp = {}; const a = ids.slice().sort(() => rnd() - .5); sp[a[0]] = 1; if (rnd() < .6) sp[a[1]] = 1; ch.push(s.echo ? { sceneId: s.scene.id + '~echo', echoOf: s.scene.id, spent: sp } : { sceneId: s.scene.id, spent: sp }); } journeys.push({ kind: 'random-taps', choices: ch }); }
journeys.push({ kind: 'spend-nothing', choices: (() => { let ch = [], g = 0; while (g++ < 40) { const s = M.step(bank, ch); if (s.done) break; ch.push(s.echo ? { sceneId: s.scene.id + '~echo', echoOf: s.scene.id, spent: {} } : { sceneId: s.scene.id, spent: {} }); } return ch; })() });
for (const j of journeys) {
  const steps = []; for (let k = 0; k <= j.choices.length; k++) { const s = M.step(bank, j.choices.slice(0, k)); steps.push({ done: s.done, echo: s.echo, scene: s.scene ? s.scene.id : null }); }
  const r = M.journeyResult(bank, j.choices);
  out.journeys.push({ kind: j.kind, choices: j.choices, steps, result: { profile: r.profile, scores: r.scores, code: r.code.code, alternatives: r.code.alternatives, confidence: r.confidence, lowEngagement: r.lowEngagement, stopsPlayed: r.stopsPlayed, consistency: r.consistency } });
}
for (let i = 0; i < 30; i++) { const prof = {}; A.forEach(a => prof[a] = (rnd() - .5) * 4); const cs = C.careers.slice(i, i + 12).map(c => ({ careerId: c.id, values: c.values })); out.careers.push({ profile: prof, careers: cs, fit: M.careerPaths(prof, cs).map(x => ({ careerId: x.careerId, r: x.r })) }); }
for (const s of bank.scenes) for (const seed of [0, 1, 12345, 999999]) out.display.push({ scene: s.id, seed, order: M.displayOptions(bank.scenes.find(x => x.id === s.id), seed).map(o => o.id) });
fs.writeFileSync(path.join(ROOT, 'engine', 'tests', 'golden.json'), JSON.stringify(out)); console.log('golden:', out.journeys.length, 'journeys,', out.careers.length, 'career sets,', out.display.length, 'display orders');
