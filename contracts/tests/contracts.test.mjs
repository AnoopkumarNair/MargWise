// Consistency between the contract files themselves. Run: node --test contracts/tests/
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { checkSchema } from '../validate_lib.js';
import { plan } from '../sync.mjs';
import { PROFILE_V } from '../profile_migrations.js';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const B = read('bands.json'), V = read('versions.json');
const SCHEMAS = fs.readdirSync(DIR, { recursive: true }).map(f => f.split(path.sep).join('/')).filter(f => f.endsWith('.schema.json') && !f.startsWith('examples/')).sort();
const profile = read('profile.schema.json'), slice = read('slice.schema.json'), events = read('events.schema.json');

// Every object-shaped schema inside a schema, with its path.
function* walk(s, at = '#') {
  if (!s || typeof s !== 'object') return;
  yield [at, s];
  for (const [k, v] of Object.entries(s.properties || {})) yield* walk(v, `${at}/properties/${k}`);
  if (s.items) yield* walk(s.items, `${at}/items`);
  for (const [k, v] of Object.entries(s.$defs || {})) yield* walk(v, `${at}/$defs/${k}`);
}

test('every schema is inside the validator subset and has a title, $id and description', () => {
  assert.ok(SCHEMAS.length >= 28, `found ${SCHEMAS.length} schemas`);
  for (const f of SCHEMAS) {
    const s = read(f); checkSchema(s);
    assert.equal(s.$id, 'contracts/' + f, f); assert.ok(s.title && s.description, f);
  }
});
test('every object schema closes its properties (additionalProperties: false)', () => {
  for (const f of SCHEMAS) for (const [at, s] of walk(read(f)))
    if (s.type === 'object' || s.properties) assert.equal(s.additionalProperties, false, `${f} ${at}`);
});
test('versions.json has the four versions with the right shapes', () => {
  assert.match(V.MATCHER_VERSION, /^\d+\.\d+\.\d+$/);
  for (const k of ['PROFILE_V', 'SLICE_V', 'API_V']) assert.ok(Number.isInteger(V[k]) && V[k] >= 1, k);
  assert.deepEqual(Object.keys(V).filter(k => k !== '_doc').sort(), ['API_V', 'MATCHER_VERSION', 'PROFILE_V', 'SLICE_V']);
});
test('schema versions match versions.json', () => {
  assert.deepEqual(profile.properties.v.enum, [V.PROFILE_V]);
  assert.equal(PROFILE_V, V.PROFILE_V, 'profile_migrations.js PROFILE_V');
  assert.deepEqual(slice.properties.slice_v.enum, [V.SLICE_V]);
});
test('bands.json: every list is documented, non-empty and has no repeats', () => {
  assert.ok(B._doc);
  for (const [k, b] of Object.entries(B)) {
    if (k === '_doc') continue;
    assert.ok(b._doc && Array.isArray(b.values) && b.values.length, k);
    assert.equal(new Set(b.values).size, b.values.length, `${k} repeats a value`);
  }
  for (const c of B.city.values) assert.ok(B.open_to.values.includes(c), `open_to lacks city ${c}`);
});
test('schema enums are exactly the bands.json lists', () => {
  const p = profile.properties, role = p.roles.items.properties, c = p.constraints.properties, d = slice.$defs, ev = events.$defs;
  const pairs = [
    [role.level.enum, 'level'], [role.industry.enum, 'industry'], [role.years.enum, 'years'],
    [p.skills.items.properties.strength.enum, 'strength'], [p.lead.properties.people.enum, 'lead_people'],
    [c.hours_month.enum, 'hours_month'], [c.course_budget.enum, 'course_budget'], [c.city.enum, 'city'],
    [c.open_to.items.enum, 'open_to'], [c.pay_floor_pct.enum, 'pay_floor_pct'], [c.mode.enum, 'mode'],
    [Object.keys(p.priorities.properties), 'priority_keys'], [p.priorities.required, 'priority_keys'],
    [d.need.properties.kind.enum, 'need_kind'], [d.need.properties.ai.enum, 'skill_ai_label'],
    [d.task.properties.ai_mode.enum, 'ai_task_mode'], [d.source.properties.trust.enum, 'trust'],
    [d.occupation.properties.maturity.enum, 'maturity'], [read('skills_index.schema.json').items.properties.kind.enum, 'need_kind'],
    [events.properties.type.enum, 'event_type'], [Object.keys(events.$defs), 'event_type'],
    [ev.intake.properties.source.enum, 'intake_source'], [ev.intake.properties.mode.enum, 'intake_mode'],
    [ev.feedback.properties.about.enum, 'feedback_about'], [ev.road_added.properties.kind.enum, 'road_kind'],
    [ev.road_added.properties.reach.enum, 'road_reach'], [ev.road_added.properties.flags.items.enum, 'road_flag'],
    [read('api/error.schema.json').properties.error.properties.code.enum, 'error_code']
  ];
  for (const [got, band] of pairs) assert.deepEqual(got, B[band].values, band);
  for (const w of Object.values(p.priorities.properties)) assert.deepEqual(w.enum, B.priority_weight.values, 'priority_weight');
});
test('ADR-16: the profile has no demographic or commercial field anywhere', () => {
  const banned = /age|birth|dob|gender|sex|relig|caste|marital|father|mother|name|email|phone|address|pin|salary_now|commission|referr|affiliat|sponsor|partner|price|paid|ad_|vendor|provider/i;
  for (const [at, s] of walk(profile)) for (const k of Object.keys(s.properties || {})) assert.doesNotMatch(k, banned, `profile ${at}/properties/${k}`);
});
test('the profile stores no free text: every string is an id, a band or a version', () => {
  for (const [at, s] of walk(profile)) if (s.type === 'string') assert.ok(s.enum || s.pattern, `free text at profile ${at}`);
});
test('events: the envelope closes data to the union of every type, with the same field schemas', () => {
  const union = events.properties.data.properties, seen = {};
  for (const d of Object.values(events.$defs)) for (const [k, v] of Object.entries(d.properties)) {
    assert.deepEqual(union[k], v, `data.${k}`); seen[k] = 1;
  }
  assert.deepEqual(Object.keys(union).sort(), Object.keys(seen).sort());
  for (const t of ['profile_saved', 'roads_viewed', 'road_opened', 'road_added'])
    for (const k of ['job_release', 'matcher_version']) assert.ok(events.$defs[t].required.includes(k), `${t} must require ${k} (invariant 7)`);
});
test('events: only feedback carries text, capped at 1,500 characters and with no @', () => {
  let n = 0;
  for (const [at, s] of walk(events)) if (s.type === 'string' && !s.enum && (!s.pattern || /\/text$/.test(at))) {
    assert.match(at, /\/text$/, at); assert.equal(s.maxLength, 1500, at); assert.equal(s.pattern, '^[^@]*$', at); n++;
  }
  assert.ok(n >= 2, 'the feedback text field (in data and in $defs.feedback)');
});
test('events: every other string pattern refuses spaces and @, so the invariant checker can tell ids from free text', () => {
  for (const [at, s] of walk(events)) if (s.type === 'string' && s.pattern && !/\/text$/.test(at)) {
    const rx = new RegExp(s.pattern, 'u'); assert.ok(!rx.test('a b') && !rx.test('a@b'), at);
  }
});
test('the nickname refuses @, so an email address cannot be stored as a name', () => {
  const nick = read('api/email_complete.request.schema.json').properties.nickname, rx = new RegExp(nick.pattern, 'u');
  assert.ok(rx.test('Asha')); assert.ok(!rx.test('asha@example.com'));
});
test('embedded copies in api/ match their sources (fix with: node contracts/sync.mjs)', () => {
  for (const p of plan()) assert.ok(p.same, `${p.file} ${p.at} differs from ${p.source}`);
});
test('no request schema accepts a tester id: it always comes from the token', () => {
  for (const f of SCHEMAS.filter(f => f.endsWith('.request.schema.json'))) for (const [at, s] of walk(read(f)))
    for (const k of Object.keys(s.properties || {})) assert.doesNotMatch(k, /tester/i, `${f} ${at}/${k}`);
});
test('versions.js (what code imports) equals versions.json (what other readers use)', async () => {
  const { versions } = await import('../versions.js');
  const { _doc, ...json } = V;
  assert.deepEqual({ ...versions }, json);
  assert.ok(Object.isFrozen(versions));
});
test('every pattern is anchored at both ends, so it checks the whole value', () => {
  for (const f of SCHEMAS) for (const [at, s] of walk(read(f))) if (s.pattern) {
    assert.ok(s.pattern.startsWith('^') && s.pattern.endsWith('$') && !s.pattern.endsWith('\\$'), `${f} ${at}: ${s.pattern}`);
  }
});
test('slice source urls: https only, the whole value, no spaces', () => {
  const rx = new RegExp(slice.$defs.source.properties.url.pattern, 'u');
  for (const ok of ['https://www.onetonline.org/link/details/15-1252.00', 'https://bls.gov', 'https://a.example.org:8443/x?y=1#z']) assert.ok(rx.test(ok), ok);
  for (const bad of ['http://bls.gov', 'https://', 'https://bls.gov/a b', 'https://bls.gov\njavascript:x', 'javascript:alert(1)//https://x.org', 'https://localhost']) assert.ok(!rx.test(bad), bad);
});
