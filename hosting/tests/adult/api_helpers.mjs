// Shared set-up for the adult API tests (TEST_PLAN layer 5): a fresh database with every migration, deps with an injected clock and
// repeatable randomness, a dry-run mailer (deps.email.outbox) and a fake Turnstile, plus small helpers to call handlers and to sign up.
import { readFileSync } from 'node:fs';
import { createFakeDb } from './fakedb.mjs';
import { makeFakeDeps } from '../../core/deps.js';
import { clearReleaseCache } from '../../core/release_ids.js';
import { checkContract } from '../../core/http.js';

export const KEYS = {
  SIGN_KEY: 'sign-key-0123456789abcdef0123456789', EMAIL_KEY: 'email-key-123456789abcdef0123456789', CODE_KEY: 'code-key-23456789abcdef0123456789ab', IP_KEY: 'ip-key-3456789abcdef0123456789abcdef', TURNSTILE_SECRET: 'ts-secret-test', ADMIN_KEY: 'admin-key-456789abcdef0123456789abc',
};
export const T0 = 1761000000000, DAY = 86400000, HOUR = 3600000, MIN = 60000;
export const contract = name => JSON.parse(readFileSync(new URL('../../../contracts/api/' + name + '.schema.json', import.meta.url), 'utf8'));
export const matches = (name, body) => { const v = checkContract(contract(name), body); if (!v.ok) throw new Error(name + ': ' + JSON.stringify(v.errors)); };

// ids the fake release knows about (the app build copies these files into /work/graph/<release>/)
export const REL = 'onet-31-0-test';
export const GRAPH_ASSETS = {
  '/work/manifest.json': { release_id: REL, graph: { base: `graph/${REL}/` } },
  [`/work/graph/${REL}/skills_index.json`]: [{ id: 'skl:2.A.1.a', label: 'x' }, { id: 'skl:2.A.2.a', label: 'x' }, { id: 'tec:excel', label: 'x' }],
  [`/work/graph/${REL}/occupations.json`]: [{ id: 'occ:13-2011.00', label: 'x' }, { id: 'occ:15-1252.00', label: 'x' }],
  [`/work/graph/${REL}/credentials.json`]: [{ id: 'cred:aws-saa' }],
  [`/work/graph/${REL}/id_registry.json`]: { registry_version: 1, entries: [
    { id: 'skl:2.A.2.z', kind: 'skill', label: 'old', first_release: 'a', status: 'tombstone', replaced_by: ['skl:2.A.2.a'], note: '' },
    { id: 'skl:2.A.9.q', kind: 'skill', label: 'gone', first_release: 'a', status: 'tombstone', replaced_by: null, note: '' },
    { id: 'skl:2.A.1.a', kind: 'skill', label: 'x', first_release: 'a', status: 'live', replaced_by: null, note: '' },
    { id: 'skl:2.A.2.a', kind: 'skill', label: 'x', first_release: 'a', status: 'live', replaced_by: null, note: '' },
    { id: 'occ:13-2011.00', kind: 'occupation', label: 'x', first_release: 'a', status: 'live', replaced_by: null, note: '' },
    { id: 'occ:15-1252.00', kind: 'occupation', label: 'x', first_release: 'a', status: 'live', replaced_by: null, note: '' },
    { id: 'tec:excel', kind: 'technology', label: 'x', first_release: 'a', status: 'live', replaced_by: null, note: '' },
    { id: 'cred:aws-saa', kind: 'credential', label: 'x', first_release: 'a', status: 'live', replaced_by: null, note: '' },
  ] },
};

export function world({ env = {}, assets = GRAPH_ASSETS, now = T0, seed = 1, invite = true } = {}) {
  clearReleaseCache();
  const db = createFakeDb();
  const deps = makeFakeDeps({ db, now, seed, assets, env: { ...KEYS, ADULT_SIGNUP: '1', EMAIL_FROM: 'hello@margwise.test', RELEASE_ID: REL, ...env } });
  if (invite) db.raw.prepare("INSERT INTO invites (code, label, created_at, track, active) VALUES ('adult1', 'pilot', ?, 'adult', 1)").run(now);
  return { db, deps, clock: deps.clock, outbox: deps.email.outbox };
}

let ipn = 10;
export const req = (method, path, { body, token, ip = '198.51.100.7', headers = {}, raw } = {}) => new Request('https://app.test' + path, {
  method, headers: { 'cf-connecting-ip': ip, ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers },
  body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
});
export const json = async res => ({ status: res.status, headers: res.headers, body: await res.json() });
export const newIp = () => `203.0.113.${ipn++ % 250}`;

// the 6-digit code and the link token from the latest dry-run email
export function lastMail(w) {
  const m = w.outbox[w.outbox.length - 1]; if (!m) return null;
  return { to: m.to, code: /code is (\d{6})/.exec(m.text)[1], link: /#link=([A-Za-z0-9_-]+)/.exec(m.text)[1], text: m.text };
}

export const START = { invite: 'adult1', birthYear: 1990, email: 'Asha@Example.com', turnstile: 'ok' };
export async function signUp(w, { handlers, email = 'asha@example.com', birthYear = 1990, nickname = 'Asha', research = false, ip = newIp() } = {}) {
  const { startH, verifyH, completeH } = handlers;
  let r = await json(await startH(req('POST', '/api/v1/email/start', { body: { ...START, email, birthYear }, ip }), w.deps)); if (r.status !== 200) throw new Error('start ' + JSON.stringify(r));
  const mail = lastMail(w);
  r = await json(await verifyH(req('POST', '/api/v1/email/verify', { body: { email, code: mail.code }, ip }), w.deps)); if (r.status !== 200) throw new Error('verify ' + JSON.stringify(r));
  if (r.body.token) return { token: r.body.token, known: true };
  const c = await json(await completeH(req('POST', '/api/v1/email/complete', { body: { pending: r.body.pending, nickname, consent: true, research }, ip }), w.deps)); if (c.status !== 200) throw new Error('complete ' + JSON.stringify(c));
  return { token: c.body.token, known: false };
}
