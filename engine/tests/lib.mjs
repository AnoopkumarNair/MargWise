// Shared helpers: load the engine bundle without a browser and reproduce the app's field scoring.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url'; import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export function loadEngine() { return vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine', 'margwise-engine.js'), 'utf8') + ';Margwise', {}); }
export function loadContent(name = 'content.json') { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8')); }
export const A = ['R', 'I', 'A', 'S', 'E', 'C'];
export function permutations3() { const p = []; for (const x of A) for (const y of A) for (const z of A) if (x !== y && y !== z && x !== z) p.push([x, y, z]); return p; }
export function idealProfiles(M, seedBase) { return permutations3().map((p, i) => { const lv = {}; A.forEach(a => lv[a] = .1); lv[p[0]] = 1; lv[p[1]] = .8; lv[p[2]] = .6; return { target: p, profile: M.journeyResult(M.JOURNEY_BANK, M.playJourney(lv, seedBase + i * 7, M.JOURNEY_BANK, .8, lv)).profile }; }); }
export function rawFieldScores(M, C, profile, K) {
  const ms = M.careerPaths(profile, C.careers.map(c => ({ careerId: c.id, values: c.values }))), by = {}; ms.forEach(m => by[m.careerId] = m.r);
  const o = {}; C.fields.forEach(f => { const v = C.careers.filter(c => c.field === f.id).map(c => by[c.id]).sort((a, b) => b - a); const k = Math.min(K || v.length, v.length); o[f.id] = v.slice(0, k).reduce((a, b) => a + b, 0) / k; }); return o;
}
export function pctOf(tab, x) { const q = tab.length - 1; if (x <= tab[0]) return 0; if (x >= tab[q]) return 1; let i = 0; while (tab[i + 1] < x) i++; return (i + (x - tab[i]) / ((tab[i + 1] - tab[i]) || 1)) / q; }
