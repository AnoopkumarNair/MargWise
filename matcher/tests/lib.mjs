// Shared helpers for the matcher tests: loading golden cases and fixtures, a seeded random profile maker, canonical hashes.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';

export const TESTS = path.dirname(fileURLToPath(import.meta.url));
export const MATCHER = path.dirname(TESTS);
export const ROOT = path.dirname(MATCHER);
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// A fixture file, without its _doc note.
export function fixture(rel) {
  const v = readJson(path.join(TESTS, rel));
  if (v && typeof v === 'object' && !Array.isArray(v)) delete v._doc;
  return v;
}
export const golden = () => readJson(path.join(TESTS, 'golden.json'));

// The (profile, slice, opts) a golden case names. String values for slice, opts.near, opts.teaches and opts.credentials are fixture paths.
export function caseInputs(c) {
  const opts = { ...(c.opts || {}) };
  for (const k of ['near', 'teaches', 'credentials']) if (typeof opts[k] === 'string') opts[k] = fixture(opts[k]);
  if (opts.credentials && !Array.isArray(opts.credentials)) opts.credentials = opts.credentials.credentials;   // {_doc, credentials: [...]}
  return [structuredClone(c.profile), typeof c.slice === 'string' ? fixture(c.slice) : structuredClone(c.slice), opts];
}

// Canonical JSON (sorted keys) and its SHA-256, for the version guard.
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : isObj(v) ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
export const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// Round half up, the same arithmetic as match.js and reference.py.
export const q = (x, d) => Math.floor(x * 10 ** d + 0.5) / 10 ** d;

// mulberry32: a small seeded generator, so the 500 random profiles are the same on every run.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SLICES = ['fixtures/slice_accountant.json', 'fixtures/slice_software_developer.json',
  'fixtures/slice_customer_service.json', 'fixtures/slice_registered_nurse.json',
  'fixtures/slice_qa_analyst.json', 'fixtures/slice_bpm_lead.json', 'fixtures/slice_bfsi_sales.json'];   // the last three: S2 (1.2.0)
const YEARS = ['0-2', '2-5', '5-8', '8-12', '12-18', '18+'];
const STRENGTHS = ['strong', 'used', 'rusty'];
const PEOPLE = ['0', '1-5', '6-20', '21+'];
const CREDS = ['cred:itil4', 'cred:copc', 'cred:aws-saa', 'cred:demo-servicenow', 'cred:demo-python'];
const CITIES = ['city:blr', 'city:hyd', 'city:pnq', 'city:other', 'open:india', 'open:remote', 'open:abroad'];

// Every skill id in the fixtures, plus two that no slice needs.
export function skillUniverse() {
  const ids = new Set(['skl:2.A.1.f', 'tec:in-unknown']);
  for (const s of SLICES) {
    const sl = fixture(s);
    for (const n of sl.needs) ids.add(n.id);
    for (const t of sl.targets) for (const n of t.needs) ids.add(n.id);
  }
  return [...ids].sort();
}

// One random input: a profile that matches contracts/profile.schema.json, a fixture slice, and opts. `credentials` (optional) is a
// credential catalogue for bridges; about half the inputs get it.
export function randomInput(r, universe, near, teaches, credentials) {
  const pick = a => a[Math.floor(r() * a.length)];
  const slicePath = pick(SLICES), sl = fixture(slicePath);
  const roles = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => ({
    occ: i === 0 ? sl.occ.id : pick(sl.targets).occ.id, level: 1 + Math.floor(r() * 6),
    industry: pick(['it', 'bpm', 'bfsi', 'other']), years: pick(YEARS), current: i === 0,
  }));
  const ids = universe.filter(() => r() < 0.25);
  const skills = ids.map(id => {
    const s = { id, strength: pick(STRENGTHS) };
    if (r() < 0.7) s.last = 2010 + Math.floor(r() * 17);
    return s;
  });
  const p = { v: 1, roles, skills };
  if (r() < 0.5) p.creds = CREDS.filter(() => r() < 0.5).map(id => ({ id, year: 2020, expires: r() < 0.3 ? null : 2020 + Math.floor(r() * 10) }));
  if (r() < 0.7) p.lead = { people: pick(PEOPLE), budget: r() < 0.3, expert: r() < 0.5 };
  if (r() < 0.6) p.priorities = { pay: pick([0, 1, 2, 3, 4, 5]), ai_safe: pick([0, 1, 2, 3, 4, 5]), short_move: pick([0, 1, 2, 3, 4, 5]), demand: pick([0, 1, 2, 3, 4, 5]), enjoy: pick([0, 1, 2, 3, 4, 5]) };
  if (r() < 0.5) p.constraints = randomConstraints(r);
  const opts = {};
  if (r() < 0.8) opts.now = 2026;
  if (r() < 0.8) opts.near = Array.isArray(near) ? pick(near) : near;
  if (r() < 0.6) opts.teaches = teaches;
  if (r() < 0.2) opts.walk = true;
  if (credentials && r() < 0.5) opts.credentials = credentials;
  return [p, sl, opts];
}

export function randomConstraints(r) {
  const pick = a => a[Math.floor(r() * a.length)];
  return {
    hours_month: pick(['0-5', '5-10', '10-20', '20-40', '40+']), course_budget: pick(['free', 'up-to-10k', '10k-50k', '50k-2L', '2L+']),
    city: pick(CITIES.slice(0, 4)), open_to: CITIES.filter(() => r() < 0.4), pay_floor_pct: pick([-30, -20, -10, 0, 10, 20]),
    mode: pick(['office', 'hybrid', 'remote', 'any']),
  };
}
