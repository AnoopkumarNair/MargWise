// Matcher tests (TEST_PLAN layer 2). Run: node --test 'matcher/tests/*.test.mjs'
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { match, coverage, level, MATCHER_VERSION, ALLOWED_INPUT_FIELDS } from '../match.js';
import { versions } from '../../contracts/versions.js';
import { validate } from '../../contracts/validate_lib.js';
import { MATCHER, ROOT, readJson, golden, caseInputs, fixture, q, rng, skillUniverse, randomInput, randomConstraints } from './lib.mjs';
import { check as guardCheck } from './version_guard.mjs';

const G = golden();
const RESULT = readJson(path.join(MATCHER, 'result.schema.json'));
const PROFILE = readJson(path.join(ROOT, 'contracts', 'profile.schema.json'));
const SLICE = readJson(path.join(ROOT, 'contracts', 'slice.schema.json'));
const NEAR = fixture('fixtures/near.json'), TEACHES = fixture('fixtures/teaches.json');
const SEED = 20261029, N = 500;
const R = rng(SEED), U = skillUniverse();
const RANDOM = Array.from({ length: N }, () => randomInput(R, U, NEAR, TEACHES));
const ids = res => res.roads.map(r => r.id);
const covById = res => Object.fromEntries(res.roads.map(r => [r.id, r.coverage]));

test('MATCHER_VERSION equals contracts/versions.js and golden.json', () => {
  assert.equal(MATCHER_VERSION, versions.MATCHER_VERSION);
  assert.equal(G.matcher_version, MATCHER_VERSION);
});

test('fixtures and golden profiles match the frozen contracts', () => {
  for (const f of fs.readdirSync(path.join(MATCHER, 'tests', 'fixtures')).filter(f => f.startsWith('slice_'))) {
    const r = validate(SLICE, fixture('fixtures/' + f));
    assert.ok(r.ok, f + ' ' + JSON.stringify(r.errors));
  }
  for (const c of G.cases) { const r = validate(PROFILE, c.profile); assert.ok(r.ok, c.id + ' ' + JSON.stringify(r.errors)); }
  for (const [p] of RANDOM) { const r = validate(PROFILE, p); assert.ok(r.ok, JSON.stringify(r.errors)); }
});

test('golden: 8 or more cases across at least 4 occupation families', () => {
  assert.ok(G.cases.length >= 8);
  assert.ok(new Set(G.cases.map(c => c.family)).size >= 4);
  assert.equal(new Set(G.cases.map(c => c.id)).size, G.cases.length);
});

test('golden: roads in order, reach, coverage to 2 decimals, flags, person level', () => {
  for (const c of G.cases) {
    const res = match(...caseInputs(c));
    assert.equal(res.person.level, c.expect.person_level, c.id + ' level');
    assert.deepEqual(ids(res), c.expect.roads.map(r => r.id), c.id + ' order');
    res.roads.forEach((r, i) => {
      const e = c.expect.roads[i];
      assert.equal(r.reach, e.reach, `${c.id} ${r.id} reach`);
      assert.equal(q(r.coverage, 2), e.coverage, `${c.id} ${r.id} coverage`);
      assert.deepEqual(r.flags, e.flags, `${c.id} ${r.id} flags`);
    });
  }
});

test('golden: near() is what lifts the LLM evaluation road in swdev-qa-near', () => {
  const c = G.cases.find(x => x.id === 'swdev-qa-near');
  const [p, s, o] = caseInputs(c);
  const withNear = match(p, s, o).roads.find(r => r.id === 'occ:ai-llm-evaluator');
  const without = match(p, s, { ...o, near: undefined }).roads.find(r => r.id === 'occ:ai-llm-evaluator');
  assert.equal(withNear.reach, 'stretch');
  assert.equal(without.reach, 'leap');
  assert.equal(withNear.new_role, true);
});

test('golden: csr-real-near reads skill_near from the slice; opts.near still overrides it', () => {
  const c = G.cases.find(x => x.id === 'csr-real-near');
  const [p, s, o] = caseInputs(c);
  assert.ok(s.near.pairs.length > 100 && !('near' in o));
  const fromSlice = covById(match(p, s, o)), none = covById(match(p, { ...s, near: undefined }, o)), override = covById(match(p, s, { ...o, near: {} }));
  for (const id of Object.keys(fromSlice)) { assert.ok(fromSlice[id] > none[id], id); assert.equal(override[id], none[id], id); }
  assert.deepEqual(match(p, s, o).roads.filter(r => r.reach === 'stretch').map(r => r.id), ['occ:43-4081.00', 'occ:41-9041.00']);
  assert.equal(match(p, { ...s, near: undefined }, o).roads.filter(r => r.reach !== 'leap').length, 0);
  // gap labels are the slice's own need labels
  const t = s.targets.find(x => x.occ.id === 'occ:43-4081.00'), lab = Object.fromEntries(t.needs.map(n => [n.id, n.label]));
  for (const g of match(p, s, o).roads.find(r => r.id === t.occ.id).gap) assert.equal(g.label, lab[g.id]);
});

test('golden: rusty by age, credential credit and expiry, own rating wins', () => {
  const now = { now: 2026 };
  const one = (skills, needs, opts = now, creds) => coverage({ v: 1, roles: [], skills, creds }, needs, opts);
  const need = [{ id: 'tec:x', label: 'X', w: 1, ai: 'mixed' }];
  assert.equal(one([{ id: 'tec:x', strength: 'used', last: 2022 }], need).coverage, 0.4);    // 4 years since last use: rusty
  assert.equal(one([{ id: 'tec:x', strength: 'used', last: 2023 }], need).coverage, 0.7);    // exactly 3 years: still used
  assert.equal(one([{ id: 'tec:x', strength: 'used', last: 2022 }], need, {}).coverage, 0.7); // no 'now': the age rule cannot run
  assert.equal(one([{ id: 'tec:x', strength: 'strong', last: 2000 }], need).coverage, 1);
  const teaches = { 'cred:a': ['tec:x'] };
  assert.equal(one([], need, { now: 2026, teaches }, [{ id: 'cred:a', expires: 2030 }]).coverage, 0.7);
  assert.equal(one([], need, { now: 2026, teaches }, [{ id: 'cred:a', expires: 2025 }]).coverage, 0.4);
  assert.equal(one([], need, { now: 2026, teaches }, [{ id: 'cred:a', expires: null }]).coverage, 0.7);
  assert.equal(one([], need, { now: 2026 }, [{ id: 'cred:a' }]).coverage, 0);                // no teaches data: no credit
  assert.equal(one([{ id: 'tec:x', strength: 'rusty' }], need, { now: 2026, teaches }, [{ id: 'cred:a' }]).coverage, 0.4);
});

test('gap: below 0.7, ordered by weight with the 1.5x boost for "people still do this"', () => {
  const needs = [
    { id: 'skl:a', label: 'A', w: 0.6, ai: 'mixed' }, { id: 'skl:b', label: 'B', w: 0.5, ai: 'people_do' },
    { id: 'skl:c', label: 'C', w: 0.9, ai: 'ai_does_much' }, { id: 'skl:d', label: 'D', w: 0.9, ai: 'mixed' },
  ];
  const r = coverage({ v: 1, roles: [], skills: [{ id: 'skl:c', strength: 'used' }, { id: 'skl:d', strength: 'rusty' }] }, needs, {});
  assert.deepEqual(r.gap.map(g => g.id), ['skl:d', 'skl:b', 'skl:a']);   // 0.9, 0.75, 0.6; skl:c is covered at 0.7
  assert.equal(r.gap[1].priority, 0.75);
});

test('level(): year bands, lead bonus, cap at 6, no title override', () => {
  const L = (roles, lead) => level({ v: 1, roles: roles.map(y => ({ occ: 'occ:13-2011.00', level: 1, industry: 'it', years: y, current: true })), skills: [], lead });
  assert.deepEqual(['0-2', '2-5', '5-8', '8-12', '12-18', '18+'].map(y => L([y]).level), [1, 2, 3, 4, 5, 6]);
  assert.equal(L(['2-5', '2-5']).level, 2);   // 2 + 2 = 4 years
  assert.equal(L(['2-5', '0-2', '5-8']).level, 3);
  assert.equal(L(['5-8'], { people: '6-20', budget: false, expert: false }).level, 4);
  assert.equal(L(['5-8'], { people: '0', budget: true, expert: false }).level, 4);
  assert.equal(L(['5-8'], { people: '1-5', budget: false, expert: true }).level, 3);
  assert.equal(L(['18+'], { people: '21+', budget: true, expert: false }).level, 6);
  assert.equal(L([]).level, null);
  assert.equal(L(['5-8']).title_override, null);
});

test('every output matches matcher/result.schema.json, and every road shows all five components', () => {
  for (const inp of [...G.cases.map(caseInputs), ...RANDOM]) {
    const res = match(...inp);
    const v = validate(RESULT, res);
    assert.ok(v.ok, JSON.stringify(v.errors.slice(0, 3)));
    for (const r of res.roads) assert.deepEqual(Object.keys(r.components), ['pay', 'ai_safe', 'short', 'demand', 'enjoy']);
  }
});

test('property: coverage is between 0 and 1', () => {
  for (const inp of RANDOM) for (const r of match(...inp).roads) assert.ok(r.coverage >= 0 && r.coverage <= 1, String(r.coverage));
});

test('property: adding a skill never lowers any road coverage', () => {
  const r = rng(SEED + 1);
  for (const [p, s, o] of RANDOM) {
    const taught = new Set((p.creds || []).flatMap(c => (o.teaches && o.teaches[c.id]) || []));
    // A rated skill replaces credential credit (SPEC 5.8: the person's own rating wins), so skip skills a held credential teaches.
    const free = U.filter(id => !p.skills.some(k => k.id === id) && !taught.has(id));
    if (!free.length) continue;
    const add = { id: free[Math.floor(r() * free.length)], strength: ['strong', 'used', 'rusty'][Math.floor(r() * 3)] };
    if (r() < 0.5) add.last = 2010 + Math.floor(r() * 17);
    const before = covById(match(p, s, o)), after = covById(match({ ...p, skills: [...p.skills, add] }, s, o));
    for (const id of Object.keys(before)) assert.ok(after[id] >= before[id], `${id} ${before[id]} -> ${after[id]} adding ${add.id}`);
  }
});

test('property: strong >= used >= rusty for the same skill', () => {
  const r = rng(SEED + 2);
  for (const [p, s, o] of RANDOM) {
    const id = U[Math.floor(r() * U.length)], last = r() < 0.5 ? 2010 + Math.floor(r() * 17) : undefined;
    const withS = strength => {
      const sk = { id, strength }; if (last !== undefined) sk.last = last;
      return covById(match({ ...p, skills: [...p.skills.filter(k => k.id !== id), sk] }, s, o));
    };
    const st = withS('strong'), us = withS('used'), ru = withS('rusty');
    for (const k of Object.keys(st)) assert.ok(st[k] >= us[k] && us[k] >= ru[k], `${k}: ${st[k]} ${us[k]} ${ru[k]}`);
  }
});

test('property: priority sliders reorder roads but never add or remove one', () => {
  const r = rng(SEED + 3), slider = () => Math.floor(r() * 6);
  for (const [p, s, o] of RANDOM) {
    const base = ids(match(p, s, o)).slice().sort();
    for (let i = 0; i < 3; i++) {
      const pr = { pay: slider(), ai_safe: slider(), short_move: slider(), demand: slider(), enjoy: slider() };
      assert.deepEqual(ids(match({ ...p, priorities: pr }, s, { ...o, walk: r() < 0.5 })).slice().sort(), base);
    }
  }
});

test('property: constraints and flags never remove a road', () => {
  const r = rng(SEED + 4);
  for (const [p, s, o] of RANDOM) {
    const expected = [...new Set(s.targets.map(t => t.occ.id).filter(id => id !== s.occ.id))].sort();
    for (let i = 0; i < 3; i++) {
      const res = match({ ...p, constraints: randomConstraints(r) }, s, o);
      assert.deepEqual(ids(res).slice().sort(), expected);
      const none = match({ ...p, constraints: undefined }, s, o);
      assert.deepEqual(ids(none).slice().sort(), expected);
    }
  }
});

test('property: the same input gives byte-identical output, and inputs are not changed', () => {
  for (const [p, s, o] of RANDOM) {
    const before = JSON.stringify([p, s, o]);
    const a = JSON.stringify(match(p, s, o)), b = JSON.stringify(match(structuredClone(p), structuredClone(s), structuredClone(o)));
    assert.equal(a, b);
    assert.equal(JSON.stringify([p, s, o]), before);
  }
});

test('reference.py agrees with match.js on every golden case and every random profile', () => {
  const inputs = [...G.cases.map(caseInputs), ...RANDOM];
  const stdin = inputs.map(([profile, slice, opts]) => JSON.stringify({ profile, slice, opts })).join('\n') + '\n';
  const py = spawnSync('python3', [path.join(MATCHER, 'reference.py'), '--jsonl'], { input: stdin, encoding: 'utf8', maxBuffer: 64 << 20 });
  assert.equal(py.status, 0, py.stderr);
  const out = py.stdout.trim().split('\n').map(l => JSON.parse(l));
  assert.equal(out.length, inputs.length);
  inputs.forEach((inp, i) => {
    const js = match(...inp), ref = out[i];
    assert.equal(ref.version, js.version);
    assert.equal(ref.person_level, js.person.level, `input ${i} level`);
    assert.deepEqual(ref.roads.map(r => r.id), ids(js), `input ${i} order`);
    js.roads.forEach((r, k) => {
      const e = ref.roads[k];
      assert.equal(q(e.coverage, 2), q(r.coverage, 2), `input ${i} ${r.id} coverage`);
      assert.equal(e.reach, r.reach, `input ${i} ${r.id} reach`);
      assert.ok(Math.abs(e.score - r.score) < 1e-6, `input ${i} ${r.id} score`);
      assert.deepEqual(e.gap, r.gap.map(g => g.id), `input ${i} ${r.id} gap`);
      assert.deepEqual(e.flags, r.flags);
    });
  });
});

test('reference.py golden check passes from the command line', () => {
  const py = spawnSync('python3', [path.join(MATCHER, 'reference.py')], { encoding: 'utf8' });
  assert.equal(py.status, 0, py.stdout + py.stderr);
});

test('version guard: golden outputs match golden.lock.json for this MATCHER_VERSION', () => {
  assert.deepEqual(guardCheck(), []);
});

test('version guard: a changed output with the same version is caught', () => {
  const lock = readJson(path.join(MATCHER, 'tests', 'golden.lock.json'));
  const id = Object.keys(lock.cases)[0];
  const changed = { ...lock, cases: { ...lock.cases, [id]: '0'.repeat(64) } };
  assert.equal(guardCheck(changed).length, 1);
  const removed = { ...lock, cases: { ...lock.cases, 'gone-case': '0'.repeat(64) } };
  assert.match(guardCheck(removed)[0], /removed/);
});

// ADR-16, invariant 8: the matcher reads only allowed profile fields, and nothing demographic or commercial.
const FORBIDDEN = /\b(age|age_band|birth|birth_year|dob|gender|sex|caste|religion|marital|name|email|phone|address|commission|referral|affiliate|sponsor|partner|paid|advert)\b/;

test('invariant 8 (static): match.js names no demographic or commercial field', () => {
  const src = fs.readFileSync(path.join(MATCHER, 'match.js'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')   // comments may explain the rule
    .replace(/'[^'\n]*'/g, m => (/^'(roles|skills|creds|lead|priorities|constraints)/.test(m) ? m : "''"));   // ignore message strings
  const props = [...src.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
  for (const p of props) assert.doesNotMatch(p, FORBIDDEN, `match.js reads .${p}`);
  assert.doesNotMatch(src, /profile\s*\[/, 'match.js must not read the profile by computed key');
  // Every profile.<field> read names a top-level allowed field.
  const top = new Set(ALLOWED_INPUT_FIELDS.filter(f => !f.includes('.') && !f.includes('[')));
  for (const m of src.matchAll(/\bprofile\.([A-Za-z_]+)/g)) assert.ok(top.has(m[1]), `profile.${m[1]} is not an allowed input`);
  for (const f of ALLOWED_INPUT_FIELDS) assert.doesNotMatch(f, FORBIDDEN, f);
});

// Wraps a value so every property read is recorded as a path like 'skills[].strength'.
function spy(value, seen, at = '') {
  if (value === null || typeof value !== 'object') return value;
  return new Proxy(value, {
    get(t, k, recv) {
      const v = Reflect.get(t, k, recv);
      if (typeof k !== 'string') return v;
      if (Array.isArray(t)) {
        if (/^[0-9]+$/.test(k)) return spy(v, seen, at + '[]');
        return typeof v === 'function' ? v : v;   // length, map, filter and the like
      }
      const p = at ? at + '.' + k : k;
      seen.add(p);
      return spy(v, seen, p);
    },
  });
}

test('invariant 8 (runtime): match(), coverage() and level() read only ALLOWED_INPUT_FIELDS', () => {
  const allowed = new Set(ALLOWED_INPUT_FIELDS);
  const extra = { age_band: '35-44', gender: 'x', commission: 1, referral: 'y' };
  for (const [p, s, o] of [...G.cases.map(caseInputs), ...RANDOM.slice(0, 100)]) {
    const seen = new Set();
    const prof = spy({ ...p, ...extra }, seen);
    match(prof, s, o); coverage(prof, s.needs, o); level(prof);
    const paths = [...seen].map(x => x.replace(/^\[\]\./, ''));
    for (const x of paths) assert.ok(allowed.has(x), `match.js read profile field ${x}`);
  }
});

test('demographic or commercial extras in the profile change nothing', () => {
  for (const [p, s, o] of RANDOM.slice(0, 100)) {
    const a = JSON.stringify(match(p, s, o));
    const b = JSON.stringify(match({ ...p, age_band: '55-64', gender: 'f', commission: 9, referral: 'z' }, s, o));
    assert.equal(a, b);
  }
});
