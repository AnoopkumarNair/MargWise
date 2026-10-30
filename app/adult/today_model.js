// Helpers for "Your job today" (SPEC 8 screen 8) and the drill (screen 11). Pure functions over a slice: no DOM, no clock
// (today is passed in), so a unit test can fix it. Nothing here makes up a figure: a fact that the slice does not hold comes back as null.

// SPEC 5.5: a signal is greyed when its age is more than twice its cadence, and hidden when it is more than three times its cadence.
// `cadenceMonths` comes from the data (data/sources.yaml is prose today, and slice.schema.json has no cadence field), so with no cadence the
// answer is 'unknown' and nothing is greyed or hidden. `asOf` is 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'; a bare year or month counts as the END of
// that period, so a fact is never called older than it is. `today` is a Date or 'YYYY-MM-DD'.
export function ageMonths(asOf, today) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(asOf || ''));
  if (!m) return null;
  const t = today instanceof Date ? today : new Date(String(today) + 'T00:00:00Z');
  if (isNaN(t)) return null;
  const y = Number(m[1]), mo = m[2] ? Number(m[2]) : 12;
  if (mo < 1 || mo > 12) return null;
  const months = (t.getUTCFullYear() - y) * 12 + (t.getUTCMonth() + 1 - mo);
  return Math.max(0, months);
}
export function freshness(asOf, cadenceMonths, today) {
  const age = ageMonths(asOf, today);
  if (age === null || !(cadenceMonths > 0)) return { state: 'unknown', ageMonths: age };
  const state = age > 3 * cadenceMonths ? 'hidden' : age > 2 * cadenceMonths ? 'grey' : 'fresh';
  return { state, ageMonths: age };
}
// The cadence the slice gives for a fact's source, in months, or null. (Today no slice has one; the field is read only if it ever appears.)
export function cadenceOf(slice, srcId) {
  const s = (slice.sources || []).find(x => x.id === srcId);
  return s && typeof s.cadence_months === 'number' && s.cadence_months > 0 ? s.cadence_months : null;
}
export function factFreshness(slice, fact, today) { return freshness(fact.as_of, cadenceOf(slice, fact.src), today); }

const year = s => { const m = /^(\d{4})/.exec(String(s || '')); return m ? Number(m[1]) : null; };
// "Skill ratings collected 2021 to 2024 (US)" from the occupation's ratings dates; if the slice has none, from the needs' own dates.
export function ratingsLine(slice) {
  let a = year(slice.occ.ratings && slice.occ.ratings.oldest), b = year(slice.occ.ratings && slice.occ.ratings.newest);
  if (a === null || b === null) {
    const ys = (slice.needs || []).map(n => year(n.as_of)).filter(y => y !== null);
    if (!ys.length) return 'The collection dates of the skill ratings are not in this data.';
    a = Math.min(...ys); b = Math.max(...ys);
  }
  if (a > b) [a, b] = [b, a];
  return 'Skill ratings collected ' + (a === b ? 'in ' + a : a + ' to ' + b) + ' (US)';
}

export const AI_USED = ['automation', 'augmentation', 'used'];
// Tasks in three lists: AI use seen, no AI use seen, and no data (the task is not in the AI data). Unknown is never counted as "none".
export function splitTasks(tasks) {
  const used = [], none = [], unknown = [];
  for (const t of tasks || []) (AI_USED.includes(t.ai_mode) ? used : t.ai_mode === 'none' ? none : unknown).push(t);
  return { used, none, unknown };
}

// The occupation's needs, most important first (weight, then id).
export function sortedNeeds(slice) { return (slice.needs || []).slice().sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : 1)); }

// The latest signal of one kind on an occupation or target, or null. "Latest" is the largest period string.
export function latestSignal(signals, kind) {
  let best = null;
  for (const s of signals || []) if (s.kind === kind && (!best || String(s.period) > String(best.period))) best = s;
  return best;
}
export function sourceOf(slice, id) { return (slice.sources || []).find(s => s.id === id) || null; }

// The drill: the jobs in this slice (the job itself and its road targets) that need a skill. Most important first.
export function rolesNeeding(slice, skillId) {
  const out = [];
  const add = (occ, needs, current) => { const n = (needs || []).find(x => x.id === skillId); if (n) out.push({ occ: { id: occ.id, label: occ.label }, w: n.w, ai: n.ai, current }); };
  add(slice.occ, slice.needs, true);
  for (const t of slice.targets || []) add(t.occ, t.needs, false);
  return out.sort((a, b) => b.w - a.w || (a.occ.label < b.occ.label ? -1 : a.occ.label > b.occ.label ? 1 : 0));
}
// The label of a skill as this slice names it, or null.
export function skillLabel(slice, skillId) {
  for (const list of [slice.needs].concat((slice.targets || []).map(t => t.needs))) { const n = (list || []).find(x => x.id === skillId); if (n) return n.label; }
  return null;
}
