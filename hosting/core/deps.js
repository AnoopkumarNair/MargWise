// What a handler may use (BACKEND ADR-01): db, now, random, log, config, assets, flags, and the slots email, ai, turnstile
// (filled in by later tickets). Handlers are pure: handle(request, deps) -> Response. No handler reads env, Date or Math.random itself.
import { readFlags } from './flags.js';
import { makeLogger } from './log.js';
import { versions } from './versions.js';

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
  };
  Object.defineProperty(config, 'secrets', { enumerable: false, value: Object.freeze({ sign: env.SIGN_KEY, email: env.EMAIL_KEY, code: env.CODE_KEY, ip: env.IP_KEY, turnstile: env.TURNSTILE_SECRET, ai: env.AI_API_KEY }) });
  return config;
}

export function makeDeps(env = {}, extra = {}) {
  return {
    db: env.DB,
    now: () => Date.now(),
    random: n => crypto.getRandomValues(new Uint8Array(n)),
    log: makeLogger(line => console.log(line)),
    config: buildConfig(env),
    flags: readFlags(env),
    assets: env.ASSETS || null,
    email: null, ai: null, turnstile: null,
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
  const deps = makeDeps({ ...env, DB: db }, {
    now: () => clock.t,
    random: n => Uint8Array.from({ length: n }, () => next() & 255),
    log: makeLogger(line => logs.push(line)),
    assets: assetMap ? { fetch: async req => { const p = new URL(typeof req === 'string' ? req : req.url, 'https://x.invalid').pathname; return p in assetMap ? new Response(typeof assetMap[p] === 'string' ? assetMap[p] : JSON.stringify(assetMap[p]), { status: 200 }) : new Response('not found', { status: 404 }); } } : null,
    ...extra,
  });
  return Object.assign(deps, { clock, logs, logged: () => logs.map(l => JSON.parse(l)) });
}
