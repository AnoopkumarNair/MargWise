// Shared by the roads and road-detail screens.
import { h } from '../dom.js';
import { state, buildProfile, checkProfile, active } from '../state.js';
import { loadMatcher, runMatch, coveragePercent, TIER_LABEL, MOVE_LABEL, MOVE_EXPLAIN } from '../matcher_adapter.js';

let matchFn = null;
export const timing = { ms: null };

// Runs the matcher on the in-memory profile. Returns { roads, version } or throws.
export async function computeRoads() {
  if (!matchFn) matchFn = await loadMatcher();
  const profile = buildProfile();
  const v = checkProfile(profile);
  if (!v.ok) throw new Error('Profile does not match the contract: ' + v.errors.map(e => e.path + ' ' + e.message).join('; '));
  const t0 = performance.now();
  const res = runMatch(matchFn, profile, active().slice, {});
  timing.ms = Math.round((performance.now() - t0) * 10) / 10;
  state.matcherVersion = res.version;
  return res;
}

export const pct = x => Math.round(x * 100) + '%';
// Coverage next to a reach badge: floored, so 0.3969 (a leap) never shows as 40% (the stretch line).
export const coverPct = x => coveragePercent(x) + '%';
export function importance(w) { return w >= 0.66 ? 'High' : w >= 0.33 ? 'Medium' : 'Low'; }
// Skill AI labels (SPEC 5.5). 'unknown' has no label: the skill simply shows no AI line (not yet measured).
export const AI_TEXT = { ai_does_much: 'AI already does much of this', mixed: 'AI helps with some of this', people_do: 'People still do this', unknown: '' };
// Task AI use (slice amendment A1). 'used' is use seen without an automation/augmentation split; 'none' is no use seen; 'unknown' has no label.
export const TASK_AI_TEXT = { automation: 'AI does this', augmentation: 'AI helps with this', used: 'AI use seen', none: 'No AI use seen', unknown: '' };

// Where "back to roads" goes: the person's own job, or the job picked in the drill.
export const roadsHref = () => state.focus ? '#/roads/' + encodeURIComponent(state.focus.occ.id) : '#/roads';
export const drillHref = id => '#/drill/' + encodeURIComponent(id);

export function badges(r) {
  return h('p', { class: 'badges' },
    h('span', { class: 'badge tier-' + r.tier }, TIER_LABEL[r.tier]),
    r.move ? h('span', { class: 'badge move move-' + r.move }, MOVE_LABEL[r.move]) : null);
}
// The kind of move in words (SPEC 7.2). With no kind from the matcher, nothing is shown.
export function moveNote(r) {
  return r.move ? h('p', { class: 'move-note' }, h('strong', null, MOVE_LABEL[r.move] + ': '), MOVE_EXPLAIN[r.move]) : null;
}

export function coverageBar(r) {
  const bar = h('span', { class: 'bar-fill' });
  bar.style.width = coverPct(r.coverage); // CSSOM, allowed by a strict style-src (no style attribute in the markup)
  return h('div', { class: 'cover' },
    h('span', { class: 'cover-num' }, coverPct(r.coverage), ' covered'),
    h('span', { class: 'bar', role: 'presentation' }, bar));
}

// Figures we do not have are left out, not listed as "not yet measured" (owner decision 2026-10-30). Dates and sources live on the "About this data" page.
export function signalText(kind, s) {
  if (kind === 'ai') return typeof s.value === 'number' ? 'AI use seen in ' + pct(s.value) + ' of the work' : String(s.value);
  return String(s.value);
}
export const NO_FIGURES = 'Pay and demand figures are coming.';
export function signalList(r) {
  const rows = [['pay', 'Pay', r.signals.pay], ['demand', 'Demand', r.signals.demand], ['ai', 'AI', r.signals.ai]].filter(x => x[2]);
  return rows.length ? h('dl', { class: 'signals' }, rows.map(([k, label, s]) => h('div', null, h('dt', null, label), h('dd', null, signalText(k, s))))) : null;
}
export function flagList(r) {
  return r.flags.length ? h('ul', { class: 'flags', 'aria-label': 'Notes on this road' }, r.flags.map(f => h('li', { 'data-flag': f.id }, f.text))) : null;
}
