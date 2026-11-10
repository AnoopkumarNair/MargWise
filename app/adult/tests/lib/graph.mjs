// Loads the real graph files for intake tests (data/graph/skills_index.json, titles.json, the slices). Test-only.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GRAPH = fileURLToPath(new URL('../../../../data/graph/', import.meta.url));
let cache = null;

export function loadGraph() {
  if (cache) return cache;
  if (!existsSync(GRAPH + 'skills_index.json')) throw new Error('data/graph/skills_index.json is missing. Run the pipeline first.');
  const skillsIndex = JSON.parse(readFileSync(GRAPH + 'skills_index.json', 'utf8'));
  const titles = JSON.parse(readFileSync(GRAPH + 'titles.json', 'utf8'));
  // occupation labels come from the slice files (what the app's occupations.json is built from)
  // (slices are rebuilt by the pipeline and not committed, so in a fresh checkout there may be none: then labels fall back to the title)
  const occupations = [];
  const hasSlices = existsSync(GRAPH + 'slices');
  if (hasSlices) {
    for (const f of readdirSync(GRAPH + 'slices').sort()) {
      if (!f.endsWith('.json')) continue;
      const s = JSON.parse(readFileSync(GRAPH + 'slices/' + f, 'utf8'));
      if (s.occ) occupations.push({ id: s.occ.id, label: s.occ.label });
    }
  }
  const sliceFor = soc => (existsSync(GRAPH + 'slices/' + soc + '.json') ? JSON.parse(readFileSync(GRAPH + 'slices/' + soc + '.json', 'utf8')) : null);
  cache = { skillsIndex, titles, occupations, hasSlices, sliceFor, skillIds: new Set(skillsIndex.map(s => s.id)) };
  return cache;
}
