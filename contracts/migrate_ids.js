// Maps a profile's graph ids through the id registry on read (BACKEND ADR-05). Shared by the browser and the server.
//
// migrateIds(profile, registry) -> {profile, mapped, dropped, unknown, merged, changed}
//   registry: the parsed data/graph/id_registry.json ({registry_version, entries: [...]}), a plain array of entries
//             {id, kind, label, first_release, status: 'live'|'tombstone', replaced_by: [ids]|null, note},
//             or a Map from id to entry (build one with registryMap() to reuse it across calls).
//   profile:  the new profile, with tombstoned ids replaced. The input is never changed.
//   mapped:   [{from, to:[ids], field}] for every tombstone that had a replacement. field is 'roles', 'skills' or 'creds'.
//             For roles it also has index (the role's position in the returned roles list), and pick: true when the
//             occupation was split: the role takes the first replacement and the app asks the person which one fits.
//   dropped:  ids removed because their tombstone has no replacement ("Please re-check these skills").
//   unknown:  ids not in the registry at all. They are kept as they are and only reported, so an empty or
//             incomplete registry can never empty a profile. The server rejects unknown ids on write instead.
//   merged:   [{field, id, entry}] for every skill or credential entry removed because another entry has the same id after
//             mapping. entry is the removed entry, so nothing disappears without a report.
//   changed:  true when the returned profile differs from the input.
//
// Rules: chains of tombstones are followed; a loop or a chain deeper than 20 counts as no replacement.
// Roles are never merged: two roles may share an occupation (the same job at two employers), so each role stays.
// Skills with the same id: an entry the person gave directly wins over a mapped one; between mapped skills the stronger
// one wins (strong > used > rusty), then the later year; otherwise the first stays.
// Credentials with the same id: the one with the latest year stays (a missing year counts as oldest); on a tie a direct entry
// wins over a mapped one, then the first stays.

const RANK = { strong: 3, used: 2, rusty: 1 };

export function registryMap(registry) {
  if (registry instanceof Map) return registry;
  const list = Array.isArray(registry) ? registry
    : registry && typeof registry === 'object' && Array.isArray(registry.entries) ? registry.entries : null;
  if (!list) throw new TypeError('registry must be {registry_version, entries: [...]}, an array of entries or a Map');
  const m = new Map();
  for (const e of list) if (e && typeof e.id === 'string') m.set(e.id, e);
  return m;
}
// -> {ids:[final live or unknown ids], unknown:[ids]}. An empty ids list means "no replacement".
function resolve(reg, id, seen = new Set(), depth = 0) {
  const e = reg.get(id);
  if (!e) return { ids: [id], unknown: [id] };
  if (e.status !== 'tombstone') return { ids: [id], unknown: [] };
  if (seen.has(id) || depth > 20 || !Array.isArray(e.replaced_by) || !e.replaced_by.length) return { ids: [], unknown: [] };
  seen = new Set(seen).add(id);
  const ids = [], unknown = [];
  for (const r of e.replaced_by) {
    const x = resolve(reg, r, seen, depth + 1);
    for (const i of x.ids) if (!ids.includes(i)) ids.push(i);
    for (const u of x.unknown) if (!unknown.includes(u)) unknown.push(u);
  }
  return { ids, unknown };
}

const better = (a, b) => (RANK[a.strength] || 0) - (RANK[b.strength] || 0) || (a.last || 0) - (b.last || 0);
const yearOf = c => (Number.isInteger(c.year) ? c.year : -Infinity);

// Should `next` (direct or not) replace `cur` for the same id?
function wins(field, next, nextDirect, cur) {
  if (field === 'skills') return cur.direct ? false : nextDirect || better(next, cur.entry) > 0;
  /* creds */ const d = yearOf(next) - yearOf(cur.entry);
  return d > 0 || (d === 0 && nextDirect && !cur.direct);
}

export function migrateIds(profile, registry) {
  const reg = registryMap(registry);
  const out = structuredClone(profile);
  const mapped = [], dropped = [], unknown = [], merged = [];
  const note = (list, id) => { if (!list.includes(id)) list.push(id); };

  if (Array.isArray(out.roles)) {   // roles: one in, at most one out; never merged
    const roles = [];
    for (const entry of out.roles) {
      const id = entry && entry.occ;
      if (typeof id !== 'string') { roles.push(entry); continue; }
      const r = resolve(reg, id);
      for (const u of r.unknown) note(unknown, u);
      if (r.ids.length === 1 && r.ids[0] === id) { roles.push(entry); continue; }
      if (!r.ids.length) { note(dropped, id); continue; }
      const m = { from: id, to: r.ids, field: 'roles', index: roles.length };
      if (r.ids.length > 1) m.pick = true;
      roles.push({ ...entry, occ: r.ids[0] }); mapped.push(m);
    }
    out.roles = roles;
  }

  for (const field of ['skills', 'creds']) {
    if (!Array.isArray(out[field])) continue;
    const kept = new Map();   // id -> {entry, direct}
    const order = [];
    const put = (entry, direct) => {
      const id = entry.id, cur = kept.get(id);
      if (!cur) { kept.set(id, { entry, direct }); order.push(id); return; }
      if (wins(field, entry, direct, cur)) { merged.push({ field, id, entry: cur.entry }); kept.set(id, { entry, direct }); }
      else merged.push({ field, id, entry });
    };
    for (const entry of out[field]) {
      const id = entry && entry.id;
      if (typeof id !== 'string') { const k = Symbol('bad'); kept.set(k, { entry, direct: true }); order.push(k); continue; }
      const r = resolve(reg, id);
      for (const u of r.unknown) note(unknown, u);
      if (r.ids.length === 1 && r.ids[0] === id) { put(entry, true); continue; }
      if (!r.ids.length) { note(dropped, id); continue; }
      for (const to of r.ids) put({ ...entry, id: to }, false);
      mapped.push({ from: id, to: r.ids, field });
    }
    out[field] = order.map(id => kept.get(id).entry);
  }
  return { profile: out, mapped, dropped, unknown, merged, changed: JSON.stringify(out) !== JSON.stringify(profile) };
}
