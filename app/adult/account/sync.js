// Saving the profile to the account, and opening it again (SPEC 9, BACKEND ADR-06). The profile is ids, bands and numbers only: it comes from
// state.js buildProfile(), the same object the matcher reads. Nothing about the resume (text, titles, source lines) can be in it.
//   save:     PUT /me/profile {rev, data}. rev is the version this page last saw (0 before the first save). A 409 conflict carries the
//             current version, and the person picks one (screens/saved.js). The server never merges.
//   open:     GET /me/profile, then restore() puts it back into the in-memory state, ready for the roads.
import { state, buildProfile, checkProfile, resetAll, DEFAULT_PRIORITIES } from '../state.js';
import { cleanConstraints } from '../constraints_model.js';
import { loadOccupations, loadSlice } from '../data.js';
import { api, sayError } from './api.js';
import { getToken, clearToken } from './session.js';

// Memory only (a reload starts fresh and asks the server). rev: the version we last saw. saved: a fingerprint of what we last saved or opened.
export const sync = { rev: 0, saved: null, conflict: null, note: '', flash: '', wantSave: false };

export const signedIn = () => !!getToken();
export const hasLocalProfile = () => !!(state.slice && state.skills && state.skills.size);
export function resetSync() { sync.rev = 0; sync.saved = null; sync.conflict = null; sync.note = ''; sync.wantSave = false; }
export function takeFlash() { const f = sync.flash; sync.flash = ''; return f; }

// The parts of the profile a person edits. The release and matcher version are added by the app, so they do not count as a change.
export function fingerprint(p) { return JSON.stringify([p.roles, p.skills, p.lead || null, p.constraints || null, p.priorities]); }
// 'out' signed out; 'never' signed in, nothing saved from this page yet; 'saved' same as the saved copy; 'changed' edited since.
export function saveStatus() {
  if (!signedIn()) return 'out';
  if (!hasLocalProfile()) return 'none';
  if (sync.saved == null) return 'never';
  try { return fingerprint(buildProfile()) === sync.saved ? 'saved' : 'changed'; } catch (e) { return 'never'; }
}

// Returns { ok:true, rev } or { ok:false, code, message, conflict? }. conflict is the server's current { rev, data } on a 409.
export async function saveNow({ rev } = {}) {
  if (!signedIn()) return { ok: false, code: 'unauthorized', message: 'Please log in to save.' };
  let profile;
  try { profile = buildProfile(); } catch (e) { return { ok: false, code: 'empty', message: 'There is nothing to save yet. Pick your job and skills first.' }; }
  const v = checkProfile(profile);
  if (!v.ok) return { ok: false, code: 'invalid', message: 'We could not check your profile, so we did not save it. Reload the page and try again.' };
  const res = await api.put('/me/profile', { rev: rev == null ? sync.rev : rev, data: profile });
  if (res.ok) { sync.rev = res.body.rev; sync.saved = fingerprint(profile); sync.conflict = null; return { ok: true, rev: res.body.rev }; }
  if (res.error.code === 'conflict') {
    const cur = res.body && res.body.current && Number.isInteger(res.body.current.rev) && res.body.current.data ? res.body.current : null;
    return { ok: false, code: 'conflict', message: sayError(res), conflict: cur };
  }
  return { ok: false, code: res.error.code, message: sayError(res) };
}

// Returns { ok:true, rev, data, mapped, dropped } or { ok:false, code, message }. code 'not_found' means nothing is saved yet.
export async function loadSaved() {
  const res = await api.get('/me/profile');
  if (res.ok) {
    const b = res.body;
    if (!b.data || !Array.isArray(b.data.roles) || !Array.isArray(b.data.skills) || !Number.isInteger(b.rev)) return { ok: false, code: 'bad_reply', message: 'Your saved profile could not be read. Please try again.' };
    return { ok: true, rev: b.rev, data: b.data, mapped: b.mapped || [], dropped: b.dropped || [] };
  }
  return { ok: false, code: res.error.code, message: sayError(res) };
}

// Puts a saved profile into memory, so the roads can be worked out from it. The person's own job (the current role, or the first) is the start;
// "Change my skills" then opens the skills screen for it. Returns { ok:true } or { ok:false, message }.
export async function restore({ rev, data, mapped = [], dropped = [] }) {
  const roles = (data.roles || []).filter(r => r && typeof r.occ === 'string');
  const start = roles.find(r => r.current) || roles[0];
  if (!start) return { ok: false, message: 'Your saved profile has no job in it, so we could not open it. Choose your job again.' };
  let occ, slice;
  try {
    occ = (await loadOccupations()).find(o => o.id === start.occ);
    if (occ && occ.slice) slice = await loadSlice(occ.slice);
  } catch (e) { return { ok: false, message: 'We could not load the job data. Check your connection and try again.' }; }
  if (!occ || !slice) return { ok: false, message: 'We have no data for your saved job any more. Choose your job again.' };
  resetAll();
  state.occ = { id: occ.id, label: occ.label }; state.slice = slice; state.path = 'title'; state.pretick = true;
  state.roles = roles.map(r => ({ occ: r.occ, level: r.level, industry: r.industry, years: r.years, current: !!r.current }));
  state.years = start.years;
  state.skills = new Map((data.skills || []).map(s => [s.id, s.strength]));
  state.skillLast = new Map((data.skills || []).filter(s => Number.isInteger(s.last)).map(s => [s.id, s.last]));
  state.lead = data.lead ? { people: data.lead.people, budget: !!data.lead.budget, expert: !!data.lead.expert } : null;
  state.constraints = cleanConstraints(data.constraints || {});
  state.priorities = Object.assign({}, DEFAULT_PRIORITIES, data.priorities || {});
  if (typeof data.matcher_version === 'string') state.matcherVersion = data.matcher_version;
  sync.rev = rev; sync.conflict = null;
  sync.note = noteFor(mapped, dropped);
  try { sync.saved = fingerprint(buildProfile()); } catch (e) { sync.saved = null; }
  return { ok: true };
}
function noteFor(mapped, dropped) {
  const parts = [];
  if (mapped.length) parts.push(mapped.length + (mapped.length === 1 ? ' item was' : ' items were') + ' updated to match the newest job data.');
  if (dropped.length) parts.push(dropped.length + (dropped.length === 1 ? ' item is' : ' items are') + ' no longer in our list and was left out.');
  return parts.join(' ');
}

// A short description of a saved profile for the "which one to keep" screen: the jobs and the number of skills.
export async function describe(data) {
  let labels = new Map();
  try { labels = new Map((await loadOccupations()).map(o => [o.id, o.label])); } catch (e) { /* ids are shown instead */ }
  const jobs = (data.roles || []).map(r => labels.get(r.occ) || r.occ);
  const n = (data.skills || []).length;
  return (jobs.length ? jobs.join(', ') : 'No job') + '. ' + n + (n === 1 ? ' skill.' : ' skills.');
}

// After a good sign-in or sign-up: go where the person would want to be. Never saves unless they asked to (sync.wantSave, set by
// "Make an account to save"), and never overwrites a saved profile without asking.
export async function afterSignIn() {
  const want = sync.wantSave; sync.wantSave = false;
  const local = hasLocalProfile();
  const saved = await loadSaved();
  if (saved.ok) {
    sync.rev = saved.rev;
    if (!local) {
      const r = await restore(saved);
      if (r.ok) { sync.flash = 'Welcome back. Your saved profile is open.'; location.hash = '#/roads'; }
      else { sync.flash = r.message; location.hash = '#/account'; }
      return;
    }
    sync.conflict = { current: { rev: saved.rev, data: saved.data }, reason: 'signin' };
    location.hash = '#/saved'; return;
  }
  if (saved.code === 'not_found') {
    sync.rev = 0;
    if (local && want) {
      const r = await saveNow({ rev: 0 });
      if (r.ok) sync.flash = 'You are signed in and your profile is saved.';
      else if (r.conflict) { sync.conflict = { current: r.conflict, reason: 'conflict' }; location.hash = '#/saved'; return; }
      else sync.flash = 'You are signed in. We could not save yet: ' + r.message;
    } else sync.flash = 'You are signed in.';
    location.hash = local ? '#/roads' : '#/'; return;
  }
  sync.flash = 'You are signed in. We could not reach your saved profile just now.';
  location.hash = local ? '#/roads' : '#/';
}

// Ends the session on this device (the server is told only by "Log out everywhere").
export function forgetSession() { clearToken(); resetSync(); }
