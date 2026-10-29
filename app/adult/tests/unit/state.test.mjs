// state.js: the profile check fails closed when the schema did not load (review nit). state.js imports ./contracts/validate_lib.js,
// which build.py copies next to it, so the test puts both in a throwaway folder the same way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = join(APP, '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'mw-state-'));
mkdirSync(join(dir, 'contracts'));
copyFileSync(join(APP, 'state.js'), join(dir, 'state.js'));
copyFileSync(join(ROOT, 'contracts', 'validate_lib.js'), join(dir, 'contracts', 'validate_lib.js'));
const S = await import(pathToFileURL(join(dir, 'state.js')).href);
test.after(() => rmSync(dir, { recursive: true, force: true }));

function fill() {
  S.state.manifest = { release_id: 'dev-unaccepted' };
  S.state.occ = { id: 'occ:13-2011.00', label: 'Accountants and Auditors' };
  S.state.skills = new Map([['skl:2.A.1.a', 'used']]);
}

test('checkProfile refuses the profile when the schema did not load', () => {
  fill(); S.state.schema = null;
  const r = S.checkProfile(S.buildProfile());
  assert.equal(r.ok, false); assert.match(r.errors[0].message, /schema did not load/);
});

test('checkProfile passes a good profile and refuses a bad one once the schema is loaded', () => {
  fill(); S.state.schema = JSON.parse(readFileSync(join(ROOT, 'contracts', 'profile.schema.json'), 'utf8'));
  assert.equal(S.checkProfile(S.buildProfile()).ok, true);
  assert.equal(S.checkProfile({ ...S.buildProfile(), gender: 'x' }).ok, false);
});

test('the sliders start at the matcher defaults (SPEC 7.3, owner decision O4)', async () => {
  assert.deepEqual(S.state.priorities, { pay: 1, ai_safe: 1, short_move: 3, demand: 1, enjoy: 0 });
  assert.deepEqual({ ...S.DEFAULT_PRIORITIES }, S.state.priorities);
  const { match } = await import(pathToFileURL(join(ROOT, 'matcher', 'match.js')).href);
  const slice = JSON.parse(readFileSync(join(APP, 'dev', 'fixtures', 'graph', 'slices', '13-2011.00.json'), 'utf8'));
  fill(); const p = S.buildProfile(); delete p.priorities;
  const w = match(p, slice, {}).weights;
  assert.deepEqual({ pay: w.pay, ai_safe: w.ai_safe, short_move: w.short, demand: w.demand, enjoy: w.enjoy }, S.state.priorities);
});
