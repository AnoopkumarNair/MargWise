// Keys, tokens and hashes for the adult API (BACKEND ADR-04 and ADR-20, T3.3).
//
// One key per purpose (each at least 32 characters, all different):
//   SIGN_KEY   session tokens and, through a derived key, pending tokens      EMAIL_KEY  email_hash
//   CODE_KEY   one-time code and link hashes                                   IP_KEY     IP bucket hashes
// Nothing here reads env, Date or Math.random: time comes from deps.now() and randomness from deps.random(n).
//
// Session token  v<keyver>.<tester_id>.<iat>.<mac>   mac = HMAC(SIGN_KEY version keyver, "adult|<tester_id>|<iat>|<keyver>")
// Pending token  p<keyver>.<email_hash>.<invite_id>.<age_band>.<iat>.<mac>
//                mac = HMAC(pending key, "pending|<email_hash>|<invite_id>|<age_band>|<iat>|<keyver>"),
//                pending key = HMAC(SIGN_KEY version keyver, "margwise/pending-key/v1") used as raw bytes
// Tokens are never logged and never put in a URL. A bad token of either kind gives the caller one answer, so nothing is learnt from the failure.
import { ipBucket } from '../functions/api/_util.js';

export const KEY_MIN = 32;
export const SESSION_MAX_AGE = 31 * 86400000;      // ADR-04: sessions last 31 days
export const SESSION_REFRESH_AFTER = 86400000;     // sliding: a new token at most once a day
export const PENDING_MAX_AGE = 30 * 60000;         // ADR-20: 30 minutes
export const CLOCK_SKEW = 60000;                   // a token may be at most 60 seconds in the future
export const CODE_LIFE = 15 * 60000;               // ADR-04: a code works for 15 minutes
export const CODE_TRIES = 5;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const SESSION_RE = /^v([1-9][0-9]{0,2})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9]{13})\.([0-9a-f]{64})$/;
const PENDING_RE = /^p([1-9][0-9]{0,2})\.([0-9a-f]{64})\.([1-9][0-9]{0,11})\.(18-24|25-34|35-44|45-54|55-64|65\+)\.([0-9]{13})\.([0-9a-f]{64})$/;

// Same time for equal-length strings whatever the content. Different lengths are simply unequal (the lengths are public shapes here).
export function safeEqual(a, b) {
  a = String(a); b = String(b); if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}

async function hmacBytes(keyBytes, msg) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
const hmacHex = async (key, msg) => hex(await hmacBytes(typeof key === 'string' ? enc.encode(key) : key, msg));

// null when all four keys are usable, otherwise a short reason (never shown to people; the handler answers `unavailable`).
export function keysProblem(deps) {
  const s = deps && deps.config && deps.config.secrets; if (!s) return 'no secrets';
  const four = { SIGN_KEY: s.sign, EMAIL_KEY: s.email, CODE_KEY: s.code, IP_KEY: s.ip };
  for (const [n, v] of Object.entries(four)) if (typeof v !== 'string' || v.length < KEY_MIN) return n + ' is missing or too short';
  if (new Set(Object.values(four)).size !== 4) return 'the four keys must all be different';
  if (s.signPrev != null && s.signPrev !== '' && (typeof s.signPrev !== 'string' || s.signPrev.length < KEY_MIN || s.signPrev === s.sign)) return 'SIGN_KEY_PREV is not usable';
  return null;
}

// The signing key for a version: the current one, or the previous one while the overlap lasts. null for any other version.
export function signKey(deps, v) {
  const c = deps.config, s = c.secrets;
  if (v === c.signKeyV) return s.sign;
  if (c.signPrevV > 0 && v === c.signPrevV && typeof s.signPrev === 'string' && s.signPrev.length >= KEY_MIN && (!c.signPrevUntil || deps.now() < c.signPrevUntil)) return s.signPrev;
  return null;
}

// ---- email: normalisation and hashes ----
// Trim, NFKC, lower-case. No provider tricks (no Gmail dots, no +tags): they are lossy and differ between providers (ADR-04).
export const normaliseEmail = e => String(e == null ? '' : e).trim().normalize('NFKC').toLowerCase();
export const emailHash = (deps, email) => hmacHex(deps.config.secrets.email, 'em:v1:' + normaliseEmail(email));
export const codeHash = (deps, eh, code) => hmacHex(deps.config.secrets.code, 'code:v1:' + eh + ':' + code);
export const linkHash = (deps, token) => hmacHex(deps.config.secrets.code, 'link:v1:' + token);
// A hash nobody can match, for the decoy row that keeps "known" and "unknown" addresses looking the same (email_start.js).
export const decoyHash = (deps, kind) => hmacHex(deps.config.secrets.code, 'decoy:v1:' + kind + ':' + hex(deps.random(16)));
// The IP bucket hash used for limits: a keyed hash of the /64 or IPv4 address, cut to 16 hex characters. Stored only in `joins`, for 24 hours.
export const ipKey = (deps, request) => hmacHex(deps.config.secrets.ip, 'ip:' + ipBucket(request.headers.get('cf-connecting-ip'))).then(h => h.slice(0, 16));

// ---- randomness (all from deps.random) ----
// A 6-digit code, uniform: bytes that would bias the result are thrown away.
export function newCode(deps) {
  const LIMIT = 4294000000;   // the largest multiple of 1,000,000 that fits in 32 bits
  for (;;) {
    const b = deps.random(4), n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (n < LIMIT) return String(n % 1000000).padStart(6, '0');
  }
}
export const newLinkToken = deps => btoa(String.fromCharCode(...deps.random(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');   // 43 characters
export function newUuid(deps) {
  const b = deps.random(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = hex(b); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---- session tokens ----
export async function mintSession(deps, testerId, at = deps.now()) {   // `at`: the issue time, when the caller read the clock earlier (auth.js)
  const v = deps.config.signKeyV, iat = String(at).padStart(13, '0');
  return `v${v}.${testerId}.${iat}.${await hmacHex(signKey(deps, v), `adult|${testerId}|${iat}|${v}`)}`;
}
// -> {id, iat, keyver} for a token that is well-formed, signed by a key we hold, and neither too new nor too old; otherwise null.
// The database checks (tester exists, is an adult, iat after tok_after) are in auth.js.
export async function readSession(deps, token) {
  const m = typeof token === 'string' ? SESSION_RE.exec(token) : null; if (!m) return null;
  const keyver = Number(m[1]), key = signKey(deps, keyver); if (!key) return null;
  const mac = await hmacHex(key, `adult|${m[2]}|${m[3]}|${keyver}`); if (!safeEqual(mac, m[4])) return null;
  const iat = Number(m[3]), now = deps.now();
  if (iat > now + CLOCK_SKEW || now - iat > SESSION_MAX_AGE) return null;
  return { id: m[2], iat, keyver };
}

// ---- pending tokens ----
const pendingKey = (deps, v) => hmacBytes(enc.encode(signKey(deps, v)), 'margwise/pending-key/v1');
export async function mintPending(deps, { emailHash: eh, inviteId, ageBand }) {
  const v = deps.config.signKeyV, iat = String(deps.now()).padStart(13, '0');
  const mac = await hmacHex(await pendingKey(deps, v), `pending|${eh}|${inviteId}|${ageBand}|${iat}|${v}`);
  return `p${v}.${eh}.${inviteId}.${ageBand}.${iat}.${mac}`;
}
// -> {ok:true, emailHash, inviteId, ageBand, iat} or {ok:false, code:'unauthorized'|'expired'}. The order is the one in ADR-20:
// shape, key version, MAC, then time (too far in the future is unauthorized; past 30 minutes is expired).
export async function readPending(deps, token) {
  const m = typeof token === 'string' ? PENDING_RE.exec(token) : null; if (!m) return { ok: false, code: 'unauthorized' };
  const keyver = Number(m[1]); if (!signKey(deps, keyver)) return { ok: false, code: 'unauthorized' };
  const mac = await hmacHex(await pendingKey(deps, keyver), `pending|${m[2]}|${m[3]}|${m[4]}|${m[5]}|${keyver}`);
  if (!safeEqual(mac, m[6])) return { ok: false, code: 'unauthorized' };
  const iat = Number(m[5]), now = deps.now();
  if (iat > now + CLOCK_SKEW) return { ok: false, code: 'unauthorized' };
  if (now - iat > PENDING_MAX_AGE) return { ok: false, code: 'expired' };
  return { ok: true, emailHash: m[2], inviteId: Number(m[3]), ageBand: m[4], iat };
}

// ---- age ----
// Birth year first (SPEC 3). Only the year is asked, so the age is known only to within a year. The rule errs on the side of refusing: a person
// is let in only when they are certainly 18 or over, that is when (this year - birth year) is at least 19. A difference of 18 could be a
// 17-year-old, so it is refused until the next year. This is a proposal that needs the owner's yes: see docs/adult/deviations.md.
export const AGE_GATE_GAP = 19;
export const ageAllowed = (year, birthYear) => Number.isInteger(birthYear) && year - birthYear >= AGE_GATE_GAP;
// The band stored for fairness checks (never for matching). Uses the largest age the year allows.
export function ageBand(year, birthYear) {
  const a = year - birthYear;
  return a <= 24 ? '18-24' : a <= 34 ? '25-34' : a <= 44 ? '35-44' : a <= 54 ? '45-54' : a <= 64 ? '55-64' : '65+';
}
