import { writeFileSync } from 'node:fs';
import { buildOpenApi } from '../src/openapi.ts';

const out = new URL('../openapi/openapi.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.warn(`wrote ${out.pathname}`);
