// Tests for the video policy (app/video_policy.js). Run: node --test app/tests/video.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { mwVideoPolicy: P, mwVideoEnv } = createRequire(import.meta.url)('../video_policy.js');
const ok = { exists: true, effectiveType: '4g', deviceMemory: 4 };
test('good connection plays and does not probe', () => assert.deepEqual([P(ok).use, P(ok).probe], [true, false]));
test('no file: no video', () => assert.equal(P({ ...ok, exists: false }).use, false));
test('data saver: no video', () => assert.equal(P({ ...ok, saveData: true }).use, false));
test('3g, 2g, slow-2g: no video', () => ['3g', '2g', 'slow-2g'].forEach((t) => assert.equal(P({ ...ok, effectiveType: t }).use, false, t)));
test('no Network Information API (iOS): plays, but probes', () => { const r = P({ exists: true }); assert.equal(r.use, true); assert.equal(r.probe, true); });
test('device memory 1 GB: no video; 2 GB and unknown: video', () => { assert.equal(P({ ...ok, deviceMemory: 1 }).use, false); assert.equal(P({ ...ok, deviceMemory: 2 }).use, true); assert.equal(P({ exists: true, effectiveType: '4g' }).use, true); });
test('reduced motion: no video', () => assert.equal(P({ ...ok, reduceMotion: true }).use, false));
test('student turned it off: no video', () => assert.equal(P({ ...ok, off: true }).use, false));
test('a clip failed earlier this session: no video', () => assert.equal(P({ ...ok, failed: true }).use, false));
test('no env at all is safe', () => assert.equal(P().use, false));
test('mwVideoEnv reads navigator and matchMedia', () => {
  const win = { navigator: { connection: { saveData: true, effectiveType: '3g' }, deviceMemory: 1 }, matchMedia: () => ({ matches: true }) };
  assert.deepEqual(mwVideoEnv(win, { exists: true }), { reduceMotion: true, saveData: true, effectiveType: '3g', deviceMemory: 1, exists: true });
  assert.equal(P(mwVideoEnv({ navigator: {} }, { exists: true })).probe, true);
});
