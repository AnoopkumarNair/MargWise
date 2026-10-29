// Shared by the roads and road-detail screens.
import { h } from '../dom.js';
import { state, buildProfile, checkProfile } from '../state.js';
import { loadMatcher, runMatch, TIER_LABEL, MOVE_LABEL } from '../matcher_adapter.js';

let matchFn = null;
export const timing = { ms: null };

// Runs the matcher on the in-memory profile. Returns { roads, version } or throws.
export async function computeRoads() {
  if (!matchFn) matchFn = await loadMatcher();
  const profile = buildProfile();
  const v = checkProfile(profile);
  if (!v.ok) throw new Error('Profile does not match the contract: ' + v.errors.map(e => e.path + ' ' + e.message).join('; '));
  const t0 = performance.now();
  const res = runMatch(matchFn, profile, state.slice, {});
  timing.ms = Math.round((performance.now() - t0) * 10) / 10;
  state.matcherVersion = res.version;
  return res;
}

export const pct = x => Math.round(x * 100) + '%';
export function importance(w) { return w >= 0.66 ? 'High' : w >= 0.33 ? 'Medium' : 'Low'; }
// Skill AI labels (SPEC 5.5). 'unknown' has no label: the skill simply shows no AI line (not yet measured).
export const AI_TEXT = { ai_does_much: 'AI already does much of this', mixed: 'AI helps with some of this', people_do: 'People still do this', unknown: '' };
// Task AI use (slice amendment A1). 'used' is use seen without an automation/augmentation split; 'none' is no use seen; 'unknown' has no label.
export const TASK_AI_TEXT = { automation: 'AI does this', augmentation: 'AI helps with this', used: 'AI use seen', none: 'No AI use seen', unknown: '' };

export function badges(r) {
  return h('p', { class: 'badges' },
    h('span', { class: 'badge tier-' + r.tier }, TIER_LABEL[r.tier]),
    r.move ? h('span', { class: 'badge' }, MOVE_LABEL[r.move]) : null);
}

export function coverageBar(r) {
  const bar = h('span', { class: 'bar-fill' });
  bar.style.width = pct(r.coverage); // CSSOM, allowed by a strict style-src (no style attribute in the markup)
  return h('div', { class: 'cover' },
    h('span', { class: 'cover-num' }, pct(r.coverage), ' covered'),
    h('span', { class: 'bar', role: 'presentation' }, bar));
}

const NM = 'not yet measured';
export function signalText(kind, s) {
  if (!s) return NM;
  if (kind === 'ai') return typeof s.value === 'number' ? 'AI use seen in ' + pct(s.value) + ' of the work (as of ' + s.as_of + ')' : String(s.value);
  return String(s.value) + ' (as of ' + s.as_of + ')';
}
export function signalList(r) {
  return h('dl', { class: 'signals' },
    h('div', null, h('dt', null, 'Pay'), h('dd', { class: r.signals.pay ? '' : 'nm' }, signalText('pay', r.signals.pay))),
    h('div', null, h('dt', null, 'Demand'), h('dd', { class: r.signals.demand ? '' : 'nm' }, signalText('demand', r.signals.demand))),
    h('div', null, h('dt', null, 'AI'), h('dd', { class: r.signals.ai ? '' : 'nm' }, signalText('ai', r.signals.ai))));
}
export function flagList(r) {
  return r.flags.length ? h('ul', { class: 'flags' }, r.flags.map(f => h('li', null, f.text))) : null;
}
