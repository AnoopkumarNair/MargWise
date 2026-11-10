// The only file in the screens that knows the shape of the reader in ./intake/ (tier 1: dictionary matching, on the device).
// Reader API (app/adult/intake/read.js):
//   readResume(text, { skillsIndex, titles, now (a year), occupations: [{ id, label }] }) -> { looksLikeResume, roles: [{ titleText,
//     occCandidates: [{ occ, label }], startYear, endYear, current, sourceLine, ... }], skills: [{ id, label, sourceLine, roleIndex, lastYear, count }],
//     creds: [{ name, sourceLine }], warnings: [{ code, message }] }
//   suggestChips(occSlice, presentIds) -> [{ id, label, kind, w }]: the occupation's usual skills the person has not got yet
// If the reader changes shape, change this file only. The resume text goes into readResume() and nowhere else.
import { loadSkillsIndex, loadTitles, loadOccupations } from './data.js';
import { toConfirmModel } from './intake_profile.js';

export const READ = { ms: null };   // how long the last read took, for the performance test

export function currentYear() { return new Date().getFullYear(); }

async function reader() {
  const m = await import('./intake/read.js');
  if (typeof m.readResume !== 'function') throw new Error('intake/read.js has no readResume() export');
  return m;
}

// Loads the three dictionaries and the reader, and builds the reader's word matcher on an empty text, so the first real read is quick.
// The intake screen calls this once it is showing; the work runs while the person picks a file. It reads no resume and sends nothing.
let warmed = null;
export function warmReader() {
  if (!warmed) warmed = (async () => {
    const [skillsIndex, titles, occs, mod] = await Promise.all([loadSkillsIndex(), loadTitles(), loadOccupations(), reader()]);
    mod.readResume('', { skillsIndex, titles, now: currentYear(), occupations: occs.map(o => ({ id: o.id, label: o.label })) });
  })().catch(() => { warmed = null; });   // not fatal: the real read loads everything again if this failed
  return warmed;
}

// text -> the editable confirm model (see intake_profile.js toConfirmModel). Throws when the dictionaries cannot be loaded.
export async function readResumeText(text) {
  const [skillsIndex, titles, occs, mod] = await Promise.all([loadSkillsIndex(), loadTitles(), loadOccupations(), reader()]);
  const t0 = performance.now();
  const found = mod.readResume(text, { skillsIndex, titles, now: currentYear(), occupations: occs.map(o => ({ id: o.id, label: o.label })) });
  READ.ms = Math.round((performance.now() - t0) * 10) / 10;
  return toConfirmModel(found, occs, currentYear());
}

// "People in your role usually have…": the occupation's top 12 needs not yet in the list. Items are { id, label }.
export const CHIP_COUNT = 12;
export async function chipsFor(slice, presentIds) {
  const have = new Set(presentIds);
  let out = null;
  try {
    const m = await reader();
    if (typeof m.suggestChips === 'function') out = m.suggestChips(slice, have.size ? [...have] : []);
  } catch (e) { out = null; }
  const label = new Map((slice.needs || []).map(n => [n.id, n.label]));
  if (Array.isArray(out)) {
    out = out.map(c => typeof c === 'string' ? { id: c, label: label.get(c) || c } : { id: c.id, label: c.label || label.get(c.id) || c.id })
      .filter(c => c && c.id && !have.has(c.id));
  } else {
    out = (slice.needs || []).slice().sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : 1)).filter(n => !have.has(n.id)).map(n => ({ id: n.id, label: n.label }));
  }
  return out.slice(0, CHIP_COUNT);
}
