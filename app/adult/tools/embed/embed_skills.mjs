// Makes data/graph/skill_vecs.bin and skill_vecs.json (BUILD_PLAN T4.5). Offline tool: run it by hand when the skill texts or the model change.
//
//   cd app/adult/tools/embed && npm ci          once (the tool's own packages, not the app's)
//   python3 app/adult/tools/fetch_model.py      once (the pinned model into the git-ignored model_cache/)
//   node app/adult/tools/embed/embed_skills.mjs [--date YYYY-MM-DD]
//
// It embeds the texts from data/graph/vec_texts.py (recipe in that file) with the pinned model, scales each unit vector by 127 and
// writes it as int8, row by row. The browser loads the same model, so a sentence and a skill are compared with the same numbers.
// The offline pipeline (pipeline/run.py) never runs this: it only checks that the files still match the texts (pipeline/validate_graph.py).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNodeEmbedder, MANIFEST } from './node_embedder.mjs';
import { quantise, EMBED_BATCH } from '../../intake/tier2.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const GRAPH = join(ROOT, 'data', 'graph');
const dateArg = process.argv.indexOf('--date') > 0 ? process.argv[process.argv.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);

const tmp = mkdtempSync(join(tmpdir(), 'mw-vec-'));
try {
  const r = spawnSync('python3', [join(GRAPH, 'vec_texts.py'), '--json', join(tmp, 'texts.json')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  const t = JSON.parse(readFileSync(join(tmp, 'texts.json'), 'utf8'));
  const embed = await loadNodeEmbedder();
  const dims = MANIFEST.dims, scale = 127;
  const data = new Int8Array(t.texts.length * dims);
  for (let i = 0; i < t.texts.length; i += EMBED_BATCH) {   // one text at a time, as the app does (see EMBED_BATCH in intake/tier2.js)
    const part = t.texts.slice(i, i + EMBED_BATCH);
    const vecs = await embed(part.map(x => x.text));
    vecs.forEach((v, k) => { if (v.length !== dims) throw new Error('the model gave ' + v.length + ' numbers, expected ' + dims); data.set(quantise(v, scale), (i + k) * dims); });
  }
  writeFileSync(join(GRAPH, 'skill_vecs.bin'), data);
  const meta = {
    model: MANIFEST.model_id, revision: MANIFEST.revision, dtype: MANIFEST.dtype, library: '@huggingface/transformers ' + embed.version + ' (onnxruntime-node), as pinned in app/adult/tools/embed/package-lock.json',
    dims, scale, pooling: MANIFEST.pooling, normalized: true, row_format: 'int8, row-major, unit vector times scale', recipe: t.recipe,
    text: '"<label>: <O*NET description>" for each skill, knowledge and work activity (technologies are not embedded); see data/graph/vec_texts.py',
    texts_sha256: t.texts_sha256, built: dateArg, ids: t.texts.map(x => x.id),
  };
  writeFileSync(join(GRAPH, 'skill_vecs.json'), JSON.stringify(meta) + '\n');
  console.log('wrote data/graph/skill_vecs.bin (' + data.length + ' bytes) and skill_vecs.json (' + meta.ids.length + ' ids, model ' + meta.model + ' @ ' + meta.revision.slice(0, 12) + ')');
} finally { rmSync(tmp, { recursive: true, force: true }); }
