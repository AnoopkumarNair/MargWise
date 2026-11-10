// Slice S5 end to end (TEST_PLAN layers 3, 4 and 8): tier 2 reading with the on-device model, in a real browser. At 390x844 and 1280x800.
//   node --test app/adult/tests/e2e/s5.test.mjs
// It builds the app from the real graph (python3 app/adult/build.py --dev, so the real skill vectors) and needs the pinned model in
// app/adult/tools/model_cache/ (python3 app/adult/tools/fetch_model.py). Without the model: under CI=true this FAILS; on a developer machine it
// prints a notice. The "tier 2 is off" and "the model is never requested without consent" checks do not need the model: see s5_off.test.mjs.
//   MW_SHOTS=commit   also write phone screenshots to e2e/screenshots/      MW_NO_BUILD=1   use whatever is in hosting/public/work/ now
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './server.mjs';
import { chromium, ROOT, PUBLIC, OUT, SHOTS, VIEWS, axeCheck, watchContext, pageProfile } from './harness.mjs';
import { fixtures } from './samples.mjs';
import { seeRoads } from './flow.mjs';
import { tier2Fixtures, summarise } from '../lib/tier2_eval.mjs';

if (!process.env.MW_NO_BUILD) {
  const r = spawnSync('python3', [join(ROOT, 'app', 'adult', 'build.py'), '--dev'], { stdio: 'inherit' });
  assert.equal(r.status, 0, 'build failed');
}
const WORK = join(PUBLIC, 'work');
const manifest = JSON.parse(readFileSync(join(WORK, 'manifest.json'), 'utf8'));
const T2 = manifest.tier2;
const ready = !!(T2 && T2.available);

if (!ready) {
  const why = 'tier 2 is not in this build (' + (T2 && T2.reason) + '). Run python3 app/adult/tools/fetch_model.py, then build again.';
  if (process.env.CI === 'true') test('tier 2 is in the build in CI', () => assert.fail(why + ' CI must fetch the pinned model.'));
  else test('the tier 2 browser tests are not run on this machine', () => console.log('\n  NOTICE: ' + why + ' Nothing was checked in the browser.\n'));
} else {
  const T2FIX = tier2Fixtures();
  const OPS = T2FIX.find(f => f.id === 'ops_manager');
  const F = fixtures();
  const canaries = F.canaries.filter(c => c.length >= 6);
  const squash = s => s.replace(/\s+/g, ' ').trim();
  const runs = text => { const t = squash(text); const out = []; for (let i = 0; i + 20 <= t.length; i += 3) out.push(t.slice(i, i + 20)); return out; };
  const PASTED = F.items.find(i => i.name === 'pasted_text');
  const RUNS = runs(OPS.text).concat(PASTED ? runs(PASTED.text) : []);
  const MODELISH = /\/vendor\/transformers\/|\/work\/models\/|skill_vecs\.|\.wasm$|\.onnx$/;
  const MB = Math.max(1, Math.round(T2.total_bytes / 1e6));

  let srv, browser, base;
  test.before(async () => { srv = await startServer(PUBLIC); browser = await chromium.launch(); base = `http://127.0.0.1:${srv.port}`; });
  test.after(async () => { await browser.close(); await srv.close(); });
  const newCtx = v => browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, hasTouch: v.phone, isMobile: v.phone });
  const shot = async (page, v, name) => {
    await page.screenshot({ path: join(OUT, `s5-${name}-${v.name}.png`), fullPage: true });
    if (v.phone && process.env.MW_SHOTS === 'commit') await page.screenshot({ path: join(SHOTS, `s5-${name}-${v.name}.png`), fullPage: true });
  };
  const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // pastes a text on the intake screen and waits for the confirm screen
  async function pasteToConfirm(page, text) {
    await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    await page.goto(base + '/work/#/intake');
    await page.locator('#show-paste').click();
    await page.locator('#resume-text').fill(text);
    await page.locator('#read-pasted').click();
    await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 30000 });
  }
  const pageErrors = w => w.errors.filter(e => !/^warning: .*content-length/.test(e));

  test('layer 8: every file under work/models and the vendored library is at most 25 MiB, and the size the build lists is the real total', () => {
    const LIMIT = 25 * 1024 * 1024;
    const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const big = [...walk(join(WORK, 'models')), ...walk(join(PUBLIC, 'vendor', 'transformers'))].map(p => [p, statSync(p).size]);
    assert.ok(big.length >= 8);
    for (const [p, n] of big) assert.ok(n <= LIMIT, `${p} is ${n} bytes`);
    const onnx = big.find(([p]) => p.endsWith('model_int8.onnx')); assert.ok(onnx && onnx[1] === 22972370, 'the pinned model file');
    let sum = 0;
    for (const f of T2.files) { const p = f.url.startsWith('/') ? join(PUBLIC, f.url) : join(WORK, f.url); assert.equal(statSync(p).size, f.bytes, f.url); sum += f.bytes; }
    assert.equal(T2.total_bytes, sum, 'the total is the sum of the real files');
    assert.equal(T2.model, 'Xenova/all-MiniLM-L6-v2'); assert.equal(T2.revision, '751bff37182d3f1213fa05d7196b954e230abad9'); assert.equal(T2.licence, 'Apache-2.0');
    console.log(`  tier 2 download: ${T2.total_bytes} bytes = ${(T2.total_bytes / 1e6).toFixed(1)} MB (library ${T2.files.filter(f => f.url.startsWith('/vendor')).reduce((a, f) => a + f.bytes, 0)}, model ${T2.files.filter(f => f.url.includes('/models/')).reduce((a, f) => a + f.bytes, 0)}, vectors ${T2.files.filter(f => /skill_vecs/.test(f.url)).reduce((a, f) => a + f.bytes, 0)})`);
  });

  for (const v of VIEWS) {
    test(`consent journey at ${v.width}x${v.height}: the offer shows the size, nothing loads before agreeing, suggestions arrive unticked with source lines`, async () => {
      const ctx = await newCtx(v); const page = await ctx.newPage(); const w = watchContext(ctx);
      await pasteToConfirm(page, OPS.text);
      // the offer, with the real size, before anything is downloaded
      const box = page.locator('#more-skills');
      await box.waitFor();
      const label = await page.locator('#more-go').innerText();
      assert.equal(label, `Look for more skills in your resume (downloads ${MB} MB once, runs on this device)`, 'the size shown is the real total');
      assert.deepEqual(w.requests.filter(r => MODELISH.test(r.url)), [], 'the model, the runtime and the vectors are not requested before the person agrees');
      assert.equal(await page.locator('#more-list li').count(), 0, 'no suggestions before agreeing');
      assert.equal(await noSideScroll(page), true);
      await shot(page, v, '01-offer');
      const before = await page.locator('#skill-count').innerText();

      // agree
      const t0 = Date.now();
      await page.locator('#more-go').click();
      await page.locator('#more-head:not([hidden])').waitFor({ timeout: 120000 });
      const ms = Date.now() - t0;
      console.log(`  agree -> suggestions (model download from localhost, start, ${OPS.text.split('\n').length} lines): ${ms} ms (${v.name})`);
      const lis = page.locator('#more-list li.suggested');
      const n = await lis.count();
      assert.ok(n >= 1 && n <= 12, 'suggestions: ' + n);
      for (let i = 0; i < n; i++) {
        const li = lis.nth(i);
        assert.equal(await li.locator('input[type=checkbox]').isChecked(), false, 'a suggestion is not ticked');
        assert.equal(await li.locator('fieldset.strength').isVisible(), false);
        const src = await li.locator('.src').innerText();
        assert.match(src, /^From your resume: “.+”$/, 'a suggestion shows the line it came from');
        assert.ok(OPS.text.includes(src.replace(/^From your resume: “/, '').replace(/”$/, '').replace(/…$/, '')), 'the source line is a line of the resume: ' + src);
      }
      assert.equal(await page.locator('#skill-count').innerText(), before, 'nothing was ticked for the person');
      assert.match(await page.locator('#more-status').innerText(), /You may also have|We found \d+ skills? you may also have\. None is ticked yet\./);
      assert.equal(await page.locator('#more-go').isHidden(), true);
      assert.equal(await noSideScroll(page), true);
      await shot(page, v, '02-suggestions');
      const ax = await axeCheck(page, 'confirm with suggestions');

      // after agreeing: same-origin GETs only, for files the build lists; no body; no personal text in any URL
      const listed = new Set(T2.files.map(f => new URL(f.url.startsWith('/') ? f.url : '/work/' + f.url, base).href));
      for (const r of w.requests) {
        assert.equal(r.method, 'GET', `${r.method} ${r.url}`);
        assert.ok(r.url.startsWith(base + '/'), 'not same-origin: ' + r.url);
        assert.ok(!r.body, 'a request has a body: ' + r.url);
        const u = decodeURIComponent(r.url);
        for (const c of canaries) assert.ok(!u.includes(c), 'canary in a URL: ' + r.url);
        for (const run of RUNS) assert.ok(!u.includes(run), 'resume text in a URL: ' + r.url);
        if (MODELISH.test(r.url)) assert.ok(listed.has(r.url), 'a model request that the build does not list: ' + r.url);
      }
      for (const f of listed) assert.ok(w.requests.some(r => r.url === f), 'a listed file was never requested: ' + f);
      assert.deepEqual(w.failed, []); assert.deepEqual(pageErrors(w), [], 'console errors');
      assert.deepEqual(await page.evaluate(() => window.__csp), [], 'no Content-Security-Policy violation while the model ran');

      // tick one: it counts, asks how well, and goes into the profile
      const first = lis.first();
      const id = await first.getAttribute('data-skill');
      await first.locator('input[type=checkbox]').check();
      assert.equal(await first.locator('fieldset.strength').isVisible(), true);
      assert.notEqual(await page.locator('#skill-count').innerText(), before);
      await seeRoads(page);
      const { profile, check } = await pageProfile(page);
      assert.equal(check.ok, true, JSON.stringify(check));
      assert.ok(profile.skills.some(s => s.id === id), 'the ticked suggestion is in the profile');
      for (const s of profile.skills) assert.deepEqual(Object.keys(s).sort().filter(k => !['id', 'strength', 'last'].includes(k)), [], 'a skill holds an id, a strength and a year only');
      assert.ok(!JSON.stringify(profile).includes('Coached'), 'no resume text in the profile');

      // storage: nothing written by us; the library may keep the model in the browser cache (allowed), never anything from the resume
      const st = await page.evaluate(async () => ({ ls: JSON.stringify(Object.entries(localStorage)), ss: JSON.stringify(Object.entries(sessionStorage)), ck: document.cookie,
        idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [],
        cache: await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).map(r => r.url))) }));
      assert.deepEqual([st.ls, st.ss, st.ck, st.idb], ['[]', '[]', '', []]);
      for (const url of st.cache.flat()) assert.match(url, /\/work\/models\/|\/vendor\/transformers\//, 'only model files in the cache: ' + url);
      console.log(`  suggestions: ${n}; axe: ${JSON.stringify(ax)}`);
      await ctx.close();
    });
  }

  test('declining: the tier 1 screen works exactly as before and the model is never requested', async () => {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await pasteToConfirm(page, OPS.text);
    await page.locator('#more-go').waitFor();
    const skills = await page.locator('li.skill').count();
    await seeRoads(page);   // never pressed the button
    assert.deepEqual(w.requests.filter(r => MODELISH.test(r.url)), [], 'no model, runtime or vector request');
    assert.ok(skills > 0);
    assert.deepEqual(pageErrors(w), []);
    // back to the confirm screen: the offer is still there and nothing was downloaded
    await page.goto(base + '/work/#/intake'); await page.locator('#show-paste').click();
    await ctx.close();
  });

  test('when the model cannot be fetched the screen says so, keeps the tier 1 list, and can try again', async () => {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await pasteToConfirm(page, OPS.text);
    const before = await page.locator('#skill-count').innerText();
    await page.route('**/onnx/model_int8.onnx', r => r.abort());
    await page.locator('#more-go').click();
    await page.locator('#more-status:has-text("We could not look for more skills")').waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#more-status').innerText(), 'We could not look for more skills. Your list is as it was. You can try again.');
    assert.equal(await page.locator('#more-go').isEnabled(), true);
    assert.equal(await page.locator('#more-list li').count(), 0);
    assert.equal(await page.locator('#skill-count').innerText(), before);
    // the way on is unchanged
    await page.unroute('**/onnx/model_int8.onnx');
    await page.locator('#more-go').click();
    await page.locator('#more-head:not([hidden])').waitFor({ timeout: 120000 });
    assert.ok(await page.locator('#more-list li').count() >= 1, 'a second try works');
    await seeRoads(page);
    assert.deepEqual(w.requests.filter(r => r.method !== 'GET'), []);
    await ctx.close();
  });

  test('canary resume: after the model has run, no canary or run of resume text has left the page, and the suggestions are still unticked', async () => {
    assert.ok(PASTED, 'the pasted_text fixture');
    const ctx = await newCtx(VIEWS[1]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await pasteToConfirm(page, PASTED.text);
    await page.locator('#more-go').click();
    await page.locator('#more-status:has-text("found"), #more-status:has-text("could not")').waitFor({ timeout: 120000 });
    assert.doesNotMatch(await page.locator('#more-status').innerText(), /could not/);
    assert.equal(await page.locator('#more-list li input[type=checkbox]:checked').count(), 0);
    for (const r of w.requests) {
      assert.equal(r.method, 'GET'); assert.ok(!r.body);
      const u = decodeURIComponent(r.url);
      for (const c of canaries) assert.ok(!u.includes(c), 'canary in ' + r.url);
      for (const run of runs(PASTED.text)) assert.ok(!u.includes(run), 'resume text in ' + r.url);
    }
    await ctx.close();
  });

  test('tier 2 in the browser on all synthetic fixtures: the same floors as the Node model test, and timing', async () => {
    const ctx = await newCtx(VIEWS[1]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await page.goto(base + '/work/');
    await page.locator('#start').waitFor();
    const texts = Object.fromEntries(T2FIX.map(f => [f.id, f.text]));
    const t0 = Date.now();
    const out = await page.evaluate(async texts => {
      const { findMoreSkills } = await import('/work/intake_embed.js');
      const { achievementLines } = await import('/work/intake/tier2.js');
      const res = {}; const times = {};
      for (const [id, text] of Object.entries(texts)) {
        const t = performance.now();
        const lines = achievementLines(text, { nowYear: 2026 });
        res[id] = await findMoreSkills(lines, { exclude: [], threshold: 0.4, cap: 1000 });
        times[id] = Math.round(performance.now() - t);
      }
      return { res, times };
    }, texts);
    const total = Date.now() - t0;
    const r = summarise(T2FIX, out.res);
    const times = Object.values(out.times);
    console.log(`  browser: first resume incl. model load ${times[0]} ms, the rest ${times.slice(1).join(', ')} ms; all 8 in ${total} ms`);
    console.log(`  browser tier 2: ${r.perResume.toFixed(1)} a resume, line recall ${r.lineRecall.toFixed(2)} (${r.linesHit}/${r.impliedLines}), fair precision ${r.precisionFair.toFixed(2)} (${r.tp + r.ok}/${r.suggested}), strict ${r.precision.toFixed(2)}`);
    assert.ok(r.lineRecall >= 0.15 && r.precisionFair >= 0.65 && r.precision >= 0.15, JSON.stringify({ lineRecall: r.lineRecall, precisionFair: r.precisionFair, precision: r.precision }));
    assert.ok(r.perResume >= 1 && r.perResume <= 4, 'a resume: ' + r.perResume);
    assert.deepEqual(w.failed, []); assert.deepEqual(pageErrors(w), []);
    await ctx.close();
  });

  test('the developer page shows tier 1 and tier 2 side by side for a pasted text', async () => {
    const ctx = await newCtx(VIEWS[1]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await page.goto(base + '/work/tiers.html');
    await page.locator('#run1').click();
    await page.locator('#status:has-text("Tier 1 done")').waitFor();
    assert.ok(await page.locator('#t1 tr').count() >= 4, 'tier 1 skills are listed');
    assert.match(await page.locator('#run2').innerText(), new RegExp(`downloads ${MB} MB the first time`));
    assert.deepEqual(w.requests.filter(r => MODELISH.test(r.url)), [], 'tier 2 loads nothing until its button is pressed');
    await page.locator('#run2').click();
    await page.waitForFunction(() => /Tier 2 (done|failed)/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
    assert.equal(await page.locator('#status').innerText(), 'Tier 2 done.');
    const rows = await page.locator('#t2 tr').count();
    assert.ok(rows >= 2, 'tier 2 suggestions are listed with their scores: ' + rows);
    assert.match(await page.locator('#t2 tr').nth(1).innerText(), /skl:.+\t.+\t0\.\d{3}\t.+/);
    // tier 1 and tier 2 give different ids: tier 2 leaves out what tier 1 found
    const t1ids = await page.locator('#t1 tr td:first-child').allInnerTexts(); const t2ids = await page.locator('#t2 tr td:first-child').allInnerTexts();
    assert.deepEqual(t2ids.filter(x => t1ids.includes(x)), []);
    await page.screenshot({ path: join(OUT, 's5-03-dev-tiers.png'), fullPage: true });
    assert.deepEqual(pageErrors(w), []);
    await ctx.close();
  });
}
