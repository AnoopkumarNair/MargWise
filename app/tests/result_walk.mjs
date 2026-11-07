// Plays the built game in a phone browser to the result screen and fails if the result does not show or any page error happens.
// Usage: URL_=http://localhost:8801/ node app/tests/result_walk.mjs   (server: bash app/tests/playtest/start_server.sh)
// Paths: see / sharpen / sharpen-stop / skip-dreams / reduced / resume / rsharpen. PATHS=see,sharpen runs a subset. OUT=dir saves screenshots.
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
import fs from 'fs';
const URL_ = process.env.URL_ || 'http://localhost:8788/', OUT = process.env.OUT || '';
const ALL = ['see', 'sharpen', 'sharpen-stop', 'skip-dreams', 'reduced', 'resume', 'rsharpen'];
const PATHS = (process.env.PATHS ? process.env.PATHS.split(',') : ALL);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const STATE = () => {
  const vis = e => { for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || p.hidden) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ok = id => { const e = document.getElementById(id); return !!(e && vis(e) && !e.disabled); };
  const bt = document.getElementById('beat'), beat = !!(bt && vis(bt)); const fin = document.getElementById('finale'), rev = document.getElementById('reveal');
  const op = document.getElementById('opening'); return { finOp: fin ? +getComputedStyle(fin).opacity : 1, opening: !!(op && vis(op)), beat, screen: (document.querySelector('.screen.on') || {}).id || null, finale: !!(fin && fin.classList.contains('on')), busy: document.body.classList.contains('busy'),
    btn: ['gStart', 'gGo', 'consentYes', 'csDone', 'begin', 'opGo', 'opSkip', 'introNext', 'beatGo', 'nextBtn', 'light', 'drSee', 'drSharpen', 'stopNow', 'dreamGo', 'fnGo', 'fnSkip', 'openDoors', 'rSharpen', 'lkNext', 'lkTry'].filter(ok),
    objs: [...document.querySelectorAll('#stop .obj')].filter(vis).length, lock: !!(document.getElementById('lock') && document.getElementById('lock').classList.contains('on')),
    revealText: rev ? rev.innerText.replace(/\s+/g, ' ').trim().length : 0 };
};

async function run(name, br) {
  const ctx = await br.newContext({ ...devices['Pixel 7'], reducedMotion: name === 'reduced' ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  const errs = [], bad = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  pg.on('requestfailed', r => bad.push(r.url().slice(0, 100)));
  let shots = 0; const shot = async tag => { if (OUT) await pg.screenshot({ path: `${OUT}/${name}_${String(shots++).padStart(2, '0')}_${tag}.png` }); };
  await pg.goto(URL_);
  let fails = 0;
  const click = async (sel) => { try { await pg.click(sel, { timeout: 2500 }); fails = 0; } catch (e) { if (++fails > 12) throw new Error('click ' + sel + ' keeps failing at ' + log.join('>') + ' :: ' + e.message.split('\n').filter(l => /intercepts|not visible|disabled/.test(l)).slice(-1)[0]); await pg.waitForTimeout(500); } };
  const wantSharpen = name === 'sharpen' || name === 'sharpen-stop';
  const log = []; let fadeSeen = false, left = false, stage = 'walk', ctxDone = false, picks = 0, clicked = 0, key = '', guard = 0, sharpened = false, resumed = false, rsh = false, sawDreams = false, dreamsAnswered = false;

  while (guard++ < 700) {
    await pg.waitForTimeout(250);
    const s = await pg.evaluate(STATE); const tag = (s.finale ? 'finale' : s.screen);
    if (log.at(-1) !== tag) { log.push(tag); await shot(tag); }
    if (s.finale && s.finOp < 0.9 && !fadeSeen) { fadeSeen = true; await pg.waitForTimeout(900); const again = await pg.evaluate(STATE); if (again.finale && again.finOp < 0.9) errs.push('lighthouse overlay is invisible (opacity ' + again.finOp + ') but still covers the result'); }
    if (!s.finale) fadeSeen = false;
    if (s.opening) { for (const id of ['opSkip', 'opGo', 'introNext']) if (s.btn.includes(id)) { await click('#' + id); break; } continue; }
    if (s.beat) { if (s.btn.includes('beatGo')) await click('#beatGo'); continue; }
    if (s.screen === 'reveal' && !s.finale && s.revealText > 40 && s.btn.length >= 0) {
      if (name === 'rsharpen' && rsh && !left) { await pg.waitForTimeout(300); continue; }
      if (name === 'rsharpen' && !rsh) { if (!s.btn.includes('rSharpen')) { await pg.waitForTimeout(500); continue; } rsh = true; await shot('result_first'); await click('#rSharpen'); continue; }
      if (name === 'resume' && !resumed) { resumed = true; await shot('result_before_reload'); await pg.reload(); await pg.waitForTimeout(1500); log.push('reload'); continue; }
      stage = 'done'; break;
    }
    if (rsh && s.screen !== 'reveal') left = true;
    if (s.screen === 'dreams') { sawDreams = true; if (!dreamsAnswered && name !== 'skip-dreams') { dreamsAnswered = true; await click('[data-k="cls"][data-v="10"]'); await click('[data-k="board"][data-v="cbse"]'); await click('#cLean .chip'); } }
    if (name === 'resume' && !resumed && s.screen === 'stop' && picks === 5) { resumed = true; await pg.reload(); await pg.waitForTimeout(1500); log.push('reload-mid'); continue; }
    if (s.screen === 'draft' && s.btn.includes('drSee') && !(wantSharpen && !sharpened)) { await click('#drSee'); continue; }
    if (s.screen === 'draft' && wantSharpen && !sharpened && s.btn.includes('drSharpen')) { sharpened = true; await click('#drSharpen'); continue; }
    if (name === 'sharpen-stop' && s.screen === 'stop' && sharpened && picks >= 9 && s.btn.includes('stopNow')) { await click('#stopNow'); continue; }
    if (s.screen === 'stop' && !s.finale && !s.beat) {
      const k = String(picks); if (k !== key) { key = k; clicked = 0; }
      if (s.btn.includes('nextBtn')) { await click('#nextBtn'); continue; }
      if (clicked < 2 && s.objs >= 2) { try { const n = await pg.locator('#stop .obj:visible').count(), a = picks % n, b = (a + 1 + (picks % 2)) % n; await pg.locator('#stop .obj:visible').nth(clicked === 0 ? a : b).click({ timeout: 2500 }); clicked++; } catch (e) { if (++fails > 12) throw new Error(e.message.slice(0, 1200)); } continue; }
      if (s.btn.includes('light')) { await click('#light'); picks++; clicked = 0; continue; }
    }
    if (s.btn.includes('gStart')) { await click('#gStart'); await pg.fill('#gName', 'Asha'); await pg.fill('#gCode', 'master'); await click('#gGo'); continue; }
    let done = false;
    for (const id of ['beatGo', 'nextBtn', 'opGo', 'introNext', 'dreamGo', 'fnGo', 'openDoors', 'csDone', 'consentYes', 'begin', 'lkNext', 'lkTry']) if (s.btn.includes(id) && !(id === 'openDoors')) { await click('#' + id); done = true; break; }
    if (done) continue;
    if (s.screen === 'lock') { const o = pg.locator('#lock [data-h]:visible'); if (await o.count()) { await o.first().click(); continue; } }
    if (s.btn.includes('fnSkip') && s.finale && (guard % 7 === 0)) { await click('#fnSkip'); continue; }
  }
  const fin = await pg.evaluate(STATE);
  const ok = stage === 'done' && errs.length === 0;
  const detail = await pg.evaluate(() => { const r = document.getElementById('reveal'); const cs = getComputedStyle(r); return { top3: !!document.querySelector('#legend .t3'), compass: !!document.querySelector('#compass *'), opacity: cs.opacity, finaleOn: document.getElementById('finale').classList.contains('on') }; });
  await shot('end');
  console.log(`${ok && detail.top3 && !detail.finaleOn ? 'PASS' : 'FAIL'} ${name}: stage=${stage} screen=${fin.screen} finale=${fin.finale} top3=${detail.top3} errs=${errs.length} failedReq=${bad.length} path=${log.join('>')}`);
  errs.forEach(e => console.log('   ' + e)); bad.slice(0, 5).forEach(e => console.log('   failed: ' + e));
  await ctx.close();
  return ok && detail.top3 && !detail.finaleOn;
}

const br = await chromium.launch(); let allOk = true;
for (const p of PATHS) { try { allOk = (await run(p, br)) && allOk; } catch (e) { console.log(`FAIL ${p}: ${e.message.slice(0, 900)}`); allOk = false; } }
await br.close(); process.exit(allOk ? 0 : 1);
