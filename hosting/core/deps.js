// What a handler may use (BACKEND ADR-01): db, now, random, log, config, assets, flags, and the slots email, ai, turnstile
// (filled in by later tickets). Handlers are pure: handle(request, deps) -> Response. No handler reads env, Date or Math.random itself.
import { readFlags, parseSwitch, isProduction } from './flags.js';
import { makeLogger } from './log.js';
import { versions } from './versions.js';
import { makeMailer, makeDryRunMailer } from './email_send.js';
import { makeTurnstile } from './turnstile.js';

// EMAIL_DRY_RUN_PRINT puts codes and addresses in the console, which on Cloudflare is the log stream. Honoured only on a local machine
// (ENVIRONMENT unset or 'local'), never on preview or production.
export const printAllowed = env => { const e = String((env && env.ENVIRONMENT) || '').trim().toLowerCase(); return e === '' || e === 'local'; };

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };

// Settings from env. The four keys are secrets: they sit on a hidden (non-enumerable) property, so JSON.stringify(config) or a log of it cannot show them.
export function buildConfig(env = {}) {
  const retention = num(env.RETENTION_DAYS, 0);
  const config = {
    release: String(env.RELEASE_ID || 'dev'),
    apiV: versions.API_V,
    environment: String(env.ENVIRONMENT || 'local'),
    emailFrom: String(env.EMAIL_FROM || ''),
    aiDailyCap: num(env.AI_DAILY_CAP, 0),
    retentionDays: { student: num(env.RETENTION_DAYS_STUDENT, retention), adult: num(env.RETENTION_DAYS_ADULT, retention) },
    // Signing key versions (BACKEND ADR-04 and ADR-20). SIGN_KEY is the current key and has version SIGN_KEY_V (default 1). During a rotation the
    // owner keeps the old key as SIGN_KEY_PREV with its version in SIGN_KEY_PREV_V; the old key is accepted until SIGN_KEY_PREV_UNTIL (Unix ms,
    // 0 or unset = until the owner removes it). The overlap is 31 days, the longest a session token can live.
    signKeyV: Math.trunc(num(env.SIGN_KEY_V, 1)) || 1,
    signPrevV: Math.trunc(num(env.SIGN_KEY_PREV_V, 0)),
    signPrevUntil: num(env.SIGN_KEY_PREV_UNTIL, 0),
    emailDailyCap: num(env.EMAIL_DAILY_CAP, 300),     // codes sent a day across the whole site (SPEC 9)
    appOrigin: String(env.APP_ORIGIN || '').replace(/\/+$/, ''),   // for the link in the sign-in email; falls back to the request's own origin
  };
  Object.defineProperty(config, 'secrets', { enumerable: false, value: Object.freeze({ sign: env.SIGN_KEY, signPrev: env.SIGN_KEY_PREV, email: env.EMAIL_KEY, code: env.CODE_KEY, ip: env.IP_KEY, turnstile: env.TURNSTILE_SECRET, ai: env.AI_API_KEY, admin: env.ADMIN_KEY }) });
  return config;
}

export function makeDeps(env = {}, extra = {}) {
  const flags = readFlags(env), config = buildConfig(env);
  return {
    db: env.DB,
    now: () => Date.now(),
    random: n => crypto.getRandomValues(new Uint8Array(n)),
    log: makeLogger(line => console.log(line)),
    config,
    flags,
    assets: env.ASSETS || null,
    // email: {send({to, subject, text})}. Dry run records the message in memory only (never in a log); otherwise Cloudflare Email Service, or null when not set up.
    email: flags.emailDryRun ? makeDryRunMailer({ print: parseSwitch(env.EMAIL_DRY_RUN_PRINT) === true && printAllowed(env) }) : makeMailer(env, config),
    ai: null,
    // background(fn): run fn() after the reply is sent (Pages `waitUntil`; the function files pass it in). Errors are swallowed, because nobody is waiting.
    background: fn => { Promise.resolve().then(fn).catch(() => {}); },
    turnstile: makeTurnstile(config.secrets.turnstile, undefined, { production: isProduction(env) }),   // turnstile(token) -> true | false; null without a secret
    ...extra,
  };
}

// Deterministic stand-ins for tests. `db` is any D1-like object (fakedb). `clock.t` is the time; clock.advance(ms) moves it.
// `logs` collects every log line as the string that would be written. `seed` makes random() repeatable.
export function makeFakeDeps({ db = null, env = {}, now = 1760000000000, seed = 1, assets = null, ...extra } = {}) {
  const clock = { t: now, advance(ms) { clock.t += ms; return clock.t; } };
  const logs = []; let s = (seed >>> 0) || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
  const assetMap = assets;
  const tasks = [];
  const deps = makeDeps({ ...env, DB: db }, {
    now: () => clock.t,
    background: fn => { tasks.push(Promise.resolve().then(fn).catch(() => {})); },   // started at once; `await deps.settle()` waits for all of them
    random: n => Uint8Array.from({ length: n }, () => next() & 255),
    log: makeLogger(line => logs.push(line)),
    email: makeDryRunMailer(),   // the recorded messages are in deps.email.outbox
    turnstile: async token => token !== 'ts-fail',   // a test passes the token 'ts-fail' to make the check fail
    assets: assetMap ? { fetch: async req => { const p = new URL(typeof req === 'string' ? req : req.url, 'https://x.invalid').pathname; return p in assetMap ? new Response(typeof assetMap[p] === 'string' ? assetMap[p] : JSON.stringify(assetMap[p]), { status: 200 }) : new Response('not found', { status: 404 }); } } : null,
    ...extra,
  });
  return Object.assign(deps, { clock, logs, settle: async () => { while (tasks.length) await tasks.shift(); }, logged: () => logs.map(l => JSON.parse(l)) });
}
