// Keeps the embedded copies in api/*.schema.json equal to their source schemas.
// The validator only follows $ref inside one file, so these API schemas carry a copy:
//   profile.schema.json -> $defs.profile in error, me_profile_get.response, me_profile_put.request
//   extract.schema.json -> $defs.extract in ai_read.response
//   events.schema.json  -> the whole of api/event.request.schema.json
// Run: node contracts/sync.mjs          (rewrite the copies)
//      node contracts/sync.mjs --check  (exit 1 if any copy differs; the tests do the same check)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const META = ['$schema', '$id', 'title'];
export const body = s => { const o = { ...s }; for (const k of META) delete o[k]; return o; };

// [api file, where the copy lives ('$defs.<name>' or '*' for the whole file), source file]
export const COPIES = [
  ['api/error.schema.json', '$defs.profile', 'profile.schema.json'],
  ['api/me_profile_get.response.schema.json', '$defs.profile', 'profile.schema.json'],
  ['api/me_profile_put.request.schema.json', '$defs.profile', 'profile.schema.json'],
  ['api/ai_read.response.schema.json', '$defs.extract', 'extract.schema.json'],
  ['api/event.request.schema.json', '*', 'events.schema.json']
];

// Returns [{file, at, source, same, want, doc}] without writing anything.
export function plan() {
  return COPIES.map(([file, at, source]) => {
    const doc = read(file), src = body(read(source));
    let have, want;
    if (at === '*') { have = body(doc); want = { ...src, description: doc.description }; }
    else { const name = at.split('.')[1]; have = doc.$defs[name]; want = src; }
    const same = JSON.stringify(sorted(have)) === JSON.stringify(sorted(want));
    return { file, at, source, same, want, doc };
  });
}
// JSON with 2-space indent, but lists of plain values on one line, so enums stay readable.
export function format(v, ind = '') {
  const next = ind + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(x => x === null || typeof x !== 'object')) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
    return '[\n' + v.map(x => next + format(x, next)).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v); if (!ks.length) return '{}';
    return '{\n' + ks.map(k => next + JSON.stringify(k) + ': ' + format(v[k], next)).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}
const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const check = process.argv.includes('--check'); let bad = 0;
  for (const p of plan()) {
    if (p.same) continue;
    bad++;
    if (check) { console.error(`${p.file}: ${p.at} differs from ${p.source}`); continue; }
    const out = p.at === '*' ? { $schema: p.doc.$schema, $id: p.doc.$id, title: p.doc.title, ...p.want }
      : { ...p.doc, $defs: { ...p.doc.$defs, [p.at.split('.')[1]]: p.want } };
    fs.writeFileSync(path.join(DIR, p.file), format(out) + '\n');
    console.log(`updated ${p.file}`);
  }
  if (check && bad) process.exit(1);
  if (!bad) console.log('all copies match');
}
