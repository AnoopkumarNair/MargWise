// The evaluation harness (BUILD_PLAN T7.3) on a temporary copy of the synthetic fixtures, placed OUTSIDE the repository.
// It checks: exit 0; stdout holds no canary, file name, fixture name or resume line; an in-repo folder is refused; the folder is not changed;
// the aggregate numbers agree with the fixtures' expected.json; and the Node file reader has not drifted from the browser's intake_file.js.
//   node --test app/adult/tests/intake/eval_harness.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync, rmSync, symlinkSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readResume } from '../../intake/read.js';
import { suggestFromText, decodeVectors } from '../../intake/tier2.js';
import { loadGraph } from '../lib/graph.mjs';
import { fixtureIds, loadFixture, FIXTURES_DIR } from '../lib/fixtures.mjs';
import { readFileNode } from '../lib/eval_files.mjs';
import { median, percentile, skillScores, shapeCounts, containCounts, redactionMisses, roleOutcome } from '../lib/eval_measures.mjs';
import { nodeDepsInstalled, modelCached, loadNodeEmbedder } from '../../tools/embed/node_embedder.mjs';

const HARNESS = fileURLToPath(new URL('../eval_intake.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const GRAPH = ROOT + 'data/graph/';
const NOW = 2026;
const g = loadGraph();
const canaries = JSON.parse(readFileSync(FIXTURES_DIR + 'canaries.json', 'utf8'));

const run = (args, opts) => spawnSync(process.execPath, [HARNESS, ...args], { encoding: 'utf8', ...opts });

// ---- the temporary folder: random file names, one person per fixture that lists skills, plus a scanned PDF that cannot be read ----
const tmp = mkdtempSync(join(tmpdir(), 'mw-eval-'));
const dir = join(tmp, 'people');
mkdirSync(dir);
const tmpReal = realpathSync(tmp);
const people = [];   // { name, fixture, file, text, expected }
const SRC = { single_col: 'resume.pdf', docx_basic: 'resume.docx' };   // the others go in as text; these two prove the PDF and DOCX readers
const META = [[120, 0], [180, 1], [240, 0], [300, 2], [200, 1], [150, 0]];
let k = 0;
for (const id of fixtureIds()) {
  const f = loadFixture(id);
  if (!f.expected.mustFind || id === 'scanned') continue;
  const src = SRC[id] || 'resume.txt';
  const name = 'zq' + (++k) + Math.random().toString(36).slice(2, 8);
  copyFileSync(f.dir + src, join(dir, name + '.' + src.split('.')[1]));
  const file = join(dir, name + '.' + src.split('.')[1]);
  people.push({ name, fixture: id, file, text: f.text, expected: f.expected });
}
// the scanned PDF: a person whose file cannot be read (no profile skills matter)
{
  const f = loadFixture('scanned'); const name = 'zqscan' + Math.random().toString(36).slice(2, 8);
  copyFileSync(f.dir + 'resume.pdf', join(dir, name + '.pdf'));
  writeFileSync(join(dir, name + '.profile.json'), JSON.stringify({ v: 1, roles: [], skills: [{ id: 'tec:python', strength: 'used' }] }));
}
// A resume with no profile and a profile with no resume (counted, never named).
copyFileSync(FIXTURES_DIR + 'pasted_text/resume.txt', join(dir, 'zzlonely.txt'));
writeFileSync(join(dir, 'zzorphan.profile.json'), JSON.stringify({ v: 1, roles: [], skills: [] }));

// The reader's first choice for a person's current job, found independently of the harness.
function firstChoice(text) {
  const r = readResume(text, { ...g, now: NOW });
  const role = r.currentRoleIndex >= 0 ? r.roles[r.currentRoleIndex] : r.roles[0];
  return role && role.occCandidates.length ? role.occCandidates[0].occ : null;
}
const BOGUS = 'occ:99-9999.99';
people.forEach((p, i) => {
  const first = firstChoice(p.text);
  p.first = first;
  p.confirmedOcc = i === 1 ? BOGUS : (first || BOGUS);   // person 2 is a deliberate miss
  const profile = { v: 1, roles: [{ occ: p.confirmedOcc, level: 3, industry: 'it', years: '5-8', current: true }], skills: p.expected.mustFind.map(id => ({ id, strength: 'used' })) };
  // person 3 gives the profile as the account export file, to show both shapes are read
  const body = i === 2 ? { ok: true, generated_at: 1, tables: [{ table: 'testers', columns: ['id'], rows: [['x']] }, { table: 'profiles', columns: ['v', 'rev', 'data'], rows: [[1, 1, JSON.stringify(profile)]] }] } : profile;
  writeFileSync(join(dir, p.name + '.profile.json'), JSON.stringify(body));
  if (META[i]) writeFileSync(join(dir, p.name + '.meta.json'), JSON.stringify({ secondsToConfirm: META[i][0], roleEdits: META[i][1] }));
});

const snapshot = d => readdirSync(d).sort().map(f => { const s = statSync(join(d, f)); return [f, s.size, s.mtimeMs].join('|'); }).join('\n');
const before = snapshot(dir);
const json = run([dir, '--now', String(NOW), '--no-tier2', '--json']);
const out = json.status === 0 ? JSON.parse(json.stdout) : null;
const textRun = run([dir, '--now', String(NOW), '--no-tier2']);

test.after(() => rmSync(tmp, { recursive: true, force: true }));

test('the temporary folder is outside the repository', () => {
  assert.ok(!tmpReal.startsWith(realpathSync(ROOT)), tmpReal);
  assert.ok(people.length >= 10, 'people: ' + people.length);
});

test('the harness exits 0 on the fixtures and says what it left out', () => {
  assert.equal(json.status, 0, json.stderr);
  assert.equal(textRun.status, 0, textRun.stderr);
  assert.equal(out.people.named, people.length + 1);          // plus the scanned one; the lonely resume and the orphan profile are not people
  assert.equal(out.people.read, people.length);
  assert.deepEqual(out.people.unreadable, { scanned: 1 });
  assert.equal(out.people.resumesWithoutProfile, 1);
  assert.equal(out.people.profilesWithoutResume, 1);
});

test('stdout holds only aggregates: no canary, file name, fixture name, skill id or resume line', () => {
  const all = textRun.stdout + json.stdout + textRun.stderr + json.stderr;
  for (const v of Object.values(canaries.base)) assert.ok(!all.toLowerCase().includes(String(v).toLowerCase()), 'canary printed: ' + v.slice(0, 4) + '...');
  for (const p of people) {
    assert.ok(!all.includes(p.name), 'file name printed');
    assert.ok(!all.includes(p.fixture), 'fixture name printed: ' + p.fixture);
    for (const id of p.expected.mustFind) assert.ok(!all.includes(id), 'skill id printed: ' + id);
    for (const line of p.text.split('\n').map(l => l.trim()).filter(l => l.length >= 15)) assert.ok(!all.includes(line), 'resume line printed');
  }
  assert.ok(!all.includes(tmp) && !all.includes(dir), 'folder path printed');
  assert.ok(!all.includes('@'), 'something shaped like an email was printed');
});

test('it writes nothing into the folder and nothing into the repository', () => {
  assert.equal(snapshot(dir), before);
  const git = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  assert.ok(!/eval/i.test(git.stdout.replace(/app\/adult\/tests\/(intake\/eval_harness\.test\.mjs|eval_intake\.mjs|EVAL\.md|lib\/eval_)/g, '')), git.stdout);
});

test('tier 1 numbers agree with the fixtures: every confirmed (mustFind) skill is suggested; precision is what the reader suggests over it', () => {
  let found = 0, must = 0, hit = 0;
  for (const p of people) {
    const ids = new Set(readResume(p.text, { ...g, now: NOW }).skills.map(s => s.id));   // (the PDF and DOCX people give the same skills as their text twins)
    found += ids.size; must += p.expected.mustFind.length; hit += p.expected.mustFind.filter(id => ids.has(id)).length;
  }
  assert.equal(out.tier1.suggested, found);
  assert.equal(out.tier1.confirmed, must);
  assert.equal(out.tier1.hit, hit);
  assert.equal(out.tier1.recall, 1, 'the fixtures pass tier 1, so recall over their own mustFind is 1');
  assert.ok(Math.abs(out.tier1.precision - hit / found) < 1e-12);
});

test('tier 2 is reported as not measured, not as zero, when it is off', () => {
  assert.equal(out.tier2, null);
  assert.equal(out.combined, null);
  assert.match(out.tier2Note, /switched off/);
  assert.match(textRun.stdout, /tier 2 \(model\): not measured/);
  assert.equal(out.checks.recall.basis, 'tier 1 only (tier 2 not measured)');
});

test('role match: first choice, one pick, recorded edits', { skip: !g.hasSlices && 'the occupation slices are not built here (python3 pipeline/run.py)' }, () => {
  const N = people.length;
  const exactN = people.filter((p, i) => i !== 1 && p.first).length;
  assert.equal(out.role.people, N);
  assert.ok(Math.abs(out.role.firstChoiceRight - exactN / N) < 1e-12, `${out.role.firstChoiceRight} vs ${exactN}/${N}`);
  assert.ok(out.role.rightWithOnePick >= out.role.firstChoiceRight);
  const edits = META.map(m => m[1]);   // 0,1,0,2,1,0 -> 5 of 6 are at most one edit
  assert.equal(out.role.recordedOneEditOrLess, edits.filter(e => e <= 1).length / edits.length);
  assert.equal(out.checks.role.value, out.role.recordedOneEditOrLess, 'the target uses the recorded edits when there are 5 or more');
});

test('time: median of the recorded seconds, and reader times per resume', () => {
  assert.equal(out.time.seconds.median, median(META.map(m => m[0])));
  assert.equal(out.checks.time.result, 'PASS');   // median 190 s is under 4 minutes
  assert.equal(out.time.reader.tier1.n, people.length);
  assert.ok(out.time.reader.tier1.median >= 0 && out.time.reader.tier1.p90 >= out.time.reader.tier1.median);
  assert.equal(out.time.reader.tier2, null);
});

test('redaction is "not measured" until S6, with a baseline that says "contain"', () => {
  assert.equal(out.redaction.misses, null);
  assert.equal(out.checks.redaction.result, 'NOT MEASURED');
  assert.match(textRun.stdout, /not measured \(arrives with S6/);
  assert.match(textRun.stdout, /CONTAIN \(before any redaction, so not leaks\)/);
  assert.equal(out.redaction.contain.any, containCounts(people.map(p => p.text)).any, 'the baseline counts what the resumes contain');
  assert.ok(out.redaction.contain.email >= 1 && out.redaction.contain.id >= 1);
});

test('a folder inside the repository is refused, whatever the path looks like', () => {
  for (const bad of [FIXTURES_DIR, ROOT, ROOT + 'app/adult/tests/fixtures/../fixtures']) {
    const r = run([bad]);
    assert.equal(r.status, 2, bad);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /inside the repository/);
  }
  const link = join(tmp, 'link'); symlinkSync(FIXTURES_DIR, link);   // a link to a repository folder
  const viaLink = run([link]);
  assert.equal(viaLink.status, 2); assert.match(viaLink.stderr, /inside the repository/);
});

test('a file that is a link into the repository is refused', () => {
  const d = join(tmp, 'linked'); mkdirSync(d);
  for (let i = 0; i < 6; i++) { copyFileSync(people[i].file, join(d, 'a' + i + '.' + people[i].file.split('.').pop())); copyFileSync(join(dir, people[i].name + '.profile.json'), join(d, 'a' + i + '.profile.json')); }
  rmSync(join(d, 'a0.pdf'), { force: true }); rmSync(join(d, 'a0.txt'), { force: true }); rmSync(join(d, 'a0.docx'), { force: true });
  symlinkSync(FIXTURES_DIR + 'ten_page/resume.txt', join(d, 'a0.txt'));
  const r = run([d, '--no-tier2']);
  assert.equal(r.status, 2); assert.match(r.stderr, /link into the repository/); assert.equal(r.stdout, '');
});

test('fewer than 5 people: nothing is reported', () => {
  const d = join(tmp, 'few'); mkdirSync(d);
  for (let i = 0; i < 4; i++) { copyFileSync(people[i].file, join(d, 'f' + i + '.' + people[i].file.split('.').pop())); copyFileSync(join(dir, people[i].name + '.profile.json'), join(d, 'f' + i + '.profile.json')); }
  const r = run([d, '--no-tier2']);
  assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.match(r.stderr, /from 5 people up/);
});

test('no folder, or a missing one, is a usage error that names no path', () => {
  assert.equal(run([]).status, 2);
  const r = run([join(tmp, 'nope-secret-name')]);
  assert.equal(r.status, 2); assert.ok(!r.stderr.includes('nope-secret-name'));
});

test('measures: median, percentile, scores, shapes, redaction misses by anonymous position', async () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5); assert.equal(median([]), null);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  const s = skillScores([new Set(['a', 'b', 'c']), new Set(['a'])], [new Set(['a', 'b', 'x', 'y']), new Set(['a'])]);
  assert.equal(s.hit, 3); assert.equal(s.precision, 3 / 4); assert.equal(s.recall, 3 / 5);
  assert.deepEqual(shapeCounts('mail a.b@c.in, call +91 98765 43210, PAN ABCDE1234F'), { email: 1, phone: 1, id: 1 });
  assert.deepEqual(shapeCounts('Aadhaar 1234 5678 9012'), { email: 0, phone: 1, id: 1 }, 'a 12-digit number also looks like a phone number: the baseline is deliberately wide');
  assert.deepEqual(shapeCounts('2019 - 2023, 12 years, 3000 people'), { email: 0, phone: 0, id: 0 });
  const r = await redactionMisses(['clean text', 'x@y.com and z@y.com', 'ok'], t => t.replace('z@y.com', '[email]'));
  assert.deepEqual(r.misses, [{ index: 2, category: 'email', count: 1 }]); assert.equal(r.total, 1);
  assert.deepEqual(roleOutcome('o1', 'o1', ['o1', 'o2']), { exact: true, onePick: true });
  assert.deepEqual(roleOutcome('o2', 'o1', ['o1', 'o2']), { exact: false, onePick: true });
  assert.deepEqual(roleOutcome('o3', 'o1', ['o1', 'o2']), { exact: false, onePick: false });
  assert.deepEqual(roleOutcome('o3', null, []), { exact: false, onePick: false });
});

test('the Node file reader reads PDF and DOCX, refuses a scan, and has not drifted from intake_file.js', async () => {
  const pdf = await readFileNode(FIXTURES_DIR + 'single_col/resume.pdf');
  assert.equal(pdf.kind, 'pdf'); assert.ok(pdf.text.length > 2000);
  const docx = await readFileNode(FIXTURES_DIR + 'docx_basic/resume.docx');
  assert.equal(docx.kind, 'docx'); assert.ok(docx.text.includes('\n') && !docx.text.includes('\n\n'));
  await assert.rejects(readFileNode(FIXTURES_DIR + 'scanned/resume.pdf'), e => e.code === 'scanned');
  await assert.rejects(readFileNode(FIXTURES_DIR + 'canaries.json'), e => e.code === 'unsupported');
  // the PDF and DOCX text finds what the text twin finds
  for (const [id, f] of [['single_col', pdf], ['docx_basic', docx]]) {
    const want = loadFixture(id).expected.mustFind;
    const ids = new Set(readResume(f.text, { ...g, now: NOW }).skills.map(s => s.id));
    assert.deepEqual(want.filter(x => !ids.has(x)), [], id);
  }
  // drift: the browser file reader's rules, copied here, must still read the same in the source
  const src = readFileSync(ROOT + 'app/adult/intake_file.js', 'utf8');
  for (const piece of ['MIN_CHARS_PER_PAGE = 40', 'MIN_CHARS_TOTAL = 120', "parts.join('\\n\\n').replace(/[ \\t]+\\n/g, '\\n').trim()", ".replace(/\\n{2,}/g, '\\n').trim()", 'replace(/\\s+/g, \'\').length < 20'])
    assert.ok(src.includes(piece), 'intake_file.js changed: ' + piece + ' (update app/adult/tests/lib/eval_files.mjs to match)');
});

// ---- tier 2 with the real model ----
const ready = nodeDepsInstalled() && modelCached();
if (!ready) {
  const why = 'the harness tier 2 run cannot be checked here: ' + (!nodeDepsInstalled() ? 'run `cd app/adult/tools/embed && npm ci`' : '') + (!modelCached() ? ' run `python3 app/adult/tools/fetch_model.py`' : '');
  if (process.env.CI === 'true') test('the real model is available in CI', () => assert.fail(why + ' (CI must fetch the pinned model)'));
  else test('the harness tier 2 run is not checked on this machine', () => console.log('\n  NOTICE: ' + why + '.\n'));
} else {
  test('tier 2: the harness reports the same suggestions as suggestFromText, and combines the tiers', async () => {
    const r = run([dir, '--now', String(NOW), '--json']);
    assert.equal(r.status, 0, r.stderr);
    const o = JSON.parse(r.stdout);
    const embed = await loadNodeEmbedder();
    const vecs = decodeVectors(readFileSync(GRAPH + 'skill_vecs.bin'), JSON.parse(readFileSync(GRAPH + 'skill_vecs.json', 'utf8')));
    let sug = 0, hit = 0, both = 0, tier1Hit = 0;
    for (const p of people) {
      const t = (await readFileNode(p.file)).text;
      const found = readResume(t, { ...g, now: NOW });
      const t1 = new Set(found.skills.map(s => s.id));
      const t2 = new Set((await suggestFromText(t, { nowYear: NOW, embed, vecs, exclude: [...t1], roles: found.roles })).map(s => s.id));
      const conf = new Set(p.expected.mustFind);
      sug += t2.size; for (const id of t2) if (conf.has(id)) hit++;
      for (const id of conf) if (t1.has(id) || t2.has(id)) both++;
      for (const id of conf) if (t1.has(id)) tier1Hit++;
    }
    assert.equal(o.tier2.suggested, sug);
    assert.equal(o.tier2.hit, hit);
    assert.equal(o.combined.hit, both);
    assert.equal(o.tier1.hit, tier1Hit);
    assert.ok(o.combined.recall >= o.tier1.recall, 'adding tier 2 never lowers recall');
    assert.equal(o.tier2Note, null);
    assert.ok(o.time.reader.tier2.n === people.length && o.time.reader.tier2.median > 0);
    assert.equal(o.checks.recall.basis, 'tier 1 and tier 2 together');
    const all = r.stdout + r.stderr;
    for (const v of Object.values(canaries.base)) assert.ok(!all.toLowerCase().includes(String(v).toLowerCase()));
  });
}
