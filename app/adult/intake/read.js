// Tier 1 resume read (BUILD_PLAN T4.4): the text of a resume in, roles and skills with their source lines out.
//
//   import { readResume, suggestChips } from './intake/read.js';
//   const r = readResume(text, { skillsIndex, titles, now: 2026, occupations });
//
// Everything stays in memory and runs on the device. The result holds graph ids, labels, years and the resume's own lines
// (each cut to 160 characters). It holds nothing else from the text, and it never runs anything the text says: a line that
// reads like an instruction to an AI ("ignore previous instructions") is plain text here, and is left out of the result.
// Pure function: the same input gives the same output. It does not read the clock; pass `now`.
import { buildMatcher, findHits } from './match_dict.js';
import { splitLines, sectionMap, injectionLines, sourceLine } from './lines.js';
import { splitRoles, roleIndexByLine, yearOf, parseDateRange, joinWrappedDates } from './roles.js';

export const MAX_CHARS = 300000;
const MIN_LETTERS = 60; // fewer letters than this: a scanned page, nothing to read

const CONTACT = /[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\d\s().-]{8,}\d)/;

// opts: { skillsIndex (required), titles (required), now (required: year, Date or ISO string), occupations (optional [{id,label}] to name occupation ids) }
// Returns:
//   looksLikeResume  boolean
//   roles   [{ titleText, occCandidates:[{occ,label}] (up to 3, best first), startYear, startMonth, endYear, endMonth, current,
//              lines:{from,to}, dateLine, sourceLine }]   in reading order
//   currentRoleIndex  index into roles of the role that is going now (the latest start if several), or -1
//   skills  [{ id, label, kind, sourceLine, roleIndex (-1 = not inside a role), lastYear (end year of the latest role it appears in, or null),
//              count, roleIndexes:[...] }]   in reading order of the first hit
//   creds   [{ name, sourceLine }]
//   warnings [{ code, message }]   codes: too_little_text, not_a_resume, instruction_like_text, no_roles, no_skills, truncated
export function readResume(text, opts) {
  const { skillsIndex, titles } = opts || {};
  if (!Array.isArray(skillsIndex)) throw new Error('intake: skillsIndex is required');
  const nowYear = yearOf(opts.now);
  const warnings = [];
  let raw = String(text == null ? '' : text);
  if (raw.length > MAX_CHARS) { raw = raw.slice(0, MAX_CHARS); warnings.push({ code: 'truncated', message: 'The text was very long, so only the first part was read.' }); }
  const lines = joinWrappedDates(splitLines(raw.normalize('NFKC')));
  const sections = sectionMap(lines);
  const skip = injectionLines(lines);
  if (skip.size) warnings.push({ code: 'instruction_like_text', message: 'Some text reads like instructions to an AI. We left it out. It is only treated as text.' });

  const letters = raw.replace(/[^\p{L}\p{N}]/gu, '').length;
  const matcher = buildMatcher(skillsIndex);
  const hits = findHits(matcher, lines, { sections, skip });
  const roles = splitRoles(lines, { titles: titles || {}, nowYear, sections, skip, occupations: opts.occupations });
  const roleAt = roleIndexByLine(roles, lines.length);

  // one entry per skill id
  const byId = new Map(); const creds = []; const credSeen = new Set();
  for (const h of hits) {
    if (h.cert) {
      if (!credSeen.has(h.id)) { credSeen.add(h.id); creds.push({ name: h.label, sourceLine: h.sourceLine }); }
      continue;
    }
    const ri = roleAt[h.line];
    const yr = ri >= 0 ? roles[ri].endYear : null;
    let s = byId.get(h.id);
    if (!s) { s = { id: h.id, label: h.label, kind: h.kind, sourceLine: h.sourceLine, roleIndex: ri, lastYear: yr, count: 0, roleIndexes: [] }; byId.set(h.id, s); }
    s.count++;
    if (ri >= 0 && s.roleIndexes.indexOf(ri) < 0) s.roleIndexes.push(ri);
    // the line shown is the one in the latest role; a hit outside any role never replaces a hit inside one
    if (yr != null && (s.lastYear == null || yr > s.lastYear)) { s.sourceLine = h.sourceLine; s.roleIndex = ri; s.lastYear = yr; }
  }
  const skills = [...byId.values()];
  for (const s of skills) s.roleIndexes.sort((a, b) => a - b);

  let currentRoleIndex = -1;
  roles.forEach((r, i) => { if (r.current && (currentRoleIndex < 0 || r.startYear > roles[currentRoleIndex].startYear)) currentRoleIndex = i; });

  // Is it a resume? Dates, section headings, contact details and a fair number of skills all point that way.
  const headings = new Set(sections.filter(s => s.heading).map(s => s.kind));
  let ranges = 0;
  for (let i = 0; i < lines.length; i++) if (!skip.has(i) && parseDateRange(lines[i], nowYear)) ranges++;
  const resumeHeadings = ['experience', 'education', 'skills', 'projects', 'certs', 'summary'].filter(k => headings.has(k)).length;
  let score = 0;
  if (resumeHeadings >= 2) score += 2; else if (resumeHeadings === 1) score += 1;
  if (ranges >= 1) score += 1;
  if (ranges >= 3) score += 1;
  if (skills.length >= 8) score += 1;
  if (CONTACT.test(raw)) score += 1;
  if (roles.length >= 1) score += 1;
  // (dates or at least three resume headings are needed: a list of tools with an email address is not a resume)
  const tooLittle = letters < MIN_LETTERS && roles.length === 0 && skills.length < 3;
  const looksLikeResume = !tooLittle && score >= 3 && (ranges >= 1 || resumeHeadings >= 3);

  if (tooLittle) warnings.push({ code: 'too_little_text', message: 'We found almost no text. A scanned page has no text to read. Paste the text instead.' });
  else if (!looksLikeResume) warnings.push({ code: 'not_a_resume', message: "This doesn't look like a resume." });
  if (looksLikeResume && !roles.length) warnings.push({ code: 'no_roles', message: 'We could not find your jobs and dates. You can add them by hand.' });
  if (looksLikeResume && !skills.length) warnings.push({ code: 'no_skills', message: 'We found no skills. You can add them by hand.' });

  return { looksLikeResume, roles, currentRoleIndex, skills, creds, warnings };
}

// "People in your role usually have...": the occupation's top needs (by weight) that the person does not have yet.
//   occSlice    a slice file (slices/<soc>.json) with `needs: [{id,label,kind,w}]`
//   presentIds  Set or array of skill ids already on the profile
// Returns up to `limit` (12) of { id, label, kind, w }.
export function suggestChips(occSlice, presentIds, limit = 12) {
  const have = presentIds instanceof Set ? presentIds : new Set(presentIds || []);
  const needs = occSlice && Array.isArray(occSlice.needs) ? occSlice.needs.slice() : [];
  needs.sort((a, b) => (b.w - a.w) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out = [];
  for (const n of needs) {
    if (have.has(n.id)) continue;
    out.push({ id: n.id, label: n.label, kind: n.kind, w: n.w });
    if (out.length >= limit) break;
  }
  return out;
}

export { sourceLine };
