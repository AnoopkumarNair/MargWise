// Slice S5, tier 2 OFF (TEST_PLAN layers 4 and 8): a build without the model or the vectors (the test fixtures have none) must offer nothing,
// request nothing, and leave the tier 1 flow exactly as it was. Runs without the model.
//   node --test app/adult/tests/e2e/s5_off.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './server.mjs';
import { chromium, buildApp, PUBLIC, VIEWS, watchContext } from './harness.mjs';
import { RESUME_TEXT } from './samples.mjs';
import { seeRoads } from './flow.mjs';

buildApp();   // the test fixtures (python3 app/adult/build.py --dev --fixtures): no skill vectors, so no tier 2
let srv, browser, base;
test.before(async () => { srv = await startServer(PUBLIC); browser = await chromium.launch(); base = `http://127.0.0.1:${srv.port}`; });
test.after(async () => { await browser.close(); await srv.close(); });

test('without tier 2 in the build, the manifest says so and no model files are served', () => {
  const m = JSON.parse(readFileSync(join(PUBLIC, 'work', 'manifest.json'), 'utf8'));
  assert.equal(m.tier2.available, false);
  assert.match(m.tier2.reason, /fixtures|skill_vecs/);
  assert.equal(existsSync(join(PUBLIC, 'work', 'models')), false);
});

test('without tier 2 the confirm screen has no offer, nothing about a model is requested, and the way on is unchanged', async () => {
  const ctx = await browser.newContext({ viewport: { width: VIEWS[0].width, height: VIEWS[0].height }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const w = watchContext(ctx);
  await page.goto(base + '/work/#/intake');
  await page.locator('#show-paste').click();
  await page.locator('#resume-text').fill(RESUME_TEXT); await page.locator('#read-pasted').click();
  await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('#more-skills').count(), 0, 'no offer');
  assert.doesNotMatch(await page.locator('main').innerText(), /Look for more skills|downloads \d+ MB/);
  await seeRoads(page);
  assert.deepEqual(w.requests.filter(r => /transformers|\/models\/|skill_vecs|\.wasm|\.onnx/.test(r.url)), []);
  assert.deepEqual(w.errors, []);
  await ctx.close();
});

test('the developer page is only in a --dev build, and says tier 2 is not in this one', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(base + '/work/tiers.html');
  await page.locator('#run1').click();
  await page.locator('#status:has-text("Tier 1 done")').waitFor();
  assert.equal(await page.locator('#run2').isDisabled(), true);
  assert.equal(await page.locator('#run2').innerText(), 'Tier 2 is not in this build');
  await ctx.close();
});
