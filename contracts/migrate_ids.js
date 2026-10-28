// Maps a profile's graph ids through the id registry on read (BACKEND ADR-05). Shared by the browser and the server.
//
// migrateIds(profile, registry) -> {profile, mapped, dropped, unknown, changed}
//   registry: an array of entries {id, kind, label, first_release, status: 'live'|'tombstone', replaced_by: [ids]|null, note},
//             or a Map from id to entry (build one with registryMap() to reuse it across calls).
//   profile:  the new profile, with tombstoned ids replaced. The input is never changed.
//   mapped:   [{from, to:[ids], field}] for every tombstone that had a replacement. field is 'roles', 'skills' or 'creds'.
//             A role whose occupation was split takes the first replacement and is also marked pick: true,
//             so the app can ask the person which one fits.
//   dropped:  ids removed because their tombstone has no replacement ("Please re-check these skills").
//   unknown:  ids not in the registry at all. They are kept as they are and only reported, so an empty or
//             incomplete registry can never empty a profile. The server rejects unknown ids on write instead.
//   changed:  true when the returned profile differs from the input.
//
// Rules: chains of tombstones are followed; a loop or a chain deeper than 20 counts as no replacement.
// When two entries end up with the same id, an entry the person gave directly wins over a mapped one;
// between mapped skills the stronger one wins (strong > used > rusty), then the later year.

const RANK = { strong: 3, used: 2, rusty: 1 };

export function registryMap(registry) {
  if (registry instanceof Map) return registry;
  if (!Array.isArray(registry)) throw new TypeError('registry must be an array of entries or a Map');
  const m = new Map();
  for (const e of registry) if (e && typeof e.id === 'string') m.set(e.id, e);
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

export function migrateIds(profile, registry) {
  const reg = registryMap(registry);
  const out = structuredClone(profile);
  const mapped = [], dropped = [], unknown = [];
  const note = (list, id) => { if (!list.includes(id)) list.push(id); };

  // Lists of {id-field, entries}. Each entry becomes 0..n entries.
  const lists = [['roles', 'occ'], ['skills', 'id'], ['creds', 'id']];
  for (const [field, idKey] of lists) {
    if (!Array.isArray(out[field])) continue;
    const kept = new Map();   // id -> {entry, direct}
    const order = [];
    const put = (entry, direct) => {
      const id = entry[idKey], cur = kept.get(id);
      if (!cur) { kept.set(id, { entry, direct }); order.push(id); return; }
      if (cur.direct) return;
      if (direct || (field === 'skills' && better(entry, cur.entry) > 0)) kept.set(id, { entry, direct });
    };
    for (const entry of out[field]) {
      const id = entry && entry[idKey];
      if (typeof id !== 'string') { const k = Symbol('bad'); kept.set(k, { entry, direct: true }); order.push(k); continue; }
      const r = resolve(reg, id);
      for (const u of r.unknown) note(unknown, u);
      if (r.ids.length === 1 && r.ids[0] === id) { put(entry, true); continue; }
      if (!r.ids.length) { note(dropped, id); continue; }
      const m = { from: id, to: r.ids, field };
      if (field === 'roles') {
        if (r.ids.length > 1) m.pick = true;
        put({ ...entry, [idKey]: r.ids[0] }, false);
      } else for (const to of r.ids) put({ ...entry, [idKey]: to }, false);
      mapped.push(m);
    }
    out[field] = order.map(id => kept.get(id).entry);
  }
  return { profile: out, mapped, dropped, unknown, changed: JSON.stringify(out) !== JSON.stringify(profile) };
}
