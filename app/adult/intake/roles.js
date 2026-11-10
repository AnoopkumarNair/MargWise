// Splits a resume into role blocks and maps each role title to occupations (BUILD_PLAN T4.4).
//   A role block is a title with a date line: "Senior Analyst | Canaryworks Pvt Ltd | Jan 2019 - Mar 2023".
//   Each skill hit takes the end year of the block it falls in. A role that is still going ("Present", "Till date", "Since 2021")
//   ends in the year passed in as `now`. This module never reads the clock.
// Pure functions. No DOM, no Date, no network.
import { normalise, lookupTitle, suggestTitles } from '../lookup.js';
import { headingKind, sectionMap, sourceLine } from './lines.js';

// ---------- the year ----------
// `now` can be a year (2026), a Date, an ISO string ("2026-10-29") or { year }. The caller reads the clock, not this module.
export function yearOf(now) {
  if (typeof now === 'number' && now > 1900 && now < 3000) return Math.floor(now);
  if (now && typeof now === 'object') {
    if (typeof now.getFullYear === 'function') return now.getFullYear();
    if (typeof now.year === 'number') return now.year;
  }
  const m = /^\s*(\d{4})/.exec(String(now == null ? '' : now));
  if (m) return Number(m[1]);
  throw new Error('intake: pass `now` (a year, a Date or an ISO date string)');
}

// ---------- dates ----------
const MON = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const Y4 = '(?:19|20)\\d{2}';
const DT = `(?:(?:${MON})\\.?\\s*,?\\s*${Y4}|(?:${MON})\\.?\\s*['’]\\s*\\d{2}(?!\\d)|(?:${MON})\\.?-\\d{2}(?!\\d)|\\d{1,2}\\s*[/.\\-]\\s*${Y4}|${Y4})`;
const PRESENT = '(?:present|presently|current(?:ly)?|till[\\s-]*date|till[\\s-]*now|till[\\s-]*present|to[\\s-]*date|up[\\s-]*to[\\s-]*date|until[\\s-]*now|tilldate|date|now|ongoing|today|continuing|वर्तमान|अब\\s*तक|आज\\s*तक)';
const SEP = '(?:[-–—−~]|\\bto\\b|\\btill\\b|\\buntil\\b|\\bthrough\\b|\\bthru\\b)';
const RANGE = new RegExp(`(^|[^\\d/.])(${DT})\\s*${SEP}\\s*(${DT}|\\d{2}(?!\\d)|${PRESENT}(?![\\p{L}\\p{M}\\p{N}]))(?![\\d])`, 'iu');
const BARE_PAIR = new RegExp(`^\\s*(${DT})\\s+(${DT}|${PRESENT})\\s*$`, 'iu');
const SINCE = new RegExp(`\\b(?:since|from|w\\.?\\s?e\\.?\\s?f\\.?)\\s+(${DT})(?![\\d])`, 'i');
const MONTH_NUM = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const PRESENT_ONLY = new RegExp(`^${PRESENT}$`, 'i');

function parseToken(tok, startYear) {
  const t = tok.trim();
  if (PRESENT_ONLY.test(t)) return { present: true };
  let m = /^(\d{2})$/.exec(t);
  if (m) { // "2019-23": the end year shares the century of the start year
    if (startYear == null) return null;
    let y = Math.floor(startYear / 100) * 100 + Number(m[1]);
    if (y < startYear) y += 100;
    return { year: y, month: null };
  }
  m = new RegExp(`(${Y4})`).exec(t);
  let year = m ? Number(m[1]) : null;
  let month = null;
  const mn = new RegExp(`^(${MON})`, 'i').exec(t);
  if (mn) {
    month = MONTH_NUM[mn[1].slice(0, 3).toLowerCase()];
    if (year == null) { const m2 = /(\d{2})\s*$/.exec(t); if (m2) year = 2000 + Number(m2[1]); }
  } else {
    const nm = /^(\d{1,2})\s*[/.\-]/.exec(t);
    if (nm) { const n = Number(nm[1]); month = n >= 1 && n <= 12 ? n : null; if (month == null) return null; }
  }
  if (year == null) return null;
  return { year, month };
}

// Finds a date range in one line. Returns
//   { startYear, startMonth, endYear, endMonth, current, index, length, text } or null.
// `nowYear` fills the end of a range that is still going. Years outside 1970..nowYear+1 are not dates.
export function parseDateRange(line, nowYear) {
  const ok = y => y >= 1970 && y <= nowYear + 1;
  // (no look-behind: older Safari on iPhone does not have it, so the character before the range is matched and skipped)
  let m = RANGE.exec(line);
  if (m) {
    const at = m.index + m[1].length, len = m[0].length - m[1].length, txt = m[0].slice(m[1].length);
    const a = parseToken(m[2], null);
    const b = a && parseToken(m[3], a.year);
    if (a && b && ok(a.year)) {
      if (b.present) return { startYear: a.year, startMonth: a.month, endYear: nowYear, endMonth: null, current: true, index: at, length: len, text: txt };
      if (ok(b.year) && b.year >= a.year) return { startYear: a.year, startMonth: a.month, endYear: b.year, endMonth: b.month, current: false, index: at, length: len, text: txt };
    }
  }
  // a table cell can lose its dash in text extraction: "2022 Present", "2019 2022"
  m = BARE_PAIR.exec(line);
  if (m) {
    const a = parseToken(m[1], null);
    const b = a && parseToken(m[2], a.year);
    if (a && b && ok(a.year)) {
      if (b.present) return { startYear: a.year, startMonth: a.month, endYear: nowYear, endMonth: null, current: true, index: 0, length: line.length, text: line };
      if (ok(b.year) && b.year > a.year) return { startYear: a.year, startMonth: a.month, endYear: b.year, endMonth: b.month, current: false, index: 0, length: line.length, text: line };
    }
  }
  m = SINCE.exec(line);
  if (m) {
    const a = parseToken(m[1], null);
    if (a && ok(a.year) && a.year <= nowYear) return { startYear: a.year, startMonth: a.month, endYear: nowYear, endMonth: null, current: true, index: m.index, length: m[0].length, text: m[0] };
  }
  return null;
}

// A narrow table cell wraps "2022 -" and "Present" onto two lines. Joins them into the first line and blanks the second,
// so line numbers do not move. Returns a new array.
const END_DASH = new RegExp(`(?:${DT})\\s*(?:[-\u2013\u2014\u2212~]|\\bto\\b|\\btill\\b)\\s*$`, 'iu');
const START_TOKEN = new RegExp(`^\\s*(?:${DT}|${PRESENT})(?![\\p{L}\\p{M}\\p{N}])`, 'iu');
export function joinWrappedDates(lines) {
  const out = lines.slice();
  for (let i = 0; i + 1 < out.length; i++) {
    if (END_DASH.test(out[i]) && START_TOKEN.test(out[i + 1])) {
      // the next line may be a cell in the same table row: keep only its first token on this line
      const m = START_TOKEN.exec(out[i + 1]);
      out[i] = out[i].trimEnd() + ' ' + m[0].trim();
      out[i + 1] = out[i + 1].slice(m[0].length);
    }
  }
  return out;
}

// ---------- titles ----------
const LEVEL = new Set(['senior', 'sr', 'snr', 'junior', 'jr', 'associate', 'assoc', 'assistant', 'asst', 'deputy', 'lead', 'principal', 'staff', 'trainee', 'intern',
  'graduate', 'fresher', 'entry', 'level', 'grade', 'tier', 'i', 'ii', 'iii', 'iv', 'v', '1', '2', '3', '4', 'l1', 'l2', 'l3', 'l4', 'contract', 'contractual', 'temporary', 'part', 'time', 'full', 'consultant']);
const ABBR = { sde: 'software engineer', swe: 'software engineer', sdet: 'software test engineer', qa: 'quality assurance', hr: 'human resources', bde: 'business development executive',
  bdm: 'business development manager', csr: 'customer service representative', ca: 'chartered accountant', eng: 'engineer', engg: 'engineer', mgr: 'manager', dev: 'developer',
  exec: 'executive', admin: 'administrator', dba: 'database administrator', tl: 'team leader', rm: 'relationship manager', mis: 'management information systems' };
const COMPANY_END = /\b(pvt|ltd|limited|inc|llp|llc|corp|corporation|technologies|technology|solutions|services|systems|consulting|group|labs|industries|enterprises|private)\.?$/i;

function tokensOf(key) { return key.split(' ').filter(Boolean); }
function expand(tokens) { return tokens.flatMap(t => (ABBR[t] ? ABBR[t].split(' ') : [t])); }

// The ways to look a title up, strongest first. Each is [stage, key].
function titleKeys(titleText) {
  const key = normalise(titleText);
  if (!key) return [];
  const out = [[1, key]];
  const exp = expand(tokensOf(key));
  const expKey = exp.join(' ');
  if (expKey !== key) out.push([1, expKey]);
  const stripped = exp.filter(t => !LEVEL.has(t));
  if (stripped.length && stripped.join(' ') !== expKey) out.push([2, stripped.join(' ')]);
  // sub-phrases of the stripped words, longest first
  const base = stripped.length ? stripped : exp;
  const seen = new Set(out.map(o => o[1]));
  for (let n = base.length - 1; n >= 1; n--) {
    for (let i = 0; i + n <= base.length; i++) {
      const k = base.slice(i, i + n).join(' ');
      if (!seen.has(k)) { seen.add(k); out.push([n >= 2 ? 3 : 4, k]); }
    }
  }
  return out;
}

function titleCase(k) { return k.replace(/\b[a-z]/g, c => c.toUpperCase()); }

// Up to 3 occupations for a role title text, best first: [{ occ, label }].
//   titles       titles.json ({normalised title: [occ ids]})
//   occupations  optional [{id,label}] to name the ids; without it the label is the matched title in capitals
export function occCandidates(titles, titleText, occupations, limit = 3) {
  if (!titles || !titleText) return [];
  const labels = new Map();
  if (occupations) for (const o of occupations) labels.set(o.id, o.label);
  const out = []; const seen = new Set();
  const push = (id, k) => { if (!seen.has(id)) { seen.add(id); out.push({ occ: id, label: labels.get(id) || titleCase(k) }); } };
  const keys = titleKeys(titleText);
  let stage = 0;
  for (const [st, k] of keys) {
    if (st !== stage) { if (out.length) break; stage = st; } // a weaker way of looking up only runs when the stronger one found nothing
    for (const id of lookupTitle(titles, k)) { push(id, k); if (out.length >= limit) return out; }
  }
  // the near-miss search walks all 40,000 titles, so it runs only when nothing matched
  if (out.length === 0) {
    const key = normalise(titleText);
    for (const s of suggestTitles(titles, key, 6)) for (const id of s.occs) { push(id, s.title); if (out.length >= limit) return out; }
  }
  return out;
}

// How well a text reads as a job title: 3 exact, 2 after dropping level words, 1 a phrase of two or more words, 0.5 a single word, 0 none.
function titleScore(titles, text) {
  let best = 0;
  for (const [stage, k] of titleKeys(text)) {
    if (!Array.isArray(titles[k])) continue;
    if (stage === 4) continue; // a single word taken out of a longer text ("foods", "pune") is not evidence of a title
    const s = stage === 1 ? 3 : stage === 2 ? 2 : 1;
    if (s > best) best = s;
    if (best === 3) break;
  }
  return best;
}

// Words that mark a job title even when the exact title is not in titles.json ("Systems Executive", "Head of Data and Analytics").
const TITLE_WORD = /\b(engineer|manager|analyst|executive|intern|interns|associate|developer|officer|assistant|lead|consultant|specialist|administrator|designer|accountant|trainee|supervisor|coordinator|director|head|teacher|lecturer|professor|nurse|technician|representative|agent|programmer|architect|scientist|writer|editor|clerk|operator|auditor|advisor|adviser|owner|founder|partner|president|apprentice|faculty|instructor|trainer|researcher|tester|support|programmer|banker|pharmacist|driver|cook|chef|mechanic|electrician|fitter|welder)s?\b/i;
// A line that names a company ("Canaryworks Pvt Ltd, Bengaluru", "Venkat & Co.") is not the title line.
const COMPANY_LINE = /\b(pvt|ltd|limited|inc|llp|llc|corp|corporation)\b\.?|&|\bco\./i;
// Lines about study, not work. A date range on one of these is not a role.
const EDU = /\b(bachelors?|masters?|diploma|degree|mba|bba|mca|bca|hsc|ssc|cbse|icse|studied|graduated|graduation|pursuing|ph\.?\s?d|b\.?\s?tech|b\.?\s?sc|b\.?\s?com|m\.?\s?tech|m\.?\s?sc|m\.?\s?com)\b|\b[bm]\.\s?[ea]\.|\bcertificat/i;

const BULLET = /^\s*[•·*\-–—▪●◦>]\s/;
const SPLIT = /\s*(?:\s{2,}|\||·|•|\t|\s[-–—]\s|,|@|\bat\b|\bwith\b|\(|\)|;)\s*/i;

function segmentsOf(text) {
  const t = text.replace(/^[\s|•·*\-–—:,]+|[\s•·*\-–—:|,]+$/g, '').trim();
  if (!t) return [];
  const clean = x => x.replace(/^[\s|\u2022\u00b7*\-\u2013\u2014:,]+|[\s|\u2022\u00b7*\-\u2013\u2014:,]+$/g, '');
  const segs = [t].concat(t.split(SPLIT).map(clean).filter(s => s.length >= 2));
  return [...new Set(segs)];
}

function chooseTitle(titles, candidates) {
  // candidates: [{text, weight}] in preference order
  let best = null;
  candidates.forEach((c, order) => {
    const companyLine = COMPANY_LINE.test(c.text);
    for (const seg of segmentsOf(c.text)) {
      if (seg.length > 70 || /\d{4}/.test(seg)) continue;
      const base = titleScore(titles, seg) + (TITLE_WORD.test(seg) ? 1 : 0);
      let score;
      if (base <= 0) score = -1 + c.weight / 10 - order / 100;
      else {
        score = base + c.weight;
        if (COMPANY_END.test(seg)) score -= 0.75;
        if (companyLine) score -= 1.5;
      }
      // on a tie, the shorter text wins: it carries fewer words that are not part of the title
      if (!best || score > best.score || (score === best.score && seg.length < best.text.length)) best = { text: seg, score, order };
    }
  });
  return best;
}

// ---------- role blocks ----------
const LABEL_PREFIX = /^\s*(?:duration|period|tenure|dates?|from|worked|working)\s*[:\-]\s*/i;

// Finds the roles in the resume lines.
//   opts.titles       titles.json
//   opts.nowYear      number (use yearOf(now))
//   opts.sections     from lines.sectionMap
//   opts.skip         Set of line indexes to ignore
//   opts.occupations  optional [{id,label}]
// Returns [{ titleText, occCandidates, startYear, startMonth, endYear, endMonth, current, lines: {from, to}, dateLine, sourceLine }] in reading order.
export function splitRoles(lines, opts) {
  const titles = opts.titles || {};
  const nowYear = opts.nowYear;
  const sections = opts.sections || sectionMap(lines);
  const skip = opts.skip || new Set();
  const hasExperience = sections.some(s => s.kind === 'experience' && s.heading);
  // Strict: dates under the experience heading. If that finds no role (two columns can put a role after the next heading), loose:
  // dates anywhere except education and personal details.
  const found = strict => splitRolesWith(lines, opts, titles, nowYear, sections, skip, strict, hasExperience);
  const rs = found(true);
  return rs.length || !hasExperience ? rs : found(false);
}

function splitRolesWith(lines, opts, titles, nowYear, sections, skip, strict, hasExperience) {
  const allowed = i => {
    const k = sections[i].kind;
    if (hasExperience && strict) return k === 'experience';
    if (!strict) return k !== 'education' && k !== 'personal';
    return k === 'none' || k === 'projects' || k === 'summary' || k === 'other';
  };
  const dateLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (skip.has(i) || sections[i].heading || !allowed(i)) continue;
    if (BULLET.test(lines[i]) && lines[i].length > 90) continue; // a bullet sentence that mentions years is not a role header
    const r = parseDateRange(lines[i], nowYear);
    if (!r) continue;
    // a range in the middle of a sentence ("Led the 2019-2021 migration to AWS") is a story, not a role
    const before = lines[i].slice(0, r.index).split(/[\s|]+/).filter(w => /\p{L}/u.test(w)).length;
    const after = lines[i].slice(r.index + r.length).split(/[\s|]+/).filter(w => /\p{L}/u.test(w)).length;
    if (BULLET.test(lines[i]) && before + after >= 4 && !/[|\t]/.test(lines[i])) continue;
    if (before >= 3 && after >= 3 && !/[|\t,]/.test(lines[i])) continue;
    dateLines.push({ i, r });
  }
  const headerLine = j => {
    const t = lines[j];
    return t && t.trim() && !BULLET.test(t) && !sections[j].heading && t.trim().length <= 90 && !/[.!?]$/.test(t.trim()) && !skip.has(j) && !parseDateRange(t, nowYear) && !/^[\s]*(tools?|technolog|environment|skills?|responsibilit|key|achiev|project)/i.test(t);
  };
  const roles = dateLines.map(({ i, r }) => {
    // the title is on the date line, or on one of the two lines above it, or the line below
    const rest = (lines[i].slice(0, r.index) + ' | ' + lines[i].slice(r.index + r.length)).replace(LABEL_PREFIX, '').replace(/·\s*\d+\s*(yrs?|years?|mos?|months?).*$/i, '').replace(/[(\[]\s*[|,;:-]*\s*[)\]]/g, ' ');
    if (EDU.test(lines[i]) || (i > 0 && headerLine(i - 1) && EDU.test(lines[i - 1]))) return null; // study, not work
    const cands = [{ text: rest, weight: 0.2 }];
    let start = i;
    // (a PDF often leaves a blank line between the lines of a block, so one blank line is skipped)
    let used = 0, blanks = 0;
    for (let j = i - 1; j >= Math.max(0, i - 6) && used < 2; j--) {
      if (!lines[j].trim()) { if (++blanks > 2) break; continue; }
      blanks = 0;
      if (!headerLine(j)) break;
      cands.push({ text: lines[j], weight: used === 0 ? 0.3 : 0.1 });
      used++;
      start = j;
    }
    if (i + 1 < lines.length && headerLine(i + 1) && !dateLines.some(d => d.i === i + 1) && allowed(i + 1)) cands.push({ text: lines[i + 1], weight: -0.3 });
    const best = chooseTitle(titles, cands);
    let titleText = best ? best.text : '';
    if (!titleText || best.score < 0) {
      const first = segmentsOf(rest).find(s => !COMPANY_END.test(s)) || segmentsOf(lines[i - 1] || '')[0] || '';
      titleText = first;
    }
    return {
      titleText: titleText.slice(0, 80),
      occCandidates: occCandidates(titles, titleText, opts.occupations),
      startYear: r.startYear, startMonth: r.startMonth, endYear: r.endYear, endMonth: r.endMonth, current: r.current,
      lines: { from: start, to: i },
      dateLine: i,
      sourceLine: sourceLine(lines[i], r.index),
    };
  }).filter(Boolean);
  // (lines about study were dropped above)
  // block ends: the line before the next block, or before the next heading
  for (let k = 0; k < roles.length; k++) {
    let end = lines.length - 1;
    if (k + 1 < roles.length) end = roles[k + 1].lines.from - 1;
    for (let j = roles[k].dateLine + 1; j <= end; j++) if (sections[j].heading) { end = j - 1; break; }
    roles[k].lines.to = Math.max(end, roles[k].dateLine);
  }
  return roles;
}

// Which role (index) each line falls in, or -1.
export function roleIndexByLine(roles, lineCount) {
  const out = new Array(lineCount).fill(-1);
  roles.forEach((r, k) => { for (let i = r.lines.from; i <= r.lines.to && i < lineCount; i++) out[i] = k; });
  return out;
}

export { headingKind };
