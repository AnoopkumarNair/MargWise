// Loads the graph files for the release in ./manifest.json (BACKEND ADR-12: the app and its data always carry the same release id).
// These are plain GET requests for static files. Nothing about the person is sent.
import { state } from './state.js';

async function getJson(url, init) {
  const r = await fetch(url, Object.assign({ credentials: 'omit' }, init));
  if (!r.ok) throw new Error(url + ' returned ' + r.status);
  return r.json();
}

let pTitles = null; let pOccs = null; let pSkills = null;
const slices = new Map();

export async function loadManifest() {
  if (!state.manifest) {
    const m = await getJson('manifest.json', { cache: 'no-cache' });
    // ADR-12: this page and its data must come from the same release. If they differ, a deploy happened mid-visit: reload.
    const meta = document.querySelector('meta[name="mw-release"]');
    if (!meta || meta.content !== m.release_id) throw new Error('page and data are from different releases');
    state.manifest = m;
  }
  if (!state.schema) { try { state.schema = await getJson('contracts/profile.schema.json'); } catch (e) { state.schema = null; } }
  return state.manifest;
}
function base() { return state.manifest.graph.base; }

export function loadTitles() { return pTitles || (pTitles = loadManifest().then(() => getJson(base() + 'titles.json')).catch(e => { pTitles = null; throw e; })); }
export function loadOccupations() { return pOccs || (pOccs = loadManifest().then(() => getJson(base() + 'occupations.json')).catch(e => { pOccs = null; throw e; })); }
// The skills dictionary (about 0.9 MB). Loaded only when the person reads a resume or adds a skill by name.
export function loadSkillsIndex() { return pSkills || (pSkills = loadManifest().then(() => getJson(base() + 'skills_index.json')).catch(e => { pSkills = null; throw e; })); }
export async function loadSlice(file) {
  await loadManifest();
  if (!slices.has(file)) slices.set(file, await getJson(base() + file));
  return slices.get(file);
}
