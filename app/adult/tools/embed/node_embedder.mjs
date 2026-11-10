// Loads the pinned model in Node (onnxruntime-node) and returns embed(texts) -> unit vectors (arrays of numbers).
// Used by the offline vector tool (embed_skills.mjs) and by the tests that run the real model. The app never uses this file.
// The model files come from the git-ignored cache that app/adult/tools/fetch_model.py fills. Nothing is fetched from the network here.
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const HERE = fileURLToPath(new URL('./', import.meta.url));
export const MODEL_CACHE = fileURLToPath(new URL('../model_cache/', import.meta.url));
export const MANIFEST = JSON.parse(readFileSync(fileURLToPath(new URL('../tier2_model.json', import.meta.url)), 'utf8'));

export function nodeDepsInstalled() { return existsSync(HERE + 'node_modules/@huggingface/transformers/package.json'); }
export function modelCached() { return existsSync(MODEL_CACHE + MANIFEST.model_id + '/onnx/model_int8.onnx'); }

export async function loadNodeEmbedder() {
  if (!nodeDepsInstalled()) throw new Error('run `npm ci` in app/adult/tools/embed/ first');
  if (!modelCached()) throw new Error('the model is not in app/adult/tools/model_cache/: run python3 app/adult/tools/fetch_model.py');
  const T = await import('@huggingface/transformers');
  T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.localModelPath = MODEL_CACHE; T.env.useBrowserCache = false;
  const pipe = await T.pipeline('feature-extraction', MANIFEST.model_id, { dtype: MANIFEST.dtype });
  const embed = async texts => (await pipe(texts, { pooling: MANIFEST.pooling, normalize: MANIFEST.normalize })).tolist();
  embed.version = JSON.parse(readFileSync(HERE + 'node_modules/@huggingface/transformers/package.json', 'utf8')).version;
  return embed;
}
