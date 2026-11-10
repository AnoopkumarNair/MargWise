// Tier 2 with the REAL model in Node (BUILD_PLAN T4.5, TEST_PLAN layer 3 extended): the synthetic fixtures in tests/fixtures/tier2, read with
// the committed skill vectors (data/graph/skill_vecs.bin). It needs the model in app/adult/tools/model_cache/ (python3 app/adult/tools/fetch_model.py)
// and the tool's packages (cd app/adult/tools/embed && npm ci). Without them:
//   - under CI=true this test FAILS, so a missing model can never pass silently;
//   - on a developer machine it prints a notice and does not run the model.
//   node --test app/adult/tests/intake/tier2_model.test.mjs
//
// The floors below were measured on these fixtures with this model, vectors and threshold 0.40 (docs/adult/deviations.md D47):
//   line recall 0.21 (10 of 48 implied lines got a fair suggestion), fair precision 0.72 (13 of 18), strict precision 0.22, 2.3 suggestions a resume.
// They are floors, not targets. The fixtures are small and were used to choose the threshold, so real resumes will do differently (T7.3 measures that).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeVectors, DEFAULTS } from '../../intake/tier2.js';
import { evaluate, memoEmbed, tier2Fixtures } from '../lib/tier2_eval.mjs';
import { loadNodeEmbedder, nodeDepsInstalled, modelCached, MANIFEST } from '../../tools/embed/node_embedder.mjs';

const GRAPH = fileURLToPath(new URL('../../../../data/graph/', import.meta.url));
const FLOORS = { lineRecall: 0.15, precisionFair: 0.65, precision: 0.15, perResumeMin: 1, perResumeMax: 4 };
const ready = nodeDepsInstalled() && modelCached();

if (!ready) {
  const why = 'the real tier 2 model test cannot run: ' + (!nodeDepsInstalled() ? 'run `cd app/adult/tools/embed && npm ci`' : '') + (!modelCached() ? ' run `python3 app/adult/tools/fetch_model.py`' : '');
  if (process.env.CI === 'true') test('the real model is available in CI', () => assert.fail(why + ' (CI must fetch the pinned model)'));
  else test('the real model test is not run on this machine', () => console.log('\n  NOTICE: ' + why + '. Nothing was checked against the model.\n'));
} else {
  const embed = memoEmbed(await loadNodeEmbedder());
  const meta = JSON.parse(readFileSync(GRAPH + 'skill_vecs.json', 'utf8'));
  const vecs = decodeVectors(readFileSync(GRAPH + 'skill_vecs.bin'), meta);

  test('the committed vectors were made with the pinned model and library', () => {
    assert.equal(meta.model, MANIFEST.model_id); assert.equal(meta.revision, MANIFEST.revision); assert.equal(meta.dtype, MANIFEST.dtype);
    assert.equal(meta.dims, MANIFEST.dims);
    assert.match(meta.library, /transformers 4\.3\.2/);
  });

  test('the model reproduces the committed vectors (so the export and the browser agree)', async () => {
    const texts = JSON.parse(spawnTexts());
    for (const k of [0, 17, 45, 80, 108]) {
      const [v] = await embed([texts[k].text]);
      assert.equal(texts[k].id, vecs.ids[k]);
      let dot = 0; for (let i = 0; i < vecs.dims; i++) dot += v[i] * vecs.data[k * vecs.dims + i] / vecs.scale;
      assert.ok(dot > 0.995, `${texts[k].id}: cosine with the committed row is ${dot.toFixed(4)}`);
    }
  });

  test(`tier 2 on the synthetic fixtures at the default threshold (${DEFAULTS.threshold}) stays above the measured floors`, async () => {
    const r = await evaluate({ embed, vecs, threshold: DEFAULTS.threshold, perLine: DEFAULTS.perLine });
    console.log(`  tier 2, ${r.fixtures} fixtures: ${r.perResume.toFixed(1)} suggestions a resume, line recall ${r.lineRecall.toFixed(2)} (${r.linesHit}/${r.impliedLines}), ` +
      `fair precision ${r.precisionFair.toFixed(2)} (${r.tp + r.ok}/${r.suggested}), strict precision ${r.precision.toFixed(2)}`);
    assert.ok(r.lineRecall >= FLOORS.lineRecall, 'line recall ' + r.lineRecall);
    assert.ok(r.precisionFair >= FLOORS.precisionFair, 'fair precision ' + r.precisionFair + '\n' + r.falsePos.join('\n'));
    assert.ok(r.precision >= FLOORS.precision, 'strict precision ' + r.precision);
    assert.ok(r.perResume >= FLOORS.perResumeMin && r.perResume <= FLOORS.perResumeMax, 'suggestions a resume: ' + r.perResume);
  });

  test('the old guess of 0.55 would suggest almost nothing on these sentences (why the threshold is lower)', async () => {
    const r = await evaluate({ embed, vecs, threshold: 0.55, perLine: DEFAULTS.perLine });
    assert.ok(r.perResume < 0.5, 'at 0.55: ' + r.perResume + ' a resume');
  });

  test('every suggestion is an id of the graph and carries the resume line it came from', async () => {
    const live = new Set(JSON.parse(readFileSync(GRAPH + 'skills_index.json', 'utf8')).map(e => e.id));
    const { achievementLines, suggest } = await import('../../intake/tier2.js');
    for (const f of tier2Fixtures()) {
      const lines = achievementLines(f.text, { nowYear: 2026 });
      for (const s of await suggest(lines, { embed, vecs, threshold: 0.3 })) {
        assert.ok(live.has(s.id), s.id); assert.ok(s.sourceLine && f.text.includes(s.sourceLine.replace(/…$/, '').slice(0, 40)), 'source line: ' + s.sourceLine);
      }
    }
  });
}

// The texts that were embedded, from the offline recipe (python, standard library).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
function spawnTexts() {
  const d = mkdtempSync(tmpdir() + '/mw-texts-');
  try {
    const r = spawnSync('python3', [GRAPH + 'vec_texts.py', '--json', d + '/t.json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.stringify(JSON.parse(readFileSync(d + '/t.json', 'utf8')).texts);
  } finally { rmSync(d, { recursive: true, force: true }); }
}
