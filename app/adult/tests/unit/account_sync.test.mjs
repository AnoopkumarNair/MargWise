// account/sync.js: saving with rev, the 409 conflict, opening a saved profile into memory, and what a build-time profile looks like on the wire.
// sync.js imports state.js (which needs contracts/validate_lib.js next to it), so the app is copied to a temporary folder, like state.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = fileURLToPath(new URL('../../', import.meta.url)), ROOT = join(APP, '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'mw-sync-'));
cpSync(APP, dir, { recursive: true, filter: s => !/adult[\\/](tests|dev)/.test(s) });
mkdirSync(join(dir, 'contracts'), { recursive: true });
copyFileSync(join(ROOT, 'contracts', 'validate_lib.js'), join(dir, 'contracts', 'validate_lib.js'));
const schema = JSON.parse(readFileSync(join(ROOT, 'contracts', 'profile.schema.json'), 'utf8'));

const mem = new Map(); const calls = [];
globalThis.window = { localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } };
globalThis.document = { querySelector: () => ({ content: 'rel1' }) };
globalThis.location = { hash: '' };
const TOKEN = 'v1.01234567-0000-0000-0000-000000000000.1761000000000.' + 'b'.repeat(64);
const slice = { occ: { id: 'occ:13-2011.00', label: 'Accountants' }, needs: [], targets: [] };
let serverProfile = null; let putStatus = null;
const json = (status, body) => ({ status, ok: status < 400, headers: { get: () => null }, json: async () => body });
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  if (path.startsWith('/api/v1/')) {
    calls.push({ path, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (path === '/api/v1/me/profile' && init.method === 'GET') return serverProfile ? json(200, { ok: true, rev: serverProfile.rev, data: serverProfile.data, mapped: [{ from: 'skl:x', to: 'skl:2.A.1.a', field: 'skills' }], dropped: [] }) : json(404, { ok: false, error: { code: 'not_found', message: 'none' } });
    if (path === '/api/v1/me/profile' && init.method === 'PUT') {
      if (putStatus === 409) return json(409, { ok: false, error: { code: 'conflict', message: 'changed' }, current: { rev: 7, data: { v: 1, roles: [], skills: [] } } });
      return json(200, { ok: true, rev: JSON.parse(init.body).rev + 1 });
    }
  }
  if (path.endsWith('manifest.json')) return json(200, { release_id: 'rel1', graph: { base: 'graph/rel1/' } });
  if (path.endsWith('occupations.json')) return json(200, [{ id: 'occ:13-2011.00', label: 'Accountants', slice: 'slices/13-2011.00.json' }, { id: 'occ:99-9999.00', label: 'Gone', slice: null }]);
  if (path.endsWith('13-2011.00.json')) return json(200, slice);
  return json(404, {});
};
const U = p => import(pathToFileURL(join(dir, p)).href);
const S = await U('state.js'), Y = await U('account/sync.js'), session = await U('account/session.js');
test.after(() => rmSync(dir, { recursive: true, force: true }));

function fill() {
  S.resetAll(); S.state.manifest = { release_id: 'rel1', graph: { base: 'graph/rel1/' } }; S.state.schema = schema;
  S.state.occ = { id: 'occ:13-2011.00', label: 'Accountants' }; S.state.slice = slice; S.state.skills = new Map([['skl:2.A.1.a', 'used'], ['skl:2.A.2.a', 'strong']]);
}

test('signed out: nothing to save, and the status says so', async () => {
  session.clearToken(); fill(); Y.resetSync();
  assert.equal(Y.saveStatus(), 'out');
  const r = await Y.saveNow(); assert.equal(r.ok, false); assert.equal(calls.length, 0, 'nothing is sent');
});

test('save sends {rev, data} with rev 0 first, then the revision the server returned', async () => {
  session.setToken(TOKEN); fill(); Y.resetSync(); calls.length = 0;
  assert.equal(Y.saveStatus(), 'never');
  let r = await Y.saveNow(); assert.deepEqual([r.ok, r.rev], [true, 1]);
  assert.equal(calls[0].body.rev, 0); assert.equal(calls[0].body.data.v, 1);
  assert.equal(Y.saveStatus(), 'saved');
  S.state.skills.set('tec:excel', 'used'); assert.equal(Y.saveStatus(), 'changed');
  r = await Y.saveNow(); assert.equal(calls[1].body.rev, 1); assert.equal(r.rev, 2);
});

test('what goes on the wire is the profile and nothing else: ids, bands, numbers', async () => {
  session.setToken(TOKEN); fill(); S.state.reading = { roles: [{ titleText: 'Senior Wizard at Secret Corp' }], skills: [] }; Y.resetSync(); calls.length = 0;
  await Y.saveNow();
  const wire = JSON.stringify(calls[0].body);
  assert.doesNotMatch(wire, /Wizard|Secret|titleText|reading/);
  assert.deepEqual(Object.keys(calls[0].body.data).sort(), ['job_release', 'priorities', 'roles', 'skills', 'v']);
});

test('a 409 returns the server version so the person can choose', async () => {
  session.setToken(TOKEN); fill(); Y.resetSync(); putStatus = 409;
  const r = await Y.saveNow(); putStatus = null;
  assert.equal(r.ok, false); assert.equal(r.code, 'conflict'); assert.equal(r.conflict.rev, 7);
  assert.equal(Y.sync.rev, 0, 'the local revision does not move until the person chooses');
});

test('"Keep mine" saves on top of the newer revision', async () => {
  session.setToken(TOKEN); fill(); Y.resetSync(); calls.length = 0;
  const r = await Y.saveNow({ rev: 7 }); assert.equal(r.rev, 8); assert.equal(calls[0].body.rev, 7);
});

test('opening a saved profile puts it into memory and starts from the current job', async () => {
  session.setToken(TOKEN); S.resetAll(); S.state.manifest = { release_id: 'rel1', graph: { base: 'graph/rel1/' } }; S.state.schema = schema; Y.resetSync();
  const data = { v: 1, roles: [{ occ: 'occ:99-9999.00', level: 1, industry: 'it', years: '0-2', current: false }, { occ: 'occ:13-2011.00', level: 3, industry: 'bfsi', years: '5-8', current: true }],
    skills: [{ id: 'skl:2.A.1.a', strength: 'strong', last: 2024 }, { id: 'skl:2.A.2.a', strength: 'rusty' }], lead: { people: '1-5', budget: false, expert: true }, constraints: { hours_month: '5-10' }, priorities: { pay: 5, ai_safe: 0, short_move: 3, demand: 1, enjoy: 0 }, job_release: 'rel0' };
  const r = await Y.restore({ rev: 5, data, mapped: [{}], dropped: [{}, {}] });
  assert.equal(r.ok, true);
  assert.equal(S.state.occ.id, 'occ:13-2011.00'); assert.equal(S.state.years, '5-8'); assert.equal(S.state.slice, slice);
  assert.deepEqual([...S.state.skills], [['skl:2.A.1.a', 'strong'], ['skl:2.A.2.a', 'rusty']]); assert.equal(S.state.skillLast.get('skl:2.A.1.a'), 2024);
  assert.equal(S.state.priorities.pay, 5); assert.equal(S.state.constraints.hours_month, '5-10'); assert.equal(S.state.lead.people, '1-5');
  assert.equal(Y.sync.rev, 5); assert.match(Y.sync.note, /1 item was updated.*2 items are no longer/);
  const back = S.buildProfile(); assert.deepEqual(back.roles, data.roles); assert.equal(S.checkProfile(back).ok, true, 'it passes the profile contract again');
  assert.equal(Y.saveStatus(), 'saved', 'opening it is not a change');
});

test('a saved profile whose job has no data any more is refused with a plain message', async () => {
  S.resetAll(); S.state.manifest = { release_id: 'rel1', graph: { base: 'graph/rel1/' } };
  const r = await Y.restore({ rev: 1, data: { v: 1, roles: [{ occ: 'occ:99-9999.00', level: 1, industry: 'it', years: '0-2', current: true }], skills: [] } });
  assert.equal(r.ok, false); assert.match(r.message, /no data for your saved job/);
  assert.equal((await Y.restore({ rev: 1, data: { v: 1, roles: [], skills: [] } })).ok, false);
});
