// Fits one additive offset per field so that, across ideal-profile journeys, every field wins about its fair share.
// Fitted on seeds 4000 and 5000; held-out seeds 100 and 7777 are checked in engine.test.mjs. Writes data/fieldbias.json (keyed to content.fieldRefKey).
import fs from 'fs'; import path from 'path'; import { loadEngine, loadContent, idealProfiles, rawFieldScores, pctOf, ROOT } from './lib.mjs';
const M = loadEngine(), C = loadContent(), J = x => JSON.parse(JSON.stringify(x)), F = C.fields.map(f => f.id), K = C.fieldK || 4;
const ps = [4000, 5000].flatMap(sb => idealProfiles(M, sb).map(p => J(p.profile)));
const base = ps.map(p => { const raw = rawFieldScores(M, C, p, K), o = {}; F.forEach(f => o[f] = pctOf(C.fieldRef[f], raw[f]) + .002 * raw[f]); return o; });
const off = {}; F.forEach(f => off[f] = 0); const fair = ps.length / F.length;
for (let it = 0; it < 300; it++) { const w = {}; F.forEach(f => w[f] = 0); for (const s of base) { let b, bs = -9; for (const f of F) { const v = s[f] + off[f]; if (v > bs) { bs = v; b = f; } } w[b]++; } F.forEach(f => off[f] -= .004 * (w[f] - fair) / fair); }
for (const f of F) off[f] = Math.round(off[f] * 1000) / 1000;
fs.writeFileSync(path.join(ROOT, 'data', 'fieldbias.json'), JSON.stringify({ key: C.fieldRefKey, bias: off }, null, 1)); console.log('fieldbias written', JSON.stringify(off));
