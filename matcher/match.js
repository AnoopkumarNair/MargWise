// Margwise adult matcher v1 (SPEC 7). A plain ES module with no dependencies, for the browser and for Node.
// matcher/reference.py is an independent Python version of the same rules; matcher/tests/ checks that they agree.
// Deterministic: no clock, no randomness, no dictionary-order dependence. The year 'now' comes from opts, never from Date.
// 1.1.0 (slice S1): coverage, gap, reach (adjacent, stretch, leap) and order, with owner decisions O1 (used = 0.85), O2 (near only from
// the 3 closest neighbours at 0.90 or more) and O4 (default sliders).
// 1.2.0 (slice S2, BUILD_PLAN T2.2, SPEC 7.2 to 7.4): target level and experience fit, road kind (up, across, diagonal, reset, fork),
// pay change from a numeric pay_band_in signal, the three constraint flags where their inputs exist, bridges from a reviewed credential
// catalogue (opts.credentials), and expired credentials labelled "renew?". What still has no data stays a stub; see matcher/README.md.

export const MATCHER_VERSION = '1.2.0';   // must equal contracts/versions.js (a test checks it)

// The only profile fields this file reads (ADR-16, invariant 8). Nothing demographic or commercial. City and openness to move are read
// only for the needs_relocation flag, never for a score or the order (a test proves it).
export const ALLOWED_INPUT_FIELDS = Object.freeze([
  'roles', 'roles[].occ', 'roles[].years',
  'skills', 'skills[].id', 'skills[].strength', 'skills[].last',
  'creds', 'creds[].id', 'creds[].expires',
  'lead', 'lead.people', 'lead.budget',
  'priorities', 'priorities.pay', 'priorities.ai_safe', 'priorities.short_move', 'priorities.demand', 'priorities.enjoy',
  'constraints', 'constraints.hours_month', 'constraints.pay_floor_pct', 'constraints.city', 'constraints.open_to',
]);

const HAVE = { strong: 1.0, used: 0.85, rusty: 0.4 };  // SPEC 7.1 (owner decision O1: used 0.7 -> 0.85)
const CRED_VALID = HAVE.used, CRED_EXPIRED = HAVE.rusty; // SPEC 5.8: a valid credential credits at the used level, an expired one at rusty
const RUSTY_AFTER = 3;                                 // years since last use
const NEAR_RANK = 3, NEAR_MIN = 0.9, NEAR_FACTOR = 0.5;   // SPEC 7.1 (owner decision O2)
const GAP_BELOW = 0.7, PEOPLE_DO_BOOST = 0.5;
const ADJACENT = 0.7, STRETCH = 0.4;                   // SPEC 7.3 reach
const YEARS_LOW = { '0-2': 0, '2-5': 2, '5-8': 5, '8-12': 8, '12-18': 12, '18+': 18 };   // bands.json years (D2)
const LEVEL_FROM = [[18, 6], [12, 5], [8, 4], [5, 3], [2, 2], [0, 1]];                  // SPEC 7.2
const LEVEL_YEARS = { 1: 0, 2: 2, 3: 5, 4: 8, 5: 12, 6: 18 };                           // first year of each level's band (SPEC 7.2)
const ZONE_LEVELS = { 1: [1, 2], 2: [1, 2], 3: [2, 3], 4: [3, 4], 5: [4, 5] };          // SPEC 7.2 target's typical level from job zone
const RESET_DROP = 2, RESET_BELOW = 0.5;              // SPEC 7.2 reset: entry level 2 or more below, and coverage under 0.5
const DEFAULT_PRIORITIES = { pay: 1, ai_safe: 1, short_move: 3, demand: 1, enjoy: 0 }; // SPEC 7.3 defaults (owner decision O4)
const COMPONENTS = ['pay', 'ai_safe', 'short', 'demand', 'enjoy'];
const SLIDER = { pay: 'pay', ai_safe: 'ai_safe', short: 'short_move', demand: 'demand', enjoy: 'enjoy' };
const MAX_BRIDGES = 3;                                 // SPEC 7.4
const HOURS_CAP = { '0-5': 5, '5-10': 10, '10-20': 20, '20-40': 40, '40+': Infinity };   // the top of each hours_month band
const STUDY_MONTHS = 12;                               // outside_time: the bridges need more than 12 months at the top of the band
const RELOCATE_BELOW = 0.5;                            // needs_relocation: under half the openings are in places the person accepts
const FLAGS = ['outside_time', 'below_pay_floor', 'needs_relocation'];
// Known specialist steps (SPEC 7.2 fork). A copy of matcher/ladder.json "steps" (from, to); a test keeps the two equal. Draft for the
// owner to review: each step is an O*NET related occupation in the same minor group at a higher job zone.
export const LADDER = Object.freeze([
  ['occ:13-2051.00', 'occ:13-2099.01'],
  ['occ:29-1141.00', 'occ:29-1151.00'],
  ['occ:29-1141.00', 'occ:29-1161.00'],
  ['occ:29-1141.00', 'occ:29-1171.00'],
]);

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
  const cs = profile.constraints && typeof profile.constraints === 'object' ? profile.constraints : {};
  return {
    roles: arr(profile.roles).map(r => ({ occ: r.occ, years: r.years })),
    skills: arr(profile.skills).map(s => ({ id: s.id, strength: s.strength, last: s.last })),
    creds: arr(profile.creds).map(c => ({ id: c.id, expires: c.expires })),
    lead: { people: lead.people, budget: lead.budget },
    priorities: pr ? { pay: pr.pay, ai_safe: pr.ai_safe, short_move: pr.short_move, demand: pr.demand, enjoy: pr.enjoy } : null,
    // Constraints are read only for the flags (SPEC 7.3). City and openness to move feed needs_relocation and nothing else (ADR-16).
    limits: { hours_month: cs.hours_month, pay_floor_pct: cs.pay_floor_pct, city: cs.city, open_to: arr(cs.open_to).slice() },
  };
}

// The reviewed credential catalogue (SPEC 5.8), as the caller passes it in opts.credentials: [{id, label, issuer, official_url, cost_inr,
// hours, validity_years, teaches: [skill id or {id, quote}]}]. Returns Map(id -> entry with teaches as a list of unique skill ids), by id.
function catalogue(opts) {
  const out = new Map();
  for (const c of arr(opts.credentials)) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || out.has(c.id)) continue;
    const ids = [];
    for (const t of arr(c.teaches)) {
      const id = typeof t === 'string' ? t : t && typeof t.id === 'string' ? t.id : null;
      if (id !== null && !ids.includes(id)) ids.push(id);
    }
    out.set(c.id, { ...c, teaches: ids });
  }
  return out;
}

// What each credential teaches, for crediting held credentials: opts.teaches ({cred id: [skill ids]}) when given, else the catalogue's lists.
function teachesOf(opts) {
  if (opts.teaches && typeof opts.teaches === 'object') return opts.teaches;
  const out = {};
  for (const [id, c] of opts.catalogue || catalogue(opts)) out[id] = c.teaches;
  return out;
}

const expiredAt = (c, now) => now !== null && num(c.expires) !== null && num(c.expires) < now;

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
  const teaches = teachesOf(opts);
  const credit = new Map();
  for (const c of p.creds) {
    const list = Object.prototype.hasOwnProperty.call(teaches, c.id) ? arr(teaches[c.id]) : [];
    const expired = expiredAt(c, now);
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

// For each skill s, the near skills that may credit it (SPEC 7.1, owner decision O2): s's NEAR_RANK closest neighbours in the near data
// (similarity read both ways, the larger if both are given, capped at 1; ranked by similarity, then id), kept only at NEAR_MIN or more.
// Returns Map(s -> [[k, sim], ...] sorted by k). match() builds it once per call.
function nearIndex(near) {
  if (!near || typeof near !== 'object') return new Map();
  const simOf = new Map();   // 'a\u0000b' with a < b -> sim
  for (const x of Object.keys(near).sort(cmpStr)) {
    const row = near[x];
    if (!row || typeof row !== 'object') continue;
    for (const y of Object.keys(row).sort(cmpStr)) {
      const v = num(row[y]);
      if (v === null || x === y) continue;
      const key = x < y ? x + '\u0000' + y : y + '\u0000' + x;
      simOf.set(key, Math.max(Math.min(v, 1), simOf.get(key) ?? -Infinity));
    }
  }
  const lists = new Map();
  for (const [key, v] of simOf) {
    const [a, b] = key.split('\u0000');
    (lists.get(a) || lists.set(a, []).get(a)).push([b, v]);
    (lists.get(b) || lists.set(b, []).get(b)).push([a, v]);
  }
  const out = new Map();
  for (const [s, lst] of lists) {
    lst.sort((p, r) => r[1] - p[1] || cmpStr(p[0], r[0]));
    const ok = lst.slice(0, NEAR_RANK).filter(([, v]) => v >= NEAR_MIN).sort((p, r) => cmpStr(p[0], r[0]));
    if (ok.length) out.set(s, ok);
  }
  return out;
}

function coverWith(have, needs, opts) {
  const index = opts.nearIndex || nearIndex(opts.near);
  let sw = 0, sc = 0;
  const rows = arr(needs).map(n => {
    const w = Math.max(0, num(n.w) ?? 0);
    const h = have.has(n.id) ? have.get(n.id).have : 0;
    let nr = 0, via = null;
    for (const [k, s] of index.get(n.id) || []) {   // sorted by id, so a tie goes to the smaller id
      if (!have.has(k)) continue;
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

// The newest signal of one kind whose value passes ok(value) (largest period string; the first one wins a tie), or null.
function newest(signals, kind, ok) {
  let best = null;
  for (const s of arr(signals)) {
    if (!s || s.kind !== kind || !ok(s.value)) continue;
    if (best === null || s.period > best.period) best = s;
  }
  return best;
}

// Pay of an occupation for the pay change (SPEC 7.3): the newest pay_band_in signal with a number above 0. The slice contract allows a
// string or a number; a string (a band name) cannot be compared, so it counts as no pay. Only the ratio of two values is used.
function payOf(signals) {
  const s = newest(signals, 'pay_band_in', v => num(v) !== null && v > 0);
  return s === null ? null : s.value;
}

// SOC code of an occupation: occ.soc, else the code in an O*NET id (occ:13-2011.00 -> 13-2011). New roles (occ:ai-*, occ:in-*) have none.
function socOf(occ) {
  if (occ && typeof occ.soc === 'string' && /^[0-9]{2}-[0-9]{4}/.test(occ.soc)) return occ.soc.slice(0, 7);
  const m = occ && typeof occ.id === 'string' ? /^occ:([0-9]{2}-[0-9]{4})\./.exec(occ.id) : null;
  return m ? m[1] : null;
}
// O*NET minor group: the first 4 digits of the SOC code (13-2011 -> 13-20), as SPEC 7.2 says.
const minorOf = soc => (soc === null ? null : soc.slice(0, 5));
const isManagement = soc => soc !== null && soc.startsWith('11-');

// Target's typical level as [low, high] (SPEC 7.2, 5.7): occ.typical_level when the slice has it (new roles' levels), else from the job
// zone. null when neither is known ("not yet known").
function typicalLevel(occ) {
  const tl = occ && occ.typical_level;
  if (Array.isArray(tl) && tl.length === 2 && Number.isInteger(tl[0]) && Number.isInteger(tl[1]) && tl[0] >= 1 && tl[1] <= 6 && tl[0] <= tl[1]) {
    return { range: [tl[0], tl[1]], basis: 'typical_level' };
  }
  const z = occ ? occ.job_zone : null;
  if (Object.prototype.hasOwnProperty.call(ZONE_LEVELS, z)) return { range: ZONE_LEVELS[z].slice(), basis: 'job_zone' };
  return { range: null, basis: null };
}

// Experience fit (SPEC 7.2): the person's total years against the years band of the target's typical levels, [first year of the low
// level, first year of the level above the high one). Level 6 has no upper end.
function fitOf(years, range) {
  if (years === null || range === null) return null;
  if (years < LEVEL_YEARS[range[0]]) return 'below';
  if (range[1] < 6 && years >= LEVEL_YEARS[range[1] + 1]) return 'above';
  return 'in';
}

// Road kind (SPEC 7.2). Rules in this order; the first that holds wins:
//   reset    the target's entry level is 2 or more below the person's level, and coverage is under 0.5
//   fork     the target is a management occupation (SOC 11-) and the person's is not, or the step is a known specialist step in the
//            same minor group (LADDER)
//   up       same minor group, entry level above the person's
//   diagonal different minor group, entry level above the person's
//   across   anything else with both levels known (same level; or lower, but not a reset)
// null when the person's level or the target's level is not known and no fork rule holds.
function kindOf(fromOcc, toOcc, personLevel, range, cov) {
  const fs = socOf(fromOcc), ts = socOf(toOcc);
  if (personLevel !== null && range !== null && range[0] <= personLevel - RESET_DROP && cov < RESET_BELOW) return 'reset';
  const same = minorOf(fs) !== null && minorOf(fs) === minorOf(ts);
  if (isManagement(ts) && !isManagement(fs)) return 'fork';
  if (same && LADDER.some(([a, b]) => a === fromOcc.id && b === toOcc.id)) return 'fork';
  if (personLevel === null || range === null) return null;
  if (range[0] > personLevel) return same ? 'up' : 'diagonal';
  return 'across';
}

// Bridges (SPEC 7.4): a greedy cover of the gap weight with up to 3 credentials from the reviewed catalogue. Each round takes the credential
// whose taught skills cover the most gap weight not yet covered (ties: the smaller id). Credentials the person holds and that are still valid
// are left out (they already count); an expired one may come back, marked renew. Without a catalogue: "No reviewed course yet".
function bridgesOf(gap, cat, held, now) {
  const left = gap.map(g => g.id), wOf = new Map(gap.map(g => [g.id, g.w]));
  if (cat === null) return { ids: null, detail: { status: 'no_reviewed_course', items: [], skills: left } };
  const covered = new Set(), chosen = [];
  const cands = [...cat.values()].filter(c => !(held.has(c.id) && !held.get(c.id).expired)).sort((a, b) => cmpStr(a.id, b.id));
  while (chosen.length < MAX_BRIDGES) {
    let best = null, bestGain = 0, bestCovers = null;
    for (const c of cands) {
      if (chosen.some(x => x.c.id === c.id)) continue;
      let g = 0;
      const cv = [];
      for (const id of c.teaches) if (wOf.has(id) && !covered.has(id)) { g += wOf.get(id); cv.push(id); }
      g = q(g, 6);
      if (g > bestGain) { best = c; bestGain = g; bestCovers = cv; }
    }
    if (best === null) break;
    for (const id of bestCovers) covered.add(id);
    chosen.push({ c: best, gain: bestGain, covers: bestCovers });
  }
  const pick = (c, k) => (c[k] === undefined ? null : c[k]);
  const items = chosen.map(({ c, gain, covers }) => ({
    id: c.id, label: typeof c.label === 'string' ? c.label : c.id, issuer: pick(c, 'issuer'),
    covers: left.filter(id => covers.includes(id)), gain: q(gain, 4),
    cost_inr: num(c.cost_inr), hours: num(c.hours), validity_years: num(c.validity_years), url: pick(c, 'official_url'),
    renew: held.has(c.id) && held.get(c.id).expired,
  }));
  return {
    ids: items.map(b => b.id),
    detail: { status: items.length ? 'reviewed' : 'no_reviewed_course', items, skills: left.filter(id => !covered.has(id)) },
  };
}

// Share of a target's openings in places the person accepts (SPEC 5.9), or null when it cannot be judged. PROVISIONAL: the slice contract
// does not fix how city_share is written. This reads the newest city_share whose value is a string 'city:blr=0.42,city:hyd=0.31' and the
// newest numeric remote_share (0 to 1; remote openings suit anyone). Accepted places: the person's city and the city ids in open_to.
// 'open:india' accepts every city, so the flag never rises; with no city and no 'open:remote' there is nothing to compare.
function acceptedShare(signals, limits) {
  const opens = limits.open_to.filter(x => typeof x === 'string');
  if (opens.includes('open:india')) return null;
  const places = new Set(opens.filter(x => x.startsWith('city:')));
  if (typeof limits.city === 'string') places.add(limits.city);
  if (places.size === 0 && !opens.includes('open:remote')) return null;
  const cs = newest(signals, 'city_share', v => typeof v === 'string' && v.includes('='));
  if (cs === null) return null;
  let share = 0;
  for (const part of cs.value.split(',')) {
    const [id, v] = part.split('=');
    const x = Number(v);
    if (places.has(id.trim()) && Number.isFinite(x) && x > 0) share += x;
  }
  const rs = newest(signals, 'remote_share', v => num(v) !== null && v >= 0 && v <= 1);
  return share + (rs === null ? 0 : rs.value);
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

// match(profile, slice, opts) -> {version, release, from, person, weights, stubs, credentials, roads} (SPEC 7).
// opts: {now: year, near: {id: {id: sim}} (default: slice.near), teaches: {cred id: [skill ids]}, credentials: [catalogue entries], walk}.
export function match(profile, slice, opts = {}) {
  opts = opts || {};
  if (slice === null || typeof slice !== 'object' || !slice.occ) throw new TypeError('slice must be an occupation slice');
  const near = nearOf(slice, opts);
  const cat = Array.isArray(opts.credentials) ? catalogue(opts) : null;
  opts = { ...opts, near, nearIndex: nearIndex(near), catalogue: cat || new Map() };
  const p = inputs(profile), have = haves(p, opts), w = weights(p, opts), from = slice.occ.id, now = num(opts.now);
  const person = level(profile), lim = p.limits;
  const held = new Map();
  // Credentials the person holds: expired only if every entry for that id has expired (SPEC 5.8, "expired, renew?").
  for (const c of p.creds) if (typeof c.id === 'string') held.set(c.id, { expired: expiredAt(c, now) && (!held.has(c.id) || held.get(c.id).expired) });
  const payFrom = payOf(slice.signals);
  const floor = num(lim.pay_floor_pct), cap = Object.prototype.hasOwnProperty.call(HOURS_CAP, lim.hours_month) ? HOURS_CAP[lim.hours_month] : null;
  const seen = new Set([from]), roads = [];
  for (const t of arr(slice.targets)) {
    const id = t && t.occ && t.occ.id;
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    const cv = coverWith(have, t.needs, opts), ai = aiObs(t.signals);
    const tl = typicalLevel(t.occ), payTo = payOf(t.signals);
    const change = payFrom !== null && payTo !== null ? payTo / payFrom - 1 : null;
    const pct = change === null ? null : q(change * 100, 2);
    const br = bridgesOf(cv.gap, cat, held, now);
    const flags = new Set();
    if (cap !== null && br.detail.items.length) {
      const hours = br.detail.items.reduce((a, b) => a + (b.hours === null ? 0 : b.hours), 0);
      if (hours > cap * STUDY_MONTHS) flags.add('outside_time');
    }
    if (pct !== null && floor !== null && pct < floor) flags.add('below_pay_floor');
    const share = acceptedShare(t.signals, lim);
    if (share !== null && share < RELOCATE_BELOW) flags.add('needs_relocation');
    roads.push({
      id, label: t.occ.label, via: arr(t.via).slice(),
      new_role: t.occ.new_role === true || id.startsWith('occ:ai-') || id.startsWith('occ:in-'),
      reach: reach(cv.coverage), coverage: cv.coverage,
      raw: {
        pay: change === null
          ? { value: 0.5, status: payFrom === null ? 'not_yet_measured' : 'unknown' }
          : { value: q(Math.min(1, Math.max(0, 0.5 + change / 2)), 4), status: 'measured' },
        ai_safe: ai === null ? { value: 0.5, status: 'unknown' } : { value: q(1 - ai, 4), status: 'measured' },
        short: { value: cv.coverage, status: 'measured' },
        demand: { value: 0.5, status: 'not_yet_measured' },
        enjoy: { value: 0.5, status: 'not_yet_measured' },
      },
      gap: cv.gap,
      kind: kindOf(slice.occ, t.occ, person.level, tl.range, cv.coverage),
      level: { target: tl.range === null ? null : tl.range[0], fit: fitOf(person.years_total, tl.range), range: tl.range, basis: tl.basis },
      flags: FLAGS.filter(f => flags.has(f)),
      bridges: br.ids, bridge_detail: br.detail, pay_change_pct: pct,
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
    bridge_detail: r.bridge_detail, pay_change_pct: r.pay_change_pct,
  }));
  // What is still a stub for this input. Always: the title override (no title text in the profile), demand and interest fit (no data yet).
  const stubs = ['title_override', 'demand', 'enjoy'];
  if (payFrom === null) stubs.push('pay');
  if (cat === null) stubs.push('bridges', 'outside_time');
  if (!arr(slice.targets).some(t => t && newest(t.signals, 'city_share', v => typeof v === 'string' && v.includes('=')) !== null)) stubs.push('needs_relocation');
  return {
    version: MATCHER_VERSION, release: slice.release, from,
    person, weights: w, stubs,
    credentials: [...held].sort((a, b) => cmpStr(a[0], b[0])).map(([id, h]) => ({ id, status: h.expired ? 'expired' : 'valid', renew: h.expired })),
    roads: out,
  };
}
