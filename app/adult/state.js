// In-memory state (slices S1 and S3). Nothing is written to storage and nothing is sent anywhere: reload the page and it is gone.
// The resume path (S3) keeps what the reader found here too, including source lines. Those lines are shown on screen and are never
// put in the profile: buildProfile() below copies ids, bands and numbers only.
import { validate } from './contracts/validate_lib.js';

export const YEARS = ['0-2', '2-5', '5-8', '8-12', '12-18', '18+'];
export const YEARS_LABEL = { '0-2': 'Under 2 years', '2-5': '2 to 5 years', '5-8': '5 to 8 years', '8-12': '8 to 12 years', '12-18': '12 to 18 years', '18+': '18 years or more' };
export const PRIORITIES = [
  ['pay', 'Pay'],
  ['ai_safe', 'Safe from AI'],
  ['short_move', 'Short move'],
  ['demand', 'Demand'],
];

// The sliders when the app starts: the matcher's defaults (SPEC 7.3, owner decision O4). A short move counts three times as much as
// pay, AI safety or demand; the enjoy slider stays at 0 until the interest walk exists.
export const DEFAULT_PRIORITIES = Object.freeze({ pay: 1, ai_safe: 1, short_move: 3, demand: 1, enjoy: 0 });

export const state = {
  manifest: null,   // from ./manifest.json
  occ: null,        // { id, label } the person picked
  slice: null,      // slice of that occupation
  years: '2-5',
  skills: new Map(),// skill id -> 'used' | 'strong' | 'rusty'
  priorities: { ...DEFAULT_PRIORITIES },
  showLeaps: false,
  matcherVersion: null,
  schema: null,
  // Resume path (S3). All of this is memory only.
  path: null,       // 'resume' | 'title' | null
  reading: null,    // what the reader found, then edited on the confirm screen (see intake_profile.js): { roles, skills, creds, warnings, ... }
  roles: null,      // confirmed roles for the profile: [{ occ, level, industry, years, current }]; null on the title path (one role from occ + years)
  skillLast: new Map(), // skill id -> last year used (a number), from the resume
  lead: null,       // { people, budget, expert } or null
  pretick: false,   // title path: the occupation's top needs have been pre-ticked once for this pick
};

export function resetPick() { state.occ = null; state.slice = null; state.skills = new Map(); state.roles = null; state.skillLast = new Map(); state.lead = null; state.reading = null; state.pretick = false; }
// "Start again": drops the resume reading, the picks and the profile. The router calls this on the welcome screen.
export function resetAll() { resetPick(); state.path = null; state.years = '2-5'; state.priorities = { ...DEFAULT_PRIORITIES }; state.showLeaps = false; state.matcherVersion = null; }

// SPEC 7.2: the level starts from the years band (0-2 is level 1 ... 18+ is level 6).
export function levelFromYears(years) { return Math.max(1, YEARS.indexOf(years) + 1); }

export function buildProfile() {
  const p = {
    v: 1,
    roles: state.roles ? state.roles.map(r => ({ occ: r.occ, level: r.level, industry: r.industry, years: r.years, current: r.current })) :
      [{ occ: state.occ.id, level: levelFromYears(state.years), industry: 'other', years: state.years, current: true }],
    skills: [...state.skills].map(([id, strength]) => {
      const o = { id, strength }; const last = state.skillLast.get(id);
      if (Number.isInteger(last) && last >= 1950 && last <= 2100) o.last = last;
      return o;
    }),
    priorities: { ...state.priorities },
    job_release: state.manifest.release_id,
  };
  if (state.lead) p.lead = { people: state.lead.people, budget: !!state.lead.budget, expert: !!state.lead.expert };
  if (state.matcherVersion && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(state.matcherVersion)) p.matcher_version = state.matcherVersion;
  return p;
}

// The profile must match contracts/profile.schema.json before the matcher sees it. Fails closed: if the schema did not load,
// the profile is not checked, so it is refused (data.js tries to load the schema again on the next screen).
export function checkProfile(profile) {
  if (!state.schema) return { ok: false, errors: [{ path: '', message: 'the profile schema did not load, so the profile cannot be checked' }] };
  return validate(state.schema, profile);
}
