// Walk-through check: node prototypes/lamplighter/smoke.mjs <html> <outDir>
// Fails on page errors, scrolling, clipped or overlapping option objects, and plays every stop.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3] ?? '.');
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
let bad = 0;
for (const [w, h] of [[393, 780], [360, 640], [412, 915], [320, 568], [320, 640], [375, 667]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + html); await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${w}-welcome.png` });
  const wt = await p.evaluate(() => { const r = document.querySelector('#welcome h1').getBoundingClientRect(); const k = document.querySelector('#welcome .kicker').getBoundingClientRect(); return { h1: r.top, kicker: k.top, begin: document.querySelector('#begin').getBoundingClientRect().bottom, ih: innerHeight }; });
  const wfail = wt.kicker < 0 || wt.h1 < 0;
  process.stdout.write([w + 'x' + h, 'welcome', JSON.stringify(wt), wfail ? 'FAIL' : 'ok'].join(' ') + '\n'); if (wfail) bad++;
  await p.click('#begin'); await p.waitForTimeout(1600);
  const geo = async (tag) => {
    const g = await p.evaluate(() => {
      const r = (e) => { const x = e.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom }; };
      const objs = [...document.querySelectorAll('.obj')].map((o) => ({ box: r(o), tag: [...o.querySelectorAll('.tag')].map((t) => ({ clip: t.scrollHeight > t.clientHeight + 1, h: t.clientHeight, art: o.querySelector('.art').clientHeight }))[0] }));
      const btn = r(document.querySelector('#light')), top = r(document.querySelector('.top'));
      // objects sway by a few degrees, so their bounding boxes are shrunk before testing
      const overlap = (a, c) => a.l < c.r - 6 && c.l < a.r - 6 && a.t < c.b - 6 && c.t < a.b - 6;
      let ov = 0; for (let i = 0; i < objs.length; i++) { for (let j = i + 1; j < objs.length; j++) if (overlap(objs[i].box, objs[j].box)) ov++; if (overlap(objs[i].box, btn) || overlap(objs[i].box, top)) ov++; }
      return { sh: document.documentElement.scrollHeight, ih: innerHeight, n: objs.length, ov, clipped: objs.some((o) => o.tag.clip), minArt: Math.min(...objs.map((o) => o.tag.art)), tagH: objs.map((o) => o.tag.h) };
    });
    const fail = g.sh > g.ih || g.n !== 4 || g.ov || g.clipped || g.minArt < 60;
    process.stdout.write([w + 'x' + h, tag, JSON.stringify(g), fail ? 'FAIL' : 'ok'].join(' ') + '\n'); if (fail) bad++;
  };
  await geo('stop1'); await p.screenshot({ path: `${out}/${w}-stop1.png` });
  await p.click('.obj >> nth=0', { force: true }); await p.click('.obj >> nth=0', { force: true }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${w}-stop1-spent.png` });
  let stops = 0, echo = false;
  for (let i = 0; i < 20; i++) {
    if (!(await p.evaluate(() => document.querySelector('#stop').classList.contains('on')))) break;
    if (await p.evaluate(() => /flickered/.test(document.querySelector('#bubble').textContent))) echo = true;
    if (i > 0) await p.click('.obj >> nth=' + (i % 4), { force: true });
    if (i % 3 === 0 && i > 0) await p.click('.obj >> nth=' + ((i + 1) % 4), { force: true });
    if (i === 3) { await geo('stop4'); await p.screenshot({ path: `${out}/${w}-stop4.png` }); }
    await p.click('#light'); stops++;
    if (i === 1) { await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${w}-lit.png` }); }
    await p.waitForTimeout(2700);
  }
  process.stdout.write(['stops', stops, 'echo', echo].join(' ') + '\n');
  await p.click('.chip >> nth=0'); await p.click('#dreamGo'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${w}-reveal.png` });
  await p.click('#openDoors'); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${w}-doors.png` });
  process.stdout.write(['errors', JSON.stringify(errs)].join(' ') + '\n'); if (errs.length) bad++;
  await ctx.close();
}
await b.close(); process.exit(bad ? 1 : 0);
