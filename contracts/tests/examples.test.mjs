// Every example document validates against its schema; every invalid one fails. Run: node --test contracts/tests/
// Naming: contracts/examples/<schema path without .schema.json>--<label>.json, and the same under examples/invalid/.
// Stored events (events.schema.json) are checked in two steps: the envelope, then data against #/$defs/<type>.
// Event requests (api/event/<type>.request.schema.json) are checked in one step against the schema for their file's type, and
// an example named for its body's type must also pass checkEvent (contracts/event_schemas.js), as the handler does.
// email_verify.request is checked whole, then against #/$defs/by_link or by_code.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { validate } from '../validate_lib.js';
import { checkEvent, EVENT_TYPES } from '../event_schemas.js';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.dirname(DIR);
const EX = path.join(DIR, 'examples');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const list = d => fs.readdirSync(d, { recursive: true }).filter(f => f.endsWith('.json')).map(f => f.split(path.sep).join('/')).sort();
const schemaFor = rel => rel.replace(/--[^/]+\.json$/, '.schema.json');
const EVENT_SCHEMAS = new Set(['events.schema.json']);
// email/verify is also two steps: the whole body, then exactly one form (by_link when link is present, else by_code).
const verifyForm = body => body && Object.prototype.hasOwnProperty.call(body, 'link') ? '#/$defs/by_link' : '#/$defs/by_code';

function check(schemaRel, doc) {
  const schema = read(path.join(DIR, schemaRel));
  const r = validate(schema, doc);
  // The handler's path: checkEvent picks the schema by the body's type, so it must agree with the file's schema when the types match.
  if (schemaRel === `api/event/${doc.type}.request.schema.json`) assert.equal(checkEvent(doc).ok, r.ok, `checkEvent disagrees with ${schemaRel}`);
  if (!r.ok) return r;
  if (EVENT_SCHEMAS.has(schemaRel)) return validate(schema, doc.data, '#/$defs/' + doc.type);
  if (schemaRel === 'api/email_verify.request.schema.json') return validate(schema, doc, verifyForm(doc));
  return r;
}

const valid = list(EX).filter(f => !f.startsWith('invalid/'));
const invalid = list(path.join(EX, 'invalid'));

test('every example names an existing schema', () => {
  for (const f of [...valid, ...invalid.map(f => 'invalid/' + f)]) {
    const s = schemaFor(f.replace(/^invalid\//, ''));
    assert.ok(fs.existsSync(path.join(DIR, s)), `${f}: no schema ${s}`);
  }
});
for (const f of valid) test(`valid: ${f}`, () => { const r = check(schemaFor(f), read(path.join(EX, f))); assert.ok(r.ok, JSON.stringify(r.errors, null, 1)); });
for (const f of invalid) test(`invalid: ${f}`, () => { const r = check(schemaFor(f), read(path.join(EX, 'invalid', f))); assert.equal(r.ok, false, 'expected errors'); assert.ok(r.errors.length > 0); });

test('every schema has at least one valid example', () => {
  const schemas = list(DIR).filter(f => f.endsWith('.schema.json') && !f.startsWith('examples/'));
  const covered = new Set(valid.map(schemaFor));
  for (const s of schemas) assert.ok(covered.has(s), `no valid example for ${s}`);
});

// SPEC 6: the profile JSON in the specification itself validates (read from SPEC.md, not a copy).
const SPEC = fs.readFileSync(path.join(ROOT, 'docs', 'adult', 'SPEC.md'), 'utf8');
test('SPEC 6: the profile example in SPEC.md validates, and matches examples/profile--spec6.json', () => {
  const m = SPEC.match(/## 6\. User model[\s\S]*?```json\n([\s\S]*?)```/);
  assert.ok(m, 'SPEC 6 json block not found');
  const doc = JSON.parse(m[1]);
  const r = validate(read(path.join(DIR, 'profile.schema.json')), doc);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(read(path.join(EX, 'profile--spec6.json')), doc);
});

// SPEC 9: every request field named in the API table is a property of that endpoint's request schema.
test('SPEC 9: request fields in the API table match the request schemas', () => {
  const rows = [...SPEC.matchAll(/^\| `(GET|POST|PUT) \/api\/v1\/([a-z/-]+)` \|([^|]*)\|/gm)];
  assert.ok(rows.length >= 11, `found ${rows.length} endpoint rows`);
  for (const [, method, route, req] of rows) {
    const name = route === 'me/profile' ? `me_profile_${method.toLowerCase()}` : route.replace(/[/-]/g, '_');
    // POST /api/v1/event has one strict request schema per event type (deviations D6).
    const files = name === 'event' ? EVENT_TYPES.map(t => path.join(DIR, 'api', 'event', `${t}.request.schema.json`)) : [path.join(DIR, 'api', `${name}.request.schema.json`)];
    assert.ok(files.length, name);
    assert.ok(fs.existsSync(path.join(DIR, 'api', `${name}.response.schema.json`)), `no response schema for ${name}`);
    const fields = [...req.matchAll(/`\{([^}]*)\}`/g)].flatMap(x => x[1].split(',')).map(s => s.split(':')[0].trim()).filter(Boolean);
    for (const file of files) {
      assert.ok(fs.existsSync(file), `no request schema for ${method} ${route} (${path.relative(DIR, file)})`);
      const props = read(file).properties || {};
      for (const f of fields) assert.ok(f in props, `${name}: SPEC 9 field "${f}" is not in ${path.relative(DIR, file)}`);
      if (!fields.length) assert.deepEqual(Object.keys(props), [], `${name}: SPEC 9 lists no body, so the schema should allow none`);
    }
  }
});

test('email_verify: each form requires its own fields and refuses the other form', () => {
  const schema = read(path.join(DIR, 'api', 'email_verify.request.schema.json'));
  assert.deepEqual(schema.$defs.by_code.required, ['email', 'code']); assert.deepEqual(schema.$defs.by_link.required, ['link']);
  for (const k of Object.keys(schema.properties)) assert.ok(k in schema.$defs.by_code.properties || k in schema.$defs.by_link.properties, k);
  for (const [name, d] of Object.entries(schema.$defs)) for (const [k, v] of Object.entries(d.properties)) assert.deepEqual(v, schema.properties[k], `${name}.${k} must equal the top-level field`);
});
