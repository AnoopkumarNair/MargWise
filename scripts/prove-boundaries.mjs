// Proves the boundary lint has teeth: plants a forbidden import (engine → apps/web),
// runs dependency-cruiser, and exits 0 only if the cruise FAILS on that file.
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const planted = 'packages/engine/src/__boundary_probe__.ts';
writeFileSync(
  planted,
  "// deliberate violation, deleted by scripts/prove-boundaries.mjs\nimport { App } from '../../../apps/web/src/App.tsx';\nexport const probe = App;\n",
);
let output = '';
let failed = false;
try {
  execFileSync('pnpm', ['exec', 'depcruise', planted, '--config', '.dependency-cruiser.cjs'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
} catch (error) {
  failed = true;
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
} finally {
  rmSync(planted, { force: true });
}

if (failed && output.includes('engine-only-contracts')) {
  console.warn(output.trim());
  console.warn('\nOK: boundary lint rejected the deliberate engine → apps/web import.');
  process.exit(0);
}
console.error('FAIL: boundary lint did not reject a deliberate engine → apps/web import.');
console.error(output);
process.exit(1);
