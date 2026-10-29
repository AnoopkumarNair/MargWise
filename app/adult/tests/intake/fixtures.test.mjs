// Every fixture, read from its plain-text twin (what a correct extractor sees). TEST_PLAN layer 3.
//   must-find found, must-not-find absent, roles and years right, under 3 seconds.
// The run prints recall and the labelled precision per fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readResume } from '../../intake/read.js';
import { loadGraph } from '../lib/graph.mjs';
import { fixtureIds, loadFixture, score, NOW, FIXTURES_DIR } from '../lib/fixtures.mjs';

const g = loadGraph();
const ids = fixtureIds();
const rows = [];

test('the corpus has about 14 fixtures covering the shapes in TEST_PLAN layer 3', () => {
  assert.ok(ids.length >= 14, 'fixtures: ' + ids.length);
  for (const need of ['single_col', 'two_col', 'docx_basic', 'table_layout', 'indian_format', 'linkedin_export', 'dates_five', 'ambiguous_terms', 'ten_page', 'scanned', 'non_resume', 'devanagari_mixed', 'hidden_text'])
    assert.ok(ids.includes(need), 'missing fixture ' + need);
});

for (const id of ids) {
  test(`fixture ${id}`, () => {
    const f = loadFixture(id);
    const e = f.expected;
    const t0 = performance.now();
    const r = readResume(f.text, { ...g, now: NOW });
    const ms = performance.now() - t0;
    assert.ok(ms < 3000, `tier 1 took ${Math.round(ms)} ms`);

    assert.equal(r.looksLikeResume, e.looksLikeResume, 'looksLikeResume');
    for (const w of e.warnings || []) assert.ok(r.warnings.some(x => x.code === w), 'warning ' + w + ' in ' + JSON.stringify(r.warnings));

    // roles and years, in reading order
    assert.equal(r.roles.length, e.roles.length, 'roles: ' + JSON.stringify(r.roles.map(x => [x.titleText, x.startYear, x.endYear])));
    e.roles.forEach((want, i) => {
      const got = r.roles[i];
      assert.ok(got.titleText.toLowerCase().includes(want.titleContains.toLowerCase()), `role ${i} title "${got.titleText}" should contain "${want.titleContains}"`);
      assert.equal(got.startYear, want.startYear, `role ${i} start`);
      assert.equal(got.endYear, want.endYear, `role ${i} end`);
      assert.equal(got.current, want.current, `role ${i} current`);
      assert.ok(got.occCandidates.length <= 3);
    });
    assert.equal(r.currentRoleIndex, e.currentRoleIndex, 'current role');

    // skills
    const sc = score(r, e);
    assert.deepEqual(sc.missed, [], 'must-find missed');
    assert.deepEqual(sc.falsePos, [], 'must-not-find found');
    const byId = new Map(r.skills.map(s => [s.id, s]));
    for (const [sid, year] of Object.entries(e.mustFindYears || {})) assert.equal(byId.get(sid).lastYear, year, `last year of ${sid}`);

    // every skill is a real graph id and comes with a source line from the resume
    const flat = f.text.replace(/\s+/g, ' ');
    for (const s of r.skills) {
      assert.ok(g.skillIds.has(s.id), 'unknown id ' + s.id);
      assert.ok(s.sourceLine.length > 0 && s.sourceLine.length <= 160);
      const bare = s.sourceLine.replace(/^…|…$/g, '').trim();
      assert.ok(flat.includes(bare), 'source line is not in the text: ' + s.sourceLine);
    }
    rows.push({ fixture: id, ms: Math.round(ms), roles: `${r.roles.length}/${e.roles.length}`, found: r.skills.length, mustFind: `${sc.hit}/${sc.must}`, recall: sc.recall.toFixed(2), falsePos: `${sc.falsePos.length}/${sc.notWant}`, precision: sc.labelledPrecision.toFixed(2) });
  });
}

test('summary', () => {
  console.table(rows);
  assert.equal(rows.length, ids.length - 0, 'every fixture ran');
});

test('canaries: every fixture holds every kind, exactly as listed in canaries.json', () => {
  const c = JSON.parse(readFileSync(FIXTURES_DIR + 'canaries.json', 'utf8'));
  assert.equal(c.base.email, 'canary.mail.7731@example.com');
  assert.equal(c.base.phone, '+91 98765 43210');
  assert.equal(c.base.pan, 'ABCDE1234F');
  assert.equal(c.base.aadhaar, '2345 6789 0123');
  assert.equal(c.base.name, 'Ravindran Canarypally');
  assert.equal(c.base.employer, 'Canaryworks Pvt Ltd');
  assert.equal(c.base.college, 'Canary Institute of Technology');
  for (const id of ids) {
    const entry = c.fixtures[id];
    assert.ok(entry, 'no canaries listed for ' + id);
    const dir = FIXTURES_DIR + id + '/';
    const text = readFileSync(dir + (entry.in === 'image' ? 'visible.txt' : 'resume.txt'), 'utf8');
    for (const kind of ['email', 'phone', 'pan', 'aadhaar', 'name', 'employer', 'college']) {
      assert.ok(entry[kind].length >= 1, `${id} has no ${kind} canary`);
      for (const v of entry[kind]) assert.ok(text.includes(v), `${id}: "${v}" is not in the text`);
    }
  }
  const phones = new Set(), names = new Set();
  for (const e of Object.values(c.fixtures)) { e.phone.forEach(x => phones.add(x)); e.name.forEach(x => names.add(x)); }
  assert.ok(phones.size >= 3 && names.size >= 3, 'spellings vary between fixtures');
});

test('the binaries exist, are small, and look like what they claim to be', () => {
  let pdfs = 0, docx = 0;
  for (const id of ids) {
    const e = loadFixture(id).expected;
    if (!e.binary) continue;
    const p = FIXTURES_DIR + id + '/' + e.binary;
    assert.ok(existsSync(p), 'missing ' + p);
    assert.ok(statSync(p).size < 200 * 1024, id + ' is large');
    const head = readFileSync(p).subarray(0, 5).toString('latin1');
    if (e.binary.endsWith('.pdf')) { assert.equal(head, '%PDF-'); pdfs++; } else { assert.ok(head.startsWith('PK'), id + ' is not a zip'); docx++; }
  }
  assert.ok(pdfs >= 11 && docx >= 1, `pdfs ${pdfs}, docx ${docx}`);
  // the ten-page fixture really is ten pages
  const raw = readFileSync(FIXTURES_DIR + 'ten_page/resume.pdf').toString('latin1');
  const counts = [...raw.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map(m => Number(m[1]));
  const direct = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.ok(counts.includes(10) || direct === 10, `ten_page: counts ${counts}, page objects ${direct}`);
});
