// RULES.md rule 8 / 04 §10: golden values change only when the spreadsheet does.
// 1. If golden JSON changed against the base ref, the workbook must have changed too.
// 2. The JSON must record the SHA-256 of the committed workbook (it was exported from it).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const WORKBOOK = 'docs/golden/golden-cases.xlsx';
const JSON_FILES = ['packages/engine/src/golden/golden-cases.json'];
const base = process.argv[2];

if (base) {
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', `${base}...HEAD`, '--', 'docs/golden', 'packages/engine/src/golden'],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  const json = changed.filter((f) => f.endsWith('.json'));
  if (json.length > 0 && !changed.includes(WORKBOOK)) {
    console.error(`Golden JSON changed without the workbook: ${json.join(', ')}`);
    console.error('Golden values change only when Anu updates docs/golden/golden-cases.xlsx.');
    process.exit(1);
  }
}

const sha = createHash('sha256').update(readFileSync(WORKBOOK)).digest('hex');
for (const file of JSON_FILES) {
  const recorded = JSON.parse(readFileSync(file, 'utf8')).sourceSha256;
  if (recorded !== sha) {
    console.error(
      `${file} was not exported from the committed workbook (recorded ${recorded}, workbook ${sha}).`,
    );
    console.error('Re-run scripts/golden/build_golden.py → recalc → export_golden.py.');
    process.exit(1);
  }
}
console.warn(`golden provenance OK (workbook ${sha.slice(0, 12)}…)`);
