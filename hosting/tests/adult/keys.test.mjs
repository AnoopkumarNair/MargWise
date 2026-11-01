// TEST_PLAN layer 5, backend foundations (T3.3): key rotation and its overlap window, tok_after, email normalisation, the token formats of ADR-20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintSession, readSession, mintPending, readPending, normaliseEmail, emailHash, codeHash, linkHash, newCode, newUuid, newLinkToken, keysProblem, signKey, safeEqual, ageAllowed, ageBand } from '../../core/keys.js';
import { makeFakeDeps } from '../../core/deps.js';
import { mintToken, checkToken } from '../../functions/api/_util.js';
import { createFakeDb } from './fakedb.mjs';
import { KEYS, T0, DAY, MIN, matches, contract } from './api_helpers.mjs';
import { validate } from '../../../contracts/validate_lib.js';

const deps = (env = {}, now = T0) => makeFakeDeps({ now, env: { ...KEYS, ...env } });
const ID = '8b1f4c2e-5d6a-4f3b-9c7d-2e1a0b9c8d7f';

test('email normalisation: trim, NFKC, lower case; nothing provider specific', () => {
  assert.equal(normaliseEmail('  Asha@Example.COM \n'), 'asha@example.com');
  assert.equal(normaliseEmail('ＡＳＨＡ＠ｅｘａｍｐｌｅ．ｃｏｍ'), 'asha@example.com', 'full-width letters fold to the plain ones');
  assert.equal(normaliseEmail('a.b+tag@gmail.com'), 'a.b+tag@gmail.com', 'Gmail dots and +tags stay: they are lossy');
  assert.equal(normaliseEmail('ﬁle@example.com'), 'file@example.com', 'the fi ligature folds');
  assert.notEqual(normaliseEmail('аsha@example.com'), normaliseEmail('asha@example.com'), 'a Cyrillic look-alike is a different address');
  assert.equal(normaliseEmail(null), '');
});
test('the email hash is a keyed hash of the normalised address; each key has its own purpose', async () => {
  const d = deps(); const a = await emailHash(d, 'Asha@Example.com'), b = await emailHash(d, ' asha@example.com');
  assert.match(a, /^[0-9a-f]{64}$/); assert.equal(a, b);
  assert.notEqual(await emailHash(deps({ EMAIL_KEY: 'another-email-key-0123456789abcdefgh' }), 'asha@example.com'), a, 'a different EMAIL_KEY gives another hash');
  assert.equal(await emailHash(deps({ SIGN_KEY: 'another-sign-key-0123456789abcdefghij', CODE_KEY: 'another-code-key-0123456789abcdefghij' }), 'asha@example.com'), a, 'the other keys do not matter');
  const c = await codeHash(d, a, '123456'); assert.notEqual(c, await codeHash(d, a, '123457')); assert.notEqual(c, await codeHash(d, 'f'.repeat(64), '123456'), 'a code hash is tied to the address');
  assert.notEqual(await linkHash(d, 'abc'), await codeHash(d, a, 'abc'));
});

test('session tokens: the ADR-20 format, matching the contract pattern, and a round trip', async () => {
  const d = deps(); const t = await mintSession(d, ID);
  assert.match(t, /^v1\.8b1f4c2e-5d6a-4f3b-9c7d-2e1a0b9c8d7f\.1761000000000\.[0-9a-f]{64}$/);
  matches('email_complete.response', { ok: true, token: t });
  assert.deepEqual(await readSession(d, t), { id: ID, iat: T0, keyver: 1 });
});
test('session tokens: tampering with any part fails, and every failure looks the same (null)', async () => {
  const d = deps(); const t = await mintSession(d, ID), [v, id, iat, mac] = t.split('.');
  const bad = [`${v}.${id.replace('8', '9')}.${iat}.${mac}`, `${v}.${id}.${Number(iat) + 1}.${mac}`, `v2.${id}.${iat}.${mac}`, `${v}.${id}.${iat}.${mac.slice(0, -1)}0`, `${v}.${id}.${iat}`, `${t}.x`, '', 'v1', t.toUpperCase(), ' ' + t, null, undefined, 42, `v01.${id}.${iat}.${mac}`];
  for (const x of bad) assert.equal(await readSession(d, x), null, String(x).slice(0, 40));
});
test('session tokens: at most 60 seconds in the future, at most 31 days old', async () => {
  const mint = async at => { const d = deps({}, at); return mintSession(d, ID); };
  const d = deps();
  assert.ok(await readSession(d, await mint(T0 + 60000)), '60 seconds ahead is allowed');
  assert.equal(await readSession(d, await mint(T0 + 60001)), null);
  assert.ok(await readSession(d, await mint(T0 - 31 * DAY)), 'exactly 31 days old is allowed');
  assert.equal(await readSession(d, await mint(T0 - 31 * DAY - 1)), null);
});
test('a student token is not an adult token, and an adult token is not a student token', async () => {
  const d = deps(); const student = await mintToken(ID, KEYS.SIGN_KEY, T0);
  assert.equal(await readSession(d, student), null);
  const adult = await mintSession(d, ID); const db = createFakeDb(); db.raw.prepare('INSERT INTO testers (id, name, created_at) VALUES (?, ?, ?)').run(ID, 'S', T0);
  assert.equal(await checkToken({ DB: db, SIGN_KEY: KEYS.SIGN_KEY }, ID, adult, T0), null);
  // the MAC covers the track: the same id and time signed as a student does not pass as an adult
  const [, , iat] = adult.split('.'); assert.equal(await readSession(d, `v1.${ID}.${iat}.${student.split('.')[1]}`), null);
});
test('pending tokens: the ADR-20 format and a round trip', async () => {
  const d = deps(); const eh = 'ab'.repeat(32), t = await mintPending(d, { emailHash: eh, inviteId: 42, ageBand: '25-34' });
  assert.match(t, /^p1\.[0-9a-f]{64}\.42\.25-34\.1761000000000\.[0-9a-f]{64}$/);
  matches('email_verify.response', { ok: true, needsProfile: true, pending: t });
  assert.deepEqual(await readPending(d, t), { ok: true, emailHash: eh, inviteId: 42, ageBand: '25-34', iat: T0 });
  for (const band of ['18-24', '35-44', '45-54', '55-64', '65+']) { const x = await mintPending(d, { emailHash: eh, inviteId: 1, ageBand: band }); assert.equal((await readPending(d, x)).ageBand, band); matches('email_complete.request', { pending: x, nickname: 'A', consent: true, research: false }); }
});
test('pending and session tokens never pass for each other, and the pending key is not the signing key', async () => {
  const d = deps(); const p = await mintPending(d, { emailHash: 'ab'.repeat(32), inviteId: 1, ageBand: '25-34' }), s = await mintSession(d, ID);
  assert.equal(await readSession(d, p), null); assert.deepEqual(await readPending(d, s), { ok: false, code: 'unauthorized' });
  // a pending MAC computed with the plain SIGN_KEY (not the derived key) is refused
  const [, eh, inv, band, iat] = p.split('.'); const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEYS.SIGN_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const wrong = Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`pending|${eh}|${inv}|${band}|${iat}|1`))).toString('hex');
  assert.equal((await readPending(d, `p1.${eh}.${inv}.${band}.${iat}.${wrong}`)).code, 'unauthorized');
});
test('pending tokens: 30 minutes, then expired (after the MAC is checked); a bad MAC is unauthorized, not expired', async () => {
  const d = deps(); const p = await mintPending(d, { emailHash: 'ab'.repeat(32), inviteId: 1, ageBand: '25-34' });
  d.clock.advance(30 * MIN); assert.equal((await readPending(d, p)).ok, true); d.clock.advance(1); assert.deepEqual(await readPending(d, p), { ok: false, code: 'expired' });
  const bad = p.slice(0, -1) + (p.endsWith('0') ? '1' : '0'); assert.deepEqual(await readPending(d, bad), { ok: false, code: 'unauthorized' });
});

test('key rotation: old tokens work during the overlap, fail after it; new tokens carry the new version', async () => {
  const oldD = deps(); const oldToken = await mintSession(oldD, ID), oldPending = await mintPending(oldD, { emailHash: 'ab'.repeat(32), inviteId: 1, ageBand: '25-34' });
  const NEW = 'rotated-sign-key-0123456789abcdefghij';
  const rotated = (at, until) => deps({ SIGN_KEY: NEW, SIGN_KEY_V: '2', SIGN_KEY_PREV: KEYS.SIGN_KEY, SIGN_KEY_PREV_V: '1', ...(until ? { SIGN_KEY_PREV_UNTIL: String(until) } : {}) }, at);
  const d = rotated(T0 + DAY, T0 + 31 * DAY);
  assert.equal(keysProblem(d), null);
  assert.deepEqual(await readSession(d, oldToken), { id: ID, iat: T0, keyver: 1 }, 'inside the overlap');
  assert.equal((await readPending(rotated(T0 + 10 * MIN, T0 + 31 * DAY), oldPending)).ok, true, 'a pending token from the old key, within its 30 minutes');
  const fresh = await mintSession(d, ID); assert.match(fresh, /^v2\./); assert.equal((await readSession(d, fresh)).keyver, 2);
  assert.equal(await readSession(oldD, fresh), null, 'the old key never accepted version 2');
  // after the overlap (the owner's end date has passed)
  const later = rotated(T0 + 31 * DAY + 1, T0 + 31 * DAY); assert.equal(await readSession(later, oldToken), null);
  assert.equal(await readSession(later, await mintSession(later, ID)) !== null, true, 'new tokens still work');
  // after the old key is removed from the settings
  const gone = deps({ SIGN_KEY: NEW, SIGN_KEY_V: '2' }, T0 + DAY); assert.equal(await readSession(gone, oldToken), null); assert.equal((await readPending(deps({ SIGN_KEY: NEW, SIGN_KEY_V: '2' }, T0 + 10 * MIN), oldPending)).ok, false);
  // a token cannot be moved to another key version: v1 token relabelled v2 fails
  const [, id, iat, mac] = oldToken.split('.'); assert.equal(await readSession(d, `v2.${id}.${iat}.${mac}`), null);
  // the previous key is only a key if it is long enough and different
  assert.match(keysProblem(deps({ SIGN_KEY_PREV: 'short' })), /SIGN_KEY_PREV/); assert.match(keysProblem(deps({ SIGN_KEY_PREV: KEYS.SIGN_KEY })), /SIGN_KEY_PREV/);
  assert.equal(signKey(deps({ SIGN_KEY_PREV_V: '1' }), 1), KEYS.SIGN_KEY, 'version 1 is the current key here');
});
test('keys: all four are required, at least 32 characters, and all different', () => {
  assert.equal(keysProblem(deps()), null);
  for (const k of ['SIGN_KEY', 'EMAIL_KEY', 'CODE_KEY', 'IP_KEY']) { assert.match(keysProblem(deps({ [k]: '' })), new RegExp(k)); assert.match(keysProblem(deps({ [k]: 'x'.repeat(31) })), new RegExp(k)); }
  assert.match(keysProblem(deps({ CODE_KEY: KEYS.EMAIL_KEY })), /different/);
  assert.ok(keysProblem(makeFakeDeps({})));
});
test('safeEqual: equal strings, different strings, different lengths', () => { assert.ok(safeEqual('abc', 'abc')); assert.ok(!safeEqual('abc', 'abd')); assert.ok(!safeEqual('abc', 'abcd')); assert.ok(safeEqual('', '')); });

test('one-time codes: 6 digits, uniform (no modulo bias), from deps.random', () => {
  const d = deps(); for (let i = 0; i < 200; i++) assert.match(newCode(d), /^[0-9]{6}$/);
  // a draw above the largest multiple of 1,000,000 is thrown away; the next draw is used
  const seq = [[255, 255, 255, 255], [0, 0, 0, 7]]; const stub = { random: () => Uint8Array.from(seq.shift()) };
  assert.equal(newCode(stub), '000007'); assert.equal(seq.length, 0);
  const counts = new Array(10).fill(0); const e = deps({}); for (let i = 0; i < 3000; i++) counts[Number(newCode(e)[5])]++;
  for (const c of counts) assert.ok(c > 200 && c < 400, 'digits are spread out: ' + counts);
});
test('ids and link tokens come from deps.random: repeatable under a seed, and well formed', () => {
  const a = makeFakeDeps({ seed: 5 }), b = makeFakeDeps({ seed: 5 });
  assert.equal(newUuid(a), newUuid(b)); assert.match(newUuid(a), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(newLinkToken(a), /^[A-Za-z0-9_-]{43}$/); assert.notEqual(newLinkToken(a), newLinkToken(a));
});
test('the age gate and the bands', () => {
  assert.equal(ageAllowed(2025, 2006), true); assert.equal(ageAllowed(2025, 2007), false); assert.equal(ageAllowed(2025, 1899), true); assert.equal(ageAllowed(2025, 'x'), false);
  const bands = JSON.parse(readFileSync(new URL('../../../contracts/bands.json', import.meta.url), 'utf8')).age_band.values;
  for (const by of [2006, 2000, 1995, 1990, 1980, 1970, 1960, 1940, 1920]) assert.ok(bands.includes(ageBand(2025, by)), String(by));
  assert.deepEqual([2006, 2001, 2000, 1991, 1990, 1981, 1980, 1971, 1970, 1961, 1960].map(by => ageBand(2025, by)), ['18-24', '18-24', '25-34', '25-34', '35-44', '35-44', '45-54', '45-54', '55-64', '55-64', '65+']);
});
