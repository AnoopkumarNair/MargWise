// Tier 2 in app/adult/build.py (T4.5, TEST_PLAN layer 8): the build copies the pinned model into work/models/, writes the real download size
// into manifest.json, refuses a file over the 25 MiB Pages limit, and still builds (with tier 2 off) when the model or the vectors are missing.
// Runs on a throwaway copy of the repository with a TINY fake model, so it needs neither the real 23 MB model nor the network.
//   node --test app/adult/tests/unit/build_tier2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FIX = join(ROOT, 'app', 'adult', 'dev', 'fixtures', 'graph');
const sha = b => createHash('sha256').update(b).digest('hex');
const MODEL = 'Test/tiny-model';

// A copy of the repo with the real skills index and vectors, a few fixture slices, a fake library and a fake 3-file model with its own manifest.
function makeRepo({ vecs = true, cache = true, bigFile = false, staleVecs = false } = {}) {
  const r = mkdtempSync(join(tmpdir(), 'mw-tier2-'));
  const skip = s => s.includes(join('adult', 'tests')) || s.includes('node_modules') || s.includes('model_cache');
  cpSync(join(ROOT, 'app', 'adult'), join(r, 'app', 'adult'), { recursive: true, filter: s => !skip(s) });
  cpSync(join(ROOT, 'matcher'), join(r, 'matcher'), { recursive: true, filter: s => !s.includes(join('matcher', 'tests')) });
  cpSync(join(ROOT, 'contracts'), join(r, 'contracts'), { recursive: true, filter: s => !s.includes('node_modules') });
  const g = join(r, 'data', 'graph'); mkdirSync(join(g, 'slices'), { recursive: true });
  for (const f of ['graph_release.py', 'vec_texts.py', 'skills_index.json', 'titles.json']) cpSync(join(ROOT, 'data', 'graph', f), join(g, f));
  mkdirSync(join(g, 'raw', 'onet', '31.0'), { recursive: true });
  cpSync(join(ROOT, 'data', 'graph', 'raw', 'onet', '31.0', 'Content Model Reference.txt'), join(g, 'raw', 'onet', '31.0', 'Content Model Reference.txt'));
  for (const f of readdirSync(join(FIX, 'slices')).slice(0, 2)) cpSync(join(FIX, 'slices', f), join(g, 'slices', f));
  if (vecs) for (const f of ['skill_vecs.json', 'skill_vecs.bin']) cpSync(join(ROOT, 'data', 'graph', f), join(g, f));
  if (staleVecs) { const m = JSON.parse(readFileSync(join(g, 'skill_vecs.json'), 'utf8')); m.texts_sha256 = '0'.repeat(64); writeFileSync(join(g, 'skill_vecs.json'), JSON.stringify(m)); }
  // the fake library (the build only needs the three files to exist, and adds their sizes to the download)
  const v = join(r, 'hosting', 'public', 'vendor', 'transformers'); mkdirSync(v, { recursive: true });
  const lib = { 'transformers.min.js': 'export const x = 1;\n', 'ort-wasm-simd-threaded.mjs': 'export default 1;\n', 'ort-wasm-simd-threaded.wasm': Buffer.alloc(1000, 1) };
  for (const [n, b] of Object.entries(lib)) writeFileSync(join(v, n), b);
  // the fake model and its manifest
  const files = { 'config.json': '{"a":1}', 'tokenizer.json': '{"b":2}', 'onnx/model_int8.onnx': bigFile ? Buffer.alloc(25 * 1024 * 1024 + 1) : Buffer.alloc(5000, 7), 'README.md': 'card' };
  const m = JSON.parse(readFileSync(join(ROOT, 'app', 'adult', 'tools', 'tier2_model.json'), 'utf8'));
  const real = JSON.parse(readFileSync(join(ROOT, 'data', 'graph', 'skill_vecs.json'), 'utf8'));
  m.model_id = MODEL; m.revision = real.revision;   // the vectors name the model and revision they were made with; the build checks they match the pinned ones
  m.files = Object.entries(files).map(([path, b]) => ({ path, bytes: Buffer.from(b).length, sha256: sha(Buffer.from(b)), load: path !== 'README.md' }));
  writeFileSync(join(r, 'app', 'adult', 'tools', 'tier2_model.json'), JSON.stringify(m));
  if (cache) for (const [p, b] of Object.entries(files)) { const d = join(r, 'app', 'adult', 'tools', 'model_cache', MODEL, p); mkdirSync(dirname(d), { recursive: true }); writeFileSync(d, b); }
  return { r, files, m };
}
const build = r => spawnSync('python3', [join(r, 'app', 'adult', 'build.py'), '--dev'], { encoding: 'utf8' });
const manifest = r => JSON.parse(readFileSync(join(r, 'hosting', 'public', 'work', 'manifest.json'), 'utf8'));

// The vectors name the model they were made with, and the build refuses a mismatch with the pinned one: here the pinned model is the fake one,
// so the copy's skill_vecs.json is rewritten to name it.
function renameVecs(r) {
  const p = join(r, 'data', 'graph', 'skill_vecs.json'); const m = JSON.parse(readFileSync(p, 'utf8')); m.model = MODEL; writeFileSync(p, JSON.stringify(m));
}

test('with the model and the vectors, the build copies the model and writes the real download size', () => {
  const { r, files } = makeRepo();
  try {
    renameVecs(r);
    const b = build(r); assert.equal(b.status, 0, b.stderr + b.stdout);
    const t = manifest(r).tier2;
    assert.equal(t.available, true);
    // every listed file exists with exactly the listed size, and the total is their sum
    const out = join(r, 'hosting', 'public');
    let sum = 0;
    for (const f of t.files) {
      const p = f.url.startsWith('/') ? join(out, f.url) : join(out, 'work', f.url);
      assert.ok(existsSync(p), 'listed file exists: ' + f.url);
      assert.equal(readFileSync(p).length, f.bytes, f.url); sum += f.bytes;
    }
    assert.equal(t.total_bytes, sum);
    // the page downloads the library, the model files it loads (not the model card) and the two vector files
    assert.deepEqual(t.files.map(f => f.url.split('/').pop()), ['transformers.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'config.json', 'tokenizer.json', 'model_int8.onnx', 'skill_vecs.json', 'skill_vecs.bin']);
    for (const n of Object.keys(files)) assert.ok(existsSync(join(out, 'work', 'models', MODEL, n)), n + ' is served');
    assert.ok(existsSync(join(out, 'work', 'models', MODEL, 'LICENSE-Apache-2.0.txt')), 'the licence travels with the model');
    assert.match(b.stdout, /tier 2: on/);
    assert.ok(existsSync(join(out, 'work', 'tiers.html')) && existsSync(join(out, 'work', 'tiers.js')), 'a --dev build has the developer page');
  } finally { rmSync(r, { recursive: true, force: true }); }
});

test('without the model in the cache the build still works, says so, and tier 2 is off', () => {
  const { r } = makeRepo({ cache: false });
  try {
    renameVecs(r);
    const b = build(r); assert.equal(b.status, 0, b.stderr + b.stdout);
    assert.match(b.stdout, /tier 2 \(reading with the on-device model\) is NOT in this build: the model is not in app\/adult\/tools\/model_cache/);
    const t = manifest(r).tier2; assert.equal(t.available, false); assert.match(t.reason, /fetch_model\.py/);
    assert.ok(!existsSync(join(r, 'hosting', 'public', 'work', 'models')));
  } finally { rmSync(r, { recursive: true, force: true }); }
});

test('a model file that differs from its pinned hash switches tier 2 off', () => {
  const { r } = makeRepo();
  try {
    renameVecs(r);
    writeFileSync(join(r, 'app', 'adult', 'tools', 'model_cache', MODEL, 'config.json'), '{"a":2}');
    const b = build(r); assert.equal(b.status, 0, b.stderr + b.stdout);
    assert.equal(manifest(r).tier2.available, false); assert.match(manifest(r).tier2.reason, /config\.json/);
  } finally { rmSync(r, { recursive: true, force: true }); }
});

test('without the vectors, or with stale ones, tier 2 is off', () => {
  for (const [opts, why] of [[{ vecs: false }, /no skill_vecs/], [{ staleVecs: true }, /stale/]]) {
    const { r } = makeRepo(opts);
    try {
      if (opts.vecs !== false) renameVecs(r);
      const b = build(r); assert.equal(b.status, 0, b.stderr + b.stdout);
      assert.equal(manifest(r).tier2.available, false); assert.match(manifest(r).tier2.reason, why);
    } finally { rmSync(r, { recursive: true, force: true }); }
  }
});

test('a file over 25 MiB stops the build (the Cloudflare Pages limit)', () => {
  const { r } = makeRepo({ bigFile: true });
  try {
    renameVecs(r);
    const b = build(r); assert.notEqual(b.status, 0);
    assert.match(b.stderr, /over the 25 MiB limit of Cloudflare Pages/);
  } finally { rmSync(r, { recursive: true, force: true }); }
});

test('vectors made with another model than the pinned one stop the build', () => {
  const { r } = makeRepo();
  try {   // (not renamed: skill_vecs.json still names the real model, the manifest pins the fake one)
    const b = build(r); assert.notEqual(b.status, 0);
    assert.match(b.stderr, /skill_vecs\.json was made with Xenova\/all-MiniLM-L6-v2 .* but the pinned model is Test\/tiny-model/);
  } finally { rmSync(r, { recursive: true, force: true }); }
});
