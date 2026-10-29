// Pure helpers for the resume path (slice S3). No DOM, no network, no storage, so they run in the browser and in node --test.
// They turn what the reader found into the bands and ids the profile holds (contracts/profile.schema.json).
// Free text (a job title, a source line) is shown on screen from memory and never returned by anything here that builds a profile.

export const YEARS = ['0-2', '2-5', '5-8', '8-12', '12-18', '18+'];
export const INDUSTRIES = [['it', 'IT and software'], ['bpm', 'BPM and customer operations'], ['bfsi', 'Banking, finance and insurance'], ['other', 'Something else']];
export const LEAD_PEOPLE = [['0', 'No one'], ['1-5', '1 to 5 people'], ['6-20', '6 to 20 people'], ['21+', 'More than 20']];
export const RUSTY_AFTER_YEARS = 3;   // a skill last used more than this many years ago starts as Rusty (the person can change it)

// Whole years in a role, from its dates. Returns null when the start year is unknown or the dates make no sense.
export function yearsInRole(startYear, endYear, current, nowYear) {
  if (!Number.isInteger(startYear)) return null;
  const end = current ? nowYear : (Number.isInteger(endYear) ? endYear : null);
  if (end === null || !Number.isInteger(end) || end < startYear) return null;
  return end - startYear;
}

// bands.json years: '0-2' is under 2 years, each band includes its lower bound (SPEC 6, D2).
export function yearsBand(n) {
  if (!Number.isInteger(n) || n < 0) return null;
  return n >= 18 ? '18+' : n >= 12 ? '12-18' : n >= 8 ? '8-12' : n >= 5 ? '5-8' : n >= 2 ? '2-5' : '0-2';
}
export function bandFromDates(startYear, endYear, current, nowYear) { return yearsBand(yearsInRole(startYear, endYear, current, nowYear)); }

// SPEC 7.2: the level starts from the years band. The title's seniority word then overrides it. The profile stores the level only.
export function levelFromBand(years) { return Math.max(1, YEARS.indexOf(years) + 1); }
export function seniorityLevel(titleText) {
  const t = ' ' + String(titleText == null ? '' : titleText).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if (/ (head|director|vp|vice president|avp|svp|evp|chief|cxo|ceo|cfo|cto|coo)( |$)/.test(t)) return { level: 6 };
  if (/ senior (manager|mgr)( |$)/.test(t)) return { level: 5 };
  if (/ (manager|mgr|lead|team lead)( |$)/.test(t)) return { level: 4 };
  if (/ (senior|sr)( |$)/.test(t)) return { level: 3 };
  if (/ associate( |$)/.test(t)) return { max: 2 };      // "associate: 1 to 2"
  return null;
}
export function roleLevel(years, titleText) {
  const base = levelFromBand(years); const o = seniorityLevel(titleText);
  if (!o) return base;
  if (o.level) return o.level;
  return Math.max(1, Math.min(o.max, base));
}

// Strength from the year a skill was last used: within 3 years is Used, older is Rusty. The person can tap Strong.
export function strengthFromYear(lastYear, nowYear) {
  return Number.isInteger(lastYear) && Number.isInteger(nowYear) && nowYear - lastYear > RUSTY_AFTER_YEARS ? 'rusty' : 'used';
}

// A first guess at the industry from the words of a job's own lines. It is only a guess: the person sees it and can change it.
const IND = [
  ['bfsi', /\b(bank|banking|insurance|nbfc|loans?|credit|kyc|aml|treasury|underwrit\w*|mutual fund|brokerage|fintech)\b/g],
  ['bpm', /\b(bpo|bpm|ites|call cent(?:re|er)|voice process|non voice|process associate|customer support|customer service|helpdesk|aht|csat)\b/g],
  ['it', /\b(software|developer|devops|java|python|javascript|cloud|aws|azure|sap|api|sql|testing|qa engineer|it services|programming)\b/g],
];
export function guessIndustry(text) {
  const t = String(text == null ? '' : text).toLowerCase();
  let best = 'other', bestN = 0, tie = false;
  for (const [id, re] of IND) {
    const n = (t.match(re) || []).length;
    if (n > bestN) { best = id; bestN = n; tie = false; } else if (n === bestN && n > 0) tie = true;
  }
  return bestN > 0 && !tie ? best : 'other';
}

// Takes what the reader found and returns the editable confirm-screen model. `nowYear` is passed in so tests do not depend on the clock.
// Roles: first candidate occupation that has data is chosen. Skills: strength from the last year used.
export function toConfirmModel(found, occupations, nowYear) {
  const hasSlice = new Map((occupations || []).map(o => [o.id, !!o.slice]));
  const roles = (found.roles || []).slice(0, 20).map((r, i) => {
    const cands = (r.occCandidates || []).map(c => ({ occ: c.occ, label: c.label, ready: hasSlice.get(c.occ) === true }));
    const pick = cands.find(c => c.ready) || null;
    const years = bandFromDates(r.startYear, r.endYear, !!r.current, nowYear);
    return {
      key: 'r' + i, titleText: String(r.titleText || ''),
      startYear: Number.isInteger(r.startYear) ? r.startYear : null, endYear: Number.isInteger(r.endYear) ? r.endYear : null,
      current: !!r.current, candidates: cands, occ: pick ? pick.occ : null, occLabel: pick ? pick.label : null,
      industry: guessIndustry([r.titleText, r.sourceLine].concat((found.skills || []).filter(s => s.roleIndex === i).map(s => s.sourceLine)).join(' ')), years: years || '', yearsFromDates: !!years, include: true,
    };
  });
  const skills = (found.skills || []).slice(0, 300).map(s => ({
    id: s.id, label: s.label, sourceLine: s.sourceLine == null ? null : String(s.sourceLine),
    roleKey: Number.isInteger(s.roleIndex) && s.roleIndex >= 0 && s.roleIndex < roles.length ? 'r' + s.roleIndex : null,
    lastYear: Number.isInteger(s.lastYear) ? s.lastYear : null,
    strength: strengthFromYear(s.lastYear, nowYear), include: true, added: false,
  }));
  const creds = (found.creds || []).slice(0, 50).map(c => ({ name: String(c.name || ''), sourceLine: c.sourceLine == null ? null : String(c.sourceLine), id: credId(c) }));
  return { roles, skills, creds, warnings: (found.warnings || []).map(w => typeof w === 'string' ? w : (w && w.message) || '').filter(Boolean), looksLikeResume: found.looksLikeResume !== false };
}

// Credentials become ids only when they are in the graph. S3 has no credentials list in the graph yet (T1.8 is in S2), so none is,
// and every credential is dropped from the profile. When the list arrives, look the name up here.
export function credId(/* cred */) { return null; }

// The profile pieces from the confirmed model. Returns { roles, skills, last, startRole } or { error }.
// roles keep only ids, bands and flags. skills is a Map id -> strength (the strongest tap wins when a skill is listed twice).
export function confirmedProfile(model) {
  const RANK = { rusty: 0, used: 1, strong: 2 };
  const used = model.roles.filter(r => r.include);
  if (!used.length) return { error: 'Keep at least one job.' };
  for (const r of used) {
    if (!r.occ) return { error: 'Pick the closest job for “' + (r.titleText || 'a job') + '”, or untick it.', roleKey: r.key, field: 'occ' };
    if (!YEARS.includes(r.years)) return { error: 'Say how long you did “' + (r.titleText || r.occLabel || 'this job') + '”.', roleKey: r.key, field: 'years' };
  }
  const roles = used.map(r => ({ occ: r.occ, level: roleLevel(r.years, r.titleText), industry: r.industry, years: r.years, current: !!r.current }));
  const keys = new Set(used.map(r => r.key));
  const skills = new Map(), last = new Map();
  for (const s of model.skills) {
    if (!s.include) continue;
    if (s.roleKey && !keys.has(s.roleKey)) continue;    // the person removed that job, so its skills go too
    const prev = skills.get(s.id);
    if (!prev || RANK[s.strength] > RANK[prev]) skills.set(s.id, s.strength);
    if (Number.isInteger(s.lastYear) && (!last.has(s.id) || s.lastYear > last.get(s.id))) last.set(s.id, s.lastYear);
  }
  // The roads start from the job the person says they do now; if none is marked, the first job kept (the resume lists the newest first).
  const startRole = used.find(r => r.current) || used[0];
  return { roles, skills, last, startRole: { key: startRole.key, occ: startRole.occ, label: startRole.occLabel, years: startRole.years } };
}
