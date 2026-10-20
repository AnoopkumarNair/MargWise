// Initial-JS budget (02 §9.2): ≤ 200 KB gzip for the scripts index.html loads
// eagerly, excluding lazy game chunks. Run after `pnpm build`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 200 * 1024;
const apps = process.argv.slice(2).length ? process.argv.slice(2) : ['apps/web', 'apps/studio'];
let failed = false;

for (const app of apps) {
  const dist = join(app, 'dist');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const eager = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="\/([^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  const total = eager.reduce(
    (sum, file) => sum + gzipSync(readFileSync(join(dist, file))).length,
    0,
  );
  const allJs = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js')).length;
  const kb = (total / 1024).toFixed(1);
  const ok = total <= BUDGET_BYTES;
  failed ||= !ok;
  console.warn(
    `${ok ? 'OK  ' : 'FAIL'} ${app}: initial JS ${kb} KB gzip (budget 200 KB; ${eager.length} eager of ${allJs} chunks)`,
  );
}
process.exit(failed ? 1 : 0);
