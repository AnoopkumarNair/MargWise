// CLAUDE.md rule 8 / 04 §10: golden JSON may change only together with the
// spreadsheet it is exported from. Fails if docs/golden/*.json changed against
// the base ref while docs/golden/golden-cases.xlsx did not.
import { execFileSync } from 'node:child_process';

const base = process.argv[2] ?? 'origin/main';
const changed = execFileSync(
  'git',
  ['diff', '--name-only', `${base}...HEAD`, '--', 'docs/golden'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);
const json = changed.filter((f) => f.endsWith('.json'));
const sheet = changed.includes('docs/golden/golden-cases.xlsx');

if (json.length > 0 && !sheet) {
  console.error(`Golden JSON changed without the spreadsheet: ${json.join(', ')}`);
  console.error('Golden values change only when Anu updates docs/golden/golden-cases.xlsx.');
  process.exit(1);
}
console.warn(
  `golden provenance OK (${json.length} JSON file(s) changed, spreadsheet ${sheet ? 'changed' : 'unchanged'})`,
);
