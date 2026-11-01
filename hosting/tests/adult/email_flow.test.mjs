// TEST_PLAN layer 5, email sign-in (T3.4): happy path, known address, no account discovery, code expiry and tries, under 18, Turnstile,
// limits, invites, bad input, idempotent completion, pending tokens, switches, the dry run, and what the logs may hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle as startH } from '../../core/email_start.js';
import { handle as verifyH } from '../../core/email_verify.js';
import { handle as completeH } from '../../core/email_complete.js';
import { mintPending, readSession, emailHash } from '../../core/keys.js';
import { world, req, json, lastMail, signUp, matches, newIp, START, KEYS, T0, DAY, HOUR, MIN } from './api_helpers.mjs';

const H = { startH, verifyH, completeH };
const start = (w, body = {}, o = {}) => startH(req('POST', '/api/v1/email/start', { body: { ...START, ...body }, ip: o.ip || newIp(), ...o }), w.deps);
const verify = (w, body, o = {}) => verifyH(req('POST', '/api/v1/email/verify', { body, ip: o.ip || newIp() }), w.deps);
const complete = (w, body, o = {}) => completeH(req('POST', '/api/v1/email/complete', { body, ip: o.ip || newIp() }), w.deps);
const rows = (w, sql, ...a) => w.db.raw.prepare(sql).all(...a);
const count = (w, t) => rows(w, `SELECT COUNT(*) AS n FROM ${t}`)[0].n;
const codeOf = w => lastMail(w).code;
const wrongCode = real => (real === '000000' ? '111111' : '000000');

test('happy path: start, verify, complete; the tester is an adult with a band and a hash, and every body matches its contract', async () => {
  const w = world();
  let r = await json(await start(w)); assert.equal(r.status, 200); matches('email_start.response', r.body);
  assert.match(r.body.message, /If this address can sign in/);
  assert.equal(w.outbox.length, 1); assert.equal(w.outbox[0].to, 'asha@example.com', 'the address is normalised');
  const mail = lastMail(w); assert.match(mail.link, /^[A-Za-z0-9_-]{43}$/);
  assert.match(w.outbox[0].text, /\/work\/#link=/, 'the link keeps the token in the fragment, which is never sent to a server');
  r = await json(await verify(w, { email: 'asha@example.com', code: mail.code })); assert.equal(r.status, 200); matches('email_verify.response', r.body);
  assert.equal(r.body.needsProfile, true); assert.ok(r.body.pending && !r.body.token);
  const c = await json(await complete(w, { pending: r.body.pending, email: 'Asha@Example.com', nickname: 'Asha', consent: true, research: true })); assert.equal(c.status, 200); matches('email_complete.response', c.body);
  const t = rows(w, 'SELECT * FROM testers')[0];
  assert.equal(t.track, 'adult'); assert.equal(t.age_band, '35-44'); assert.equal(t.name, 'Asha'); assert.equal(t.research_ok, 1); assert.equal(t.key_v, 1);
  assert.match(t.email_hash, /^[0-9a-f]{64}$/); assert.equal(t.email, 'asha@example.com', 'D29: the normalised address is stored when the account is made');
  assert.equal(t.source, null); assert.equal(t.counsellor_id, null); assert.equal(t.klass, null); assert.equal(t.consent_on, '2025-10-20');
  assert.equal(rows(w, 'SELECT uses FROM invites')[0].uses, 1);
  assert.equal(count(w, 'email_codes'), 0, 'the code was used up');
  const s = await readSession(w.deps, c.body.token); assert.equal(s.id, t.id);
});

test('the link form works once, and is single use', async () => {
  const w = world(); await start(w); const { link } = lastMail(w);
  let r = await json(await verify(w, { link })); assert.equal(r.status, 200); assert.equal(r.body.needsProfile, true);
  r = await json(await verify(w, { link })); assert.equal(r.status, 400); assert.equal(r.body.error.code, 'invalid_code');
});

test('a known address signs in with a new code and gets a token; the address is kept the first time it is typed again', async () => {
  const w = world(); const first = await signUp(w, { handlers: H });
  const tid = rows(w, 'SELECT id FROM testers')[0].id;
  w.clock.advance(HOUR); let r = await json(await start(w, { email: 'ASHA@example.COM' })); assert.equal(r.status, 200);
  assert.equal(w.outbox.length, 2);
  r = await json(await verify(w, { email: 'asha@EXAMPLE.com', code: codeOf(w) })); assert.equal(r.status, 200); matches('email_verify.response', r.body);
  assert.ok(r.body.token && !r.body.needsProfile); assert.equal((await readSession(w.deps, r.body.token)).id, tid);
  assert.equal(count(w, 'testers'), 1); assert.equal(rows(w, 'SELECT email FROM testers')[0].email, 'asha@example.com');
  assert.equal(first.known, false);
  // by link: a known address also gets a token, and the stored address is left alone
  w.clock.advance(HOUR); await start(w); r = await json(await verify(w, { link: lastMail(w).link })); assert.ok(r.body.token);
});

test('no account discovery: a known and an unknown address get the same answer and run the same queries', async () => {
  const w = world(); await signUp(w, { handlers: H, email: 'known@example.com' }); w.clock.advance(HOUR);
  const measure = async email => { const q0 = w.db.queries; const res = await start(w, { email }, { ip: '198.51.100.99' }); const body = await res.json(); return { status: res.status, body, queries: w.db.queries - q0 }; };
  await measure('warm@example.com');   // the first call of a day also runs the daily purge
  const a = await measure('known@example.com'), b = await measure('stranger@example.com');
  assert.deepEqual(a.body, b.body); assert.equal(a.status, b.status); assert.equal(a.queries, b.queries);
  // a wrong code looks the same too
  const x = await json(await verify(w, { email: 'known@example.com', code: wrongCode(codeOf(w)) })), y = await json(await verify(w, { email: 'nobody@example.com', code: '123456' }));
  assert.deepEqual(x.body, y.body); assert.equal(x.body.error.code, 'invalid_code');
});

test('no account discovery while sign-up is switched off: nothing is sent to a stranger, the answer and a later verify look the same', async () => {
  const w = world({ env: { ADULT_SIGNUP: '0' } });
  await signUp(Object.assign(w, {}), { handlers: H, email: 'known@example.com' }).catch(() => {});   // sign-up is closed: cannot create the known account this way
  w.db.raw.prepare("INSERT INTO testers (id, name, created_at, track, age_band, email_hash) VALUES ('11111111-1111-4111-8111-111111111111', 'K', 1, 'adult', '25-34', ?)").run(await emailHash(w.deps, 'known@example.com'));
  const before = w.outbox.length;
  const a = await json(await start(w, { email: 'known@example.com' })), b = await json(await start(w, { email: 'stranger@example.com' }));
  assert.deepEqual(a.body, b.body); assert.equal(w.outbox.length, before + 1, 'only the known address got an email');
  assert.equal(count(w, 'email_codes') >= 2, true, 'the stranger has a decoy row, so verifying it behaves like a real one');
  const c = await json(await verify(w, { email: 'stranger@example.com', code: '123456' })); assert.equal(c.body.error.code, 'invalid_code');
  const real = await json(await verify(w, { email: 'known@example.com', code: codeOf(w) })); assert.ok(real.body.token, 'a known address can still sign in');
  w.clock.advance(20 * MIN); const d = await json(await verify(w, { email: 'stranger@example.com', code: '123456' })); assert.equal(d.body.error.code, 'expired');
});

test('code expiry: 15 minutes, then expired; a new code voids the old one; a used code is gone', async () => {
  const w = world(); await start(w); const c1 = codeOf(w);
  w.clock.advance(15 * MIN - 1000); await start(w); const c2 = codeOf(w);   // the second request replaces the first
  assert.equal(count(w, 'email_codes'), 1);
  if (c1 !== c2) { const old = await json(await verify(w, { email: 'asha@example.com', code: c1 })); assert.equal(old.body.error.code, 'invalid_code'); }
  w.clock.advance(15 * MIN + 1); let r = await json(await verify(w, { email: 'asha@example.com', code: c2 })); assert.equal(r.status, 410); assert.equal(r.body.error.code, 'expired');
  const w2 = world(); await start(w2); const c = codeOf(w2);
  assert.equal((await verify(w2, { email: 'asha@example.com', code: c })).status, 200);
  assert.equal((await json(await verify(w2, { email: 'asha@example.com', code: c }))).body.error.code, 'invalid_code', 'a code works once');
});

test('five wrong tries void the code, even for the right code afterwards', async () => {
  const w = world(); await start(w); const real = codeOf(w), bad = wrongCode(real);
  for (let i = 0; i < 5; i++) { const r = await json(await verify(w, { email: 'asha@example.com', code: bad })); assert.equal(r.body.error.code, 'invalid_code', 'try ' + (i + 1)); }
  const r = await json(await verify(w, { email: 'asha@example.com', code: real })); assert.equal(r.body.error.code, 'expired');
  assert.equal(rows(w, 'SELECT tries FROM email_codes')[0].tries, 5);
  w.clock.advance(HOUR); await start(w); assert.equal((await verify(w, { email: 'asha@example.com', code: codeOf(w) })).status, 200);
});

test('four wrong tries then the right code still works', async () => {
  const w = world(); await start(w); const real = codeOf(w);
  for (let i = 0; i < 4; i++) await verify(w, { email: 'asha@example.com', code: wrongCode(real) });
  assert.equal((await verify(w, { email: 'asha@example.com', code: real })).status, 200);
});

test('under 18: refused_age, only the under18 count is stored, and nothing else', async () => {
  const w = world(); const year = new Date(T0).getUTCFullYear();
  const r = await json(await start(w, { birthYear: year - 10 })); assert.equal(r.status, 403); assert.equal(r.body.error.code, 'refused_age'); matches('error', r.body);
  assert.deepEqual(JSON.parse(JSON.stringify(rows(w, 'SELECT invite_id, n FROM under18'))), [{ invite_id: 1, n: 1 }]);
  await start(w, { birthYear: year - 10 }); assert.equal(rows(w, 'SELECT n FROM under18')[0].n, 2);
  for (const t of ['email_codes', 'email_sends', 'joins', 'testers', 'events', 'profiles']) assert.equal(count(w, t), 0, t + ' must stay empty');
  assert.deepEqual(rows(w, 'SELECT DISTINCT metric FROM ops_daily').map(r => r.metric), ['requests'], 'the refusal itself is counted only in under18; ops_daily only has the all-requests counter');
  assert.equal(w.outbox.length, 0);
  await start(w, { birthYear: year - 10, invite: 'nosuchcode' }); assert.equal(rows(w, 'SELECT n FROM under18 WHERE invite_id = 0')[0].n, 1, 'an unknown invite is counted under 0');
  assert.ok(!JSON.stringify(rows(w, 'SELECT * FROM under18')).includes('@'));
});
test('the age rule: certainly 18 or over (this year minus birth year at least 19)', async () => {
  const w = world(); const year = new Date(T0).getUTCFullYear();
  assert.equal((await start(w, { birthYear: year - 18 })).status, 403, 'may be 17');
  assert.equal((await start(w, { birthYear: year - 19, email: 'b@example.com' })).status, 200);
  assert.equal((await start(w, { birthYear: year + 1 })).status, 403, 'a birth year in the future');
});

test('Turnstile: a failed check stores nothing; an error in the check is unavailable; no secret means unavailable', async () => {
  const w = world(); let r = await json(await start(w, { turnstile: 'ts-fail' })); assert.equal(r.status, 403); assert.equal(r.body.error.code, 'forbidden');
  for (const t of ['email_codes', 'email_sends', 'joins', 'under18']) assert.equal(count(w, t), 0, t);
  w.deps.turnstile = async () => { throw new Error('network'); }; r = await json(await start(w)); assert.equal(r.status, 503); assert.equal(r.body.error.code, 'unavailable');
  w.deps.turnstile = null; r = await json(await start(w)); assert.equal(r.status, 503);
  // an under-18 attempt must pass Turnstile first, so bots cannot inflate the count
  const w2 = world(); await start(w2, { birthYear: 2020, turnstile: 'ts-fail' }); assert.equal(count(w2, 'under18'), 0);
});

test('limits: 3 codes an hour and 10 a day per address, per IP bucket, and a site-wide daily cap', async () => {
  const w = world();
  for (let i = 0; i < 3; i++) assert.equal((await start(w)).status, 200);
  let r = await json(await start(w)); assert.equal(r.status, 429); assert.equal(r.body.error.code, 'rate_limited'); assert.equal(w.outbox.length, 3);
  for (let h = 1; h < 4; h++) { w.clock.advance(HOUR); for (let i = 0; i < 3; i++) await start(w); }   // 3 more hours of 3
  assert.equal(rows(w, 'SELECT n FROM email_sends WHERE day = ?', '2025-10-20')[0].n >= 10 || w.outbox.length >= 10, true);
  r = await json(await start(w)); assert.equal(r.status, 429, 'the daily limit of 10 holds even in a fresh hour');
  // another address is not affected
  assert.equal((await start(w, { email: 'other@example.com' })).status, 200);
  // per IP bucket: 20 an hour
  const w2 = world(); const ip = '192.0.2.77';
  for (let i = 0; i < 20; i++) assert.equal((await start(w2, { email: `u${i}@example.com` }, { ip })).status, 200, 'try ' + i);
  assert.equal((await start(w2, { email: 'u21@example.com' }, { ip })).status, 429);
  assert.equal((await start(w2, { email: 'u22@example.com' }, { ip: '192.0.2.78' })).status, 200, 'another bucket');
  w2.clock.advance(HOUR + 1000); assert.equal((await start(w2, { email: 'u23@example.com' }, { ip })).status, 200, 'the hour has passed');
  // the site-wide cap
  const w3 = world({ env: { EMAIL_DAILY_CAP: '2' } }); await start(w3, { email: 'a1@example.com' }); await start(w3, { email: 'a2@example.com' });
  r = await json(await start(w3, { email: 'a3@example.com' })); assert.equal(r.status, 503); assert.equal(r.body.error.code, 'unavailable');
  w3.clock.advance(DAY); assert.equal((await start(w3, { email: 'a3@example.com' })).status, 200, 'a new day');
});
test('the IP bucket is stored as a keyed hash, never the address', async () => {
  const w = world(); await start(w, {}, { ip: '192.0.2.55' });
  const j = rows(w, 'SELECT ip FROM joins'); assert.equal(j.length >= 1, true); for (const x of j) { assert.match(x.ip, /^e:[0-9a-f]{16}$/); assert.ok(!x.ip.includes('192.0.2.55')); }
});

test('the invite must exist, be active, be an adult invite and not be expired', async () => {
  const w = world();
  w.db.raw.exec("INSERT INTO invites (code, label, created_at, track, active) VALUES ('stud1', 's', 1, NULL, 1), ('off1', 'o', 1, 'adult', 0)");
  w.db.raw.prepare("INSERT INTO invites (code, label, created_at, track, active, expires_at) VALUES ('old1', 'o', 1, 'adult', 1, ?)").run(T0 - 1);
  for (const invite of ['nosuch', 'stud1', 'off1', 'old1']) { const r = await json(await start(w, { invite })); assert.equal(r.status, 403, invite); assert.equal(r.body.error.code, 'forbidden'); }
  assert.equal(count(w, 'email_codes'), 0); assert.equal(w.outbox.length, 0);
  assert.equal((await start(w, { invite: 'ADULT1' })).status, 200, 'invite codes are not case sensitive');
});

test('bad input: wrong types, extra fields, oversize body, wrong content type, bad JSON', async () => {
  const w = world(); const post = (body, o = {}) => startH(req('POST', '/api/v1/email/start', { body, raw: o.raw, headers: o.headers, ip: newIp() }), w.deps);
  for (const bad of [{}, { ...START, email: 'not-an-email' }, { ...START, birthYear: '1990' }, { ...START, birthYear: 1.5 }, { ...START, extra: 1 }, { ...START, turnstile: '' }, { ...START, invite: 'a b' }, { ...START, email: 'a'.repeat(300) + '@x.co' }]) {
    const r = await json(await post(bad)); assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 60)); assert.equal(r.body.error.code, 'bad_request');
  }
  assert.equal((await post(undefined, { raw: 'x'.repeat(6000) })).status, 413);
  assert.equal((await post(undefined, { raw: '{not json' })).status, 400);
  assert.equal((await post(undefined, { raw: '[1,2]' })).status, 400);
  assert.equal((await startH(new Request('https://app.test/api/v1/email/start', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(START) }), w.deps)).status, 400);
  assert.equal((await startH(new Request('https://app.test/api/v1/email/start', { method: 'GET' }), w.deps)).status, 405);
  for (const t of ['email_codes', 'email_sends', 'joins', 'under18']) assert.equal(count(w, t), 0, t);
  // verify: both forms, or neither, or a bad shape
  for (const bad of [{}, { email: 'asha@example.com' }, { email: 'asha@example.com', code: '12345' }, { link: 'short' }, { email: 'asha@example.com', code: '123456', link: 'x'.repeat(40) }, { code: '123456' }]) {
    const r = await json(await verify(w, bad)); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(r.body.error.code, 'bad_request');
  }
  for (const bad of [{}, { pending: 'x', nickname: 'a', consent: true, research: false }]) assert.equal((await complete(w, bad)).status, 400);
  assert.doesNotMatch(JSON.stringify(rows(w, 'SELECT * FROM email_codes')), /asha@/, 'no code row holds the address');
});

test('complete is idempotent: the same pending token twice, or two devices at once, give one tester', async () => {
  const w = world(); await start(w); let r = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) }));
  const body = { pending: r.body.pending, email: 'asha@example.com', nickname: 'Asha', consent: true, research: false };
  const [a, b] = await Promise.all([complete(w, body), complete(w, body)]);
  const A = await json(a), B = await json(b); assert.equal(A.status, 200); assert.equal(B.status, 200);
  assert.equal(count(w, 'testers'), 1); assert.equal(rows(w, 'SELECT uses FROM invites')[0].uses, 1, 'one use claimed once');
  const c = await json(await complete(w, { ...body, idempotency_key: 'retry-key-0001' })); assert.equal(c.status, 200);
  const ids = [A, B, c].map(x => x.body.token.split('.')[1]); assert.equal(new Set(ids).size, 1);
  assert.equal(count(w, 'testers'), 1); assert.equal(rows(w, 'SELECT uses FROM invites')[0].uses, 1);
});

test('pending tokens: expired after 30 minutes, tampering, a session token in its place, and an unknown key version', async () => {
  const w = world(); await start(w); const r = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) }));
  const body = pending => ({ pending, email: 'asha@example.com', nickname: 'Asha', consent: true, research: false });
  const p = r.body.pending;
  const tampered = p.slice(0, -1) + (p.endsWith('0') ? '1' : '0'); let x = await json(await complete(w, body(tampered))); assert.equal(x.status, 401); assert.equal(x.body.error.code, 'unauthorized');
  const parts = p.split('.'); parts[2] = '2'; x = await json(await complete(w, body(parts.join('.')))); assert.equal(x.status, 401, 'another invite id breaks the MAC');
  const band = p.split('.'); band[3] = '65+'; x = await json(await complete(w, body(band.join('.')))); assert.equal(x.status, 401, 'another age band breaks the MAC');
  const ver = p.replace(/^p1/, 'p2'); x = await json(await complete(w, body(ver))); assert.equal(x.status, 401, 'a key version we do not hold');
  w.clock.advance(30 * MIN - 1000); assert.equal((await complete(w, body(p))).status, 200, 'still valid just inside 30 minutes');
  const w2 = world(); await start(w2); const r2 = await json(await verify(w2, { email: 'asha@example.com', code: codeOf(w2) }));
  w2.clock.advance(30 * MIN + 1000); x = await json(await complete(w2, body(r2.body.pending))); assert.equal(x.status, 410); assert.equal(x.body.error.code, 'expired');
  // a session token is not a pending token (and the reverse)
  const w3 = world(); const { token } = await signUp(w3, { handlers: H }); x = await json(await complete(w3, body(token))); assert.equal(x.status, 400);
  // a pending token from the future
  const w4 = world(); await start(w4); const r4 = await json(await verify(w4, { email: 'asha@example.com', code: codeOf(w4) })); 
  w4.clock.t -= 2 * MIN; x = await json(await complete(w4, body(r4.body.pending))); assert.equal(x.status, 401, 'more than 60 seconds in the future');
});

test('the invite is checked again at the end: deactivated, expired or full means forbidden and no tester', async () => {
  const mk = async mutate => { const w = world(); await start(w); const r = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) })); mutate(w); return { w, res: await json(await complete(w, { pending: r.body.pending, email: 'asha@example.com', nickname: 'A', consent: true, research: false })) }; };
  let o = await mk(w => w.db.raw.exec('UPDATE invites SET active = 0 WHERE id = 1')); assert.equal(o.res.status, 403); assert.equal(count(o.w, 'testers'), 0);
  o = await mk(w => w.db.raw.exec('UPDATE invites SET max_uses = 1, uses = 1 WHERE id = 1')); assert.equal(o.res.status, 403); assert.equal(count(o.w, 'testers'), 0); assert.equal(rows(o.w, 'SELECT uses FROM invites')[0].uses, 1);
  o = await mk(w => w.db.raw.prepare('UPDATE invites SET expires_at = ? WHERE id = 1').run(T0 - 1)); assert.equal(o.res.status, 403, 'expired'); assert.equal(count(o.w, 'testers'), 0);
  o = await mk(w => w.db.raw.exec("UPDATE invites SET track = NULL WHERE id = 1")); assert.equal(o.res.status, 403, 'a student invite never makes an adult');
  // the last use goes to exactly one of two people
  const w = world(); w.db.raw.exec('UPDATE invites SET max_uses = 1');
  const tok = async email => { await start(w, { email }); const v = await json(await verify(w, { email, code: codeOf(w) })); return [v.body.pending, email]; };
  const p1 = await tok('a@example.com'), p2 = await tok('b@example.com');
  const rs = await Promise.all([p1, p2].map(([p, email]) => complete(w, { pending: p, email, nickname: 'N', consent: true, research: false })));
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 403]); assert.equal(count(w, 'testers'), 1); assert.equal(rows(w, 'SELECT uses FROM invites')[0].uses, 1);
});

test('the nickname is cleaned and must not be empty after cleaning', async () => {
  const w = world(); await start(w); const r = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) }));
  let x = await json(await complete(w, { pending: r.body.pending, email: 'asha@example.com', nickname: '   ', consent: true, research: false })); assert.equal(x.status, 400);
  x = await json(await complete(w, { pending: r.body.pending, email: 'asha@example.com', nickname: '  Asha K  ', consent: true, research: false })); assert.equal(x.status, 200);
  assert.equal(rows(w, 'SELECT name FROM testers')[0].name, 'Asha K');
  for (const bad of [{ consent: false }, { nickname: 'a<b' }, { nickname: 'a@b' }, { research: 'yes' }]) assert.equal((await complete(w, { pending: r.body.pending, email: 'asha@example.com', nickname: 'A', consent: true, research: false, ...bad })).status, 400, JSON.stringify(bad));
});

test('switches: sign-up off means no new account (a known address still signs in); the mailer decides email_dry_run', async () => {
  const w = world(); await start(w); const r = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) }));
  w.deps.flags.adultSignup = false;
  let x = await json(await complete(w, { pending: r.body.pending, email: 'asha@example.com', nickname: 'A', consent: true, research: false })); assert.equal(x.status, 503); assert.equal(x.body.error.code, 'unavailable'); assert.equal(count(w, 'testers'), 0);
  w.deps.flags.adultSignup = true; assert.equal((await complete(w, { pending: r.body.pending, email: 'asha@example.com', nickname: 'A', consent: true, research: false })).status, 200);
  w.deps.flags.adultSignup = false; w.clock.advance(HOUR); await start(w); x = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) })); assert.ok(x.body.token, 'known addresses keep working');
  // verify of a new address when sign-up has since been closed
  const w2 = world(); await start(w2); w2.deps.flags.adultSignup = false; x = await json(await verify(w2, { email: 'asha@example.com', code: codeOf(w2) })); assert.equal(x.status, 503);
});

test('the dry run records the message and sends nothing; a real mailer gets exactly the message; a failing or missing mailer is unavailable', async () => {
  const w = world(); assert.equal(w.deps.flags.emailDryRun, true); assert.equal(w.deps.email.dryRun, true); await start(w); assert.equal(w.outbox.length, 1);
  assert.match(w.outbox[0].text, /Your Margwise code is \d{6}/); assert.match(w.outbox[0].subject, /sign-in code/);
  const sent = []; const w2 = world({ env: { EMAIL_DRY_RUN: '0' } }); w2.deps.email = { dryRun: false, send: async m => { sent.push(m); } };
  await start(w2); assert.equal(sent.length, 1); assert.equal(sent[0].to, 'asha@example.com');
  const w3 = world(); w3.deps.email = { send: async () => { throw new Error('provider down'); } };
  let r = await json(await start(w3)); assert.equal(r.status, 503); assert.equal(r.body.error.code, 'unavailable'); assert.match(r.body.error.message, /could not send your code/);
  assert.equal(rows(w3, "SELECT n FROM ops_daily WHERE metric = 'email_errors'")[0].n, 1);
  const w4 = world(); w4.deps.email = null; r = await json(await start(w4)); assert.equal(r.status, 503);
  const w5 = world({ env: { SIGN_KEY: 'short' } }); r = await json(await start(w5)); assert.equal(r.status, 503, 'a missing key fails closed');
});

test('every response carries the standard headers and a request id', async () => {
  const w = world();
  for (const res of [await start(w), await start(w, { turnstile: 'ts-fail' }), await verify(w, { email: 'x@example.com', code: '123456' }), await complete(w, { pending: 'x' })]) {
    assert.equal(res.headers.get('content-type'), 'application/json'); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('x-request-id'), /^[0-9a-f]{16}$/); assert.equal(res.headers.get('access-control-allow-origin'), null);
  }
});

test('the counters: codes sent, code failures and sign-ups are counted, and nothing about a person', async () => {
  const w = world(); await signUp(w, { handlers: H }); await verify(w, { email: 'asha@example.com', code: '123456' });
  const m = Object.fromEntries(rows(w, 'SELECT metric, n FROM ops_daily').map(r => [r.metric, r.n]));
  assert.equal(m.codes_sent, 1); assert.equal(m.signups, 1); assert.equal(m.code_failures, 1); assert.ok(m.requests >= 4);
  assert.equal(rows(w, 'SELECT day FROM ops_daily')[0].day, '2025-10-20');
});

test('the daily purge removes old codes, send counts and IP rows once a day', async () => {
  const w = world(); await start(w);
  w.db.raw.prepare("INSERT INTO email_codes VALUES ('old', 'c', 'l', 1, 0, NULL, NULL, ?)").run(T0 - DAY - 1000);
  w.db.raw.prepare("INSERT INTO email_sends VALUES ('old', '2025-10-01', 1), ('old', '2025-10-14', 1), ('old', '2025-10-13T23', 1)").run();
  w.db.raw.prepare("INSERT INTO joins VALUES ('e:old', ?)").run(T0 - DAY - 1000);
  w.clock.advance(DAY); await start(w, { email: 'next@example.com' });
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM email_codes WHERE email_hash = 'old'")[0].n, 0);
  assert.deepEqual(rows(w, "SELECT day FROM email_sends WHERE email_hash = 'old' ORDER BY day").map(r => r.day), ['2025-10-14']);
  assert.equal(rows(w, "SELECT COUNT(*) AS n FROM joins WHERE ip = 'e:old'")[0].n, 0);
  assert.equal(rows(w, "SELECT v FROM meta WHERE k = 'adult_purge'")[0].v, '2025-10-21');
});

test('logs: no email, code, link, token, IP or body in any line, for every sign-in endpoint', async () => {
  const w = world(); const ip = '198.51.100.213';
  await signUp(w, { handlers: H, email: 'private.person@example.com', ip });
  await start(w, { birthYear: 2020 }, { ip }); await start(w, { turnstile: 'ts-fail' }, { ip }); await verify(w, { email: 'private.person@example.com', code: '654321' }, { ip }); await complete(w, { pending: 'p1.bad' }, { ip });
  const log = w.deps.logs.join('\n'); assert.ok(w.deps.logs.length >= 7);
  for (const secret of ['private.person', 'example.com', ip, '654321', 'p1.', 'asha', ...Object.values(KEYS)]) assert.ok(!log.includes(secret), 'log leaks ' + secret);
  const realCode = /code is (\d{6})/.exec(w.outbox[0].text)[1], realLink = /#link=([A-Za-z0-9_-]+)/.exec(w.outbox[0].text)[1];
  assert.ok(!log.includes(realCode) && !log.includes(realLink), 'the code and the link are not logged');
  for (const line of w.deps.logged()) assert.deepEqual(Object.keys(line).sort(), ['api_v', 'error_code', 'ms', 'release', 'rid', 'route', 'status', 'ts']);
});

test('D29: complete checks the email against the hash in the pending token; a mismatch or a missing address is refused and creates nothing', async () => {
  const w = world(); await start(w); const r = await json(await verify(w, { email: 'asha@example.com', code: codeOf(w) }));
  const body = { pending: r.body.pending, nickname: 'Asha', consent: true, research: false };
  const spy = []; const log = console.log, err = console.error; console.log = console.error = (...a) => spy.push(a.join(' '));
  let x; try {
    x = await json(await complete(w, { ...body, email: 'other@example.com' })); assert.equal(x.status, 400);
    assert.doesNotMatch(JSON.stringify(x.body), /other@|asha@/, 'the error holds no address');
    assert.equal((await complete(w, body)).status, 400, 'missing email');
    assert.equal((await complete(w, { ...body, email: 'not an address' })).status, 400, 'fails the contract');
  } finally { console.log = log; console.error = err; }
  assert.doesNotMatch(spy.join('\n'), /@example\.com/, 'nothing logged holds an address');
  assert.equal(count(w, 'testers'), 0); assert.equal(rows(w, 'SELECT uses FROM invites')[0].uses, 0, 'no invite use claimed');
  assert.ok(!r.body.pending.includes('asha') && !r.body.pending.includes('@'), 'the token holds no address');
  x = await json(await complete(w, { ...body, email: 'ASHA@example.com' })); assert.equal(x.status, 200, 'the same address in another case (normalised) matches');
  assert.equal(rows(w, 'SELECT email FROM testers')[0].email, 'asha@example.com');
});
