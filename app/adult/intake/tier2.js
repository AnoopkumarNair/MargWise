// Tier 2 of the resume read (BUILD_PLAN T4.5): suggest skills a resume only hints at. Pure logic, no model in this file.
//
//   const lines = achievementLines(text, { nowYear });          // the sentences worth comparing
//   const vecs  = decodeVectors(binBytes, vecsJson);            // skill_vecs.bin (int8) + skill_vecs.json (ids)
//   const found = await suggest(lines, { embed, vecs, exclude: tier1Ids });
//   // found: [{ id, score, sourceLine, line }]  best first. Every id is an id that already exists in the graph.
//
// `embed(texts) -> Promise<array of vectors>` is injected: the browser passes the on-device model (intake_embed.js), a Node test or the
// evaluation harness passes its own, and the unit tests pass fake vectors. Nothing here loads a model, touches the network or stores text.
//
// A suggestion is never a fact. The person must tick it, it is never ticked for them, and it always carries the resume line it came
// from (SPEC principle 1: no model ever shows a user a fact of its own). Only ids from skill_vecs.json can come out.
import { splitLines, sectionMap, injectionLines, sourceLine } from './lines.js';
import { parseDateRange, joinWrappedDates } from './roles.js';

// Sentences go to the model one at a time. The model is int8 and a batch pads its texts, so the numbers for a sentence would change a little with
// the other sentences in its batch (a cosine of about 0.99). One at a time, a sentence gets the same vector in every resume, and the skill vectors
// are made the same way (embed_skills.mjs).
export const EMBED_BATCH = 1;
export const VERSION = 1;   // bump with any change to the line rules or the scoring below
// Tuned on the synthetic tier 2 fixtures (app/adult/tests/fixtures/tier2, docs/adult/deviations.md D47). A sentence is much shorter than
// an O*NET description, so cosine scores are lower than the 0.55 the plan guessed.
export const DEFAULTS = Object.freeze({ threshold: 0.4, perLine: 2, cap: 12, maxLines: 120 });

// Thrown by suggest() when opts.cancelled() says so. Not a failure: the person pressed Cancel.
export class Tier2Cancelled extends Error {}

const CONTACT = /[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\d\s().-]{8,}\d)|https?:\/\/|www\./i;
const SKIP_SECTIONS = new Set(['education', 'skills', 'certs', 'personal', 'other', 'summary']);
const MIN_WORDS = 5, MIN_LETTERS = 20, MAX_SENTENCE = 300;

// The sentences of a resume that describe what the person did. Headings, contact lines, skill lists, date lines, education, personal
// details and lines that read like instructions to an AI are left out. A long line is cut into sentences.
// Returns [{ text, sourceLine, line (index of the line in the text), roleIndex (index into opts.roles, or -1) }], at most opts.maxLines.
// opts: { nowYear (required), roles (optional, from readResume: used to say which job a sentence is in), maxLines }
export function achievementLines(text, opts) {
  const o = opts || {};
  const nowYear = Number.isInteger(o.nowYear) ? o.nowYear : new Date().getFullYear();
  const max = o.maxLines || DEFAULTS.maxLines;
  const lines = joinWrappedDates(splitLines(String(text == null ? '' : text).normalize('NFKC').slice(0, 300000)));   // the same lines tier 1 reads
  const sections = sectionMap(lines);
  const bad = injectionLines(lines);
  const out = [], seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const s = sections[i];
    if (s.heading || s.skillList || SKIP_SECTIONS.has(s.kind) || bad.has(i)) continue;
    const raw = lines[i].replace(/^[\s•*\-–—·▪●○◦>]+/, '').replace(/\s+/g, ' ').trim();
    if (!raw || CONTACT.test(raw) || parseDateRange(raw, nowYear)) continue;
    for (const part of splitSentences(raw)) {
      const key = part.toLowerCase();
      if (seen.has(key) || !worthy(part)) continue;
      seen.add(key);
      let roleIndex = -1;
      (o.roles || []).forEach((r, k) => { if (r && r.lines && i >= r.lines.from && i <= r.lines.to) roleIndex = k; });
      out.push({ text: part.slice(0, MAX_SENTENCE), sourceLine: sourceLine(part), line: i, roleIndex });
    }
  }
  if (out.length <= max) return out;
  // Too many to read on a phone in good time: keep the newest jobs first (a job that is current or ended most recently), then the order of the
  // resume. Sentences outside any dated job come after the dated ones. The kept sentences stay in the order they have in the resume.
  const recency = l => { const r = l.roleIndex >= 0 ? (o.roles || [])[l.roleIndex] : null; return !r ? -Infinity : r.current ? Infinity : Number.isInteger(r.endYear) ? r.endYear : (Number.isInteger(r.startYear) ? r.startYear : -1e9); };
  return out.map((l, n) => ({ l, n })).sort((a, b) => (recency(b.l) - recency(a.l)) || (a.n - b.n) || 0)
    .slice(0, max).sort((a, b) => a.n - b.n).map(x => x.l);
}
function splitSentences(line) {
  // "Did A. Did B." -> two sentences. A number such as "3.5" or a short initial ("B.Com") does not end one.
  // (no look-behind: older Safari on iPhone does not have it, so the end mark is matched and kept)
  const out = []; const re = /([a-z)\]”"'%][.;!?])\s+(?=[A-Z0-9])/gu; let from = 0, m;
  while ((m = re.exec(line))) { out.push(line.slice(from, m.index + m[1].length).trim()); from = m.index + m[0].length; }
  out.push(line.slice(from).trim());
  return out.filter(Boolean);
}
function worthy(s) {
  const words = s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
  return words.length >= MIN_WORDS && s.replace(/[^\p{L}]/gu, '').length >= MIN_LETTERS;
}

// ---- vectors --------------------------------------------------------------------------------------------------------------------
// skill_vecs.bin holds one row of `dims` int8 numbers per entry of skill_vecs.json `ids`, in that order. An id may appear on more than one row
// (its O*NET description and example phrases); its score is the best of its rows. Each row is the unit vector times `scale`.

// A unit vector as a row of int8 (what the offline tool writes, and what the tests use for fake vectors).
export function quantise(vec, scale = 127) {
  let n = 0; for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
  n = Math.sqrt(n) || 1;
  const out = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = Math.max(-scale, Math.min(scale, Math.round(vec[i] / n * scale)));
  return out;
}

// Checks the two files agree and returns { ids, dims, scale, data: Int8Array }. Throws a plain Error when they do not.
export function decodeVectors(bin, meta) {
  if (!meta || !Array.isArray(meta.ids) || !Number.isInteger(meta.dims) || meta.dims < 1 || !(meta.scale > 0)) throw new Error('skill_vecs.json is not valid');
  const bytes = bin instanceof Int8Array ? bin : new Int8Array(bin.buffer ? bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) : bin);
  if (bytes.length !== meta.ids.length * meta.dims) throw new Error('skill_vecs.bin has ' + bytes.length + ' bytes, but ' + meta.ids.length + ' ids of ' + meta.dims + ' numbers need ' + meta.ids.length * meta.dims);
  return { ids: meta.ids.slice(), dims: meta.dims, scale: meta.scale, data: bytes };
}

// Cosine of one unit vector `q` against every row. Rows are int8 at `scale`, so the dot product is divided by the scale.
export function similarities(q, vecs) {
  const { dims, data, scale } = vecs, n = vecs.ids.length, out = new Float32Array(n);
  if (q.length !== dims) throw new Error('the model gives ' + q.length + ' numbers, the skill vectors have ' + dims);
  for (let r = 0, o = 0; r < n; r++, o += dims) {
    let d = 0; for (let k = 0; k < dims; k++) d += q[k] * data[o + k];
    out[r] = d / scale;
  }
  return out;
}

function unit(v) {
  let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length); for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

// lines: from achievementLines(). opts:
//   embed      async (texts: string[]) => array of vectors (arrays or typed arrays), in the same order. Required.
//   vecs       from decodeVectors(). Required.
//   exclude    ids to leave out (what tier 1 already found, and anything already on the list). Set or array.
//   threshold  keep a match at or above this cosine (default DEFAULTS.threshold)
//   perLine    at most this many suggestions from one sentence (default 2)
//   cap        at most this many suggestions in all (default 12)
//   onProgress called with (done, total) sentences
//   yieldToUi  async () => void, awaited after every sentence. The browser passes a function that lets the page repaint and answer taps; Node passes nothing.
//   cancelled  () => boolean, asked before and after every sentence. When it says true, suggest() throws Tier2Cancelled.
// Returns [{ id, score, sourceLine, line }], best first, one per id (its best sentence). Ties go to the smaller id, so the result is stable.
export async function suggest(lines, opts) {
  const { embed, vecs } = opts || {};
  if (typeof embed !== 'function') throw new Error('tier2: embed is required');
  if (!vecs || !vecs.ids) throw new Error('tier2: vecs is required');
  const threshold = opts.threshold == null ? DEFAULTS.threshold : opts.threshold;
  const perLine = opts.perLine || DEFAULTS.perLine, cap = opts.cap || DEFAULTS.cap;
  const skip = new Set(opts.exclude || []);
  const best = new Map();   // id -> { id, score, sourceLine, line }
  const BATCH = EMBED_BATCH;
  for (let i = 0; i < lines.length; i += BATCH) {
    if (opts.cancelled && opts.cancelled()) throw new Tier2Cancelled('cancelled');
    const part = lines.slice(i, i + BATCH);
    const got = await embed(part.map(l => l.text));
    if (!got || got.length !== part.length) throw new Error('tier2: embed returned ' + (got ? got.length : 0) + ' vectors for ' + part.length + ' sentences');
    part.forEach((l, k) => {
      const sims = similarities(unit(got[k]), vecs);
      // a skill may have several rows (its description and example phrases): its score for this sentence is the best row
      const top = new Map();
      for (let r = 0; r < sims.length; r++) if (sims[r] >= threshold && !skip.has(vecs.ids[r]) && !(top.get(vecs.ids[r]) >= sims[r])) top.set(vecs.ids[r], sims[r]);
      const hits = [...top].map(([id, sc]) => [sc, id]);
      hits.sort((a, b) => (b[0] - a[0]) || (a[1] < b[1] ? -1 : 1));
      for (const [score, id] of hits.slice(0, perLine)) {
        const cur = best.get(id);
        if (!cur || score > cur.score) best.set(id, { id, score: Math.round(score * 1000) / 1000, sourceLine: l.sourceLine, line: l.line });
      }
    });
    if (opts.onProgress) opts.onProgress(Math.min(i + BATCH, lines.length), lines.length);
    if (opts.yieldToUi) await opts.yieldToUi();
    if (opts.cancelled && opts.cancelled()) throw new Tier2Cancelled('cancelled');
  }
  return [...best.values()].sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1)).slice(0, cap);
}

// Text in, suggestions out: the entry point for a Node harness.
//   tier1 = readResume(text, ...)  then  tier2 = await suggestFromText(text, { nowYear, embed, vecs, exclude: tier1.skills.map(s => s.id), roles: tier1.roles })
export async function suggestFromText(text, opts) {
  return suggest(achievementLines(text, { nowYear: opts.nowYear, roles: opts.roles, maxLines: opts.maxLines }), opts);
}
