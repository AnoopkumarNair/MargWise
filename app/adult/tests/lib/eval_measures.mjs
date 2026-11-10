// Pure measures for the evaluation harness (eval_intake.mjs): no files, no printing, nothing about a person leaves these functions except numbers.
// SPEC 11 targets are in TARGETS. Test and harness use only.

export const TARGETS = Object.freeze({ precision: 0.85, recall: 0.70, roleOneEdit: 0.90, medianSeconds: 240 });
export const MIN_PEOPLE = 5;   // BUILD_PLAN: aggregates are shown from 5 people up

export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function percentile(a, p) {   // nearest rank
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))];
}
export const rate = (n, d) => (d ? n / d : null);

// suggested: one Set of ids per person; confirmed: one Set per person (same order).
// Pooled: precision = sum(suggested and confirmed) / sum(suggested); recall = sum(suggested and confirmed) / sum(confirmed).
// perPerson: the median of each person's own rates (people with nothing suggested, or nothing confirmed, are left out of that rate).
export function skillScores(suggested, confirmed) {
  let tp = 0, sug = 0, conf = 0; const ps = [], rs = [];
  suggested.forEach((S, i) => {
    const C = confirmed[i]; let hit = 0;
    for (const id of S) if (C.has(id)) hit++;
    tp += hit; sug += S.size; conf += C.size;
    if (S.size) ps.push(hit / S.size);
    if (C.size) rs.push(hit / C.size);
  });
  return { people: suggested.length, suggested: sug, confirmed: conf, hit: tp, precision: rate(tp, sug), recall: rate(tp, conf), medianPrecision: median(ps), medianRecall: median(rs) };
}

// Union of two lists of Sets, person by person.
export function unionSets(a, b) { return a.map((s, i) => new Set([...s, ...b[i]])); }

// What a person's resume text holds that should never reach the preview. Simple, documented patterns (SPEC 11, redaction):
//   email  : something@something.tld
//   phone  : 10 to 14 digits with spaces, dots, dashes, brackets or a leading +  (also catches some long numbers; that is a baseline, not a judge)
//   id     : PAN (5 letters, 4 digits, 1 letter) or Aadhaar (12 digits, in groups of 4 or not)
export const SHAPES = Object.freeze({
  email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  phone: /(?:\+?\d[\d\s().-]{8,}\d)/g,
  id: /\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
});
export function shapeCounts(text) {
  const t = String(text == null ? '' : text), out = {};
  for (const [k, re] of Object.entries(SHAPES)) out[k] = (t.match(re) || []).filter(m => k !== 'phone' || m.replace(/\D/g, '').length >= 10).length;
  return out;
}
// Baseline: how many resumes CONTAIN each shape. This says nothing about leaks: nothing was redacted.
export function containCounts(texts) {
  const out = { email: 0, phone: 0, id: 0, any: 0 };
  for (const t of texts) { const c = shapeCounts(t); let any = false; for (const k of Object.keys(SHAPES)) if (c[k]) { out[k]++; any = true; } if (any) out.any++; }
  return out;
}
// With a redactor plugged in (redact(text) -> text, or { text }): what is still in the redacted text. Returns { misses: [{ index, category, count }], total }.
// `index` is the person's position (1-based) in the harness's sorted list. The value is never kept.
export async function redactionMisses(texts, redact) {
  const misses = []; let total = 0;
  for (let i = 0; i < texts.length; i++) {
    const r = await redact(texts[i]);
    const c = shapeCounts(typeof r === 'string' ? r : r && r.text);
    for (const k of Object.keys(SHAPES)) if (c[k]) { misses.push({ index: i + 1, category: k, count: c[k] }); total += c[k]; }
  }
  return { misses, total };
}

// Role: confirmed = the occupation id the person confirmed for their current job; first = the reader's first choice; candidates = all it offered (up to 3).
//   exact     : the first choice is the confirmed one (no edit)
//   onePick   : exact, or the confirmed one is among the candidates (one tap on the confirm screen)
export function roleOutcome(confirmedOcc, firstOcc, candidateOccs) {
  const exact = !!confirmedOcc && firstOcc === confirmedOcc;
  return { exact, onePick: exact || (!!confirmedOcc && (candidateOccs || []).includes(confirmedOcc)) };
}
