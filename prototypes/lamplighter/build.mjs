// Builds the self-contained prototype page: node prototypes/lamplighter/build.mjs [outDir]
// Output: <outDir>/lamplighter.html (default: prototypes/lamplighter/dist, git-ignored).
// Optional art: put a JSON map of data-URIs or URLs in prototypes/lamplighter/art.json as
// { "bg": {"s01": "..."}, "obj": {"s01-R": "..."}, "char": {"jyo": "..."} }.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.resolve(process.argv[2] ?? path.join(here, 'dist'));
const require = createRequire(path.join(root, 'apps/web/package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')).href);

const tmp = fs.mkdtempSync(path.join(root, 'node_modules/.lamplighter-'));
const entry = path.join(tmp, 'entry.ts');
fs.writeFileSync(entry, `import vectors from '${root}/pipeline/src/seed/onet-31.0-interest-vectors.json' with { type: 'json' };
export { JOURNEY_BANK, FLASKS, step, undo, journeyResult, displayOptions, careerPaths, compareDreams, teenView } from '${root}/packages/engine/src/index.ts';
export { playJourney, levelsForCode } from '${root}/packages/engine/src/journey/fixtures/personas.ts';
export { vectors };
`);
await build({
  root: tmp, logLevel: 'warn',
  resolve: { alias: { '@margwise/contracts': `${root}/packages/contracts/src/index.ts` } },
  build: { outDir: path.join(tmp, 'dist'), emptyOutDir: true, minify: true, target: 'es2022',
    lib: { entry, name: 'Margwise', formats: ['iife'], fileName: () => 'engine.js' } },
});
const engine = fs.readFileSync(path.join(tmp, 'dist/engine.js'), 'utf8');
const artFile = path.join(here, 'art.json');
const art = fs.existsSync(artFile) ? fs.readFileSync(artFile, 'utf8') : '{ "bg": {}, "obj": {}, "char": {} }';
let html = fs.readFileSync(path.join(here, 'lamplighter.template.html'), 'utf8');
html = html.replace('/*ENGINE*/', () => engine).replace('/*ART*/', () => art);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'lamplighter.html'), html);
fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(['wrote', path.join(out, 'lamplighter.html'), (html.length / 1024).toFixed(0) + ' KB'].join(' ') + '\n');
