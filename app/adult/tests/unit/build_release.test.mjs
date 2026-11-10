// The release path of app/adult/build.py on a throwaway copy of the repository (the real data/releases/ is never touched):
// accept_graph() packs the slices into data/releases/graph/<release>/slices.jsonl.xz, and the release build unpacks them into
// hosting/public/work/graph/<release>/slices/ as plain .json, byte for byte, after checking every hash. A changed pack is refused.
//   node --test app/adult/tests/unit/build_release.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FIX = join(ROOT, 'app', 'adult', 'dev', 'fixtures', 'graph');
const REL = 'fixture-rel-1';

function makeRepo() {
  const r = mkdtempSync(join(tmpdir(), 'mw-adult-build-'));
  cpSync(join(ROOT, 'app', 'adult'), join(r, 'app', 'adult'), { recursive: true, filter: s => !s.includes(join('adult', 'tests')) });
  cpSync(join(ROOT, 'matcher'), join(r, 'matcher'), { recursive: true, filter: s => !s.includes(join('matcher', 'tests')) });
  cpSync(join(ROOT, 'contracts'), join(r, 'contracts'), { recursive: true, filter: s => !s.includes('node_modules') });
  const g = join(r, 'data', 'graph'); mkdirSync(join(g, 'slices'), { recursive: true });
  cpSync(join(ROOT, 'data', 'graph', 'graph_release.py'), join(g, 'graph_release.py'));
  const ids = [];
  for (const f of readdirSync(join(FIX, 'slices'))) {
    const s = JSON.parse(readFileSync(join(FIX, 'slices', f), 'utf8'));
    writeFileSync(join(g, 'slices', f), JSON.stringify(s));   // one line, as export.py writes it
    ids.push(s.occ.id);
  }
  cpSync(join(FIX, 'titles.json'), join(g, 'titles.json'));
  cpSync(join(FIX, 'skills_index.json'), join(g, 'skills_index.json'));
  for (const e of JSON.parse(readFileSync(join(FIX, 'skills_index.json'), 'utf8'))) ids.push(e.id);
  writeFileSync(join(g, 'export_report.json'), JSON.stringify({ release: REL, graph_hash: 'h1' }));
  writeFileSync(join(g, 'build_report.json'), JSON.stringify({ onet_version: '31.0', onet_release: '2026-08', graph_hash: 'h1' }));
  writeFileSync(join(g, 'id_registry.json'), JSON.stringify({ registry_version: 1, entries: ids.map(id => ({ id, kind: id.startsWith('occ:') ? 'occupation' : 'skill', label: id, first_release: REL, status: 'live', replaced_by: null, note: null })) }));
  const py = `import json, os, sys; sys.path.insert(0, ${JSON.stringify(g)}); import graph_release
man = {'release_id': 'content-1'}; graph_release.accept_graph(${JSON.stringify(r)}, man)
json.dump(man, open(os.path.join(${JSON.stringify(r)}, 'data', 'releases', 'manifest.json'), 'w'))`;
  const a = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(a.status, 0, a.stderr);
  return r;
}
const build = (r, ...args) => spawnSync('python3', [join(r, 'app', 'adult', 'build.py'), ...args], { encoding: 'utf8' });

test('a release build unpacks the accepted slice pack into raw .json files and stamps the graph release id', () => {
  const r = makeRepo();
  try {
    const rel = join(r, 'data', 'releases', 'graph', REL);
    assert.ok(existsSync(join(rel, 'slices.jsonl.xz')) && !existsSync(join(rel, 'slices')));
    const b = build(r); assert.equal(b.status, 0, b.stderr + b.stdout);
    const out = join(r, 'hosting', 'public', 'work');
    for (const f of readdirSync(join(r, 'data', 'graph', 'slices')))
      assert.equal(readFileSync(join(out, 'graph', REL, 'slices', f), 'utf8'), readFileSync(join(r, 'data', 'graph', 'slices', f), 'utf8'), f);
    assert.match(readFileSync(join(out, 'index.html'), 'utf8'), new RegExp(`content="${REL}"`));
    const man = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    assert.equal(man.release_id, REL); assert.equal(man.dev_build, false); assert.equal(man.graph.slices, 2);
    assert.ok(!Object.keys(man.graph.files).some(k => k.startsWith('slices/')), 'one folder hash, not one hash per slice');
    assert.ok(!existsSync(join(out, '.gitignore')), 'the git-ignore rule for work/ lives in hosting/.gitignore');
  } finally { rmSync(r, { recursive: true, force: true }); }
});

test('a release build refuses a pack or a file that does not match its recorded hash, and --fixtures without --dev', () => {
  const r = makeRepo();
  try {
    const p = join(r, 'data', 'releases', 'graph', REL, 'titles.json');
    writeFileSync(p, readFileSync(p, 'utf8') + ' ');
    let b = build(r); assert.notEqual(b.status, 0); assert.match(b.stderr, /titles.json is missing or does not match/);
    const pack = join(r, 'data', 'releases', 'graph', REL, 'slices.jsonl.xz');
    writeFileSync(pack, Buffer.concat([readFileSync(pack), Buffer.from([0])]));
    b = build(r); assert.notEqual(b.status, 0);
    b = build(r, '--fixtures'); assert.notEqual(b.status, 0); assert.match(b.stderr, /only works together with --dev/);
    rmSync(join(r, 'data', 'releases', 'graph', 'latest.json'));
    b = build(r); assert.notEqual(b.status, 0); assert.match(b.stderr, /No accepted graph release/);
  } finally { rmSync(r, { recursive: true, force: true }); }
});
