// STAND-IN MATCHER, TESTS ONLY. Used by `build.py --dev` only when matcher/match.js does not exist yet. Never copied by a release build.
// It follows SPEC 7.1 (coverage, gap) and 7.3 (order) loosely, with no "near" skills, no levels and no bridges.
// The real matcher is matcher/match.js (matcher lane). If this file ever disagrees with it, the real one wins.
const HAVE = { strong: 1.0, used: 0.7, rusty: 0.4 };
export function match(profile, slice, opts) {
  const mine = new Map(profile.skills.map(s => [s.id, HAVE[s.strength] || 0.7]));
  const pr = profile.priorities || { pay: 1, ai_safe: 1, short_move: 1, demand: 1, enjoy: 0 };
  const roads = slice.targets.map(t => {
    const needs = t.needs.slice(0, 40);
    const tw = needs.reduce((a, n) => a + n.w, 0) || 1;
    const cov = needs.reduce((a, n) => a + n.w * (mine.get(n.id) || 0), 0) / tw;
    const gaps = needs.filter(n => (mine.get(n.id) || 0) < 0.7).sort((a, b) => b.w - a.w).map(n => ({ id: n.id, w: n.w }));
    const sig = k => (t.signals.find(s => s.kind === k) || {}).value;
    const ai = sig('ai_obs');
    const comp = { pay: 0.5, ai_safe: typeof ai === 'number' ? 1 - ai : 0.5, short_move: cov, demand: 0.5, enjoy: 0 };
    const keys = ['pay', 'ai_safe', 'short_move', 'demand', 'enjoy'];
    const den = keys.reduce((a, k) => a + (pr[k] || 0), 0) || 1;
    const score = keys.reduce((a, k) => a + (pr[k] || 0) * comp[k], 0) / den;
    return { id: t.occ.id, kind: cov >= 0.7 ? 'adjacent' : cov >= 0.4 ? 'stretch' : 'leap', coverage: Math.round(cov * 100) / 100, gaps, flags: [], components: comp, score: Math.round(score * 1000) / 1000, bridges: [] };
  });
  roads.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return { version: '0.0.0-stub', roads };
}
