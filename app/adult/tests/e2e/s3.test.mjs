// Slice S3 end to end (TEST_PLAN layers 7 and 8): upload each kind of file, check what was found, confirm, see roads. At 390x844 and 1280x800.
//   node --test app/adult/tests/e2e/s3.test.mjs
// Same setup as s1.test.mjs (Playwright with Chromium, `npm install` in app/adult/tests/ for axe-core). The sample files are made fresh by
// samples.mjs; the intake lane's corpus in app/adult/tests/fixtures/ is read too when it exists.
//   MW_E2E_DATA=real   build from data/graph/ (generic assertions)      MW_SHOTS=commit   also write phone screenshots to e2e/screenshots/
//   MW_NO_BUILD=1      use whatever is in hosting/public/work/ now
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { startServer } from './server.mjs';
import { makeSamples, fixtures, giveFixture, RESUME_TEXT, CANARIES } from './samples.mjs';
import { chromium, buildApp, PUBLIC, OUT, REAL, VIEWS, axeCheck, shot, watchContext, pageProfile, uploadToConfirm, roadsReady } from './harness.mjs';

buildApp();
let srv, browser, S, base;
test.before(async () => { srv = await startServer(PUBLIC); browser = await chromium.launch(); S = await makeSamples(browser, join(OUT, 'samples')); base = `http://127.0.0.1:${srv.port}`; });
test.after(async () => { await browser.close(); await srv.close(); });

const newCtx = (v, extra) => browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, hasTouch: v.phone, isMobile: v.phone, ...extra });
const NOW = new Date().getFullYear();
const bandOf = n => (n >= 18 ? '18+' : n >= 12 ? '12-18' : n >= 8 ? '8-12' : n >= 5 ? '5-8' : n >= 2 ? '2-5' : '0-2');
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const v of VIEWS) {
  test(`S3 journey at ${v.width}x${v.height}: PDF, check, edit, roads, road, start again`, async () => {
    const ctx = await newCtx(v); const page = await ctx.newPage(); const w = watchContext(ctx);
    // 1. Welcome and intake choice
    await page.goto(base + '/work/');
    await page.locator('#start').waitFor();
    assert.match(await page.locator('main').innerText(), /Your resume is read in your browser\. Nothing leaves your device\./);
    await page.locator('#start').click();
    await page.locator('#resume-file').waitFor();
    const intake = await page.locator('main').innerText();
    assert.match(intake, /Your resume is read in your browser\. Nothing leaves your device\./);
    assert.match(intake, /Upload your resume\s*Recommended/);
    assert.match(intake, /Paste text/); assert.match(intake, /No resume: type your job title/);
    assert.doesNotMatch(intake, /Most accurate/, 'S3 offers only the on-device way');
    assert.equal(await noSideScroll(page), true);
    await shot(page, v, '01-intake');
    const ax = { intake: await axeCheck(page, 'intake') };
    // the two big libraries have not been asked for yet
    assert.deepEqual(w.requests.filter(r => /\/vendor\/(pdfjs|mammoth)\//.test(r.url)), [], 'vendor libraries load only after a file is chosen');

    // 2. Choose the PDF
    await page.locator('#resume-file').setInputFiles(S.pdf);
    await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 30000 });
    assert.ok(w.requests.some(r => /\/vendor\/pdfjs\/pdf\.min\.mjs$/.test(r.url)), 'pdf.js loaded after the file was chosen');
    assert.ok(w.requests.some(r => /\/vendor\/pdfjs\/pdf\.worker\.min\.mjs$/.test(r.url)), 'the PDF worker is a same-origin file');
    assert.ok(!w.requests.some(r => /mammoth/.test(r.url)), 'mammoth is not needed for a PDF');

    // 3. Confirm: jobs, years from dates, skills with source lines
    const cards = page.locator('.role-card');
    assert.ok(await cards.count() >= 1, 'a job was found');
    const first = cards.first();
    const occ = await first.locator('input[name^="occ-"]:checked').getAttribute('value');
    assert.match(occ, /^occ:/);
    if (!REAL) assert.equal(occ, 'occ:13-2011.00');
    if (await cards.count() >= 2) {
      assert.equal(await first.locator('select[id^="yrs-"]').inputValue(), bandOf(NOW - 2019), 'years band from "Jan 2019 - Present"');
      assert.equal(await cards.nth(1).locator('select[id^="yrs-"]').inputValue(), bandOf(2018 - 2014), 'years band from "2014 - 2018"');
    }
    assert.equal(await first.locator('input[id^="cur-"]').isChecked(), true, '"I still work here" from the dates');
    assert.match(await first.locator('select[id^="ind-"]').inputValue(), /^(it|bpm|bfsi|other)$/);
    const nSk = await page.locator('li.skill').count();
    assert.ok(nSk >= 5, 'skills found: ' + nSk);
    assert.ok(await page.locator('li.skill .src').count() >= 5, 'each skill shows the line it came from');
    assert.match(await page.locator('li.skill .src').first().innerText(), /^From your resume: “.+”$/);
    // the recency rule: used within 3 years, rusty when older
    const old = page.locator('li.skill:has(.tag:text-matches("last used 20(0|1[0-9])"))');
    if (await old.count()) assert.equal(await old.first().locator('input[type=radio]:checked').getAttribute('value'), 'rusty');
    const recent = page.locator(`li.skill:has(.tag:text("last used ${NOW}"))`);
    if (await recent.count()) assert.equal(await recent.first().locator('input[type=radio]:checked').getAttribute('value'), 'used');
    assert.equal(await noSideScroll(page), true, 'no sideways scroll on the confirm screen');
    const total = Number(await page.locator('section.screen[data-total-ms]').getAttribute('data-total-ms'));
    console.log(`  file chosen -> confirm screen: ${total} ms (${v.name})`);
    await shot(page, v, '02-confirm');
    ax.confirm = await axeCheck(page, 'confirm');

    // 4. Edit: strength tap, remove, add by search, a usual skill chip, leadership
    const row = page.locator('li.skill').first();
    await row.getByLabel('Strong').check();
    assert.equal(await row.getByLabel('Strong').isChecked(), true);
    const before = await page.locator('#skill-count').innerText();
    await page.locator('li.skill').nth(1).locator('input[type=checkbox]').uncheck();
    assert.notEqual(await page.locator('#skill-count').innerText(), before, 'removing a skill changes the count');
    await page.locator('#skill-search').fill('python');
    await page.locator('#skill-results button').first().click();
    await page.locator('#added-skills li.skill').first().waitFor();
    assert.match(await page.locator('#added-skills').innerText(), /You added this\./);
    await page.locator('.chip').first().waitFor();
    const nChips = await page.locator('.chip').count(); assert.ok(nChips >= 1 && nChips <= 12, 'chips: ' + nChips);
    const chipId = await page.locator('.chip').first().getAttribute('data-chip');
    await page.locator('.chip').first().click();
    await page.locator(`li.skill[data-skill="${chipId}"]`).waitFor();
    await page.locator(`.chip[data-chip="${chipId}"]`).waitFor({ state: 'detached' });   // a tapped chip is gone
    await page.getByLabel('6 to 20 people').check();
    assert.equal(await page.getByLabel('No', { exact: true }).nth(0).isChecked(), true, 'the other two leadership questions default to No');
    await page.screenshot({ path: join(OUT, `s3-02b-confirm-edited-${v.name}.png`), fullPage: true });

    // 5. Go on: the profile holds ids and bands only and passes the contract
    await page.locator('#see-roads').click();
    await roadsReady(page);
    const { profile, check } = await pageProfile(page);
    assert.equal(check.ok, true, JSON.stringify(check.errors));
    assert.ok(profile.roles.length >= 1 && profile.skills.length >= 5);
    assert.deepEqual(profile.lead, { people: '6-20', budget: false, expert: false });
    assert.ok(profile.skills.some(s => Number.isInteger(s.last)), 'last-used years are kept as numbers');
    const dump = JSON.stringify(profile);
    for (const c of Object.values(CANARIES)) assert.ok(!dump.includes(c), 'the profile holds no canary: ' + c);
    assert.ok(!/Accountant|Canary|Northwind|@/.test(dump.replace(/occ:13-2011\.00/g, '')), 'no title or line text in the profile');
    assert.deepEqual(Object.keys(profile).sort(), ['job_release', 'lead', 'priorities', 'roles', 'skills', 'v'].concat(profile.matcher_version ? ['matcher_version'] : []).sort());
    assert.match(await page.locator('#change-skills').innerText(), /Change what we found/);
    await shot(page, v, '03-roads');
    ax.roads = await axeCheck(page, 'roads');
    await page.locator('ol.cards > li').first().getByRole('link', { name: 'See details' }).click();
    await page.locator('h2:has-text("Skills you would still need")').waitFor();
    await page.getByRole('link', { name: 'Back to roads' }).last().click();
    await roadsReady(page);

    // 6. Back to the confirm screen keeps the edits; Start again clears everything
    await page.locator('#change-skills').click();
    await page.locator('h1:has-text("Check what we found")').waitFor();
    assert.equal(await page.locator('#added-skills li.skill').count() >= 1, true, 'edits are kept when you go back');
    await page.locator('#start-again').click();
    await page.locator('h1:has-text("Find your next move")').waitFor();
    const left = await page.evaluate(async () => { const s = await import('/work/state.js'); return { reading: s.state.reading, skills: s.state.skills.size, occ: s.state.occ, roles: s.state.roles, lead: s.state.lead }; });
    assert.deepEqual(left, { reading: null, skills: 0, occ: null, roles: null, lead: null }, 'Start again clears the reading and the profile');

    // 7. Hygiene
    assert.deepEqual(w.errors, [], 'console errors');
    assert.deepEqual(w.failed, [], 'failed requests');
    console.log(`  axe (minor/moderate, informational) at ${v.name}:`, JSON.stringify(ax));
    await ctx.close();
  });

  test(`S3 at ${v.width}x${v.height}: DOCX, pasted text and a text file all reach the confirm screen`, async () => {
    const ctx = await newCtx(v); const page = await ctx.newPage(); const w = watchContext(ctx);
    await uploadToConfirm(page, base, S.docx);
    assert.ok(w.requests.some(r => /\/vendor\/mammoth\/mammoth\.browser\.min\.js$/.test(r.url)), 'mammoth loaded for the DOCX');
    assert.ok(!w.requests.some(r => /pdfjs/.test(r.url)), 'pdf.js is not needed for a DOCX');
    assert.ok(await page.locator('.role-card').count() >= 1 && await page.locator('li.skill').count() >= 5);
    await page.locator('#see-roads').click(); await page.locator('#road-count:has-text("shown")').waitFor();
    // pasted text
    await page.goto(base + '/work/#/'); await page.locator('#start').click();
    await page.locator('#show-paste').click();
    await page.locator('#resume-text').fill(RESUME_TEXT);
    await page.locator('#read-pasted').click();
    await page.locator('h1:has-text("Check what we found")').waitFor();
    assert.ok(await page.locator('li.skill').count() >= 5);
    await shot(page, v, '04-pasted');
    // a text file
    await uploadToConfirm(page, base, S.txt);
    assert.ok(await page.locator('li.skill').count() >= 5);
    assert.deepEqual(w.errors, [], 'console errors'); assert.deepEqual(w.failed, []);
    await ctx.close();
  });

  test(`S3 at ${v.width}x${v.height}: a scan, a non-resume, a long file, a big file and an old format each get a plain message`, async () => {
    const ctx = await newCtx(v); const page = await ctx.newPage(); const w = watchContext(ctx);
    const err = page.locator('#intake-error');
    const choose = async f => { await page.goto(base + '/work/#/intake'); await page.locator('#resume-file').setInputFiles(f); };
    // scanned: no text, so the paste box opens
    await choose(S.scanned);
    await err.filter({ hasText: /looks like a scan/ }).waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#paste-box').isVisible(), true, 'the paste box opens for a scan');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'resume-text', 'focus moves to the paste box');
    assert.match(page.url(), /#\/intake$/);
    await shot(page, v, '05-scanned');
    await axeCheck(page, 'intake with a message');
    await page.locator('#resume-text').fill(RESUME_TEXT);
    await page.locator('#read-pasted').click();
    await page.locator('h1:has-text("Check what we found")').waitFor();
    // not a resume
    await choose(S.notResume);
    await err.filter({ hasText: /does not look like a resume/ }).waitFor({ timeout: 30000 });
    assert.match(page.url(), /#\/intake$/); assert.equal(await page.locator('.role-card').count(), 0);
    await shot(page, v, '06-not-a-resume');
    // eleven pages, 5 MB, and a format we do not read
    await choose(S.long); await err.filter({ hasText: /more than 10 pages/ }).waitFor({ timeout: 30000 });
    await choose(S.tooBig); await err.filter({ hasText: /larger than 5 MB/ }).waitFor();
    await choose(S.legacy); await err.filter({ hasText: /PDF and Word \(DOCX\)/ }).waitFor();
    // short pasted text
    if (!(await page.locator('#paste-box').isVisible())) await page.locator('#show-paste').click();
    await page.locator('#resume-text').fill('too short'); await page.locator('#read-pasted').click();
    await err.filter({ hasText: /Paste more/ }).waitFor();
    // nothing in any of these went out
    assert.ok(w.requests.every(r => r.method === 'GET' && r.url.startsWith(base) && !r.body), 'only same-origin GET requests');
    assert.deepEqual(w.errors, [], 'console errors'); assert.deepEqual(w.failed, []);
    await ctx.close();
  });
}

test('the title path (no resume) starts with the top 12 ticked, shows 18, and Show all reveals the rest', async () => {
  const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
  await page.goto(base + '/work/#/intake'); await page.locator('#choose-title').click();
  await page.locator('#job-title').fill('accountant');
  await page.locator('#job-picks button:not([disabled])').first().click();
  await page.locator('.skill-groups').waitFor();
  assert.equal(await page.locator('ul.skills input:checked[type=checkbox]').count(), 12);
  assert.equal(await page.locator('ul.skills > li:not([hidden])').count(), 18);
  assert.match(await page.locator('main').innerText(), /We ticked the 12 things that matter most/);
  await shot(page, VIEWS[0], '07-title-path-skills');
  await axeCheck(page, 'title path skills');
  await page.locator('#show-all').click();
  assert.ok(await page.locator('ul.skills > li:not([hidden])').count() > 18);
  await page.locator('#see-roads').click(); await roadsReady(page);
  assert.deepEqual(w.errors, []);
  await ctx.close();
});

test('the CSP allows the PDF worker from this site only, and still blocks inline script', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const res = await page.goto(base + '/work/');
  const csp = res.headers()['content-security-policy'].split(', ').find(p => p.includes("object-src 'none'"));
  assert.match(csp, /worker-src 'self'/); assert.match(csp, /script-src 'self';/); assert.match(csp, /connect-src 'self'/);
  assert.ok(!/unsafe-inline|unsafe-eval|wasm-unsafe-eval|blob:|https?:/.test(csp), 'no inline, eval, blob or remote sources: ' + csp);
  await ctx.close();
});

test('budgets (TEST_PLAN layer 8): first load <= 300 KB, libraries only after a file is chosen, tier 1 on the 2-page file <= 2 s at 4x CPU', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const w = watchContext(ctx);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const sizes = [];
  page.on('response', async r => { try { const b = await r.body(); sizes.push({ url: r.url(), type: r.request().resourceType(), bytes: b.length }); } catch { /* redirects */ } });
  await page.goto(base + '/work/#/intake');
  await page.locator('#resume-file').waitFor();
  const first = sizes.filter(s => ['document', 'script', 'stylesheet'].includes(s.type));
  const firstBytes = first.reduce((a, s) => a + s.bytes, 0);
  console.log(`  intake screen first load: ${first.length} files, ${(firstBytes / 1024).toFixed(1)} KB of HTML+JS+CSS`);
  assert.ok(firstBytes <= 300 * 1024, 'first load ' + firstBytes);
  assert.ok(!sizes.some(s => /\/vendor\/(pdfjs|mammoth)\//.test(s.url)), 'no vendor library before a file is chosen');
  // The dictionaries and the reader load while the person picks a file (warmReader); the clock starts when the file is chosen.
  await page.locator('section[data-warm=done]').waitFor({ timeout: 60000 });
  assert.ok(!sizes.some(s => /\/vendor\/(pdfjs|mammoth)\//.test(s.url)), 'warming the reader does not load a vendor library');
  const t0 = Date.now();
  await page.locator('#resume-file').setInputFiles(S.pdf);
  await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 60000 });
  const ms = Date.now() - t0;
  const lib = sizes.filter(s => /\/vendor\/(pdfjs|mammoth)\//.test(s.url));
  console.log(`  2-page PDF at 4x CPU: file chosen -> confirm screen in ${ms} ms; libraries loaded lazily: ${lib.map(s => s.url.split('/').pop() + ' ' + (s.bytes / 1024).toFixed(0) + ' KB').join(', ')}`);
  assert.ok(lib.length >= 2, 'the PDF libraries loaded after the choice');
  assert.ok(ms <= 2000, `tier 1 intake took ${ms} ms`);
  assert.deepEqual(w.errors, []);
  await ctx.close();
});

// The intake lane's corpus (app/adult/tests/fixtures/<name>/), when it exists: every fixture must end on the confirm screen (then roads) or on a
// plain message, with zero console errors and nothing but same-origin GETs. The kinds that must end on a message are named below. What each file
// must contain is checked by the intake lane's own tests; with the small test graph (fixtures mode) most fixtures find few skills.
{
  const F = fixtures();
  const MESSAGE_ONLY = { scanned: /looks like a scan/, non_resume: /does not look like a resume/ };
  test(`fixture corpus: ${F.items.length} fixtures each reach the confirm screen or a plain message`, { skip: F.items.length ? false : 'app/adult/tests/fixtures/ has no fixtures yet' }, async () => {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    for (const item of F.items) {
      const r = await giveFixture(page, base, item);
      console.log(`  ${item.name}: ${r === 'confirm' ? 'confirm screen' : 'message: ' + r.slice(0, 60)}`);
      if (MESSAGE_ONLY[item.name]) assert.match(r, MESSAGE_ONLY[item.name], item.name);
      else if (!REAL) assert.ok(r === 'confirm' || /resume|skills/.test(r), item.name + ': ' + r);
      else assert.equal(r, 'confirm', item.name + ' should reach the confirm screen with the real data: ' + r);
      if (r === 'confirm') { await page.locator('#see-roads').click(); await page.waitForTimeout(100); }
    }
    assert.deepEqual(w.errors, [], 'console errors');
    assert.ok(w.requests.every(r => r.method === 'GET' && r.url.startsWith(base) && !r.body));
    await ctx.close();
  });
}
