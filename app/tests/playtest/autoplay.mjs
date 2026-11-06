// Automated loop over the play daemon: node autoplay.mjs <port>  (daemon must be at the intro; plays to the doors screen)
import http from 'http'; import fs from 'fs'; import path from 'path';
const port = +process.argv[2]; const SCR = process.env.PLAYTEST_OUT || path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
const call = (cmd, ...args) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, method: 'POST' }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res(d)); }); r.on('error', rej); r.end(JSON.stringify({ cmd, args })); });
const last = () => { const j = JSON.parse(fs.readFileSync(`${SCR}/runs/${port}/log.json`)); return j.entries.at(-1); };
let lockSel = false, stopKey = '', clicked = 0, picks = 0, lockN = 0, guard = 0, prev = '';
if (process.argv[3] === 'signup') for (const a of [['click', '#gStart'], ['fill', '#gName', 'Asha'], ['fill', '#gCode', 'master'], ['check', '#gOk'], ['click', '#gGo'], ['click', '#consentYes'], ['click', '#csDone'], ['click', '#begin']]) await call(...a);
while (guard++ < 400) {
  await call('look'); const e = last(); const has = id => e.choices.find(c => c.sel === id && !c.disabled);
  if (e.screen !== prev) { console.log(`#${e.n} ${e.screen} words=${e.words} ${e.text.slice(0, 70).replace(/\n/g, ' | ')}`); prev = e.screen; }
  if (e.screen === 'doors') break;
  if (has('#beatGo')) { await call('click', '#beatGo'); continue; }
  if (has('#nextBtn')) { await call('click', '#nextBtn'); continue; }
  if (e.screen === 'lock') { if (has('#lkNext')) { await call('click', '#lkNext'); lockSel = false; continue; } if (lockSel && has('#lkTry')) { await call('click', '#lkTry'); lockSel = false; continue; }
    const opt = e.choices.filter(c => c.sel.startsWith('[data-h')); if (opt.length) { await call('click', String(opt[(lockN++) % opt.length].n)); lockSel = true; continue; } }
  if (e.screen === 'stop') { const key = e.text.split('\n')[0]; if (key !== stopKey) { stopKey = key; clicked = 0; } const objs = e.choices.filter(c => /\.obj/.test(c.sel) && !c.disabled);
    if (clicked < 2 && objs.length >= 2) { await call('click', objs[clicked === 0 ? 0 : 1].sel); clicked++; continue; } if (has('#light')) { await call('click', '#light'); picks++; continue; } }
  let done = false; for (const id of ['#introNext', '#dreamGo', '#fnGo', '#fnSkip', '#openDoors', '#csDone', '#consentYes', '#begin']) if (has(id)) { await call('click', id); done = true; break; }
  if (!done) { await call('wait', '1500'); }
}
