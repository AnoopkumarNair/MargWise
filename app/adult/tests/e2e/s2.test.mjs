// Slice S2 end to end (TEST_PLAN layer 7, "Slice 2"): confirm, six questions, your job today, roads with kinds, sliders re-ordering, notes (flags),
// drill, About this data. At 390x844 and 1280x800.
//   node --test app/adult/tests/e2e/s2.test.mjs      (MW_E2E_DATA=real for real data, MW_SHOTS=commit for phone screenshots, MW_NO_BUILD=1)
// Flags and kinds come from the matcher (1.2.0). With an older matcher the journey still runs and says what it skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { startServer } from './server.mjs';
import { makeSamples, CANARIES } from './samples.mjs';
import { chromium, buildApp, PUBLIC, OUT, REAL, VIEWS, axeCheck, watchContext, pageProfile, uploadToConfirm, roadsReady } from './harness.mjs';

buildApp();
let srv, browser, S, base;
test.before(async () => { srv = await startServer(PUBLIC); browser = await chromium.launch(); S = await makeSamples(browser, join(OUT, 'samples')); base = `http://127.0.0.1:${srv.port}`; });
test.after(async () => { await browser.close(); await srv.close(); });

import { SHOTS } from './harness.mjs';
async function shot2(page, v, name) {
  await page.screenshot({ path: join(OUT, `s2-${name}-${v.name}.png`), fullPage: true });
  if (v.phone && process.env.MW_SHOTS === 'commit') await page.screenshot({ path: join(SHOTS, `s2-${name}-${v.name}.png`), fullPage: true });
}
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const v of VIEWS) {
  test(`S2 journey at ${v.width}x${v.height}: questions, your job today, roads, notes, drill, about`, async () => {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, hasTouch: v.phone, isMobile: v.phone });
    const page = await ctx.newPage(); const w = watchContext(ctx);
    const ax = {};
    await uploadToConfirm(page, base, S.pdf);

    // 1. Confirm: source lines are behind one tap (owner decision 2026-10-30)
    assert.equal(await page.locator('li.skill .src:visible').count(), 0);
    assert.match(await page.locator('main').innerText(), /Where did this come from\?/);
    await page.locator('#see-roads').click();

    // 2. Six quick questions
    await page.locator('h1:has-text("A few quick questions")').waitFor();
    const qText = await page.locator('main').innerText();
    assert.match(qText, /never change the order of your roads/i); assert.match(qText, /optional/i);
    for (const id of ['hours', 'budget', 'city', 'open', 'floor', 'mode']) assert.equal(await page.locator('#fs-' + id).count(), 1, id);
    assert.equal(await page.locator('#open-same').isDisabled(), true, 'own city needs a city first');
    // big tap targets: every choice is at least 44 px tall
    const small = await page.locator('.q .seg.opt').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 44).length);
    assert.equal(small, 0, 'tap targets under 44 px');
    assert.equal(await noSideScroll(page), true);
    await shot2(page, v, '01-questions'); ax.questions = await axeCheck(page, 'questions');
    await page.locator('label[for="q-hours-0"]').click();              // 0-5 hours
    await page.locator('label[for="q-budget-0"]').click();             // free only
    await page.locator('#q-city').selectOption('city:pnq');
    assert.equal(await page.locator('#open-same').isDisabled(), false);
    await page.locator('label[for="open-1"]').click();                 // remote only
    await page.locator('label[for="q-floor-5"]').click();              // at least 20% more
    await page.locator('label[for="q-mode-2"]').click();               // remote
    await page.locator('#constraints-next').click();

    // 3. Your job today
    await page.locator('h1:has-text("Your job today")').waitFor();
    const todayText = await page.locator('main').innerText();
    assert.doesNotMatch(todayText, /not yet measured|collected 20|\(US\)/);
    assert.ok(await page.locator('li.tskill').count() >= 5, 'skills listed');
    assert.match(todayText, /People still do this|Mixed: people and AI both do this|AI already does much of this/, 'AI labels');
    assert.ok(await page.locator('li.tskill a.drill-link').count() >= 5);
    assert.match(todayText, /AI used today|No AI use seen/);
    if (!REAL) {
      assert.match(await page.locator('#tasks-ai').innerText(), /AI helps with this|AI use seen/);
      assert.match(await page.locator('#tasks-none').innerText(), /No AI use seen/);
      assert.match(await page.locator('#pay-band').innerText(), /PLFS broad group/);   // the fixture slice carries a pay band; real slices may not
      assert.match(todayText, /Pay and demand figures are coming/);
    }
    assert.match(await page.locator('#your-answers').innerText(), /Pune/);
    assert.equal(await noSideScroll(page), true);
    await shot2(page, v, '02-today'); ax.today = await axeCheck(page, 'job today');
    // the person's answers are in the profile, as ids and bands, and it passes the contract
    const { profile, check } = await pageProfile(page);
    assert.equal(check.ok, true, JSON.stringify(check.errors));
    assert.deepEqual(profile.constraints, { hours_month: '0-5', course_budget: 'free', city: 'city:pnq', open_to: ['open:remote'], pay_floor_pct: 20, mode: 'remote' });
    await page.locator('#to-roads').click();

    // 4. Roads: kinds with a plain explanation, notes, sliders
    await roadsReady(page);
    const version = await page.evaluate(async () => (await import('/work/matcher/match.js')).MATCHER_VERSION);
    const moves = await page.locator('ol.cards .badge.move').count();
    if (moves) { assert.match(await page.locator('ol.cards .move-note').first().innerText(), /:\s+\S/); console.log(`  matcher ${version}: ${moves} kind labels shown`); }
    else console.log(`  matcher ${version}: no road kinds yet, so no kind labels to check`);
    const flagged = await page.locator('ol.cards li[data-flag]').count();
    if (flagged) {
      const ids = await page.locator('ol.cards li[data-flag]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-flag')))]);
      for (const id of ids) assert.ok(['outside_time', 'below_pay_floor', 'needs_relocation'].includes(id), id);
      assert.match(await page.locator('#flag-note').innerText(), /never hides a road or changes the order/);
      console.log('  notes shown: ' + ids.join(', '));
    } else console.log(`  matcher ${version}: no notes (flags) yet`);
    // notes never hide a road or change the order: skip the questions and compare
    const order = async () => page.locator('ol.cards > li').evaluateAll(els => els.map(e => e.getAttribute('data-road')));
    const withAnswers = await order();
    await page.locator('#to-constraints').click(); await page.locator('#skip-constraints').click(); await page.locator('#to-roads').click(); await roadsReady(page);
    assert.deepEqual(await order(), withAnswers, 'answers add notes and never change the order');
    assert.equal(await page.locator('ol.cards li[data-flag]').count(), 0, 'no answers, no notes');
    const ms = Number(await page.locator('#road-list').getAttribute('data-compute-ms')); assert.ok(ms >= 0 && ms <= 200, 'roads ' + ms + ' ms');
    // sliders re-order, defaults unchanged (short move 3)
    assert.equal(await page.locator('#pr-short_move').inputValue(), '3');
    const set = async (k, val) => page.locator('#pr-' + k).fill(String(val));
    await set('pay', 0); await set('demand', 0); await set('short_move', 0); await set('ai_safe', 5);
    const byAi = await order(); await set('ai_safe', 0); await set('short_move', 5);
    assert.notDeepEqual(byAi, await order(), 'moving the sliders changes the order');
    assert.equal(await page.locator('#show-leaps').count(), 1);
    await set('pay', 1); await set('demand', 1); await set('short_move', 3); await set('ai_safe', 1);
    assert.doesNotMatch(await page.locator('main').innerText(), /not yet measured/);
    await shot2(page, v, '03-roads'); ax.roads = await axeCheck(page, 'roads');

    // 5. Road detail and drill
    await page.locator('ol.cards > li').first().getByRole('link', { name: 'See details' }).click();
    await page.locator('h2:has-text("Skills you would still need")').waitFor();
    const d = await page.locator('main').innerText();
    assert.match(d, /No reviewed course yet for these skills/); assert.match(d, /Why this order\?/);
    assert.doesNotMatch(d, /not yet measured/);
    await page.locator('#why-order summary').click();
    assert.ok(await page.locator('#why-order table.comps tbody tr').count() >= 4);
    await shot2(page, v, '04-road'); ax.road = await axeCheck(page, 'road detail');
    await page.locator('a.drill-link').first().click();
    await page.locator('ul.drill-list').waitFor();
    assert.match(await page.locator('h1').innerText(), /^Jobs that need /);
    await shot2(page, v, '05-drill'); ax.drill = await axeCheck(page, 'drill');
    const open = page.locator('ul.drill-list a.btn').first();
    if (await open.count()) {
      const href = await open.getAttribute('href'); const name = await open.getAttribute('aria-label');
      await open.click();
      await page.locator('#focus-note').waitFor();
      assert.match(await page.locator('h1').innerText(), /^Roads from /);
      assert.ok((await page.locator('h1').innerText()).includes(name.replace('See roads from ', '')));
      await roadsReady(page);
      await shot2(page, v, '06-drilled-roads');
      await page.goBack();                                       // browser back returns to the drill list
      await page.locator('ul.drill-list').waitFor();
      await page.goForward(); await page.locator('#focus-note').waitFor();
      await page.locator('#back-home').click();
      await roadsReady(page);
      assert.equal(await page.locator('#focus-note').count(), 0);
      assert.ok(href.startsWith('#/roads/'));
    } else console.log('  (no other job in the drill list has its own data in this build: skipped the job tap)');

    // 6. About this data: dates, sources and gaps are here, one link from the footer
    const foot = await page.locator('#footer').innerText();
    assert.match(foot, /About this data/); assert.match(foot, /O\*NET OnLine, U\.S\. Department of Labor/); assert.match(foot, /Release dev-unaccepted/);
    assert.doesNotMatch(foot, /as of 20\d\d/);
    await page.locator('#about-link').click();
    await page.locator('h1:has-text("About this data")').waitFor();
    const a = await page.locator('main').innerText();
    assert.match(a, /Skill ratings collected/); assert.match(a, /as of 20\d\d/); assert.match(a, /no pay or demand figures for India/i);
    await shot2(page, v, '07-about'); ax.about = await axeCheck(page, 'about');

    assert.deepEqual(w.errors, [], 'console errors');
    assert.deepEqual(w.failed, []);
    assert.ok(w.requests.every(r => r.method === 'GET' && r.url.startsWith(base) && !r.body), 'only same-origin GETs');
    const stored = await page.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie, idb: indexedDB.databases ? (await indexedDB.databases()).length : 0 }));
    assert.deepEqual(stored, { ls: 0, ss: 0, ck: '', idb: 0 });
    console.log(`  axe (minor/moderate, informational) at ${v.name}:`, JSON.stringify(ax));
    await ctx.close();
  });
}
