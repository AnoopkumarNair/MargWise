// A small, dependency-free validator for the JSON Schema subset in BACKEND ADR-07.
// This is the library: pure code with no Node imports, so the browser and the Workers bundle can import it.
// The command line tool is contracts/validate.js (node contracts/validate.js <schema.json> <file.json> ...).
//
// Supported keywords: type (string or list; integer, number, string, boolean, null, array, object), required,
// properties, additionalProperties (false or true only), enum, items, prefixItems (one schema per position; with
// maxItems it describes a fixed tuple such as [id, id, number]), minItems, maxItems, pattern,
// minLength, maxLength, minimum, maximum, and $ref within the same file ("#" or "#/$defs/name").
// Annotations ($schema, $id, $defs, $comment, title, description, examples, default, _doc) are ignored.
// Any other keyword is an error, so a schema never looks stricter than it is.

const KEYWORDS = new Set(['type', 'required', 'properties', 'additionalProperties', 'enum', 'items', 'prefixItems', 'minItems', 'maxItems',
  'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', '$ref']);
const ANNOTATIONS = new Set(['$schema', '$id', '$defs', '$comment', 'title', 'description', 'examples', 'default', '_doc']);
const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'null', 'array', 'object']);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const typeOf = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isType = (v, t) => t === 'integer' ? Number.isInteger(v) : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeOf(v) === t;
const nat = v => Number.isInteger(v) && v >= 0;
const show = v => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.length > 60 ? s.slice(0, 57) + '...' : s; };
const key = k => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? '.' + k : '[' + JSON.stringify(k) + ']');

// Canonical JSON, with sorted object keys, so enum values compare by content.
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : isObj(v) ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);

function resolve(root, ref) {
  if (typeof ref !== 'string' || !(ref === '#' || ref.startsWith('#/'))) throw new Error(`$ref must point inside the same file: ${ref}`);
  let s = root;
  for (const part of ref.slice(2).split('/').filter((p, i, a) => a.length > 1 || p)) {
    const k = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObj(s) || !Object.prototype.hasOwnProperty.call(s, k)) throw new Error(`$ref not found: ${ref}`);   // own keys only: never __proto__ or constructor
    s = s[k];
  }
  if (!isObj(s)) throw new Error(`$ref does not point at a schema: ${ref}`);
  return s;
}

// Walks the whole schema once and throws on anything outside the subset.
function check(root, s, at) {
  if (!isObj(s)) throw new Error(`${at}: a schema must be an object`);
  for (const k of Object.keys(s)) if (!KEYWORDS.has(k) && !ANNOTATIONS.has(k)) throw new Error(`${at}: unsupported keyword "${k}"`);
  if ('type' in s) { const ts = Array.isArray(s.type) ? s.type : [s.type]; if (!ts.length || ts.some(t => !TYPES.has(t))) throw new Error(`${at}: bad type ${show(s.type)}`); }
  if ('required' in s && !(Array.isArray(s.required) && s.required.every(r => typeof r === 'string'))) throw new Error(`${at}: required must be a list of names`);
  if ('additionalProperties' in s && typeof s.additionalProperties !== 'boolean') throw new Error(`${at}: additionalProperties must be true or false`);
  if ('enum' in s && !(Array.isArray(s.enum) && s.enum.length)) throw new Error(`${at}: enum must be a non-empty list`);
  for (const k of ['minItems', 'maxItems', 'minLength', 'maxLength']) if (k in s && !nat(s[k])) throw new Error(`${at}: ${k} must be a whole number`);
  for (const k of ['minimum', 'maximum']) if (k in s && !isType(s[k], 'number')) throw new Error(`${at}: ${k} must be a number`);
  if ('pattern' in s) { if (typeof s.pattern !== 'string') throw new Error(`${at}: pattern must be a string`); new RegExp(s.pattern, 'u'); }
  if ('$ref' in s) resolve(root, s.$ref);
  if ('properties' in s) { if (!isObj(s.properties)) throw new Error(`${at}: properties must be an object`); for (const [k, v] of Object.entries(s.properties)) check(root, v, `${at}/properties/${k}`); }
  if ('items' in s) check(root, s.items, `${at}/items`);
  if ('prefixItems' in s) {
    if (!(Array.isArray(s.prefixItems) && s.prefixItems.length)) throw new Error(`${at}: prefixItems must be a non-empty list of schemas`);
    if ('items' in s) throw new Error(`${at}: use prefixItems or items, not both`);   // the two-keyword form of 2020-12 is not in the subset
    s.prefixItems.forEach((x, i) => check(root, x, `${at}/prefixItems/${i}`));
  }
  if ('$defs' in s) { if (!isObj(s.$defs)) throw new Error(`${at}: $defs must be an object`); for (const [k, v] of Object.entries(s.$defs)) check(root, v, `${at}/$defs/${k}`); }
}

const checked = new WeakMap();   // schema -> compiled patterns, so repeated calls stay cheap
export function checkSchema(schema) {
  if (!checked.has(schema)) { check(schema, schema, '#'); checked.set(schema, new Map()); }
  return checked.get(schema);
}

function run(root, s, v, path, errs, rx, depth) {
  if (depth > 200) { errs.push({ path, message: 'schema nesting is too deep (a $ref loop?)' }); return; }
  if (s.$ref) run(root, resolve(root, s.$ref), v, path, errs, rx, depth + 1);
  if ('type' in s) {
    const ts = Array.isArray(s.type) ? s.type : [s.type];
    if (!ts.some(t => isType(v, t))) { errs.push({ path, message: `must be ${ts.join(' or ')}, got ${typeOf(v)}` }); return; }
  }
  if (s.enum && !s.enum.some(e => canon(e) === canon(v))) errs.push({ path, message: `must be one of ${s.enum.map(show).join(', ')}; got ${show(v)}` });
  if (typeof v === 'string') {
    const n = [...v].length;
    if ('minLength' in s && n < s.minLength) errs.push({ path, message: `must be at least ${s.minLength} characters` });
    if ('maxLength' in s && n > s.maxLength) errs.push({ path, message: `must be at most ${s.maxLength} characters` });
    if ('pattern' in s) {
      if (!rx.has(s.pattern)) rx.set(s.pattern, new RegExp(s.pattern, 'u'));
      if (!rx.get(s.pattern).test(v)) errs.push({ path, message: `does not match ${s.pattern}` });
    }
  }
  if (typeof v === 'number') {
    if ('minimum' in s && v < s.minimum) errs.push({ path, message: `must be ${s.minimum} or more` });
    if ('maximum' in s && v > s.maximum) errs.push({ path, message: `must be ${s.maximum} or less` });
  }
  if (Array.isArray(v)) {
    if ('minItems' in s && v.length < s.minItems) errs.push({ path, message: `must have at least ${s.minItems} items` });
    if ('maxItems' in s && v.length > s.maxItems) errs.push({ path, message: `must have at most ${s.maxItems} items` });
    if (s.items) v.forEach((x, i) => run(root, s.items, x, `${path}[${i}]`, errs, rx, depth + 1));
    if (s.prefixItems) s.prefixItems.forEach((ps, i) => { if (i < v.length) run(root, ps, v[i], `${path}[${i}]`, errs, rx, depth + 1); });
  }
  if (isObj(v)) {
    for (const r of s.required || []) if (!Object.prototype.hasOwnProperty.call(v, r)) errs.push({ path: path + key(r), message: 'is required' });
    const props = s.properties || {};
    for (const k of Object.keys(v)) {
      if (Object.prototype.hasOwnProperty.call(props, k)) run(root, props[k], v[k], path + key(k), errs, rx, depth + 1);
      else if (s.additionalProperties === false) errs.push({ path: path + key(k), message: 'is not allowed here' });
    }
  }
}

// validate(schema, value) -> {ok, errors:[{path, message}]}. Paths look like $.roles[0].occ.
// `at` (optional) validates against a part of the schema instead, for example '#/$defs/feedback'.
// Throws only when the schema itself is outside the subset; bad data never throws.
export function validate(schema, value, at = '#') {
  const rx = checkSchema(schema), errs = [];
  run(schema, resolve(schema, at), value, '$', errs, rx, 0);
  return { ok: errs.length === 0, errors: errs };
}
