// Profile schema upgrades (BACKEND ADR-06). The server upgrades on read and writes only the current v.
// Each step is a pure function from version n to n + 1, added in the same commit that bumps PROFILE_V
// in versions.json and profile.schema.json, with fixtures in contracts/tests/profile_migrations.test.mjs.

export const PROFILE_V = 1;   // must equal versions.json PROFILE_V (checked by the tests)

// STEPS[n] turns a v = n profile into a v = n + 1 profile. Empty while v1 is the only version.
export const STEPS = {};

// upgrade(profile) -> a new profile at PROFILE_V. Never changes its input.
// Throws on a missing or bad v, or a v newer than this code knows (never guess at a future shape).
export function upgrade(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new TypeError('profile must be an object');
  let p = structuredClone(profile);
  if (!Number.isInteger(p.v) || p.v < 1) throw new Error(`profile v must be a whole number from 1, got ${JSON.stringify(p.v)}`);
  if (p.v > PROFILE_V) throw new Error(`profile v${p.v} is newer than this code (v${PROFILE_V})`);
  while (p.v < PROFILE_V) {
    const step = STEPS[p.v];
    if (typeof step !== 'function') throw new Error(`no upgrade step from profile v${p.v}`);
    const from = p.v;
    p = step(p);
    if (!p || p.v !== from + 1) throw new Error(`upgrade step from v${from} must return a v${from + 1} profile`);
  }
  return p;
}
