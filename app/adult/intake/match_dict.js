// Tier 1 of the resume read: a dictionary match (BUILD_PLAN T4.4).
// Finds every skill and technology from skills_index.json in the resume lines.
//   - Aho-Corasick, written by hand: one pass over the text however many terms there are
//   - case-insensitive, whole-word, unicode-safe (Devanagari and accents are word characters)
//   - the longest term wins where two overlap ("Microsoft Excel" beats "Excel")
//   - everyday words and short terms ("R", "Go", "Spring", "Excel") need a context word, see ambiguous.js
// Pure functions. No DOM, no Date, no network. The text is kept in memory only.
import { ruleFor, decide, fold as foldWord, EXTRA_ALIASES } from './ambiguous.js';
import { sourceLine } from './lines.js';

// Lower case, one UTF-16 unit in and one out, so positions in the folded text are positions in the original.
const PLAIN = /[^\x20-\x7e]/;
export function fold(s) {
  s = String(s);
  if (!PLAIN.test(s)) return s.toLowerCase(); // plain ASCII: the common case
  let out = '';
  for (const ch of s) {
    let c = ch;
    if (/\s/u.test(c) && c !== '\n') c = ' ';
    else if (c === '–' || c === '—' || c === '−' || c === '‑') c = '-';
    else if (c === '‘' || c === '’' || c === '´') c = "'";
    else if (c === '​' || c === '‌' || c === '‍' || c === '­' || c === '﻿') c = ' ';
    else { const l = c.toLowerCase(); c = l.length === c.length ? l : c; }
    out += c;
  }
  return out;
}

const WORD = /[\p{L}\p{N}\p{M}_]/u;
function charBefore(s, i) { // the character before index i (a surrogate pair counts as one)
  if (i <= 0) return '';
  const c = s.charCodeAt(i - 1);
  if (c >= 0xDC00 && c <= 0xDFFF && i >= 2) return s.slice(i - 2, i);
  return s[i - 1];
}
function charAt(s, i) {
  if (i >= s.length) return '';
  const c = s.charCodeAt(i);
  if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) return s.slice(i, i + 2);
  return s[i];
}
const isWord = ch => ch !== '' && WORD.test(ch);

// Names of certifications that count as credentials, but only when the skills index itself holds them as a term.
const CERT_NAMES = new Set(['pmp', 'prince2', 'ccna', 'ccnp', 'cissp', 'cism', 'cisa', 'ceh', 'itil', 'cfa', 'cpa', 'acca', 'six sigma', 'lean six sigma', 'csm', 'safe agilist']);
const CERT_LABEL = /\b(certified|certification)\b/i;

// People write "Photoshop", not "Adobe Photoshop". A name without its vendor is added as a term, unless it is an everyday word
// or it is already a term of its own.
const VENDORS = ['microsoft', 'ms', 'adobe', 'oracle', 'google', 'amazon', 'ibm', 'apache', 'atlassian', 'salesforce', 'autodesk', 'cisco', 'vmware', 'sun microsystems', 'red hat', 'jetbrains', 'github', 'sap', 'mozilla', 'elastic'];
const VENDOR_BLOCK = new Set(['word', 'access', 'teams', 'project', 'office', 'windows', 'power', 'dynamics', 'sheets', 'docs', 'drive', 'maps', 'translate', 'forms', 'publisher', 'cloud', 'services', 'studio', 'edge', 'store', 'live', 'one', 'mobile', 'server', 'platform', 'suite', 'express', 'enterprise', 'standard', 'professional', 'mail', 'calendar', 'security', 'defender', 'software', 'tools', 'analytics', 'search', 'ads', 'data', 'database', 'reports', 'script', 'visual', 'test', 'systems', 'solutions', 'access', 'ads', 'checkout', 'classroom', 'clinical', 'cobalt', 'connect', 'contribute', 'darwin', 'designer', 'director', 'domino', 'erp', 'exchange', 'flex', 'hive', 'inventory', 'mechanical', 'meet', 'middleware', 'money', 'notes', 'paint', 'persuasion', 'presenter', 'rational', 'reports', 'scholar', 'scm', 'sites', 'slides', 'smoke', 'video', 'works', 'workstation', 'world', 'ant', 'pig', 'air', 'bamboo', 'continuum', 'combustion', 'maintenance', 'apo', 'beehive', 'dms', 'ilog']);

// ---------- Aho-Corasick ----------
class Automaton {
  constructor() {
    this.go = new Map();   // node * 65536 + code -> child node
    this.head = [-1];      // first child of a node (linked list through `sib`)
    this.sib = [-1];
    this.code = [0];
    this.fail = [0];
    this.out = [-1];       // pattern index ending at this node
    this.dict = [-1];      // nearest node along the fail chain that has an output
    this.depth = [0];
    this.patterns = [];
  }
  add(term, payload) {
    let n = 0;
    for (let i = 0; i < term.length; i++) {
      const c = term.charCodeAt(i), k = n * 65536 + c;
      let nx = this.go.get(k);
      if (nx === undefined) {
        nx = this.head.length;
        this.head.push(-1); this.sib.push(this.head[n]); this.code.push(c); this.fail.push(0); this.out.push(-1); this.dict.push(-1); this.depth.push(this.depth[n] + 1);
        this.head[n] = nx; this.go.set(k, nx);
      }
      n = nx;
    }
    if (this.out[n] < 0) { this.out[n] = this.patterns.length; this.patterns.push({ term, entries: [] }); }
    this.patterns[this.out[n]].entries.push(payload);
  }
  build() {
    const q = [];
    for (let c = this.head[0]; c >= 0; c = this.sib[c]) { this.fail[c] = 0; q.push(c); }
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi];
      for (let c = this.head[v]; c >= 0; c = this.sib[c]) {
        const ch = this.code[c];
        let f = this.fail[v], t;
        for (;;) { t = this.go.get(f * 65536 + ch); if (t !== undefined || f === 0) break; f = this.fail[f]; }
        this.fail[c] = (t !== undefined && t !== c) ? t : 0;
        const fc = this.fail[c];
        this.dict[c] = this.out[fc] >= 0 ? fc : this.dict[fc];
        q.push(c);
      }
    }
  }
  // Calls found(startIndex, endIndex, pattern) for every occurrence in `s`.
  scan(s, found) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      let t;
      for (;;) { t = this.go.get(n * 65536 + ch); if (t !== undefined || n === 0) break; n = this.fail[n]; }
      n = t === undefined ? 0 : t;
      for (let m = this.out[n] >= 0 ? n : this.dict[n]; m >= 0; m = this.dict[m]) found(i + 1 - this.depth[m], i + 1, this.patterns[this.out[m]]);
    }
  }
}

const cache = new WeakMap();

// Builds the matcher for a skills index ([{id,label,alt,kind,ambiguous?}]). Cached per index object.
export function buildMatcher(skillsIndex) {
  if (cache.has(skillsIndex)) return cache.get(skillsIndex);
  const ac = new Automaton();
  const ids = new Map(); // id -> entry
  const byId = new Map();
  const seen = new Set();
  const add = (term, entry, isAlias) => {
    const f = fold(term).replace(/\s+/g, ' ').trim();
    if (!/[\p{L}\p{N}]/u.test(f)) return;
    const key = f + '\u0000' + entry.id;
    if (seen.has(key)) return;
    seen.add(key);
    const rule = ruleFor(foldWord(f), isAlias ? { kind: entry.kind, ambiguous: entry.ambiguous } : entry, term.trim());
    const cert = CERT_NAMES.has(f) || CERT_LABEL.test(entry.label);
    ac.add(f, { id: entry.id, label: entry.label, kind: entry.kind, rule, cert });
  };
  const real = new Set();
  const variants = [];
  for (const e of skillsIndex) {
    for (const t of [e.label].concat(e.alt || [])) real.add(fold(t).replace(/\s+/g, ' ').trim());
  }
  for (const e of skillsIndex) {
    byId.set(e.id, e);
    if (e.kind === 'technology') {
      const lab = e.label.trim();
      for (const v of VENDORS) {
        if (lab.length > v.length + 3 && lab.slice(0, v.length).toLowerCase() === v && lab[v.length] === ' ') {
          const rest = lab.slice(v.length + 1).trim();
          const f = fold(rest);
          if (rest.replace(/[^\p{L}\p{N}\p{M}]/gu, '').length >= 4 && !VENDOR_BLOCK.has(f) && !real.has(f)) variants.push([rest, e]);
          break;
        }
      }
    }
    const terms = [e.label].concat(e.alt || []);
    for (const t of terms) {
      add(t, e);
      // "SAP software" and "Microsoft Office software": people drop the last word. Only for brand names (a capital after the first
      // letter), never for the plain categories ("Sales software" must not match every "sales").
      const m = /^(.{3,}?)\s+software$/i.exec(t);
      if (m && /[A-Z]/.test(m[1].slice(1))) add(m[1], e);
    }
  }
  for (const [t, e] of variants) { real.add(fold(t)); add(t, e); }
  for (const a of EXTRA_ALIASES) { const e = byId.get(a.id); if (e) add(a.term, e, true); }
  ac.build();
  const matcher = { ac, size: ac.patterns.length };
  cache.set(skillsIndex, matcher);
  return matcher;
}

const URLISH = /\b(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|in|org|io|co|me|dev)\b(?:\/\S*)?/gi;

function isListItem(line, start, end, seps) {
  let b = start - 1; while (b >= 0 && line[b] === ' ') b--;
  let a = end; while (a < line.length && line[a] === ' ') a++;
  const okB = b < 0 || ',;|•·/\t:(*-–'.indexOf(line[b]) >= 0;
  const okA = a >= line.length || ',;|•·/\t)'.indexOf(line[a]) >= 0;
  if (!(okB && okA)) return false;
  return seps() >= 2;
}

// Finds hits on the resume lines.
//   lines    array of strings
//   opts.sections  from lines.sectionMap (a skills section counts as a skills list)
//   opts.skip      Set of line indexes to leave out (instruction-like text)
// Returns [{ id, label, kind, cert, term, line, start, end, sourceLine }] in reading order. `term` is the text as written.
export function findHits(matcher, lines, opts = {}) {
  const sections = opts.sections || null;
  const skip = opts.skip || null;
  const hits = [];
  for (let li = 0; li < lines.length; li++) {
    if (skip && skip.has(li)) continue;
    const line = lines[li];
    if (!line || line.length < 1) continue;
    const f = fold(line);
    const cands = [];
    matcher.ac.scan(f, (s, e, pat) => {
      // whole word
      if (isWord(charBefore(line, s)) || isWord(charAt(line, e))) return;
      const nx = line[e] || '';
      const letters = pat.term.replace(/[^\p{L}\p{N}\p{M}]/gu, '').length;
      const lastAlnum = /[\p{L}\p{N}]$/u.test(pat.term);
      if (lastAlnum && (nx === '+' || nx === '#')) return;                         // "C" in "C++"
      if (letters <= 2 && nx === '&') return;                                       // "R&D"
      if (letters <= 3 && nx === '.' && /[\p{L}\p{N}]/u.test(line[e + 1] || '')) return; // "R.K."
      const pv = charBefore(line, s);
      if (pv === '@' || (pv === '.' && isWord(charBefore(line, s - 1)) && letters <= 3)) return;
      for (const en of pat.entries) cands.push({ s, e, en });
    });
    if (!cands.length) continue;
    const urls = []; URLISH.lastIndex = 0;
    for (let m; (m = URLISH.exec(line));) urls.push([m.index, m.index + m[0].length]);
    const sec = sections ? sections[li] : null;
    let sepCount = -1; // separators in the line, counted once, and only if some hit needs it
    const seps = () => (sepCount < 0 ? (sepCount = (line.match(/[,;|\u2022\u00b7\t]/g) || []).length) : sepCount);
    const ok = [];
    for (const c of cands) {
      if (urls.some(u => c.s >= u[0] && c.e <= u[1])) continue;
      if (c.en.rule) {
        const inList = !!(sec && sec.skillList) || isListItem(line, c.s, c.e, seps);
        if (!decide(c.en.rule, { line, start: c.s, end: c.e, inList })) continue;
      }
      ok.push(c);
    }
    // longest match first where two overlap
    ok.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s) || (a.en.id < b.en.id ? -1 : 1));
    let lastEnd = -1, lastStart = -1, lastLen = 0;
    for (const c of ok) {
      const sameSpan = c.s === lastStart && c.e - c.s === lastLen; // the same words mapping to two ids ("mathematics")
      if (c.s < lastEnd && !sameSpan) continue;
      hits.push({ id: c.en.id, label: c.en.label, kind: c.en.kind, cert: !!c.en.cert, term: line.slice(c.s, c.e), line: li, start: c.s, end: c.e, sourceLine: sourceLine(line, c.s) });
      if (!sameSpan) { lastEnd = c.e; lastStart = c.s; lastLen = c.e - c.s; }
    }
  }
  return hits;
}
