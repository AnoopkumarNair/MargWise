// The id list of the release the app was built with (SPEC 9, BACKEND ADR-05, ADR-12): which skill, technology, occupation and credential ids exist,
// and the id registry that maps retired ids. Loaded with env.ASSETS.fetch from the files the app build copies into /work/graph/<release>/, kept
// in memory per release id, never bundled (the Workers bundle must stay small).
//   /work/manifest.json                    -> release_id and graph.base ("graph/<release_id>/")
//   <base>ids.json                         -> {ids:[...]}  all live ids (preferred; the data lane may publish it)
//   or <base>skills_index.json ([{id}]) + <base>occupations.json ([{id}]) + optional <base>credentials.json ([{id}])
//   <base>id_registry.json (optional)      -> {registry_version, entries:[...]}  for mapping retired ids on read
// If the manifest or the ids cannot be read, loadRelease returns null and the caller fails closed (a write answers `unavailable`).
import { registryMap } from '../../contracts/migrate_ids.js';

const TTL = 5 * 60000;
const cache = new Map();   // release_id -> {at, value}
export const clearReleaseCache = () => cache.clear();
const REL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, BASE_RE = /^graph\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/$/;

async function getJson(deps, path) {
  try { const res = await deps.assets.fetch(new Request('https://assets.invalid' + path)); if (!res || !res.ok) return null; return await res.json(); } catch { return null; }
}
const idsOf = list => (Array.isArray(list) ? list.map(x => (x && typeof x === 'object' ? x.id : x)).filter(x => typeof x === 'string') : null);

export async function loadRelease(deps) {
  if (!deps.assets || typeof deps.assets.fetch !== 'function') return null;
  const man = await getJson(deps, '/work/manifest.json');
  const rel = man && man.release_id, base = man && man.graph && man.graph.base;
  if (typeof rel !== 'string' || !REL_RE.test(rel) || typeof base !== 'string' || !BASE_RE.test(base)) return null;
  const hit = cache.get(rel); if (hit && deps.now() - hit.at < TTL) return hit.value;
  const prefix = '/work/' + base;
  let ids = null;
  const direct = await getJson(deps, prefix + 'ids.json');
  if (direct && Array.isArray(direct.ids)) ids = idsOf(direct.ids);
  else {
    const sk = idsOf(await getJson(deps, prefix + 'skills_index.json')), oc = idsOf(await getJson(deps, prefix + 'occupations.json'));
    if (sk && oc) { const cr = idsOf(await getJson(deps, prefix + 'credentials.json')); ids = [...sk, ...oc, ...(cr || [])]; }
  }
  if (!ids || !ids.length) return null;   // an empty list would reject every profile; treat it as "not loaded"
  let registry = null;
  const reg = await getJson(deps, prefix + 'id_registry.json');
  if (reg) { try { registry = registryMap(reg); } catch { registry = null; } }
  const value = { release: rel, ids: new Set(ids), registry };
  cache.set(rel, { at: deps.now(), value }); return value;
}

// Every graph id a profile holds (roles, skills, credentials). The city, band and level fields are enums in the contract, so they need no list.
export function profileIds(p) {
  return [...(p.roles || []).map(r => r.occ), ...(p.skills || []).map(s => s.id), ...(p.creds || []).map(c => c.id)];
}
export const unknownIds = (p, set) => [...new Set(profileIds(p).filter(id => !set.has(id)))];
