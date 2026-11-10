// Command line tool for the contract validator. The library is contracts/validate_lib.js: import that in the browser and on the
// server (this file uses node:fs and node:url, so it must never end up in a Workers or browser bundle).
//   node contracts/validate.js <schema.json> <file.json> [more files...]
//   exit 0 = every file valid, 1 = a file is invalid (errors on stderr), 2 = usage, unreadable file or bad schema.
// It re-exports the library so older Node-only imports keep working.
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validate, checkSchema } from './validate_lib.js';
export { validate, checkSchema };

export function cli(args) {
  if (args.length < 2) { console.error('usage: node contracts/validate.js <schema.json> <file.json> [more files...]'); return 2; }
  const load = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.error(`${f}: cannot read JSON: ${e.message}`); return undefined; } };
  const schema = load(args[0]); if (schema === undefined) return 2;
  try { checkSchema(schema); } catch (e) { console.error(`${args[0]}: bad schema: ${e.message}`); return 2; }
  let bad = 0;
  for (const f of args.slice(1)) {
    const doc = load(f); if (doc === undefined) return 2;
    const r = validate(schema, doc);
    if (!r.ok) { bad++; for (const e of r.errors) console.error(`${f}: ${e.path} ${e.message}`); }
  }
  if (bad) return 1;
  console.log(`ok: ${args.length - 1} file(s) match ${args[0]}`);
  return 0;
}

let main = false; try { main = !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { /* not a file path */ }
if (main) process.exit(cli(process.argv.slice(2)));
