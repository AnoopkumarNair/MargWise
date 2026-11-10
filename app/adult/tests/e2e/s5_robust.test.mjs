// Slice S5 review fixes, in a real browser (TEST_PLAN layer 8): the scan stays responsive and can be cancelled under 4x CPU throttling (S1), the live region
// speaks a few times and not on every sentence (S2), a screen drawn again during a load shows the load and starts no second download (S3), and the model
// is kept for a second visit (S5). Same setup as s5.test.mjs: needs the pinned model (python3 app/adult/tools/fetch_model.py); under CI=true a missing
// model FAILS, on a developer machine it prints a notice.
//   node --test app/adult/tests/e2e/s5_robust.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './server.mjs';
import { chromium, ROOT, PUBLIC, VIEWS, watchContext } from './harness.mjs';

if (!process.env.MW_NO_BUILD) {
  const r = spawnSync('python3', [join(ROOT, 'app', 'adult', 'build.py'), '--dev'], { stdio: 'inherit' });
  assert.equal(r.status, 0, 'build failed');
}
const WORK = join(PUBLIC, 'work');
const manifest = JSON.parse(readFileSync(join(WORK, 'manifest.json'), 'utf8'));
const T2 = manifest.tier2;

if (!(T2 && T2.available)) {
  const why = 'tier 2 is not in this build (' + (T2 && T2.reason) + '). Run python3 app/adult/tools/fetch_model.py, then build again.';
  if (process.env.CI === 'true') test('tier 2 is in the build in CI', () => assert.fail(why + ' CI must fetch the pinned model.'));
  else test('the tier 2 robustness tests are not run on this machine', () => console.log('\n  NOTICE: ' + why + ' Nothing was checked in the browser.\n'));
} else {
  // a long resume (7 jobs, 268 sentences before the cap): the scan reads the newest 120
  const LONG = readFileSync(join(ROOT, 'app', 'adult', 'tests', 'fixtures', 'ten_page', 'resume.txt'), 'utf8');
  const OPS = readFileSync(join(ROOT, 'app', 'adult', 'tests', 'fixtures', 'tier2', 'ops_manager', 'resume.txt'), 'utf8');
  const MODEL_URL = /\/work\/models\//;
  const modelFiles = T2.files.filter(f => MODEL_URL.test('/work/' + f.url)).map(f => '/work/' + f.url);
  let srv, browser, base;
  const hits = [];   // every GET the server answered, as "GET /path": what really crossed the network (the browser's own cache hits never reach it)
  const served = path => hits.filter(h => h === 'GET ' + path).length;
  const slow = { ms: 0 };   // holds the model file back when a test needs a download that lasts
  test.before(async () => { srv = await startServer(PUBLIC, { log: l => hits.push(l), delay: p => (/model_int8\.onnx$/.test(p) ? slow.ms : 0) }); browser = await chromium.launch(); base = `http://127.0.0.1:${srv.port}`; });
  test.after(async () => { await browser.close(); await srv.close(); });
  const phone = VIEWS[0];
  const newCtx = () => browser.newContext({ viewport: { width: phone.width, height: phone.height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });

  async function pasteToConfirm(page, text) {
    await page.goto(base + '/work/#/intake');
    await page.locator('#show-paste').click();
    await page.locator('#resume-text').fill(text);
    await page.locator('#read-pasted').click();
    await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 60000 });
  }
  // Records, inside the page, what changes while a scan runs: the visible text, the live text, the bar, animation frames and the longest wait of the event loop
  // while it is reading sentences (the library starts its model in one go, which no page code can break up).
  const instrument = page => page.evaluate(() => {
    const t = window.__t = { status: [], live: [], bar: new Set(), frames: 0, maxGap: 0, on: true };
    const watch = (sel, into) => { const el = document.querySelector(sel); new MutationObserver(() => { into.push(el.textContent); if (sel === '#more-status' && /^Reading your resume/.test(el.textContent)) t.reading = true; if (sel === '#more-status') t.bar.add(document.querySelector('#more-progress').value); }).observe(el, { childList: true, characterData: true, subtree: true }); };
    watch('#more-status', t.status); watch('#more-live', t.live);
    let last = performance.now(); const tick = () => { const n = performance.now(); if (t.reading) t.maxGap = Math.max(t.maxGap, n - last); last = n; if (t.on) setTimeout(tick, 10); }; tick();
    const raf = () => { t.frames++; if (t.on) requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  });
  const reading = s => /^Reading your resume… (\d+) of (\d+) lines$/.exec(s);
  const pageErrors = w => w.errors.filter(e => !/^warning: .*content-length/.test(e));

  test('S1: under 4x CPU throttling the page stays responsive while reading, the progress text advances, and Cancel stops the scan and leaves the offer available', async () => {
    const ctx = await newCtx(); const page = await ctx.newPage(); const w = watchContext(ctx);
    await pasteToConfirm(page, LONG);
    const before = await page.locator('#skill-count').innerText();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await instrument(page);
    await page.locator('#more-go').click();
    assert.equal(await page.locator('#more-go').isHidden(), true, 'the button gives way to Cancel while the scan runs');
    await page.locator('#more-cancel').waitFor({ state: 'visible' });
    // wait until the reading has really started and gone on a while
    await page.waitForFunction(() => window.__t.status.some(s => /^Reading your resume… (1[5-9]|[2-9]\d) of/.test(s)), null, { timeout: 120000, polling: 100 });
    const t0 = Date.now();
    await page.locator('#more-cancel').click({ timeout: 5000 });   // would time out if the page were frozen
    await page.locator('#more-status:has-text("Stopped. Your list is as it was.")').waitFor({ timeout: 5000 });
    const cancelMs = Date.now() - t0;
    const t = await page.evaluate(() => { window.__t.on = false; return { ...window.__t, bar: [...window.__t.bar] }; });
    const steps = t.status.map(reading).filter(Boolean).map(m => +m[1]);
    console.log(`  throttled 4x: cancel took ${cancelMs} ms; read ${steps[steps.length - 1]} of ${reading(t.status.filter(reading).pop())[2]} lines before it; frames ${t.frames}; longest wait of the page while reading ${Math.round(t.maxGap)} ms; distinct progress values ${t.bar.length}`);
    assert.ok(steps.length >= 15, 'the text advanced: ' + steps.length + ' updates');
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'the count only goes up');
    assert.ok(t.bar.length >= 15, 'the bar moved');
    assert.ok(t.frames >= 20, 'the page repainted while it worked: ' + t.frames + ' frames');
    assert.ok(t.maxGap < 1000, 'while reading, the page was never stuck for long: ' + t.maxGap + ' ms');
    assert.ok(cancelMs < 3000, 'cancel answered in ' + cancelMs + ' ms');
    // the screen is as it was, and the offer is back
    assert.equal(await page.locator('#more-go').isVisible(), true); assert.equal(await page.locator('#more-go').isEnabled(), true);
    assert.equal(await page.locator('#more-cancel').isHidden(), true);
    assert.equal(await page.locator('#more-list li').count(), 0, 'nothing from a stopped scan is shown');
    assert.equal(await page.locator('#skill-count').innerText(), before);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'more-go', 'keyboard focus is on the button again');
    const modelRequests = w.requests.filter(r => MODEL_URL.test(r.url)).length;
    // press it again: the model is already here, so nothing is downloaded, and this time it finishes
    await page.locator('#more-go').click();
    await page.locator('#more-head:not([hidden]), #more-status:has-text("found nothing")').waitFor({ timeout: 120000 });
    assert.equal(w.requests.filter(r => MODEL_URL.test(r.url)).length, modelRequests, 'the second scan downloaded nothing');
    assert.match(await page.locator('#more-status').innerText(), /We found \d+ skills? you may also have\. None is ticked yet\.|We found nothing more/);
    assert.deepEqual(pageErrors(w), []);
    await ctx.close();
  });

  test('S1: Cancel during the download stops it, and a new try downloads again and works', async () => {
    const ctx = await newCtx(); const page = await ctx.newPage(); const w = watchContext(ctx);
    await pasteToConfirm(page, OPS);
    slow.ms = 4000;
    await page.locator('#more-go').click();
    await page.locator('#more-status:has-text("Downloading")').waitFor({ timeout: 30000 });
    await page.locator('#more-cancel').click();
    await page.locator('#more-status:has-text("Stopped. Your list is as it was.")').waitFor({ timeout: 10000 });
    assert.equal(await page.locator('#more-go').isEnabled(), true);
    slow.ms = 0;
    await page.locator('#more-go').click();
    await page.locator('#more-head:not([hidden])').waitFor({ timeout: 120000 });
    assert.ok(await page.locator('#more-list li').count() >= 1);
    await ctx.close();
  });

  test('S2: the live region speaks at the start, about every 10 percent and the end; the progress bar and the visible text keep moving', async () => {
    const ctx = await newCtx(); const page = await ctx.newPage();
    await pasteToConfirm(page, LONG);
    assert.equal(await page.locator('#more-status').getAttribute('aria-live'), null, 'the fast text is not a live region');
    assert.equal(await page.locator('#more-live').getAttribute('role'), 'status');
    assert.equal(await page.locator('#more-live').getAttribute('aria-live'), 'polite');
    await instrument(page);
    await page.locator('#more-go').click();
    await page.locator('#more-head:not([hidden])').waitFor({ timeout: 120000 });
    const t = await page.evaluate(() => { window.__t.on = false; return { ...window.__t, bar: [...window.__t.bar] }; });
    const spoken = t.live.filter(Boolean);
    console.log(`  spoken updates ${spoken.length} (${spoken.join(' | ')}); visible text updates ${t.status.length}; bar values ${t.bar.length}`);
    assert.equal(spoken[0], 'Getting ready…');
    assert.match(spoken[spoken.length - 1], /^We found \d+ skills? you may also have\. None is ticked yet\.$|^We found nothing more/);
    assert.ok(spoken.length >= 4 && spoken.length <= 26, 'spoken updates: ' + spoken.length);
    assert.ok(t.status.length >= 3 * spoken.length, 'the visible text changed far more often than the spoken one: ' + t.status.length + ' against ' + spoken.length);
    assert.ok(t.bar.length >= 30, 'the bar kept moving: ' + t.bar.length + ' values');
    await ctx.close();
  });

  test('S3: drawing the confirm screen again during a download shows the download, offers no second button, and each file is downloaded once', async () => {
    const ctx = await newCtx(); const page = await ctx.newPage(); const w = watchContext(ctx);
    await pasteToConfirm(page, OPS);
    slow.ms = 3500;
    const mark = hits.length;
    await page.locator('#more-go').click();
    await page.locator('#more-status:has-text("Downloading")').waitFor({ timeout: 30000 });
    // Back leaves the screen (the intake screen starts a new pick, so the reading is gone); reading the resume again draws a new confirm screen
    await page.goBack(); await page.locator('#show-paste').waitFor();
    await page.locator('#show-paste').click(); await page.locator('#resume-text').fill(OPS); await page.locator('#read-pasted').click();
    await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 60000 });
    await page.locator('#more-skills').waitFor();
    slow.ms = 0;
    assert.equal(await page.locator('#more-go').isHidden(), true, 'no live button while the download runs');
    assert.equal(await page.locator('#more-cancel').isVisible(), true);
    assert.equal(await page.locator('#more-progress').isVisible(), true);
    assert.match(await page.locator('#more-status').innerText(), /Getting ready|Downloading/, 'the in-progress state is shown');
    // when it ends the button comes back, says nothing about a download, and reading needs none
    await page.locator('#more-go:not([hidden])').waitFor({ timeout: 120000 });
    assert.equal(await page.locator('#more-status').innerText(), 'The files are here. Press the button to look for more skills.');
    assert.equal(await page.locator('#more-go').innerText(), 'Look for more skills in your resume (runs on this device)');
    assert.equal(await page.locator('#more-live').innerText(), 'The files are here. Press the button to look for more skills.');
    await page.locator('#more-go').click();
    await page.locator('#more-head:not([hidden])').waitFor({ timeout: 120000 });
    assert.ok(await page.locator('#more-list li.suggested').count() >= 1);
    const mine = hits.slice(mark);
    for (const f of modelFiles.concat(['/vendor/transformers/transformers.min.js', '/vendor/transformers/ort-wasm-simd-threaded.wasm', '/vendor/transformers/ort-wasm-simd-threaded.mjs'])) assert.equal(mine.filter(h => h === 'GET ' + f).length, 1, f + ' was served once');
    assert.deepEqual(pageErrors(w), []);
    await ctx.close();
  });

  test('S3: a click on the button while a scan of this screen runs starts nothing new', async () => {
    const ctx = await newCtx(); const page = await ctx.newPage();
    await pasteToConfirm(page, OPS);
    const n = await page.evaluate(async () => {
      const em = await import('/work/intake_embed.js'); const rd = await import('/work/intake_read.js');
      const lines = (await rd.readResumeText('Operations Manager\nNorthwind, Kochi\nJan 2019 - Present\n- Coached five team leads on how to give feedback to their teams every week.')).achievements;
      const a = em.startScan(lines, {}); let second = 'none'; try { em.startScan(lines, {}); } catch (e) { second = e.message; }
      let third = 'none'; await em.findMoreSkills(lines, {}).catch(e => { third = e.message; });
      a.cancel(); await a.promise.catch(() => {});
      return { second, third, after: em.currentScan() };
    });
    assert.equal(n.second, 'a scan is already running');
    assert.equal(n.third, 'a scan is already running');
    assert.equal(n.after, null, 'a stopped scan leaves nothing behind');
    await ctx.close();
  });

  test('S5: the model files are under a path with the revision and are marked as never changing; a second visit in the same browser downloads no model bytes', async () => {
    const rev12 = T2.revision.slice(0, 12);
    assert.equal(T2.model_path, `models/${rev12}/`);
    for (const f of modelFiles) assert.ok(f.startsWith(`/work/models/${rev12}/`), f);
    const ctx = await newCtx(); const w = watchContext(ctx);
    const heads = {}; const h0 = hits.length;
    const onResp = page => page.on('response', r => { const u = new URL(r.url()).pathname; if (modelFiles.includes(u) || u === '/work/manifest.json') heads[u] = r.headers()['cache-control']; });
    const scan = page => page.evaluate(async text => {
      const { findMoreSkills } = await import('/work/intake_embed.js'); const { achievementLines } = await import('/work/intake/tier2.js');
      return (await findMoreSkills(achievementLines(text, { nowYear: 2026 }), { exclude: [] })).length;
    }, OPS);

    // visit 1: everything downloads once. An entry for an older revision is left in the library's cache first, and must be removed.
    const p1 = await ctx.newPage(); onResp(p1);
    await p1.goto(base + '/work/'); await p1.locator('#start').waitFor();
    const stale = `${base}/work/models/000000000000/Xenova/all-MiniLM-L6-v2/onnx/model_int8.onnx`;
    await p1.evaluate(async u => { await (await caches.open('transformers-cache')).put(u, new Response('old')); }, stale);
    const n1 = await scan(p1);
    const cached = await p1.evaluate(async () => (await (await caches.open('transformers-cache')).keys()).map(r => new URL(r.url).pathname));
    for (const f of modelFiles) assert.ok(cached.includes(f), 'the library kept ' + f);
    assert.ok(!cached.some(p => p.includes('/000000000000/')), 'a copy for an older revision was removed');
    for (const f of modelFiles) assert.equal(hits.slice(h0).filter(h => h === 'GET ' + f).length, 1, f + ' served once in visit 1');
    await p1.close();
    for (const f of modelFiles) assert.equal(heads[f], 'public, max-age=31536000, immutable', 'cache header of ' + f + ': ' + heads[f]);
    assert.equal(heads['/work/manifest.json'], 'no-cache', 'the rest of /work/ is still revalidated');

    // visit 2: a new page of the same browser
    const mark = hits.length;
    const p2 = await ctx.newPage();
    await p2.goto(base + '/work/'); await p2.locator('#start').waitFor();
    const n2 = await scan(p2);
    const second = hits.slice(mark).map(h => h.replace(/^GET /, ''));
    console.log('  second visit requests for the model and library: ' + second.filter(p => /models|vendor\/transformers|skill_vecs/.test(p)).join(', '));
    assert.deepEqual(second.filter(p => MODEL_URL.test(p)), [], 'no model file was requested again');
    assert.equal(n2, n1, 'the same answer from the kept files');
    // (the 14 MB runtime is fetched with an ordinary request: a browser with a disk cache answers 304; this test browser keeps its cache in memory, so it is not asserted)
    await ctx.close();
  });
}
