// Run: node --test contracts/tests/
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validate, checkSchema } from '../validate.js';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pass = (s, v, at) => { const r = validate(s, v, at); assert.ok(r.ok, JSON.stringify(r.errors)); assert.deepEqual(r.errors, []); };
const fail = (s, v, where, msg) => {
  const r = validate(s, v); assert.equal(r.ok, false, `expected ${JSON.stringify(v)} to fail`);
  if (where !== undefined) assert.ok(r.errors.some(e => e.path === where && (!msg || msg.test(e.message))), JSON.stringify(r.errors));
  return r.errors;
};

test('type: each simple type', () => {
  const cases = { string: ['a', 1], number: [1.5, '1'], integer: [3, 3.5], boolean: [false, 0], null: [null, 0], array: [[], {}], object: [{}, []] };
  for (const [t, [good, bad]] of Object.entries(cases)) { pass({ type: t }, good); fail({ type: t }, bad, '$', new RegExp(`must be ${t}`)); }
});
test('type: integer is a number too, and number rejects non-finite values', () => {
  pass({ type: 'number' }, 4); pass({ type: 'integer' }, -0); pass({ type: 'integer' }, 1e3);
  fail({ type: 'number' }, NaN, '$'); fail({ type: 'number' }, Infinity, '$'); fail({ type: 'integer' }, '3', '$');
});
test('type: a list of types', () => {
  const s = { type: ['integer', 'null'] };
  pass(s, 2027); pass(s, null); fail(s, '2027', '$', /integer or null/); fail(s, 1.5, '$');
});
test('type: a wrong type stops the other checks for that value', () => {
  assert.equal(fail({ type: 'string', minLength: 3, pattern: '^a' }, 5).length, 1);
});
test('required and properties', () => {
  const s = { type: 'object', required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'integer' } } };
  pass(s, { a: 'x', b: 1 });
  fail(s, { a: 'x' }, '$.b', /required/);
  fail(s, { a: 1, b: 1 }, '$.a', /must be string/);
  pass({ type: 'object', required: ['n'] }, { n: null });   // present but null still counts as present
});
test('properties: an inherited name is not a present property', () => {
  fail({ type: 'object', required: ['toString'] }, {}, '$.toString', /required/);
});
test('additionalProperties: false rejects unknown keys, true or absent allows them', () => {
  const props = { a: { type: 'string' } };
  fail({ type: 'object', properties: props, additionalProperties: false }, { a: 'x', z: 1 }, '$.z', /not allowed/);
  fail({ type: 'object', properties: props, additionalProperties: false }, JSON.parse('{"__proto__": 1}'), '$.__proto__', /not allowed/);
  pass({ type: 'object', properties: props, additionalProperties: true }, { a: 'x', z: 1 });
  pass({ type: 'object', properties: props }, { a: 'x', z: 1 });
});
test('enum: strings, numbers, booleans, null and structured values', () => {
  const s = { enum: ['a', 1, true, null, [1, 2], { x: 1, y: 2 }] };
  for (const v of ['a', 1, true, null, [1, 2], { y: 2, x: 1 }]) pass(s, v);
  for (const v of ['b', '1', 2, false, [2, 1], { x: 1 }, 1.0001]) fail(s, v, '$', /one of/);
});
test('items, minItems, maxItems', () => {
  const s = { type: 'array', minItems: 1, maxItems: 2, items: { type: 'integer' } };
  pass(s, [1]); pass(s, [1, 2]);
  fail(s, [], '$', /at least 1/); fail(s, [1, 2, 3], '$', /at most 2/); fail(s, [1, 'x'], '$[1]', /integer/);
});
test('pattern uses unicode mode and only applies to strings', () => {
  const s = { pattern: '^occ:[0-9]{2}-[0-9]{4}\\.[0-9]{2}$' };
  pass(s, 'occ:15-2051.00'); fail(s, 'occ:15-2051', '$', /does not match/); fail(s, 'xocc:15-2051.00', '$');
  pass(s, 42);   // not a string, so the pattern does not apply
  pass({ pattern: '^\\p{L}+$' }, 'नमस्ते'.replace(/[ा-्]/g, ''));
});
test('minLength and maxLength count characters, not UTF-16 units', () => {
  const s = { type: 'string', minLength: 2, maxLength: 3 };
  pass(s, 'ab'); pass(s, 'abc'); pass(s, '😀😀😀');
  fail(s, 'a', '$', /at least 2/); fail(s, 'abcd', '$', /at most 3/); fail(s, '😀', '$');
});
test('minimum and maximum are inclusive and only apply to numbers', () => {
  const s = { minimum: -10, maximum: 20 };
  pass(s, -10); pass(s, 20); pass(s, 0.5); pass(s, 'x');
  fail(s, -10.5, '$', /-10 or more/); fail(s, 21, '$', /20 or less/);
});
test('$ref inside the file, including a recursive schema and sibling keywords', () => {
  const s = {
    type: 'object', additionalProperties: false, properties: { a: { $ref: '#/$defs/id' }, tree: { $ref: '#/$defs/node' } },
    $defs: { id: { type: 'string', pattern: '^skl:' }, node: { type: 'object', additionalProperties: false, required: ['n'], properties: { n: { type: 'integer' }, kids: { type: 'array', items: { $ref: '#/$defs/node' } } } } }
  };
  pass(s, { a: 'skl:1', tree: { n: 1, kids: [{ n: 2, kids: [{ n: 3 }] }] } });
  fail(s, { a: 'tec:1' }, '$.a', /does not match/);
  fail(s, { tree: { n: 1, kids: [{ n: 'two' }] } }, '$.tree.kids[0].n', /integer/);
  const sib = { $ref: '#/$defs/s', maxLength: 2, $defs: { s: { type: 'string' } } };
  pass(sib, 'ab'); fail(sib, 'abc', '$', /at most 2/); fail(sib, 3, '$', /string/);
  const root = { type: 'object', additionalProperties: false, properties: { child: { $ref: '#' } } };
  pass(root, { child: { child: {} } }); fail(root, { child: { x: 1 } }, '$.child.x', /not allowed/);
});
test('$ref: a schema that only points at itself ends with an error, not a hang', () => {
  fail({ $ref: '#' }, 1, '$', /too deep/);
});
test('validate against a part of the schema with the at argument', () => {
  const s = { type: 'object', $defs: { d: { type: 'integer', maximum: 3 } } };
  pass(s, 2, '#/$defs/d');
  assert.equal(validate(s, 4, '#/$defs/d').ok, false);
  assert.throws(() => validate(s, 1, '#/$defs/missing'), /not found/);
});
test('errors collect every problem with readable paths', () => {
  const s = { type: 'object', additionalProperties: false, required: ['roles'], properties: { roles: { type: 'array', items: { type: 'object', properties: { occ: { type: 'string' }, 'odd key': { type: 'integer' } } } } } };
  const errs = fail(s, { roles: [{ occ: 1, 'odd key': 'x' }], extra: true });
  assert.deepEqual(errs.map(e => e.path).sort(), ['$.extra', '$.roles[0].occ', '$.roles[0]["odd key"]'].sort());
  for (const e of errs) assert.equal(typeof e.message, 'string');
});
test('the value is never changed', () => {
  const v = { a: [1, { b: 2 }] }, copy = structuredClone(v);
  validate({ type: 'object', properties: { a: { type: 'array', items: { type: ['integer', 'object'] } } } }, v);
  assert.deepEqual(v, copy);
});
test('schemas outside the subset are refused, so nothing looks stricter than it is', () => {
  for (const s of [{ oneOf: [] }, { anyOf: [] }, { const: 1 }, { uniqueItems: true }, { format: 'email' }, { properties: { a: { allOf: [] } } },
    { additionalProperties: { type: 'string' } }, { type: 'date' }, { type: [] }, { enum: [] }, { minLength: -1 }, { minimum: '1' },
    { pattern: '(' }, { $ref: 'other.json#/x' }, { $ref: '#/$defs/nope' }, { items: [{}] }, { required: 'a' }, { $defs: { x: { not: {} } } }])
    assert.throws(() => checkSchema(s), undefined, JSON.stringify(s));
  for (const s of [{}, { title: 't', description: 'd', $comment: 'c', _doc: 'x', examples: [], default: 1, $schema: 's', $id: 'i' }]) checkSchema(s);
});
test('a bad schema throws even when the data would never reach the bad part', () => {
  assert.throws(() => validate({ type: 'object', properties: { a: { oneOf: [] } } }, {}), /unsupported keyword "oneOf"/);
});

// ---- CLI ----
const CLI = path.join(DIR, 'validate.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contracts-'));
const put = (name, o) => { const f = path.join(tmp, name); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const schemaFile = put('s.json', { type: 'object', additionalProperties: false, required: ['n'], properties: { n: { type: 'integer' } } });

test('CLI: exit 0 when every file is valid', () => {
  const r = run(schemaFile, put('a.json', { n: 1 }), put('b.json', { n: 2 }));
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /ok: 2 file/);
});
test('CLI: exit 1 with each error on stderr when a file is invalid', () => {
  const r = run(schemaFile, put('good.json', { n: 1 }), put('bad.json', { n: 'x', z: 1 }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /bad\.json: \$\.n must be integer/); assert.match(r.stderr, /bad\.json: \$\.z is not allowed/);
  assert.doesNotMatch(r.stderr, /good\.json/);
});
test('CLI: exit 2 on usage errors, unreadable JSON and bad schemas', () => {
  assert.equal(run().status, 2);
  assert.equal(run(schemaFile).status, 2);
  assert.equal(run(schemaFile, path.join(tmp, 'missing.json')).status, 2);
  assert.equal(run(schemaFile, put('broken.json', '{"n": ')).status, 2);
  const r = run(put('bad-schema.json', { oneOf: [] }), put('x.json', {}));
  assert.equal(r.status, 2); assert.match(r.stderr, /bad schema/);
});
test('CLI: works on a real contract, as the Python pipeline calls it', () => {
  const r = run(path.join(DIR, 'profile.schema.json'), path.join(DIR, 'examples', 'profile--spec6.json'));
  assert.equal(r.status, 0, r.stderr);
});
test('importing the module runs no CLI', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(CLI)}).then(m => console.log(typeof m.validate))`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), 'function');
});
