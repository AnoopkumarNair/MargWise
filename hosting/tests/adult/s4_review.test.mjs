// Fixes from the S4 review (docs/adult/S4_REVIEW.md): B1, S1, S3, S4, S8, S9 and the cheap nits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle as startH } from '../../core/email_start.js';
import { handle as verifyH } from '../../core/email_verify.js';
import { handle as completeH } from '../../core/email_complete.js';
import { handleDelete, handleLogoutAll } from '../../core/account.js';
import { handleGet } from '../../core/profile.js';
import { makeDeps, makeFakeDeps, printAllowed } from '../../core/deps.js';
import { makeTurnstile, isTestSecret } from '../../core/turnstile.js';
import { mintPending, mintSession, emailHash } from '../../core/keys.js';
import { INVENTORY } from '../../core/data_inventory.js';
import { world, req, json, lastMail, signUp, newIp, START, KEYS, T0, DAY, HOUR, MIN } from './api_helpers.mjs';

const H = { startH, verifyH, completeH };
const start = (w, body = {}, o = {}) => startH(req('POST', '/api/v1/email/start', { body: { ...START, ...body }, ip: o.ip || newIp() }), w.deps);
const complete = (w, body) => completeH(req('POST', '/api/v1/email/complete', { body, ip: newIp() }), w.deps);
const rows = (w, sql, ...a) => w.db.raw.prepare(sql).all(...a);
const never = new Promise(() => {});
const within = (p, ms = 500) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('did not answer in time')), ms))]);
async function addKnown(w, email = 'known@example.com', id = '11111111-1111-4111-8111-111111111111') {
  w.db.raw.prepare("INSERT INTO testers (id, name, created_at, track, age_band, email_hash) VALUES (?, 'K', ?, 'adult', '25-34', ?)").run(id, T0, await emailHash(w.deps, email)); return id;
}

// ---- B1 ----
test('B1: the reply does not wait for the email provider, whether it hangs, throws or works; known and unknown get the same answer', async () => {
  for (const signup of ['1', '0']) {
    const answers = [];
    for (const provider of [() => never, async () => { throw new Error('provider down'); }, async () => {}]) {
      const w = world({ env: { ADULT_SIGNUP: signup } }); await addKnown(w); w.deps.email = { send: provider };
      const a = await within(start(w, { email: 'known@example.com' }).then(json)), b = await within(start(w, { email: 'stranger@example.com' }).then(json));
      assert.equal(a.status, 200); assert.deepEqual(a.body, b.body); answers.push(a.body);
    }
    assert.deepEqual(answers[0], answers[1]); assert.deepEqual(answers[1], answers[2]);
  }
});
test('B1: the same queries run before the reply for a known and an unknown address, and a failed send is counted afterwards', async () => {
  const w = world({ env: { ADULT_SIGNUP: '0' } }); await addKnown(w); w.deps.email = { send: async () => { throw new Error('down'); } };
  await start(w, { email: 'warm@example.com' });
  const measure = async email => { const q0 = w.db.queries; const r = await json(await start(w, { email }, { ip: '198.51.100.50' })); return { r, q: w.db.queries - q0 }; };
  const a = await measure('known@example.com'); await w.deps.settle();
  const rowsErr = rows(w, "SELECT n FROM ops_daily WHERE metric = 'email_errors'"); assert.equal(rowsErr[0].n, 1);
  w.deps.email = { send: () => never }; const c = await measure('known@example.com'), b = await measure('stranger@example.com');   // a send that never ends adds no queries of its own
  assert.equal(c.q, b.q); assert.deepEqual(a.r, b.r); assert.deepEqual(c.r, b.r);
});
test('B1: the background email is really sent and counted when the provider works', async () => {
  const w = world(); await start(w); await w.deps.settle();
  assert.equal(w.outbox.length, 1); assert.equal(rows(w, "SELECT n FROM ops_daily WHERE metric = 'codes_sent'")[0].n, 1);
});

// ---- D36 / S2 ----
test('D36: a known address gets a code and can log in with no active invite; a new address with none gets nothing', async () => {
  const w = world(); await signUp(w, { handlers: H }); w.db.raw.prepare('UPDATE invites SET active = 0').run(); w.outbox.length = 0; w.clock.advance(HOUR);
  const r = await json(await start(w)); assert.equal(r.status, 200); assert.equal(w.outbox.length, 1);
  const v = await json(await verifyH(req('POST', '/api/v1/email/verify', { body: { email: 'asha@example.com', code: lastMail(w).code } }), w.deps)); assert.ok(v.body.token);
  const s = await json(await start(w, { email: 'new@example.com' })); assert.deepEqual(s.body, r.body); assert.equal(w.outbox.length, 1, 'nothing for the new address');
});

// ---- S1 ----
test('S1: any adult route runs the daily purge, not only email/start', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H }); w.clock.advance(2 * DAY);
  w.db.raw.prepare("INSERT INTO email_codes VALUES ('old', 'c', 'l', 1, 0, NULL, NULL, ?)").run(w.clock.t - DAY - 1000);
  w.db.raw.prepare("INSERT INTO email_sends VALUES ('old', '2025-10-01', 1)").run();
  const t = await mintSession(w.deps, rows(w, 'SELECT id FROM testers')[0].id);
  await handleGet(req('GET', '/api/v1/me/profile', { token: t }), w.deps);
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM email_codes WHERE email_hash = 'old'")[0].n, 0);
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM email_sends WHERE email_hash = 'old'")[0].n, 0);
});
test('S1: an adult past RETENTION_DAYS_ADULT is gone after a request to an adult route, and the old token no longer works', async () => {
  const w = world({ env: { RETENTION_DAYS_ADULT: '10' } }); await signUp(w, { handlers: H }); const id = rows(w, 'SELECT id FROM testers')[0].id;
  w.clock.advance(11 * DAY); const t = await mintSession(w.deps, id);
  const r = await json(await handleGet(req('GET', '/api/v1/me/profile', { token: t }), w.deps)); assert.equal(r.status, 401);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers')[0].n, 0);
});

// ---- S3 ----
test('S3: a refresh that loses a race with log-out-everywhere hands out no token', async () => {
  const w = world(); await signUp(w, { handlers: H }); const id = rows(w, 'SELECT id FROM testers')[0].id;
  const old = await mintSession(w.deps, id); w.clock.advance(2 * DAY);
  const plain = await handleGet(req('GET', '/api/v1/me/profile', { token: old }), w.deps); assert.ok(plain.headers.get('x-session-token'), 'a normal refresh still works');
  const fresh = plain.headers.get('x-session-token'); w.clock.advance(2 * DAY);
  const orig = w.db.prepare.bind(w.db);
  w.db.prepare = sql => { if (/^UPDATE testers SET key_v/.test(sql)) w.db.raw.prepare('UPDATE testers SET tok_after = ?').run(w.clock.t); return orig(sql); };   // logout-all commits between the check and the refresh
  const raced = await handleGet(req('GET', '/api/v1/me/profile', { token: fresh }), w.deps);
  assert.equal(raced.headers.get('x-session-token'), null);
  w.db.prepare = orig; assert.equal((await handleGet(req('GET', '/api/v1/me/profile', { token: fresh }), w.deps)).status, 401);
});

// ---- S4 ----
async function pendingFor(w, email = 'asha@example.com') { return mintPending(w.deps, { emailHash: await emailHash(w.deps, email), inviteId: 1, ageBand: '35-44' }); }
test('S4: a pending token cannot open an account again after log-out-everywhere', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H }); const pending = await pendingFor(w);   // (a token issued earlier)
  w.clock.advance(1000); const body = { pending, email: 'asha@example.com', nickname: 'Asha', consent: true, research: false };
  assert.ok((await json(await complete(w, body))).body.token, 'before: the repeat is still allowed (idempotent)');
  await handleLogoutAll(req('POST', '/api/v1/me/logout-all', { token, body: {} }), w.deps);
  const r = await json(await complete(w, body)); assert.equal(r.status, 401); assert.ok(!r.body.token);
  w.clock.advance(MIN); const later = { ...body, pending: await pendingFor(w) };
  assert.ok((await json(await complete(w, later))).body.token, 'a pending token made after the log-out works');
});
test('S4: a pending token cannot make the account again after delete; a new one can; the mark is purged', async () => {
  const w = world(); const { token } = await signUp(w, { handlers: H }); const pending = await pendingFor(w);
  const body = { pending, email: 'asha@example.com', nickname: 'Asha', consent: true, research: false };
  await handleDelete(req('POST', '/api/v1/me/delete', { token, body: { confirm: 'DELETE' } }), w.deps);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers')[0].n, 0);
  const r = await json(await complete(w, body)); assert.equal(r.status, 401);
  assert.equal(rows(w, 'SELECT COUNT(*) AS n FROM testers')[0].n, 0, 'nothing was made'); assert.equal(rows(w, 'SELECT uses FROM invites')[0].uses, 1, 'no invite use claimed');
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM meta WHERE k LIKE 'del:%'")[0].n, 1);
  w.clock.advance(MIN); assert.ok((await json(await complete(w, { ...body, pending: await pendingFor(w) }))).body.token, 'signing up again with a fresh code is fine');
  w.clock.advance(2 * DAY); await handleGet(req('GET', '/api/v1/me/profile', { token: 'x' }), w.deps);
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM meta WHERE k LIKE 'del:%'")[0].n, 0, 'the mark does not outlive the day');
});
test('N1: the repeat path fills in an address that an older account did not have', async () => {
  const w = world(); await signUp(w, { handlers: H }); w.db.raw.prepare('UPDATE testers SET email = NULL').run(); w.clock.advance(1000);
  await complete(w, { pending: await pendingFor(w), email: 'Asha@example.com', nickname: 'Asha', consent: true, research: false });
  assert.equal(rows(w, 'SELECT email FROM testers')[0].email, 'asha@example.com');
});

// ---- S8 ----
test('S8: EMAIL_DRY_RUN_PRINT is honoured only on a local machine', async () => {
  assert.equal(printAllowed({}), true); assert.equal(printAllowed({ ENVIRONMENT: 'local' }), true);
  for (const e of ['preview', 'production', 'Production', 'staging']) assert.equal(printAllowed({ ENVIRONMENT: e }), false, e);
  const lines = []; const real = console.log; console.log = (...a) => lines.push(a.join(' '));
  try {
    for (const [environment, expected] of [['preview', 0], ['production', 0], ['', 1]]) {
      const d = makeDeps({ ...KEYS, ENVIRONMENT: environment, EMAIL_DRY_RUN: '1', EMAIL_DRY_RUN_PRINT: '1' }); await d.email.send({ to: 'a@example.com', subject: 's', text: 'code 123456' });
      assert.equal(lines.filter(l => l.includes('123456')).length, expected, environment || 'unset'); lines.length = 0;
    }
  } finally { console.log = real; }
});

// ---- N2, N4 ----
test('N2: production refuses to send a link without APP_ORIGIN, and uses it when set', async () => {
  const w = world({ env: { ENVIRONMENT: 'production' } }); const r = await json(await start(w)); assert.equal(r.status, 503); assert.equal(w.outbox.length, 0);
  const w2 = world({ env: { ENVIRONMENT: 'production', APP_ORIGIN: 'https://margwise.example/' } }); assert.equal((await start(w2)).status, 200); await w2.deps.settle();
  assert.match(w2.outbox[0].text, /^.*https:\/\/margwise\.example\/work\/#link=/m);
});
test("N4: Cloudflare's test secrets are refused in production only", async () => {
  const pass = '1x0000000000000000000000000000000AA';
  assert.ok(isTestSecret(pass) && isTestSecret('2x0000000000000000000000000000000AA') && isTestSecret('3x0000000000000000000000000000000AA') && !isTestSecret('0x4AAAAAAAreal-looking-secret-value'));
  assert.equal(makeTurnstile(pass, async () => Response.json({ success: true }), { production: true }), null);
  assert.equal(typeof makeTurnstile(pass, async () => Response.json({ success: true })), 'function');
  assert.equal(typeof makeTurnstile('0x4AAAAAAAreal-looking-secret-value', undefined, { production: true }), 'function');
  assert.equal(makeDeps({ ...KEYS, ENVIRONMENT: 'production', TURNSTILE_SECRET: pass }).turnstile, null);
  assert.equal(typeof makeDeps({ ...KEYS, ENVIRONMENT: 'preview', TURNSTILE_SECRET: pass }).turnstile, 'function');
});

// ---- S9 ----
test('S9: the inventory says what is true after A2 and D31', () => {
  const t = Object.fromEntries(INVENTORY.map(x => [x.table, x]));
  assert.deepEqual(t.testers.fields.email.who, ['tester']); assert.doesNotMatch(t.testers.fields.email.purpose, /next code sign-in/);
  assert.match(t.joins.fields.ip.purpose, /keyed hash/);
  assert.match(t.email_sends.purpose, /never made an account/); assert.match(t.email_sends.retention, /2 days/);
});
