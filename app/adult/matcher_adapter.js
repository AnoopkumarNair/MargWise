// The only file that knows the shape of matcher/match.js output. Everything else uses the normalised road below.
// Matcher API (SPEC 7, matcher/match.js 1.0.x, matcher/result.schema.json): match(profile, slice, opts) -> { version, roads: [{ id, label, reach,
//   coverage, gap, kind, level, flags, bridges, components: { pay|ai_safe|short|demand|enjoy: { value, norm, weight, status } }, score }] }
// In 1.0.x `kind`, `level.fit`, `bridges` and `flags` are stubs (null or empty). Only this shape is read. If it changes, change this
// file only (and adapter.test.mjs).
//
// Normalised road:
//   { id, label, tier: 'adjacent'|'stretch'|'leap', move: 'up'|'across'|'diagonal'|'reset'|'fork'|null, coverage: 0..1, score: number,
//     gaps: [{ id, label, w, ai, reason }], flags: [{ id, text }], components: [{ key, label, value: number|null, measured: bool }],
//     signals: { pay, demand, ai } (each { value, as_of } or null = not yet measured), bridges: [{ label }], fit: string|null, via: [...] }

export const TIERS = ['adjacent', 'stretch', 'leap'];
export const TIER_LABEL = { adjacent: 'Close move', stretch: 'Stretch', leap: 'Leap' };
export const MOVES = ['up', 'across', 'diagonal', 'reset', 'fork'];
export const MOVE_LABEL = { up: 'Step up', across: 'Sideways move', diagonal: 'Step up and sideways', reset: 'Start again lower', fork: 'Fork in the same field' };
// A plain-word explanation for each kind of move (SPEC 7.2).
export const MOVE_EXPLAIN = {
  up: 'The same line of work, one level above yours.',
  across: 'A different line of work, at about your level.',
  diagonal: 'A different line of work, one level above yours.',
  reset: 'A job at least two levels below yours, where you cover less than half of the skills.',
  fork: 'A management job, or a specialist step, in your own line of work.',
};
// Experience fit: your years against the years this job's level usually asks for (SPEC 7.2).
export const FIT_TEXT = {
  below: 'You have fewer years of experience than this job’s level usually asks for.',
  in: 'Your years of experience fit this job’s level.',
  above: 'You have more years of experience than this job’s level usually asks for.',
};
export const FLAG_TEXT = {
  outside_time: 'Needs more study time than you said you have.',
  below_pay_floor: 'Pay may fall below your lowest pay change.',
  needs_relocation: 'May need a move to another city.',
};
const COMP = [['pay', 'Pay change'], ['ai_safe', 'Safe from AI'], ['short_move', 'Short move'], ['demand', 'Demand'], ['enjoy', 'Interest fit']];

export function tierFromCoverage(c) { return c >= 0.7 ? 'adjacent' : c >= 0.4 ? 'stretch' : 'leap'; }
// Coverage as a whole percent for the screen. Floored, not rounded, so the number never contradicts the badge: 0.3969 is a leap and
// shows 39%, not 40% (review finding S3). Coverage has 4 decimals; rounding to 2 places of percent first keeps 0.29 at 29, not 28.
export function coveragePercent(c) { return Math.floor(Math.round((Number(c) || 0) * 10000) / 100); }

function latest(signals, kind) {
  let best = null;
  for (const s of signals || []) if (s.kind === kind && (!best || s.period > best.period)) best = s;
  return best ? { value: best.value, as_of: best.as_of, period: best.period } : null;
}

// Plain reason for a gap row. `cover` is how much of the skill the person covers, from 0 to 1.
function gapReason(g) {
  const c = typeof g.cover === 'number' ? g.cover : 0;
  const base = c > 0 ? 'You cover this only in part (' + Math.round(c * 100) + '% of what the job needs).' : 'You did not tick this skill, and nothing you ticked comes close to it.';
  return base + (g.people_do ? ' People still do this work, so it is listed higher.' : '');
}

function targetOf(slice, id) { return (slice.targets || []).find(t => t.occ.id === id) || null; }

export function normaliseRoad(raw, slice, profile) {
  const t = targetOf(slice, raw.id);
  const needs = new Map(((t && t.needs) || []).map(n => [n.id, n]));
  const coverage = Number(raw.coverage) || 0;
  const tier = TIERS.includes(raw.reach) ? raw.reach : tierFromCoverage(coverage);
  const move = MOVES.includes(raw.kind) ? raw.kind : null;
  const signals = {
    pay: latest(t && t.signals, 'pay_band_in'),
    demand: latest(t && t.signals, 'demand_trend'),
    ai: latest(t && t.signals, 'ai_obs'),
  };
  const gaps = (raw.gap || []).map(g => {
    const n = needs.get(g.id);
    return {
      id: g.id,
      label: g.label || (n && n.label) || g.id,
      w: typeof g.w === 'number' ? g.w : (n ? n.w : null),
      ai: g.ai || (n && n.ai) || 'unknown',
      reason: gapReason(g),
    };
  });
  const flags = (raw.flags || []).map(f => { const id = typeof f === 'string' ? f : (f && f.id) || ''; return { id, text: FLAG_TEXT[id] || id }; }).filter(f => f.id);
  const lvl = raw.level || {};
  const fit = ['below', 'in', 'above'].includes(lvl.fit) ? lvl.fit : null;
  const bridges = (Array.isArray(raw.bridges) ? raw.bridges : []).map(b => ({ label: typeof b === 'string' ? b : (b && (b.label || b.name)) || '' })).filter(b => b.label);
  const comps = raw.components || {};
  const components = COMP.map(([key, label]) => {
    const c = comps[key === 'short_move' ? 'short' : key];
    const value = c && typeof c.value === 'number' ? c.value : null;
    return { key, label, value, measured: !!c && c.status === 'measured' && value !== null };
  });
  return {
    id: raw.id,
    label: raw.label || (t && t.occ.label) || raw.id,
    tier, move, coverage,
    score: typeof raw.score === 'number' ? raw.score : 0,
    gaps, flags, components, signals,
    bridges,
    fit, fitText: fit ? FIT_TEXT[fit] : null,
    targetLevel: lvl.target === undefined ? null : lvl.target,
    newRole: !!raw.new_role,
    via: t ? t.via : [],
  };
}

export function normaliseResult(res, slice, profile) {
  const roads = (res.roads || []).map(r => normaliseRoad(r, slice, profile));
  // Stable order: score, then coverage, then id. The matcher already sorts; this keeps the screen steady if it does not.
  roads.sort((a, b) => b.score - a.score || b.coverage - a.coverage || (a.id < b.id ? -1 : 1));
  const person = res.person && typeof res.person === 'object' ? res.person : null;
  return { version: res.version || null, roads, personLevel: person && Number.isInteger(person.level) ? person.level : null };
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
