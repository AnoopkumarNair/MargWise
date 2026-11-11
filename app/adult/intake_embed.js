// Tier 2 on the device (BUILD_PLAN T4.5): the small language model and the skill vectors. This is the ONLY file that loads the vendored
// library (hosting/public/vendor/transformers/), and it does so only after the person has agreed to the download.
//
// Everything is a same-origin GET for a static file: the library, the WebAssembly runtime, the model files in ./models/ and the vectors
// beside the graph files. The library is set to read nothing from anywhere else (env.allowRemoteModels = false), to run on one thread with
// no worker (so the page needs no blob: URL and no cross-origin isolation), and to keep no copy of the runtime in a blob.
// The sentences go into the model in this page and nowhere else. No request carries them.
//
//   tier2Info() -> { available, totalBytes, files }      from the build's manifest.json (the size shown to the person is this number)
//   startScan(lines, { exclude, threshold, cap, onStatus, onProgress }) -> scan { promise, cancel(), subscribe(fn), last }   one scan at a time
//   currentScan() -> the scan in flight, or null (a screen drawn again while a scan runs attaches to it instead of starting another)
//   findMoreSkills(lines, opts) -> promise of [{ id, score, sourceLine, line }]    (startScan(...).promise; lines from intake/tier2.js achievementLines)
//
// One download per visit: the load in flight is kept at module level and reset if it fails. Model files sit under models/<revision>/ and the library
// keeps them in the Cache API, so a later visit need not download them again; a new revision is a new path (docs/adult/deviations.md D54).
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

// Lets the page repaint and answer a tap between two sentences. (A hidden tab slows timers to one a second, so it uses a message instead.)
export function yieldToUi() {
  if (typeof document !== 'undefined' && document.hidden && typeof MessageChannel !== 'undefined') return new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
  return new Promise(r => setTimeout(r, 0));
}

let loaded = null;    // { embed, vecs } once the model is ready; kept for the rest of the visit
let loading = null;   // the load in flight: { promise, subscribe, cancel, ... }. Set before the first await, cleared when it ends, so two calls never start two downloads.
let scan = null;      // the scan in flight (one at a time)

async function getBytes(url, onBytes, signal) {
  const r = await fetch(url, { credentials: 'omit', signal });
  if (!r.ok) throw new Tier2Problem(url + ' returned ' + r.status);
  if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); onBytes(b.byteLength); return b; }
  const rd = r.body.getReader(); const parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; onBytes(value.length); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

// fetch() that counts the bytes the library really reads, so the progress bar shows what was downloaded. The library gets this as env.fetch.
// The library swallows a failed download and then waits for ever, so a failure of any file the build lists is reported here, through `fail`.
function countingFetch(onBytes, listed, fail, signal) {
  return async (url, init) => {
    const path = new URL(url, location.href).pathname, must = listed.has(path);
    let r;
    try { r = await fetch(url, Object.assign({ credentials: 'omit', signal }, init)); } catch (e) { if (must) fail(new Tier2Problem('could not download ' + path)); throw e; }
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

async function load(info, say, signal) {
  let done = 0; say(0, 'Getting ready…');
  const lib = await import(LIB); done += (info.files.find(f => f.url === LIB) || { bytes: 0 }).bytes;
  const { env, pipeline } = lib;
  env.allowRemoteModels = false; env.allowLocalModels = true;
  env.localModelPath = new URL(info.modelPath, document.baseURI).pathname;   // a path on this site, not a full URL: the library reads a full URL as a remote one
  env.useWasmCache = false;   // the library's own copy in a blob: URL is not needed, and the page allows no blob: scripts
  let fail; const failed = new Promise((_, no) => { fail = no; }); failed.catch(() => {});
  const listed = new Set(info.files.map(f => new URL(f.url, location.origin + '/work/').pathname));
  env.fetch = countingFetch(n => { done += n; say(done, 'Downloading…'); }, listed, fail, signal);
  const ort = env.backends.onnx.wasm;
  ort.numThreads = 1; ort.proxy = false;
  ort.wasmPaths = { mjs: new URL(WASM_FACTORY, location.origin).href, wasm: new URL(WASM, location.origin).href };
  say(done, 'Downloading…');
  ort.wasmBinary = await getBytes(WASM, n => { done += n; say(done, 'Downloading…'); }, signal);   // the runtime, fetched here so it can be counted too
  const made = pipeline('feature-extraction', info.model, { dtype: info.dtype, device: 'wasm' }); made.catch(() => {});
  const pipe = await Promise.race([made, failed]);   // (no progress_callback: it makes the library ask for every file first)
  if (!pipe) throw new Tier2Problem('the model did not start');
  const embed = async texts => (await pipe(texts, { pooling: info.pooling, normalize: true })).tolist();
  const base = info.graphBase;
  const get = (name, how) => fetch(base + name, { credentials: 'omit', signal }).then(r => { if (!r.ok) throw new Tier2Problem(name + ' returned ' + r.status); return r[how](); });
  const [bin, meta] = await Promise.all([get('skill_vecs.bin', 'arrayBuffer'), get('skill_vecs.json', 'json')]);
  const vecs = (await import('./intake/tier2.js')).decodeVectors(bin, meta);
  dropOldModelCopies(env.localModelPath);
  return { embed, vecs };
}

// Removes cached model files of an older revision (best effort; only entries under this site's models/ folder).
async function dropOldModelCopies(keep) {
  try {
    const root = new URL('models/', document.baseURI).pathname, c = await caches.open('transformers-cache');
    for (const r of await c.keys()) { const p = new URL(r.url).pathname; if (p.startsWith(root) && !p.startsWith(keep)) await c.delete(r); }
  } catch (e) { /* the cache is not available: nothing to clean */ }
}

// The one load of this visit. Later callers join it. A failure or a cancel clears it. It outlives a scan: leaving the screen does not stop it.
function ensureLoaded(info) {
  if (loaded) return { promise: Promise.resolve(loaded) };
  if (!loading) {
    const ac = new AbortController();
    const cur = { listeners: new Set(), last: null, abort: () => ac.abort(), promise: null, cancelled: false };
    const say = (done, text) => { cur.last = { doneBytes: Math.min(done, info.totalBytes), totalBytes: info.totalBytes, text }; for (const fn of [...cur.listeners]) { try { fn(cur.last); } catch (e) { /* a screen that is gone */ } } };
    cur.subscribe = fn => { cur.listeners.add(fn); if (cur.last) fn(cur.last); return () => cur.listeners.delete(fn); };
    cur.cancel = () => { cur.cancelled = true; cur.abort(); if (loading === cur) loading = null; };   // a load that starts next is a new one, not this stopped one
    cur.promise = load(info, say, ac.signal);
    loading = cur;
    cur.promise.then(v => { loaded = v; if (loading === cur) loading = null; }, () => { if (loading === cur) loading = null; });
  }
  return loading;
}

export function currentScan() { return scan; }
// The download in flight, or null: { promise, subscribe(fn), cancel(), last }. A screen drawn while it runs shows it instead of offering a second one.
export function currentLoad() { return loading; }
export function isLoaded() { return !!loaded; }

// Starts a scan of `lines` (from achievementLines): loads the model if this visit has not, loads the vectors, finds skills. One scan at a time.
// Returns { promise, cancel(), orphan(), subscribe(fn), last, owner }. promise gives [{ id, score, sourceLine, line }], or rejects with Tier2Problem or
// Tier2Cancelled. cancel() also stops the download; orphan() stops only the scan (for a screen that was left). opts.owner says whose scan it is.
// subscribe(fn) gets the latest event, then each new one: { kind: 'download', doneBytes, totalBytes, text } or { kind: 'read', done, total }.
export function startScan(lines, opts) {
  if (scan) throw new Tier2Problem('a scan is already running');
  const o = opts || {};
  const listeners = new Set();
  const s = { last: null, cancelled: false, promise: null, owner: o.owner || null };
  s.subscribe = fn => { listeners.add(fn); if (s.last) fn(s.last); return () => listeners.delete(fn); };
  const emit = ev => { s.last = ev; for (const fn of [...listeners]) { try { fn(ev); } catch (e) { /* a screen that is gone */ } } };
  if (o.onStatus) listeners.add(ev => { if (ev.kind === 'download') o.onStatus(ev); });
  if (o.onProgress) listeners.add(ev => { if (ev.kind === 'read') o.onProgress(ev.done, ev.total); });
  let stop; const stopped = new Promise((_, no) => { stop = no; }); stopped.catch(() => {});
  const end = () => { if (scan === s) scan = null; };
  const halt = () => { if (s.cancelled) return; s.cancelled = true; end(); import('./intake/tier2.js').then(t => stop(new t.Tier2Cancelled('cancelled'))); };
  s.orphan = halt;
  s.cancel = () => { const l = loading; halt(); if (l && !loaded) l.cancel(); };
  scan = s;
  s.promise = (async () => {
    const info = await tier2Info();
    if (!info.available) throw new Tier2Problem('tier 2 is not available in this build');
    const t = state.manifest.tier2;
    const tier2 = await import('./intake/tier2.js');
    if (s.cancelled) throw new tier2.Tier2Cancelled('cancelled');
    if (!loaded) {
      const full = { ...info, model: t.model, dtype: t.dtype, pooling: t.pooling, modelPath: t.model_path || 'models/', graphBase: state.manifest.graph.base };
      const l = ensureLoaded(full); const off = l.subscribe ? l.subscribe(ev => emit({ kind: 'download', ...ev })) : () => {};
      try { await Promise.race([l.promise, stopped]); } finally { off(); }
    }
    // only ids that exist in the graph the page loaded can be suggested
    const index = await loadSkillsIndex(); const live = new Set(index.map(e => e.id));
    const found = await Promise.race([tier2.suggest(lines, { embed: loaded.embed, vecs: loaded.vecs, exclude: o.exclude, threshold: o.threshold, cap: o.cap,
      onProgress: (done, total) => emit({ kind: 'read', done, total }), yieldToUi: o.yieldToUi || yieldToUi, cancelled: () => s.cancelled }), stopped]);
    return found.filter(f => live.has(f.id));
  })();
  s.promise.then(end, end);
  return s;
}

export function findMoreSkills(lines, opts) { try { return startScan(lines, opts).promise; } catch (e) { return Promise.reject(e); } }
