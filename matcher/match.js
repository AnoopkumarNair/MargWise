// Margwise adult matcher v1 (SPEC 7). A plain ES module with no dependencies, for the browser and for Node.
// matcher/reference.py is an independent Python version of the same rules; matcher/tests/ checks that they agree.
// Deterministic: no clock, no randomness, no dictionary-order dependence. The year 'now' comes from opts, never from Date.
// Scope of 1.0.x (slice S1, BUILD_PLAN T2.2; 1.0.1 has the same rules as 1.0.0, see matcher/README.md): coverage, gap, reach (adjacent, stretch, leap) and order.
// Road kind, target level, experience fit, bridges, pay, demand and the constraint flags are stubs: they come back as
// null or "not_yet_measured", because the S1 slices and contracts do not carry the data they need. See matcher/README.md.

export const MATCHER_VERSION = '1.0.1';   // must equal contracts/versions.js (a test checks it)

// The only profile fields this file reads (ADR-16, invariant 8). Nothing demographic or commercial. City and openness to
// move are allowed only for the needs_relocation flag; 1.0.0 reads none of the constraints because the flags are stubs.
export const ALLOWED_INPUT_FIELDS = Object.freeze([
  'roles', 'roles[].occ', 'roles[].years',
  'skills', 'skills[].id', 'skills[].strength', 'skills[].last',
  'creds', 'creds[].id', 'creds[].expires',
  'lead', 'lead.people', 'lead.budget',
  'priorities', 'priorities.pay', 'priorities.ai_safe', 'priorities.short_move', 'priorities.demand', 'priorities.enjoy',
  'constraints', 'constraints.hours_month', 'constraints.pay_floor_pct', 'constraints.city', 'constraints.open_to',
]);

const HAVE = { strong: 1.0, used: 0.7, rusty: 0.4 };   // SPEC 7.1
const CRED_VALID = 0.7, CRED_EXPIRED = 0.4;            // SPEC 5.8
const RUSTY_AFTER = 3;                                 // years since last use
const NEAR_MIN = 0.5, NEAR_FACTOR = 0.5;
const GAP_BELOW = 0.7, PEOPLE_DO_BOOST = 0.5;
const ADJACENT = 0.7, STRETCH = 0.4;                   // SPEC 7.3 reach
const YEARS_LOW = { '0-2': 0, '2-5': 2, '5-8': 5, '8-12': 8, '12-18': 12, '18+': 18 };   // bands.json years (D2)
const LEVEL_FROM = [[18, 6], [12, 5], [8, 4], [5, 3], [2, 2], [0, 1]];                  // SPEC 7.2
const DEFAULT_PRIORITIES = { pay: 1, ai_safe: 1, short_move: 1, demand: 1, enjoy: 0 }; // SPEC 6 example
const COMPONENTS = ['pay', 'ai_safe', 'short', 'demand', 'enjoy'];
const SLIDER = { pay: 'pay', ai_safe: 'ai_safe', short: 'short_move', demand: 'demand', enjoy: 'enjoy' };

// Round half up to d decimals. reference.py uses the same arithmetic, so both give the same digits.
const q = (x, d) => Math.floor(x * 10 ** d + 0.5) / 10 ** d;
const arr = v => (Array.isArray(v) ? v : []);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Copies the allowed profile fields into a plain object. This is the only function that touches the profile.
function inputs(profile) {
  if (profile === null || typeof profile !== 'object') throw new TypeError('profile must be an object');
  const lead = profile.lead && typeof profile.lead === 'object' ? profile.lead : {};
  const pr = profile.priorities && typeof profile.priorities === 'object' ? profile.priorities : null;
  return {
    roles: arr(profile.roles).map(r => ({ occ: r.occ, years: r.years })),
    skills: arr(profile.skills).map(s => ({ id: s.id, strength: s.strength, last: s.last })),
    creds: arr(profile.creds).map(c => ({ id: c.id, expires: c.expires })),
    lead: { people: lead.people, budget: lead.budget },
    priorities: pr ? { pay: pr.pay, ai_safe: pr.ai_safe, short_move: pr.short_move, demand: pr.demand, enjoy: pr.enjoy } : null,
  };
}

// What the person has, per skill id: rated skills first, then credential credit for skills they did not rate (SPEC 5.8).
function haves(p, opts) {
  const now = num(opts.now), out = new Map();
  for (const s of p.skills) {
    if (!(s.strength in HAVE) || typeof s.id !== 'string') continue;
    const last = num(s.last);
    const aged = s.strength !== 'strong' && now !== null && last !== null && now - last > RUSTY_AFTER;
    const v = aged ? HAVE.rusty : HAVE[s.strength];
    const prev = out.get(s.id);
    if (!prev || v > prev.have) out.set(s.id, { have: v, from: 'rated', aged });
  }
  const teaches = opts.teaches && typeof opts.teaches === 'object' ? opts.teaches : {};
  const credit = new Map();
  for (const c of p.creds) {
    const list = Object.prototype.hasOwnProperty.call(teaches, c.id) ? arr(teaches[c.id]) : [];
    const exp = num(c.expires), expired = now !== null && exp !== null && exp < now;
    const v = expired ? CRED_EXPIRED : CRED_VALID;
    for (const id of list) {
      if (out.has(id)) continue;   // their own rating wins
      const prev = credit.get(id);
      if (!prev || v > prev.have || (v === prev.have && c.id < prev.cred)) credit.set(id, { have: v, from: 'cred', cred: c.id, expired });
    }
  }
  for (const [id, v] of credit) out.set(id, v);
  return out;
}

// skill_near data as {id: {id: sim}}: opts.near when the caller passes it (tests, or data from elsewhere), otherwise the slice's own
// near pairs (slice contract amendment A1: slice.near.pairs = [[a, b, sim], ...]), otherwise none.
function nearOf(slice, opts) {
  if (opts.near && typeof opts.near === 'object') return opts.near;
  const pairs = slice && slice.near && Array.isArray(slice.near.pairs) ? slice.near.pairs : null;
  if (!pairs) return null;
  const out = Object.create(null);
  for (const p of pairs) {
    if (!Array.isArray(p) || typeof p[0] !== 'string' || typeof p[1] !== 'string' || num(p[2]) === null) continue;
    (out[p[0]] || (out[p[0]] = Object.create(null)))[p[1]] = Math.max(p[2], out[p[0]][p[1]] ?? -1);
  }
  return out;
}

// skill_near similarity, symmetric, from {id: {id: sim}}.
function sim(near, a, b) {
  const one = (x, y) => (near && Object.prototype.hasOwnProperty.call(near, x) && near[x] && Object.prototype.hasOwnProperty.call(near[x], y) ? num(near[x][y]) : null);
  const v = Math.max(one(a, b) ?? -1, one(b, a) ?? -1);
  return v >= NEAR_MIN ? Math.min(v, 1) : null;
}

function coverWith(have, needs, opts) {
  const ids = [...have.keys()].sort(cmpStr);
  let sw = 0, sc = 0;
  const rows = arr(needs).map(n => {
    const w = Math.max(0, num(n.w) ?? 0);
    const h = have.has(n.id) ? have.get(n.id).have : 0;
    let nr = 0, via = null;
    for (const k of ids) {
      if (k === n.id) continue;
      const s = sim(opts.near, k, n.id);
      if (s === null) continue;
      const v = NEAR_FACTOR * s * have.get(k).have;
      if (v > nr) { nr = v; via = k; }
    }
    const cover = Math.max(h, nr);
    sw += w; sc += w * cover;
    return { id: n.id, label: n.label, w, ai: n.ai, have: h, near: nr, near_via: via, cover };
  });
  const value = sw > 0 ? q(sc / sw, 4) : 0;
  const gap = rows.filter(r => r.cover < GAP_BELOW)
    .map(r => ({ r, pri: r.w * (1 + (r.ai === 'people_do' ? PEOPLE_DO_BOOST : 0)) }))
    .sort((a, b) => b.pri - a.pri || cmpStr(a.r.id, b.r.id))
    .map(({ r, pri }) => ({ id: r.id, label: r.label, w: q(r.w, 4), cover: q(r.cover, 4), ai: r.ai, people_do: r.ai === 'people_do', priority: q(pri, 4) }));
  return {
    coverage: value,
    needs: rows.map(r => ({ id: r.id, w: q(r.w, 4), have: q(r.have, 4), near: q(r.near, 4), near_via: r.near_via, cover: q(r.cover, 4) })),
    gap,
  };
}

// coverage(profile, needs, opts) -> {coverage, needs:[...], gap:[...]} (SPEC 7.1). opts: {now, near, teaches}.
export function coverage(profile, needs, opts = {}) {
  return coverWith(haves(inputs(profile), opts || {}), needs, opts || {});
}

// level(profile) -> {level, years_total, years_level, lead_bonus, title_override} (SPEC 7.2).
// Total years adds the lower bound of each role's band. The profile holds no title text, so the seniority-word override
// cannot run here: title_override is always null (the app applies it at intake and stores roles[].level).
export function level(profile) {
  const p = inputs(profile);
  const known = p.roles.filter(r => Object.prototype.hasOwnProperty.call(YEARS_LOW, r.years));
  if (known.length === 0) return { level: null, years_total: null, years_level: null, lead_bonus: 0, title_override: null };
  const total = known.reduce((a, r) => a + YEARS_LOW[r.years], 0);
  const yl = LEVEL_FROM.find(([min]) => total >= min)[1];
  const bonus = p.lead.people === '6-20' || p.lead.people === '21+' || p.lead.budget === true ? 1 : 0;
  return { level: Math.min(6, yl + bonus), years_total: total, years_level: yl, lead_bonus: bonus, title_override: null };
}

function reach(c) { return c >= ADJACENT ? 'adjacent' : c >= STRETCH ? 'stretch' : 'leap'; }

// The newest ai_obs signal (largest period string), as a share from 0 to 1.
function aiObs(signals) {
  let best = null;
  for (const s of arr(signals)) {
    if (s.kind !== 'ai_obs' || num(s.value) === null) continue;
    if (best === null || s.period > best.period) best = s;
  }
  return best === null ? null : Math.min(1, Math.max(0, best.value));
}

function weights(p, opts) {
  const pr = p.priorities || DEFAULT_PRIORITIES, w = {};
  for (const c of COMPONENTS) {
    const v = num(pr[SLIDER[c]]);
    w[c] = v === null || v < 0 ? 0 : v;
  }
  if (opts.walk !== true) w.enjoy = 0;   // SPEC 7.3: no weight unless the interest walk was taken
  return w;
}

// match(profile, slice, opts) -> {version, release, from, person, weights, stubs, roads} (SPEC 7).
// opts: {now: year, near: {id: {id: sim}} (default: slice.near), teaches: {cred id: [skill ids]}, walk: boolean}.
export function match(profile, slice, opts = {}) {
  opts = opts || {};
  if (slice === null || typeof slice !== 'object' || !slice.occ) throw new TypeError('slice must be an occupation slice');
  opts = { ...opts, near: nearOf(slice, opts) };
  const p = inputs(profile), have = haves(p, opts), w = weights(p, opts), from = slice.occ.id;
  const seen = new Set([from]), roads = [];
  for (const t of arr(slice.targets)) {
    const id = t && t.occ && t.occ.id;
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    const cv = coverWith(have, t.needs, opts), ai = aiObs(t.signals);
    roads.push({
      id, label: t.occ.label, via: arr(t.via).slice(),
      new_role: t.occ.new_role === true || id.startsWith('occ:ai-') || id.startsWith('occ:in-'),
      reach: reach(cv.coverage), coverage: cv.coverage,
      raw: {
        pay: { value: 0.5, status: 'not_yet_measured' },
        ai_safe: ai === null ? { value: 0.5, status: 'unknown' } : { value: q(1 - ai, 4), status: 'measured' },
        short: { value: cv.coverage, status: 'measured' },
        demand: { value: 0.5, status: 'not_yet_measured' },
        enjoy: { value: 0.5, status: 'not_yet_measured' },
      },
      gap: cv.gap,
      kind: null, level: { target: null, fit: null }, flags: [], bridges: null,
    });
  }
  // Normalise each component to 0..1 across the candidates (min-max). A component equal on every road keeps its value.
  const span = {};
  for (const c of COMPONENTS) {
    const vs = roads.map(r => r.raw[c].value);
    span[c] = vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 0];
  }
  const sumW = COMPONENTS.reduce((a, c) => a + w[c], 0);
  for (const r of roads) {
    const comp = {};
    let s = 0;
    for (const c of COMPONENTS) {
      const [lo, hi] = span[c], v = r.raw[c].value;
      const norm = hi - lo > 1e-12 ? (v - lo) / (hi - lo) : v;
      comp[c] = { value: v, norm: q(norm, 4), weight: w[c], status: r.raw[c].status };
      s += w[c] * norm;
    }
    r.components = comp;
    r.score = sumW > 0 ? q(s / sumW, 6) : 0;
    delete r.raw;
  }
  roads.sort((a, b) => b.score - a.score || b.coverage - a.coverage || cmpStr(a.id, b.id));
  const out = roads.map(r => ({
    id: r.id, label: r.label, via: r.via, new_role: r.new_role, reach: r.reach, coverage: r.coverage,
    score: r.score, components: r.components, gap: r.gap, kind: r.kind, level: r.level, flags: r.flags, bridges: r.bridges,
  }));
  return {
    version: MATCHER_VERSION, release: slice.release, from,
    person: level(profile), weights: w,
    stubs: ['kind', 'level.target', 'level.fit', 'bridges', 'flags', 'pay', 'demand', 'enjoy'],
    roads: out,
  };
}
