// Job title lookup (BUILD_PLAN T4.7). Pure functions, no DOM, so they run in the browser and in node --test.
//   titles.json:      { "normalised title": ["occ:...", ...] }   (SPEC 5.4)
//   occupations.json: [{ id, label, alt: [...], slice: "slices/x.json" | null }]   (written by app/adult/build.py from the slices)
// Step 1 looks the typed title up in titles.json. If that finds nothing, step 2 searches the occupation labels.

// One normal form for titles: lower case, accents removed, "&" read as "and", punctuation turned into spaces.
export function normalise(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const STOP = new Set(['and', 'of', 'the', 'a', 'an', 'for', 'in', 'to', 'sr', 'jr']);
function tokens(s) { return normalise(s).split(' ').filter(t => t && !STOP.has(t)); }
// Light stemming so "engineers" finds "engineer" and "analysts" finds "analyst".
function stem(t) { return t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t; }

// Exact match on the normalised title. Returns occupation ids ([] if none).
export function lookupTitle(titles, typed) {
  const key = normalise(typed);
  if (!key || !titles) return [];
  return Array.isArray(titles[key]) ? titles[key].slice() : [];
}

// Titles that start with, or contain every word of, what the person typed. Used for the "did you mean" list.
// Returns [{ title, occs }], best first, at most `limit`.
export function suggestTitles(titles, typed, limit = 8) {
  const key = normalise(typed);
  if (key.length < 2 || !titles) return [];
  const want = tokens(key).map(stem);
  const out = [];
  for (const t in titles) {
    let rank;
    if (t === key) rank = 0;
    else if (t.startsWith(key)) rank = 1;
    else if (want.length && want.every(w => t.split(' ').some(x => stem(x).startsWith(w)))) rank = 2;
    else continue;
    out.push({ title: t, occs: titles[t], rank });
  }
  out.sort((a, b) => a.rank - b.rank || a.title.length - b.title.length || (a.title < b.title ? -1 : 1));
  return out.slice(0, limit);
}

// Search occupation labels (and their alternative names). Score: whole-phrase hit, then share of the typed words found.
export function searchOccupations(occupations, typed, limit = 8) {
  const key = normalise(typed);
  const want = tokens(key).map(stem);
  if (!key || !want.length || !occupations) return [];
  const scored = [];
  for (const o of occupations) {
    let best = 0;
    for (const name of [o.label].concat(o.alt || [])) {
      const n = normalise(name);
      if (!n) continue;
      let s = 0;
      if (n === key) s = 100;
      else if (n.startsWith(key)) s = 80;
      else if (n.includes(key)) s = 60;
      else {
        const have = new Set(tokens(n).map(stem));
        const hit = want.filter(w => have.has(w) || [...have].some(x => x.startsWith(w))).length;
        if (hit) s = 40 * hit / want.length;
      }
      if (name !== o.label) s -= 1; // the main label wins a tie
      if (s > best) best = s;
    }
    if (best >= 20) scored.push({ o, s: best });
  }
  scored.sort((a, b) => b.s - a.s || (a.o.label < b.o.label ? -1 : 1));
  return scored.slice(0, limit).map(x => x.o);
}

// The full pick list for a typed title: titles.json first, then occupation labels. Returns occupations (deduplicated).
//   { source: 'title' | 'label' | 'none', exact: bool, items: [occupation] }
export function findOccupations(titles, occupations, typed, limit = 8) {
  const byId = new Map((occupations || []).map(o => [o.id, o]));
  const seen = new Set(); const items = [];
  const push = id => { if (!seen.has(id) && byId.has(id)) { seen.add(id); items.push(byId.get(id)); } };
  const exact = lookupTitle(titles, typed);
  exact.forEach(push);
  if (items.length) return { source: 'title', exact: true, items: items.slice(0, limit) };
  suggestTitles(titles, typed, limit).forEach(s => s.occs.forEach(push));
  if (items.length) return { source: 'title', exact: false, items: items.slice(0, limit) };
  searchOccupations(occupations, typed, limit).forEach(o => push(o.id));
  return { source: items.length ? 'label' : 'none', exact: false, items: items.slice(0, limit) };
}
