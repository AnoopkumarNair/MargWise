// Slice S1 end to end (TEST_PLAN layers 7 and 8): type a title, tick skills, see roads, open one. At 390x844 and 1280x800.
//   node --test app/adult/tests/e2e/s1.test.mjs
// Needs Playwright with Chromium (require('playwright') must work) and `npm install` in app/adult/tests/ for axe-core.
// Builds the dev app first, with the small hand-written fixtures (`build.py --dev --fixtures`), so the assertions are exact and fast.
//   MW_E2E_DATA=real   build from data/graph/ instead (generic assertions only: same journey, no job-specific checks)
//   MW_SHOTS=commit    also write the phone screenshots to e2e/screenshots/ (committed). Without it every screenshot goes to
//                      tests/out/ only (git-ignored), so a real-data run never overwrites the committed ones
//   MW_NO_BUILD=1      use whatever is in hosting/public/work/ now
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startServer } from './server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..', '..');
const PUBLIC = join(ROOT, 'hosting', 'public');
const OUT = join(here, '..', 'out');            // gitignored
const SHOTS = join(here, 'screenshots');        // committed: phone width only
mkdirSync(OUT, { recursive: true }); mkdirSync(SHOTS, { recursive: true });

const REAL = process.env.MW_E2E_DATA === 'real';
const ONET_V = REAL ? JSON.parse(readFileSync(join(ROOT, 'data', 'graph', 'build_report.json'), 'utf8')).onet_version : null;   // 31.0
if (!process.env.MW_NO_BUILD) {
  const r = spawnSync('python3', [join(ROOT, 'app', 'adult', 'build.py'), '--dev'].concat(REAL ? [] : ['--fixtures']), { stdio: 'inherit' });
  assert.equal(r.status, 0, 'build failed');
}
const TICKS = 25; // the person ticks 25 skills and calls them strong: coverage needs 0.7 of every need to reach "adjacent" (SPEC 7.1, 7.3)
let axeSrc = null;
try { axeSrc = readFileSync(join(here, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8'); } catch { /* reported by the axe test */ }

const VIEWS = [{ name: '390', width: 390, height: 844, phone: true }, { name: '1280', width: 1280, height: 800, phone: false }];
let srv, browser;
test.before(async () => { srv = await startServer(PUBLIC); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); await srv.close(); });

// Collects everything that must stay empty or small during a journey.
function watch(page) {
  const w = { errors: [], requests: [], failed: [] };
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') w.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => w.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => w.failed.push(r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('request', r => w.requests.push({ method: r.method(), url: r.url(), body: r.postData() }));
  page.on('response', r => { if (r.status() >= 400) w.errors.push('http ' + r.status() + ' ' + r.url()); });
  return w;
}

async function axeCheck(page, label) {
  assert.ok(axeSrc, 'axe-core is not installed: run `npm install` in app/adult/tests/');
  await page.evaluate(axeSrc); // evaluate runs outside the page CSP, so the strict policy stays on
  const res = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  const bad = res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  assert.deepEqual(bad.map(v => v.id + ' (' + v.impact + '): ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')), [], 'axe on ' + label);
  return res.violations.map(v => v.id + ':' + v.impact);
}

async function shot(page, v, name) {
  await page.screenshot({ path: join(OUT, `s1-${name}-${v.name}.png`), fullPage: true });
  if (v.phone && process.env.MW_SHOTS === 'commit') await page.screenshot({ path: join(SHOTS, `s1-${name}-${v.name}.png`), fullPage: true });
}

async function footerOk(page) {
  const t = await page.locator('#footer').innerText();
  assert.match(t, /Job data release:\s*dev-unaccepted/);
  assert.match(t, /O\*NET OnLine, U\.S\. Department of Labor/);
  assert.match(t, /Margwise has modified this information\. USDOL\/ETA has not approved, endorsed or tested these modifications\. O\*NET® is a trademark of USDOL\/ETA\./);
  assert.match(t, /as of 20\d\d/);
  // the O*NET version shows in a dev build too (from the slices' release id); the hand-written fixtures have none
  if (REAL) assert.match(t, new RegExp('O\\*NET version:\\s*' + ONET_V.replace('.', '\\.'))); else assert.doesNotMatch(t, /O\*NET version:/);
  assert.doesNotMatch(t, /broad averages/);   // S1 has no India data (review finding S2)
}

for (const v of VIEWS) {
  test(`S1 journey at ${v.width}x${v.height}: title, skills, roads, one road`, async () => {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, hasTouch: v.phone, isMobile: v.phone });
    const page = await ctx.newPage(); const w = watch(page);
    const base = `http://127.0.0.1:${srv.port}`;
    await page.goto(base + '/work/');

    // 1. Welcome
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.match(await page.locator('main').innerText(), /no sign-in/i);
    assert.match(await page.locator('main').innerText(), /nothing is stored on a server/i);
    await footerOk(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
    await shot(page, v, '01-welcome');
    const ax = { welcome: await axeCheck(page, 'welcome') };

    // keyboard: Tab reaches Start, and the focus ring is visible
    for (let i = 0; i < 8 && (await page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'start'; i++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'start');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
    await page.keyboard.press('Enter');

    // 2. Title entry
    await page.locator('#job-title').waitFor();
    await page.locator('#job-status', { hasText: 'Two letters are enough' }).waitFor();
    await footerOk(page);
    // a job that has no data yet is found by the label search, and shown but not selectable (fixtures only: real data has a slice for almost every job)
    await page.locator('#job-title').fill('data scientist');
    await page.locator('#job-picks button').first().waitFor();
    if (!REAL) {
      assert.equal(await page.locator('#job-picks button').first().isDisabled(), true);
      assert.match(await page.locator('#job-picks').innerText(), /No data for this job yet/);
    }
    // nonsense
    await page.locator('#job-title').fill('qwertyuiop');
    await page.locator('#job-status', { hasText: 'No job found' }).waitFor();
    // markup typed by a person is shown as text, never run
    await page.locator('#job-title').fill('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('main img').count(), 0);
    // a close title
    await page.locator('#job-title').fill('chartered account');
    await page.locator('#job-picks button').first().waitFor();
    assert.match(await page.locator('#job-picks').innerText(), /Accountants and Auditors/);
    await page.locator('#job-title').fill('Accountant');
    await page.locator('#job-picks button:not([disabled])').first().waitFor();
    await shot(page, v, '02-title');
    ax.title = await axeCheck(page, 'title');
    await page.locator('#job-picks button', { hasText: 'Accountants and Auditors' }).click();

    // 3. Skills: up to 40, in groups, with "tick all" per group
    await page.locator('.skill-groups').waitFor();
    const nSk = await page.locator('ul.skills > li').count(); assert.ok(nSk <= 40 && nSk >= (REAL ? 10 : 32), 'skills listed: ' + nSk);
    if (!REAL) assert.equal(nSk, 32);
    assert.ok(await page.locator('.skill-group h2').count() >= 2, 'skills are grouped');
    assert.match(await page.locator('#tick-count').innerText(), /^0 of \d+ ticked\. Tick everything you do/);
    // "tick all" in one group ticks every box in it, and a second click unticks them
    const grp = page.locator('.skill-group').last(), inGrp = await grp.locator('input[type=checkbox]').count();
    await grp.locator('button.tick-all').click();
    assert.equal(await grp.locator('input[type=checkbox]:checked').count(), inGrp);
    assert.match(await page.locator('#tick-count').innerText(), new RegExp('^' + inGrp + ' of '));
    assert.match(await grp.locator('button.tick-all').innerText(), /Untick all/);
    await grp.locator('button.tick-all').click();
    assert.equal(await grp.locator('input[type=checkbox]:checked').count(), 0);
    // the job's tasks and their AI use: "used" and "none" have labels, a task without AI data has none
    await page.locator('#job-tasks summary').click();
    const tasksText = await page.locator('#job-tasks').innerText();
    assert.match(tasksText, /AI use was seen in \d+ of these \d+ tasks/);
    if (!REAL) {
      assert.match(tasksText, /AI use seen/); assert.match(tasksText, /No AI use seen/); assert.match(tasksText, /there is no AI data yet/);
      assert.equal(await page.locator('#job-tasks li', { hasText: 'Advise managers' }).locator('.tag').count(), 0, 'unknown shows no label');
    }
    await page.locator('#job-tasks summary').click();
    const boxes = page.locator('ul.skills input[type=checkbox]');
    const nBoxes = Math.min(TICKS, await boxes.count());
    const ticked = [...Array(nBoxes).keys()].filter(i => i !== 20);
    for (const i of ticked) await boxes.nth(i).check();
    for (const i of ticked) await page.locator('ul.skills > li').nth(i).getByLabel('Strong').check();
    await page.locator('ul.skills > li').nth(2).getByLabel('Rusty').check();
    await page.locator('#years').selectOption('5-8');
    assert.match(await page.locator('#tick-count').innerText(), new RegExp('^' + ticked.length + ' of \\d+ ticked\\.$'));
    // keyboard: Space toggles a checkbox
    await boxes.nth(20).focus(); await page.keyboard.press('Space');
    assert.equal(await boxes.nth(20).isChecked(), true);
    await page.keyboard.press('Space');
    assert.equal(await boxes.nth(20).isChecked(), false);
    await footerOk(page);
    await shot(page, v, '03-skills');
    ax.skills = await axeCheck(page, 'skills');
    await page.locator('#see-roads').click();

    // 4. Roads
    await page.locator('ol.cards > li').first().waitFor();
    const n0 = await page.locator('ol.cards > li').count();
    assert.ok(n0 >= (REAL ? 1 : 3), 'roads without leaps, got ' + n0);
    assert.equal(await page.locator('ol.cards > li.tier-leap').count(), 0, 'leaps are hidden at first');
    const card = page.locator('ol.cards > li').first();
    const cardText = await card.innerText();
    assert.match(cardText, /% covered/); assert.match(cardText, /Top skills still missing/); assert.match(cardText, /Demand\s*not yet measured/);
    assert.ok((await card.locator('ul.gaps > li').count()) <= 3);
    await footerOk(page);
    const ms = Number(await page.locator('#road-list').getAttribute('data-compute-ms'));
    assert.ok(ms >= 0 && ms <= 200, 'roads computed in ' + ms + ' ms');
    // sliders re-sort live
    const order = async () => page.locator('ol.cards > li').evaluateAll(els => els.map(e => e.getAttribute('data-road')));
    const setSlider = async (id, val) => { await page.locator('#pr-' + id).fill(String(val)); };
    await setSlider('pay', 0); await setSlider('demand', 0); await setSlider('short_move', 0); await setSlider('ai_safe', 5);
    const byAi = await order();
    await setSlider('ai_safe', 0); await setSlider('short_move', 5);
    const byShort = await order();
    assert.notDeepEqual(byAi, byShort, 'moving the sliders changes the order');
    assert.match(await page.locator('#prio-note').innerText(), /not yet measured/);
    // leaps (the fixture has one; real data may have none for a person who covers everything)
    if (REAL && (await page.locator('#show-leaps').isHidden())) console.log('  (no leaps for this person in real data: skipped)');
    else {
    await page.locator('#show-leaps').click();
    await page.locator('ol.cards > li.tier-leap').first().waitFor();
    assert.ok((await page.locator('ol.cards > li').count()) > n0);
    assert.equal(await page.locator('#show-leaps').getAttribute('aria-pressed'), 'true');
    }
    await shot(page, v, '04-roads');
    ax.roads = await axeCheck(page, 'roads');

    // 5. Road detail
    await page.locator('ol.cards > li').first().getByRole('link', { name: 'See details' }).click();
    await page.locator('ol.gap-list, h2:has-text("Skills you would still need")').first().waitFor();
    const main = await page.locator('main').innerText();
    assert.match(main, /No reviewed course yet for these skills\./);
    assert.match(main, /How this road was scored/);
    assert.match(main, /Pay change/); assert.match(main, /not yet measured/);
    assert.match(main, /Importance in this job/);
    assert.equal(await page.locator('table.comps tbody tr').count(), 4);
    await footerOk(page);
    await shot(page, v, '05-road');
    ax.road = await axeCheck(page, 'road detail');
    await page.getByRole('link', { name: 'Back to roads' }).last().click();
    await page.locator('ol.cards > li').first().waitFor();

    // Reload loses the profile (kept in memory only) and sends the person back to the start of the pick.
    await page.reload(); await page.locator('#job-title').waitFor();

    // 6. Privacy and safety
    assert.deepEqual(w.errors, [], 'console errors');
    assert.deepEqual(w.failed, [], 'failed requests');
    assert.ok(w.requests.every(r => r.method === 'GET' && r.url.startsWith(base) && !r.body), 'only same-origin GET requests, no body');
    const stored = await page.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie, idb: indexedDB.databases ? (await indexedDB.databases()).length : 0 }));
    assert.deepEqual(stored, { ls: 0, ss: 0, ck: '', idb: 0 });
    const urls = w.requests.map(r => r.url).join('\n');
    assert.ok(!/Accountant|chartered|img/i.test(urls.replace(/graph\/dev-unaccepted\/slices\/[^\n]+/g, '')), 'typed text never appears in a URL');
    console.log(`  axe (minor/moderate, informational) at ${v.name}:`, JSON.stringify(ax));
    await ctx.close();
  });
}

test('direct visit to a deep link without a profile goes back to the title screen', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); const w = watch(page);
  await page.goto(`http://127.0.0.1:${srv.port}/work/#/roads`);
  await page.locator('#job-title').waitFor();
  assert.match(page.url(), /#\/title$/);
  assert.deepEqual(w.errors, []);
  await ctx.close();
});

test('the CSP header on /work/ blocks inline script and inline style', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const res = await page.goto(`http://127.0.0.1:${srv.port}/work/`);
  const csp = res.headers()['content-security-policy'];
  assert.match(csp, /default-src 'self'/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /connect-src 'self'/); assert.match(csp, /style-src 'self'(;|,)/);
  const policies = csp.split(', ');
  const work = policies.find(p => p.includes("object-src 'none'"));
  assert.ok(work && !work.includes('unsafe-inline') && !work.includes('unsafe-eval'));
  await page.locator('h1').waitFor();
  const r = await page.evaluate(() => new Promise(done => {
    const seen = [];
    document.addEventListener('securitypolicyviolation', e => seen.push(e.violatedDirective), { once: false });
    const s = document.createElement('script'); s.textContent = 'window.__ran = 1'; document.head.appendChild(s);
    const d = document.createElement('div'); d.setAttribute('style', 'color:red'); document.body.appendChild(d);
    setTimeout(() => done({ ran: window.__ran === 1, seen }), 200);
  }));
  assert.equal(r.ran, false, 'inline script must not run');
  assert.ok(r.seen.some(x => x.startsWith('script-src')), 'script violation reported: ' + r.seen);
  await ctx.close();
});

test('budgets (TEST_PLAN layer 8): first load <= 300 KB, slice <= 60 KB gzipped, roads <= 200 ms at 4x CPU and fast 3G', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const w = watch(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  // "Fast 3G" as in Chrome DevTools: 1.6 Mbit/s down, 750 kbit/s up, 150 ms latency (x3.75 for the DevTools "slow 4x" request multiplier = 562.5 ms)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024 / 8) * 0.9, uploadThroughput: (750 * 1024 / 8) * 0.9 });
  const sizes = [];
  page.on('response', async r => {
    try { const t = r.request().resourceType(); const b = await r.body(); sizes.push({ url: r.url(), type: t, bytes: b.length }); } catch { /* redirects have no body */ }
  });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${srv.port}/work/`);
  await page.locator('#start').waitFor({ timeout: 30000 });
  const loadMs = Date.now() - t0;
  const first = sizes.filter(s => ['document', 'script', 'stylesheet'].includes(s.type));
  const firstBytes = first.reduce((a, s) => a + s.bytes, 0);
  console.log(`  first load: ${first.length} files, ${(firstBytes / 1024).toFixed(1)} KB of HTML+JS+CSS, ready after ${loadMs} ms (4x CPU, fast 3G)`);
  assert.ok(firstBytes <= 300 * 1024, `first load ${firstBytes} bytes`);
  // the whole app folder is also under the budget, so lazy loading cannot hide a regression
  const man = JSON.parse(readFileSync(join(PUBLIC, 'work', 'manifest.json'), 'utf8'));
  const appBytes = Object.keys(man.app_files).filter(f => /\.(html|js|css)$/.test(f)).reduce((a, f) => a + statSync(join(PUBLIC, 'work', f)).size, 0);
  console.log(`  whole app (HTML+JS+CSS incl. matcher and validator): ${(appBytes / 1024).toFixed(1)} KB`);
  assert.ok(appBytes <= 300 * 1024, 'whole app ' + appBytes);
  // walk to the roads
  await page.locator('#start').click();
  await page.locator('#job-title').fill('accountant');
  await page.locator('#job-picks button').first().click();
  await page.locator('.skill-groups').waitFor();
  const sl = sizes.find(s => /\/slices\/.+\.json$/.test(s.url));
  assert.ok(sl, 'a slice was fetched');
  // The budget is the gzipped size, what a browser downloads from a web server that compresses (owner decision 2026-10-29; level 6 as export.py)
  const gz = gzipSync(readFileSync(join(PUBLIC, new URL(sl.url).pathname)), { level: 6 }).length;
  console.log(`  slice fetch: ${(gz / 1024).toFixed(1)} KB gzipped, ${(sl.bytes / 1024).toFixed(1)} KB raw (${sl.url.split('/').pop()})`);
  assert.ok(gz <= 60000, `slice ${gz} bytes gzipped`);
  for (let i = 0; i < TICKS; i++) { await page.locator('ul.skills input[type=checkbox]').nth(i).check(); await page.locator('ul.skills > li').nth(i).getByLabel('Strong').check(); }
  await page.locator('#see-roads').click();
  await page.locator('ol.cards > li').first().waitFor();
  const ms = Number(await page.locator('#road-list').getAttribute('data-compute-ms'));
  console.log(`  roads computed in ${ms} ms at 4x CPU slowdown`);
  assert.ok(ms <= 200, 'roads ' + ms + ' ms');
  assert.deepEqual(w.errors, []);
  await ctx.close();
});
