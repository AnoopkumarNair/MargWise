// The six constraint questions (SPEC 8 screen 7, SPEC 6). Pure data and helpers: no DOM, so a unit test can check them against
// contracts/bands.json. The profile stores the values, never free text (profile.schema.json, constraints).
// These answers never change the order of the roads (ADR-16). They only add flags (outside_time, below_pay_floor, needs_relocation).

export const HOURS = [['0-5', 'Up to 5 hours'], ['5-10', '5 to 10 hours'], ['10-20', '10 to 20 hours'], ['20-40', '20 to 40 hours'], ['40+', 'More than 40 hours']];
export const BUDGET = [['free', 'Free only'], ['up-to-10k', 'Up to ₹10,000'], ['10k-50k', '₹10,000 to ₹50,000'], ['50k-2L', '₹50,000 to ₹2 lakh'], ['2L+', 'More than ₹2 lakh']];
export const CITY_LABEL = {
  'city:blr': 'Bengaluru', 'city:hyd': 'Hyderabad', 'city:pnq': 'Pune', 'city:maa': 'Chennai', 'city:ncr': 'Delhi NCR', 'city:bom': 'Mumbai',
  'city:ccu': 'Kolkata', 'city:amd': 'Ahmedabad', 'city:cjb': 'Coimbatore', 'city:cok': 'Kochi', 'city:jai': 'Jaipur', 'city:idr': 'Indore',
  'city:bbi': 'Bhubaneswar', 'city:vtz': 'Visakhapatnam', 'city:trv': 'Thiruvananthapuram', 'city:ixc': 'Chandigarh', 'city:nag': 'Nagpur',
  'city:mys': 'Mysuru', 'city:other': 'Somewhere else in India',
};
export const CITIES = Object.keys(CITY_LABEL);
// The three choices that are not a city. 'Same city as now' is the person's own city id (bands.json open_to).
export const OPEN_EXTRA = [['open:india', 'Anywhere in India'], ['open:remote', 'Remote only'], ['open:abroad', 'Abroad']];
export const OPEN_ORDER = CITIES.concat(OPEN_EXTRA.map(x => x[0]));
export const PAY_FLOOR = [[-30, 'Up to 30% less than I earn now'], [-20, 'Up to 20% less'], [-10, 'Up to 10% less'], [0, 'No less than I earn now'], [10, 'At least 10% more'], [20, 'At least 20% more']];
export const MODE = [['office', 'In an office'], ['hybrid', 'Hybrid'], ['remote', 'Remote'], ['any', 'No preference']];

// What the profile may hold: only known values, each once. Anything else is dropped, so a bad value never reaches the schema check.
export function cleanConstraints(c) {
  const out = {};
  if (!c || typeof c !== 'object') return out;
  const one = (key, list) => { if (list.some(x => x[0] === c[key])) out[key] = c[key]; };
  one('hours_month', HOURS); one('course_budget', BUDGET); one('pay_floor_pct', PAY_FLOOR); one('mode', MODE);
  if (CITIES.includes(c.city)) out.city = c.city;
  if (Array.isArray(c.open_to)) {
    const set = new Set(c.open_to.filter(x => OPEN_ORDER.includes(x)));
    if (set.size) out.open_to = OPEN_ORDER.filter(x => set.has(x));
  }
  return out;
}

export function labelOf(list, value) { const f = list.find(x => x[0] === value); return f ? f[1] : String(value); }
export function openLabel(id) { return CITY_LABEL[id] || (OPEN_EXTRA.find(x => x[0] === id) || [])[1] || id; }

// One plain line per answer, for the "Your answers" summary on the job-today screen.
export function summaryLines(c) {
  c = cleanConstraints(c); const L = [];
  if (c.hours_month) L.push('Study time: ' + labelOf(HOURS, c.hours_month) + ' a month');
  if (c.course_budget) L.push('Course budget: ' + labelOf(BUDGET, c.course_budget));
  if (c.city) L.push('Your city: ' + CITY_LABEL[c.city]);
  if (c.open_to) L.push('Would work in: ' + c.open_to.map(openLabel).join(', '));
  if (c.pay_floor_pct !== undefined) L.push('Lowest pay change: ' + labelOf(PAY_FLOOR, c.pay_floor_pct));
  if (c.mode) L.push('Work mode: ' + labelOf(MODE, c.mode));
  return L;
}
