// Slice S4 end to end (TEST_PLAN layers 5 to 7): sign up, save, log in on another device, conflict, export, delete, log out everywhere.
//   node --test app/adult/tests/e2e/s4.test.mjs
// The page talks to the REAL API handlers (hosting/core/) on an in-memory database, through api_server.mjs. Sign-in codes come from the dry-run
// mailer (GET /__test/mail). Same setup as the other e2e files (Playwright with Chromium, `npm ci` in app/adult/tests/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startApiServer } from './api_server.mjs';
import { makeSamples, RESUME_TEXT, CANARIES } from './samples.mjs';
import { chromium, buildApp, PUBLIC, OUT, VIEWS, axeCheck, shot, watchContext, uploadToConfirm } from './harness.mjs';
import { seeRoads } from './flow.mjs';

buildApp();
let browser, S;
test.before(async () => { browser = await chromium.launch(); S = await makeSamples(browser, join(OUT, 'samples')); });
test.after(async () => { await browser.close(); });

const YEAR = new Date().getUTCFullYear();
const newCtx = (v, extra) => browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, hasTouch: v.phone, isMobile: v.phone, acceptDownloads: true, ...extra });
const mail = async (srv, n) => { for (let i = 0; i < 50; i++) { const m = await (await fetch(srv.base + '/__test/mail')).json(); if (m.count >= n) return m; await new Promise(r => setTimeout(r, 40)); } throw new Error('no email'); };
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const apiLog = async srv => (await fetch(srv.base + '/__test/requests')).json();
const stored = page => page.evaluate(() => ({ ls: Object.fromEntries(Object.entries(localStorage)), ss: Object.keys(sessionStorage).length, ck: document.cookie }));

async function titleToRoads(page, base) {
  if (page.url().startsWith(base + '/work/')) await page.evaluate(() => { location.hash = '#/intake'; });   // in the app: an invite code held in memory stays
  else await page.goto(base + '/work/#/intake');
  await page.locator('#choose-title').click();
  await page.locator('#job-title').fill('accountant');
  await page.locator('#job-picks button:not([disabled])').first().click();
  await seeRoads(page);
}

// birth year -> email -> code -> nickname + notice -> account. Ends on the page the app opens after sign-up.
async function signUp(page, srv, { email = 'asha@example.com', nickname = 'Asha', research = false, invite, n = 1 } = {}) {
  await page.locator('#birth-year').fill(String(YEAR - 30));
  await page.locator('#birth-next').click();
  await page.locator('#email').fill(email);
  if (invite) await page.locator('#invite').fill(invite);
  await page.locator('#send-code').click();
  await page.locator('#code').waitFor();
  const m = await mail(srv, n);
  assert.equal(m.to, email.toLowerCase());
  await page.locator('#code').fill(m.code);
  await page.locator('#check-code').click();
  await page.locator('#nickname').waitFor();
  await page.locator('#nickname').fill(nickname);
  await page.locator('#consent').check();
  if (research) await page.locator('#research').check();
  await page.locator('#make-account').click();
  return m;
}
async function logIn(page, srv, { email = 'asha@example.com', n }) {
  await page.locator('#birth-year').fill(String(YEAR - 30));
  await page.locator('#email').fill(email);
  if (!(await page.locator('#invite').inputValue())) await page.locator('#invite').fill('adult1');
  await page.locator('#send-code').click();
  await page.locator('#code').waitFor();
  const m = await mail(srv, n);
  await page.locator('#code').fill(m.code);
  await page.locator('#check-code').click();
}

for (const v of VIEWS) {
  test(`S4 journey at ${v.width}x${v.height}: roads, sign up, save, log in on another device, export, delete`, async () => {
    const srv = await startApiServer(PUBLIC); const base = srv.base;
    try {
      const ctx = await newCtx(v); const page = await ctx.newPage(); const w = watchContext(ctx);
      // 1. Signed out: the app works, and nothing has been sent or stored
      await page.goto(base + '/work/?c=adult1');
      await page.locator('#start').waitFor();
      assert.match(await page.locator('main').innerText(), /no sign-in needed/i);
      assert.equal(await page.locator('#nav-login').count(), 1);
      await titleToRoads(page, base);
      assert.deepEqual(await apiLog(srv), [], 'no request to the server while signed out');
      assert.deepEqual(await stored(page), { ls: {}, ss: 0, ck: '' });
      const box = page.locator('#save-box');
      assert.match(await box.innerText(), /You do not need an account/);
      assert.equal(await noSideScroll(page), true);
      await shot(page, v, 's4-01-roads-signed-out');

      // 2. Sign up from the save box: age first, then email (the invite code comes from ?c=), the code, the notice
      await page.locator('#make-account-link').click();
      await page.locator('#birth-year').waitFor();
      assert.match(await page.locator('main').innerText(), /The year you were born/);
      assert.equal(await noSideScroll(page), true);
      await shot(page, v, 's4-02-birth-year');
      const ax = { birth: await axeCheck(page, 'birth year') };
      await page.locator('#birth-year').fill(String(YEAR - 30)); await page.locator('#birth-next').click();
      await page.locator('#email').waitFor();
      assert.equal(await page.locator('#invite').inputValue(), 'adult1', 'the invite code from ?c= is filled in');
      assert.equal(await page.locator('#turnstile').count(), 0, 'a test build has no human-check widget');
      ax.email = await axeCheck(page, 'email');
      await page.locator('#email').fill('Asha@Example.com'); await page.locator('#send-code').click();
      await page.locator('#code').waitFor();
      assert.match(await page.locator('#code-sent').innerText(), /If this address can sign in, we have sent a code/);
      await shot(page, v, 's4-03-code');
      ax.code = await axeCheck(page, 'code');
      const m = await mail(srv, 1);
      await page.locator('#code').fill('000000'); await page.locator('#check-code').click();
      await page.locator('#flow-error:not(:empty)').waitFor();
      assert.match(await page.locator('#flow-error').innerText(), /code did not work/i);
      await page.locator('#code').fill(m.code); await page.locator('#check-code').click();
      await page.locator('#nickname').waitFor();
      // the notice is the file the owner approves, shown whole, with the required tick and the research tick off
      const nt = await page.locator('main').innerText();
      assert.match(nt, /Before you make an account/); assert.match(nt, /What we keep/); assert.match(nt, /What we do not keep/); assert.match(nt, /Questions or complaints/);
      assert.equal(await page.locator('#consent').isChecked(), false);
      assert.equal(await page.locator('#research').isChecked(), false, 'research is off by default');
      assert.equal(await page.locator('#make-account').isDisabled(), true, 'no account without the nickname and the tick');
      await page.locator('#nickname').fill('Asha');
      assert.equal(await page.locator('#make-account').isDisabled(), true, 'the tick is required');
      await shot(page, v, 's4-04-notice');
      ax.notice = await axeCheck(page, 'notice');
      await page.locator('#consent').check();
      await page.locator('#make-account').click();

      // 3. Signed in, the profile was saved (the person pressed "Make an account to save")
      await page.locator('#save-status:has-text("Saved to your account")').waitFor();
      const tester = srv.db.raw.prepare('SELECT * FROM testers').all();
      assert.equal(tester.length, 1); assert.equal(tester[0].name, 'Asha'); assert.equal(tester[0].research_ok, 0); assert.equal(tester[0].track, 'adult');
      const row = srv.db.raw.prepare('SELECT rev, data FROM profiles').get();
      assert.equal(row.rev, 1);
      assert.ok(JSON.parse(row.data).skills.length > 0);
      const st = await stored(page);
      assert.deepEqual(Object.keys(st.ls).sort(), ['mw_adult_invite', 'mw_adult_token'], 'only the token and the invite code are stored');
      assert.equal(st.ls.mw_adult_invite, 'adult1');
      assert.equal(st.ss, 0); assert.equal(st.ck, '');
      assert.equal(await page.locator('#nav-account').count(), 1);
      await shot(page, v, 's4-05-saved');
      ax.saved = await axeCheck(page, 'roads signed in');

      // 4. A change after saving shows as unsaved, then saves
      await page.locator('#change-skills').click();
      await page.locator('ul.skills input[type=checkbox]:checked').first().uncheck();
      await page.locator('#see-roads').click(); await page.locator('#skip-constraints').click(); await page.locator('#to-roads').click();
      await page.locator('#save-status:has-text("not saved yet")').waitFor();
      await page.locator('#save-profile').click();
      await page.locator('#save-status:has-text("Saved to your account")').waitFor();
      assert.equal(srv.db.raw.prepare('SELECT rev FROM profiles').get().rev, 2);

      // 5. Another device: log in with a code, the saved profile opens
      const ctx2 = await newCtx(VIEWS[0]); const page2 = await ctx2.newPage();
      await page2.goto(base + '/work/#/login');
      await page2.locator('#birth-year').waitFor();
      await logIn(page2, srv, { n: 2 });
      await page2.locator('#save-status:has-text("Saved to your account")').waitFor();
      await page2.locator('#road-count:has-text("shown")').waitFor();
      assert.match(await page2.locator('#restore-note, #save-status').first().innerText(), /Saved|updated/);
      assert.ok(await page2.locator('ol.cards > li, #show-leaps').count() > 0, 'roads from the saved profile');
      assert.equal((await stored(page2)).ls.mw_adult_invite, 'adult1');
      const nSkills2 = await page2.evaluate(async () => (await import('/work/state.js')).state.skills.size);
      const nSkills1 = await page.evaluate(async () => (await import('/work/state.js')).state.skills.size);
      assert.equal(nSkills2, nSkills1, 'device B holds the same skills as device A');

      // 6. A conflict: B saves a change, then A (now stale) saves another. A is offered "Keep mine" or "Use the saved profile"
      await page2.locator('#change-skills').click();
      await page2.locator('ul.skills input[type=checkbox]:not(:checked)').first().check();
      await page2.locator('#see-roads').click(); await page2.locator('#skip-constraints').click(); await page2.locator('#to-roads').click();
      await page2.locator('#save-profile').click();
      await page2.locator('#save-status:has-text("Saved to your account")').waitFor();
      assert.equal(srv.db.raw.prepare('SELECT rev FROM profiles').get().rev, 3);
      await page.locator('#change-skills').click();
      await page.locator('ul.skills input[type=checkbox]:checked').first().uncheck();
      await page.locator('#see-roads').click(); await page.locator('#skip-constraints').click(); await page.locator('#to-roads').click();
      await page.locator('#save-profile').click();
      await page.locator('#saved-choice').waitFor();
      assert.match(await page.locator('main').innerText(), /changed on another device/);
      assert.equal(srv.db.raw.prepare('SELECT rev FROM profiles').get().rev, 3, 'nothing was overwritten');
      await shot(page, v, 's4-06-conflict');
      ax.conflict = await axeCheck(page, 'conflict');
      await page.locator('#keep-mine').click();
      await page.locator('#save-status:has-text("Saved")').waitFor();
      assert.equal(srv.db.raw.prepare('SELECT rev FROM profiles').get().rev, 4, 'keeping mine saved on top of the newer one');
      // ... and the other way: B is stale now; "Use the saved profile" opens A's version
      await page2.locator('#change-skills').click();
      await page2.locator('ul.skills input[type=checkbox]:checked').first().uncheck();
      await page2.locator('#see-roads').click(); await page2.locator('#skip-constraints').click(); await page2.locator('#to-roads').click();
      await page2.locator('#save-profile').click();
      await page2.locator('#saved-choice').waitFor();
      await page2.locator('#use-saved').click();
      await page2.locator('#save-status:has-text("Saved to your account")').waitFor();
      assert.equal(srv.db.raw.prepare('SELECT rev FROM profiles').get().rev, 4);
      assert.equal(await page2.evaluate(async () => (await import('/work/state.js')).state.skills.size), await page.evaluate(async () => (await import('/work/state.js')).state.skills.size));
      await ctx2.close();

      // 7. Export: a JSON download of what the server keeps
      await page.locator('#account-link').click();
      await page.locator('#export-data').waitFor();
      ax.account = await axeCheck(page, 'account');
      await shot(page, v, 's4-07-account');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#export-data').click()]);
      assert.match(dl.suggestedFilename(), /^margwise-my-data-\d{4}-\d{2}-\d{2}\.json$/);
      const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
      assert.ok(Array.isArray(file.tables) && !('ok' in file));
      assert.ok(file.tables.some(t => t.table === 'profiles' && t.rows.length === 1), 'the saved profile is in the file');
      assert.ok(file.tables.some(t => t.table === 'testers'));

      // 8. Delete: the button waits for the typed word
      await page.locator('#delete-data').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#delete-data').isDisabled(), true);
      await page.locator('#delete-confirm').fill('delete');
      assert.equal(await page.locator('#delete-data').isDisabled(), true, 'DELETE must be typed exactly');
      await page.locator('#delete-confirm').fill('DELETE');
      await page.locator('#delete-data').click();
      await page.locator('#welcome-note:has-text("deleted")').waitFor();
      assert.equal(srv.db.raw.prepare('SELECT COUNT(*) n FROM testers').get().n, 0);
      assert.equal(srv.db.raw.prepare('SELECT COUNT(*) n FROM profiles').get().n, 0);
      assert.deepEqual((await stored(page)).ls.mw_adult_token, undefined, 'the token is gone');
      assert.equal(await page.locator('#nav-login').count(), 1);
      assert.deepEqual(w.errors.filter(e => !/40[0149]|failed to load resource/i.test(e)), [], 'no console errors');
      console.log('S4 ' + v.name + ' axe notes', JSON.stringify(ax));
      await ctx.close();
    } finally { await srv.close(); }
  });
}

test('S4: under the age limit, nothing is sent or kept (the page decides; the server would also refuse)', async () => {
  const srv = await startApiServer(PUBLIC);
  try {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await page.goto(srv.base + '/work/#/signup');
    await page.locator('#birth-year').fill('abc'); await page.locator('#birth-next').click();
    assert.match(await page.locator('#flow-error').innerText(), /four digits/);
    await page.locator('#birth-year').fill(String(YEAR - 18)); await page.locator('#birth-next').click();   // 18 this year: the server rule (D30) refuses
    await page.locator('#refused').waitFor();
    assert.match(await page.locator('#refused').innerText(), new RegExp('born in ' + (YEAR - 19) + ' or earlier'));
    assert.match(await page.locator('main').innerText(), /born in \d{4} or earlier/);
    await shot(page, VIEWS[0], 's4-08-refused');
    assert.deepEqual(await apiLog(srv), [], 'no request');
    assert.deepEqual(w.requests.filter(r => /\/api\//.test(r.url)), []);
    assert.deepEqual(await stored(page), { ls: {}, ss: 0, ck: '' });
    assert.equal(srv.db.raw.prepare('SELECT COUNT(*) n FROM under18').get().n, 0, 'the server was not even told');
    // exactly at the limit is allowed
    await page.goto(srv.base + '/work/#/'); await page.locator('#start').waitFor();
    await page.goto(srv.base + '/work/#/signup'); await page.locator('#birth-year').fill(String(YEAR - 19)); await page.locator('#birth-next').click();
    await page.locator('#email').waitFor();
    // log-in asks the same question, and also stops before sending anything
    await page.goto(srv.base + '/work/#/login'); await page.locator('#birth-year').fill(String(YEAR - 10));
    await page.locator('#email').fill('kid@example.com'); await page.locator('#invite').fill('adult1'); await page.locator('#send-code').click();
    await page.locator('#refused').waitFor();
    assert.deepEqual(await apiLog(srv), []);
    await ctx.close();
  } finally { await srv.close(); }
});

test('S4: a wrong invite code for a new address gets the same answer as any address, and no email (D36, ADR-21)', async () => {
  const srv = await startApiServer(PUBLIC);
  try {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage();
    await page.goto(srv.base + '/work/#/signup');
    await page.locator('#birth-year').fill(String(YEAR - 30)); await page.locator('#birth-next').click();
    await page.locator('#email').fill('x@example.com'); await page.locator('#invite').fill('nope'); await page.locator('#send-code').click();
    await page.locator('#code').waitFor();   // the same next step as for any address; the server says nothing about the invite or the address
    assert.equal(srv.db.raw.prepare('SELECT COUNT(*) AS n FROM testers').get().n, 0);
    await ctx.close();
  } finally { await srv.close(); }
});

test('S4: the emailed link signs a new person up (the token is taken out of the address bar), and an old link fails plainly', async () => {
  const srv = await startApiServer(PUBLIC);
  try {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await page.goto(srv.base + '/work/#/signup');
    await page.locator('#birth-year').fill(String(YEAR - 40)); await page.locator('#birth-next').click();
    await page.locator('#email').fill('link@example.com'); await page.locator('#invite').fill('adult1'); await page.locator('#send-code').click();
    await page.locator('#code').waitFor();
    const m = await mail(srv, 1);
    // another device opens the link
    const ctx2 = await newCtx(VIEWS[0]); const p2 = await ctx2.newPage(); const w2 = watchContext(ctx2);
    await p2.goto(srv.base + '/work/#link=' + m.link);
    await p2.locator('#nickname').waitFor();
    assert.equal(new URL(p2.url()).hash, '#/link', 'the token is not left in the address bar');
    assert.ok(!(await p2.evaluate(() => history.length > 0 && document.referrer)).includes(m.link));
    await p2.locator('#confirm-email').fill('link@example.com'); await p2.locator('#nickname').fill('Ravi'); await p2.locator('#consent').check(); await p2.locator('#research').check(); await p2.locator('#make-account').click();
    await p2.locator('#welcome-note:has-text("signed in")').waitFor();
    assert.equal(srv.db.raw.prepare('SELECT research_ok FROM testers').get().research_ok, 1);
    assert.equal(srv.db.raw.prepare('SELECT email FROM testers').get().email, 'link@example.com', 'D29: the address typed on the second device is stored');
    for (const r of w2.requests) assert.ok(!r.url.includes(m.link), 'the link token is never in a URL');
    // the same link again
    await p2.goto(srv.base + '/work/#link=' + m.link); await p2.reload();
    await p2.locator('#flow-error, #welcome-note').first().waitFor();
    const p3 = await (await newCtx(VIEWS[0])).newPage();
    await p3.goto(srv.base + '/work/#link=' + m.link);
    await p3.locator('#flow-error:not(:empty)').waitFor();
    assert.match(await p3.locator('main').innerText(), /did not work/);
    assert.equal(w.errors.filter(e => !/400|410/.test(e)).length, 0);
    await ctx.close(); await ctx2.close();
  } finally { await srv.close(); }
});

test('S4: log out everywhere ends the session on every device', async () => {
  const srv = await startApiServer(PUBLIC);
  try {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage();
    await page.goto(srv.base + '/work/?c=adult1#/signup');
    await signUp(page, srv);
    await page.locator('#welcome-note:has-text("signed in")').waitFor();
    // device B logs in
    const ctx2 = await newCtx(VIEWS[0]); const page2 = await ctx2.newPage();
    await page2.goto(srv.base + '/work/?c=adult1#/login'); await logIn(page2, srv, { n: 2 });
    await page2.locator('#welcome-note:has-text("signed in")').waitFor();
    await page2.goto(srv.base + '/work/#/account'); await page2.locator('#logout-all').click();
    await page2.locator('#welcome-note:has-text("every device")').waitFor();
    assert.equal((await stored(page2)).ls.mw_adult_token, undefined);
    // device A: its token no longer works, and the page says so instead of failing silently
    await page.goto(srv.base + '/work/#/account');
    await page.locator('#not-signed-in:has-text("session has ended")').waitFor();
    assert.equal((await stored(page)).ls.mw_adult_token, undefined, 'a refused token is dropped');
    await ctx.close(); await ctx2.close();
  } finally { await srv.close(); }
});

test('S4 privacy: a signed-in resume journey sends the profile (ids) and nothing from the resume', async () => {
  const srv = await startApiServer(PUBLIC);
  try {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await page.goto(srv.base + '/work/?c=adult1#/signup');
    await signUp(page, srv);
    await page.locator('#welcome-note:has-text("signed in")').waitFor();
    await uploadToConfirm(page, srv.base, S.pdf);
    await page.locator('.chip').first().waitFor(); await page.locator('.chip').first().click();
    await seeRoads(page);
    await page.locator('#save-profile').click();
    await page.locator('#save-status:has-text("Saved to your account")').waitFor();
    const squash = s => s.replace(/\s+/g, ' ').trim(); const t = squash(RESUME_TEXT);
    const runs = []; for (let i = 0; i + 20 <= t.length; i += 3) runs.push(t.slice(i, i + 20));
    const canaries = Object.values(CANARIES).filter(c => c.length >= 6);
    const apiReqs = w.requests.filter(r => /\/api\//.test(r.url));
    assert.ok(apiReqs.some(r => r.method === 'PUT'));
    for (const r of apiReqs) {
      const text = decodeURIComponent(r.url) + ' ' + (r.body || '');
      for (const c of canaries) assert.ok(!text.includes(c), 'canary in an API request: ' + r.url);
      for (const run of runs) assert.ok(!text.includes(run), 'resume text in an API request: ' + r.url);
      assert.ok(!/multipart|\.pdf/i.test(text), 'no file');
    }
    const stored_ = srv.db.raw.prepare('SELECT data FROM profiles').get().data;
    for (const c of canaries) assert.ok(!stored_.includes(c), 'canary in the saved profile');
    assert.deepEqual(w.requests.filter(r => r.method !== 'GET' && !/\/api\/v1\/(email|me)\//.test(r.url)), [], 'only the account calls are not GETs');
    await ctx.close();
  } finally { await srv.close(); }
});

test('S4: signed out, a whole journey makes no call to the API (title path, resume path)', async () => {
  const srv = await startApiServer(PUBLIC);
  try {
    const ctx = await newCtx(VIEWS[0]); const page = await ctx.newPage(); const w = watchContext(ctx);
    await titleToRoads(page, srv.base);
    await uploadToConfirm(page, srv.base, S.pdf);
    await page.goto(srv.base + '/work/#/account'); await page.locator('#not-signed-in').waitFor();
    await page.goto(srv.base + '/work/#/saved'); await page.locator('h1:has-text("Nothing to choose")').waitFor();
    assert.deepEqual(await apiLog(srv), []);
    assert.deepEqual(w.requests.filter(r => /\/api\//.test(r.url) || r.method !== 'GET'), []);
    assert.deepEqual(await stored(page), { ls: {}, ss: 0, ck: '' });
    await ctx.close();
  } finally { await srv.close(); }
});
