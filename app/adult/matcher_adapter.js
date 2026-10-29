// The only file that knows the shape of matcher/match.js output. Everything else uses the normalised road below.
// Matcher API (SPEC 7, matcher/match.js 1.0.0): match(profile, slice, opts) -> { version, roads: [{ id, label, reach, coverage, gap, kind, level, flags,
//   bridges, components: { pay|ai_safe|short|demand|enjoy: { value, norm, weight, status } }, score }] }
// In 1.0.0 `kind`, `level.fit`, `bridges` and `flags` are stubs (null or empty). Older drafts used `tier`/`gaps`; both are read.
// If the matcher's real shape differs, change this file only (and adapter.test.mjs).
//
// Normalised road:
//   { id, label, tier: 'adjacent'|'stretch'|'leap', move: 'up'|'across'|'diagonal'|'reset'|'fork'|null, coverage: 0..1, score: number,
//     gaps: [{ id, label, w, ai, reason }], flags: [{ id, text }], components: [{ key, label, value: number|null, measured: bool }],
//     signals: { pay, demand, ai } (each { value, as_of } or null = not yet measured), bridges: [{ label }], fit: string|null, via: [...] }

export const TIERS = ['adjacent', 'stretch', 'leap'];
export const TIER_LABEL = { adjacent: 'Close move', stretch: 'Stretch', leap: 'Leap' };
export const MOVES = ['up', 'across', 'diagonal', 'reset', 'fork'];
export const MOVE_LABEL = { up: 'Step up', across: 'Sideways move', diagonal: 'Step up and sideways', reset: 'Start again lower', fork: 'Fork in the same field' };
export const FLAG_TEXT = {
  outside_time: 'Needs more study time than you said you have.',
  below_pay_floor: 'Pay may fall below your lowest pay change.',
  needs_relocation: 'May need a move to another city.',
};
const COMP = [['pay', 'Pay change'], ['ai_safe', 'Safe from AI'], ['short_move', 'Short move'], ['demand', 'Demand'], ['enjoy', 'Interest fit']];
const COMP_ALIAS = { short: 'short_move' };

export function tierFromCoverage(c) { return c >= 0.7 ? 'adjacent' : c >= 0.4 ? 'stretch' : 'leap'; }

function latest(signals, kind) {
  let best = null;
  for (const s of signals || []) if (s.kind === kind && (!best || s.period > best.period)) best = s;
  return best ? { value: best.value, as_of: best.as_of, period: best.period } : null;
}

// Plain reason for a gap row when the matcher gives none. `cover` is how much of the skill the person covers, from 0 to 1.
function gapReason(g) {
  const c = g && typeof g.cover === 'number' ? g.cover : 0;
  const base = c > 0 ? 'You cover this only in part (' + Math.round(c * 100) + '% of what the job needs).' : 'You did not tick this skill, and nothing you ticked comes close to it.';
  return base + (g && g.people_do ? ' People still do this work, so it counts for more.' : '');
}

function targetOf(slice, id) { return (slice.targets || []).find(t => t.occ.id === id) || null; }

export function normaliseRoad(raw, slice, profile) {
  const t = targetOf(slice, raw.id);
  const needs = new Map(((t && t.needs) || []).map(n => [n.id, n]));
  const coverage = Number(raw.coverage) || 0;
  const rk = String(raw.kind || '').toLowerCase();
  const tier = TIERS.includes(raw.reach) ? raw.reach : TIERS.includes(raw.tier) ? raw.tier : TIERS.includes(rk) ? rk : tierFromCoverage(coverage);
  const move = MOVES.includes(rk) ? rk : (MOVES.includes(raw.move) ? raw.move : null);
  const signals = {
    pay: latest(t && t.signals, 'pay_band_in'),
    demand: latest(t && t.signals, 'demand_trend'),
    ai: latest(t && t.signals, 'ai_obs'),
  };
  const gaps = (raw.gap || raw.gaps || []).map(g => {
    const id = typeof g === 'string' ? g : g.id;
    const n = needs.get(id);
    return {
      id,
      label: (g && g.label) || (n && n.label) || id,
      w: g && typeof g.w === 'number' ? g.w : (n ? n.w : null),
      ai: (g && g.ai) || (n && n.ai) || 'unknown',
      reason: (g && g.reason) || gapReason(g),
    };
  });
  const flags = (raw.flags || []).map(f => {
    const id = typeof f === 'string' ? f : (f.id || f.flag);
    return { id, text: (f && f.text) || FLAG_TEXT[id] || id };
  });
  const rc = raw.components || {};
  const comps = Array.isArray(rc) ? Object.fromEntries(rc.map(c => [c.key || c.id, c])) : rc;
  const prio = (profile && profile.priorities) || {};
  const measuredBy = { pay: !!signals.pay, ai_safe: !!signals.ai, short_move: true, demand: !!signals.demand, enjoy: (prio.enjoy || 0) > 0 };
  const components = COMP.map(([key, label]) => {
    let c = comps[key];
    if (c === undefined) { const a = Object.keys(COMP_ALIAS).find(x => COMP_ALIAS[x] === key); if (a) c = comps[a]; }
    const value = c == null ? null : (typeof c === 'number' ? c : (typeof c.value === 'number' ? c.value : null));
    const measured = c && typeof c === 'object' && typeof c.status === 'string' ? c.status === 'measured'
      : c && typeof c === 'object' && typeof c.measured === 'boolean' ? c.measured : measuredBy[key];
    return { key, label, value, measured: !!measured && value !== null };
  });
  return {
    id: raw.id,
    label: raw.label || (t && t.occ.label) || raw.id,
    tier, move, coverage,
    score: typeof raw.score === 'number' ? raw.score : 0,
    gaps, flags, components, signals,
    bridges: (Array.isArray(raw.bridges) ? raw.bridges : []).map(b => ({ label: typeof b === 'string' ? b : (b.label || b.name || b.id) })),
    fit: (raw.level && raw.level.fit) || raw.exp_fit || raw.fit || null,
    via: t ? t.via : [],
  };
}

export function normaliseResult(res, slice, profile) {
  const roads = (res.roads || []).map(r => normaliseRoad(r, slice, profile));
  // Stable order: score, then coverage, then id. The matcher already sorts; this keeps the screen steady if it does not.
  roads.sort((a, b) => b.score - a.score || b.coverage - a.coverage || (a.id < b.id ? -1 : 1));
  return { version: res.version || null, roads };
}

// Runs the matcher and returns the normalised result. `matchFn` is match() from the matcher module.
export function runMatch(matchFn, profile, slice, opts) {
  return normaliseResult(matchFn(profile, slice, opts || {}), slice, profile);
}

// Loads the matcher module that build.py copied next to the app.
export async function loadMatcher() {
  const m = await import('./matcher/match.js');
  if (typeof m.match !== 'function') throw new Error('matcher/match.js has no match() export');
  return m.match;
}
