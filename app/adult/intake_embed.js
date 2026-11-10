// Tier 2 on the device (BUILD_PLAN T4.5): the small language model and the skill vectors. This is the ONLY file that loads the vendored
// library (hosting/public/vendor/transformers/), and it does so only after the person has agreed to the download.
//
// Everything is a same-origin GET for a static file: the library, the WebAssembly runtime, the model files in ./models/ and the vectors
// beside the graph files. The library is set to read nothing from anywhere else (env.allowRemoteModels = false), to run on one thread with
// no worker (so the page needs no blob: URL and no cross-origin isolation), and to keep no copy of the runtime in a blob.
// The sentences go into the model in this page and nowhere else. No request carries them.
//
//   tier2Info() -> { available, totalBytes, files }      from the build's manifest.json (the size shown to the person is this number)
//   findMoreSkills(lines, { exclude, threshold, cap, onStatus, onProgress }) -> [{ id, score, sourceLine, line }]    (lines from intake/tier2.js achievementLines)
import { loadManifest, loadSkillsIndex } from './data.js';
import { state } from './state.js';

export const LIB = '/vendor/transformers/transformers.min.js';
export const WASM = '/vendor/transformers/ort-wasm-simd-threaded.wasm';
export const WASM_FACTORY = '/vendor/transformers/ort-wasm-simd-threaded.mjs';

export class Tier2Problem extends Error {}

// What the build says about tier 2. { available: false } when the build has no model or no vectors: the app then does not offer it.
export async function tier2Info() {
  await loadManifest();
  const t = state.manifest && state.manifest.tier2;
  if (!t || !t.available) return { available: false, totalBytes: 0, files: [] };
  return { available: true, totalBytes: t.total_bytes, files: t.files };
}

// "38 MB": the real total, rounded to whole megabytes (1 MB = 1,000,000 bytes), never below 1.
export function megabytes(bytes) { return Math.max(1, Math.round(bytes / 1e6)) + ' MB'; }

let loaded = null;   // { embed, vecs } once the model is ready; kept for the rest of the visit so a second look does not download again

async function getBytes(url, onBytes) {
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Tier2Problem(url + ' returned ' + r.status);
  if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); onBytes(b.byteLength); return b; }
  const rd = r.body.getReader(); const parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; onBytes(value.length); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

// fetch() that counts the bytes the library really reads, so the progress bar shows what was downloaded. The library gets this as env.fetch.
// The library swallows a failed download and then waits for ever, so a failure of any file the build lists is reported here, through `fail`.
function countingFetch(onBytes, listed, fail) {
  return async (url, init) => {
    const path = new URL(url, location.href).pathname, must = listed.has(path);
    let r;
    try { r = await fetch(url, Object.assign({ credentials: 'omit' }, init)); } catch (e) { if (must) fail(new Tier2Problem('could not download ' + path)); throw e; }
    if (!r.ok && must) fail(new Tier2Problem(path + ' returned ' + r.status));
    if (!r.ok || !r.body || !r.body.getReader || (init && init.method && init.method !== 'GET')) return r;
    const rd = r.body.getReader();
    const body = new ReadableStream({
      async pull(c) { try { const { done, value } = await rd.read(); if (done) { c.close(); return; } onBytes(value.length); c.enqueue(value); } catch (e) { if (must) fail(new Tier2Problem('the download of ' + path + ' stopped')); throw e; } },
      cancel(why) { return rd.cancel(why); },
    });
    return new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
  };
}

async function load(info, onStatus) {
  const say = (done, text) => onStatus && onStatus({ doneBytes: Math.min(done, info.totalBytes), totalBytes: info.totalBytes, text });
  let done = 0; say(0, 'Getting ready…');
  const lib = await import(LIB); done += (info.files.find(f => f.url === LIB) || { bytes: 0 }).bytes;
  const { env, pipeline } = lib;
  env.allowRemoteModels = false; env.allowLocalModels = true;
  env.localModelPath = new URL('models/', document.baseURI).pathname;   // a path on this site, not a full URL: the library reads a full URL as a remote one
  env.useWasmCache = false;   // the library's own copy in a blob: URL is not needed, and the page allows no blob: scripts
  let fail; const failed = new Promise((_, no) => { fail = no; });
  const listed = new Set(info.files.map(f => new URL(f.url, location.origin + '/work/').pathname));
  env.fetch = countingFetch(n => { done += n; say(done, 'Downloading…'); }, listed, fail);
  const ort = env.backends.onnx.wasm;
  ort.numThreads = 1; ort.proxy = false;
  ort.wasmPaths = { mjs: new URL(WASM_FACTORY, location.origin).href, wasm: new URL(WASM, location.origin).href };
  say(done, 'Downloading…');
  ort.wasmBinary = await getBytes(WASM, n => { done += n; say(done, 'Downloading…'); });   // the runtime, fetched here so it can be counted too
  const pipe = await Promise.race([pipeline('feature-extraction', info.model, { dtype: info.dtype, device: 'wasm' }), failed]);   // (no progress_callback: it makes the library ask for every file first)
  if (!pipe) throw new Tier2Problem('the model did not start');
  const embed = async texts => (await pipe(texts, { pooling: info.pooling, normalize: true })).tolist();
  say(info.totalBytes, 'Reading your resume…');
  return embed;
}

// Downloads and starts the model (once per visit), loads the skill vectors, and finds skills for the sentences.
// Throws Tier2Problem (or any error) when something fails; the caller keeps the tier 1 result either way.
export async function findMoreSkills(lines, opts) {
  const o = opts || {};
  const info = await tier2Info();
  if (!info.available) throw new Tier2Problem('tier 2 is not available in this build');
  const t = state.manifest.tier2;
  const tier2 = await import('./intake/tier2.js');
  if (!loaded) {
    const model = { model: t.model, dtype: t.dtype, pooling: t.pooling };
    const embed = await load({ ...info, ...model }, o.onStatus);
    const base = state.manifest.graph.base;
    const [bin, meta] = await Promise.all([fetch(base + 'skill_vecs.bin', { credentials: 'omit' }).then(r => { if (!r.ok) throw new Tier2Problem('skill_vecs.bin returned ' + r.status); return r.arrayBuffer(); }),
      fetch(base + 'skill_vecs.json', { credentials: 'omit' }).then(r => { if (!r.ok) throw new Tier2Problem('skill_vecs.json returned ' + r.status); return r.json(); })]);
    loaded = { embed, vecs: tier2.decodeVectors(bin, meta) };
  }
  // only ids that exist in the graph the page loaded can be suggested
  const index = await loadSkillsIndex(); const live = new Set(index.map(e => e.id));
  const found = await tier2.suggest(lines, { embed: loaded.embed, vecs: loaded.vecs, exclude: o.exclude, threshold: o.threshold, cap: o.cap, onProgress: o.onProgress });
  return found.filter(f => live.has(f.id));
}
