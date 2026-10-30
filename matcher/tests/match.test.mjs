// Matcher tests (TEST_PLAN layer 2). Run: node --test 'matcher/tests/*.test.mjs'
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { match, coverage, level, MATCHER_VERSION, ALLOWED_INPUT_FIELDS, LADDER } from '../match.js';
import { versions } from '../../contracts/versions.js';
import { validate } from '../../contracts/validate_lib.js';
import { MATCHER, ROOT, readJson, golden, caseInputs, fixture, q, rng, skillUniverse, randomInput, randomConstraints } from './lib.mjs';
import { check as guardCheck } from './version_guard.mjs';

const G = golden();
const RESULT = readJson(path.join(MATCHER, 'result.schema.json'));
const PROFILE = readJson(path.join(ROOT, 'contracts', 'profile.schema.json'));
const SLICE = readJson(path.join(ROOT, 'contracts', 'slice.schema.json'));
const NEAR = fixture('fixtures/near.json'), NEAR_RANK = fixture('fixtures/near_rank.json'), TEACHES = fixture('fixtures/teaches.json');
const CATALOGUE = fixture('fixtures/credentials.json').credentials;
const SEED = 20261029, N = 500;
const R = rng(SEED), U = skillUniverse();
const RANDOM = Array.from({ length: N }, () => randomInput(R, U, [NEAR, NEAR_RANK], TEACHES, CATALOGUE));
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

test('golden: 15 or more cases across at least 5 occupation families (BUILD_PLAN T2.4)', () => {
  assert.ok(G.cases.length >= 15);
  assert.ok(new Set(G.cases.map(c => c.family.replace(/, real-shape slice$/, ''))).size >= 5);
  assert.equal(new Set(G.cases.map(c => c.id)).size, G.cases.length);
});

test('golden: roads in order, reach, coverage to 2 decimals, kind, target level, fit, flags, bridges, person level', () => {
  for (const c of G.cases) {
    const res = match(...caseInputs(c));
    assert.equal(res.person.level, c.expect.person_level, c.id + ' level');
    assert.deepEqual(ids(res), c.expect.roads.map(r => r.id), c.id + ' order');
    res.roads.forEach((r, i) => {
      const e = c.expect.roads[i];
      assert.equal(r.reach, e.reach, `${c.id} ${r.id} reach`);
      assert.equal(q(r.coverage, 2), e.coverage, `${c.id} ${r.id} coverage`);
      assert.equal(r.kind, e.kind, `${c.id} ${r.id} kind`);
      assert.equal(r.level.target, e.target, `${c.id} ${r.id} target level`);
      assert.equal(r.level.fit, e.fit, `${c.id} ${r.id} fit`);
      assert.deepEqual(r.flags, e.flags, `${c.id} ${r.id} flags`);
      assert.deepEqual(r.bridges, e.bridges, `${c.id} ${r.id} bridges`);
    });
  }
});

test('golden (S2): the cases BUILD_PLAN T2.4, T1.8 and TEST_PLAN layer 2 ask for are there', () => {
  const all = G.cases.map(c => [c, match(...caseInputs(c))]);
  const roads = all.flatMap(([c, res]) => res.roads.map(r => ({ c, r })));
  const kinds = new Set(roads.map(x => x.r.kind));
  for (const k of ['up', 'across', 'diagonal', 'reset', 'fork']) assert.ok(kinds.has(k), 'no golden road of kind ' + k);
  // a profile with rusty skills
  assert.ok(G.cases.some(c => c.profile.skills.some(s => s.strength === 'rusty' || (s.last && s.last < 2023 && s.strength !== 'strong'))));
  // every road below the pay floor, and none hidden
  const [pf, pfRes] = all.find(([c]) => c.id === 'bfsi-pay-floor');
  assert.ok(pfRes.roads.length >= 5 && pfRes.roads.every(r => r.flags.includes('below_pay_floor') && r.components.pay.status === 'measured'));
  assert.equal(pfRes.roads.length, caseInputs(pf)[1].targets.length);
  // roads into new AI-era roles: one close move, one reset
  assert.ok(roads.some(x => x.r.new_role && x.r.reach === 'adjacent'));
  assert.ok(roads.some(x => x.r.new_role && x.r.kind === 'reset'));
  // a certification closes a gap; an expired one is labelled renew and offered again as a bridge
  const [cc, ccRes] = all.find(([c]) => c.id === 'csr-cert-bridge'), [p, s, o] = caseInputs(cc);
  const without = match({ ...p, creds: [] }, s, o).roads.find(r => r.id === 'occ:15-1232.00');
  const withCert = ccRes.roads.find(r => r.id === 'occ:15-1232.00');
  assert.ok(without.gap.some(g => g.id === 'tec:servicenow') && !withCert.gap.some(g => g.id === 'tec:servicenow'));
  assert.ok(without.reach !== 'adjacent' && withCert.reach === 'adjacent');
  assert.ok(!ccRes.roads.some(r => (r.bridges || []).includes('cred:demo-servicenow')), 'a valid held credential is never a bridge');
  const [, bl] = all.find(([c]) => c.id === 'bpm-lead-reset');
  assert.deepEqual(bl.credentials, [{ id: 'cred:copc', status: 'expired', renew: true }]);
  assert.ok(bl.roads.some(r => r.bridge_detail.items.some(b => b.id === 'cred:copc' && b.renew === true)));
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
  assert.ok(s.near.pairs.length > 50 && !('near' in o));
  const fromSlice = covById(match(p, s, o)), none = covById(match(p, { ...s, near: undefined }, o)), override = covById(match(p, s, { ...o, near: {} }));
  for (const id of Object.keys(fromSlice)) { assert.ok(fromSlice[id] > none[id], id); assert.equal(override[id], none[id], id); }
  // Matcher 1.1.0 (used 0.85, near only from the 3 closest at 0.90 or more) on the exported slice (tool weights capped): one road is a
  // stretch with the slice's near pairs, none without them
  assert.deepEqual(match(p, s, o).roads.filter(r => r.reach !== 'leap').map(r => [r.id, r.coverage]), [['occ:43-4041.00', 0.4087]]);
  assert.equal(match(p, { ...s, near: undefined }, o).roads.filter(r => r.reach !== 'leap').length, 0);
  // the export keeps only pairs that can count: 0.90 or more (owner decision O2)
  assert.ok(s.near.pairs.every(([, , w]) => w >= 0.9));
  // gap labels are the slice's own need labels
  const t = s.targets.find(x => x.occ.id === 'occ:43-4081.00'), lab = Object.fromEntries(t.needs.map(n => [n.id, n.label]));
  for (const g of match(p, s, o).roads.find(r => r.id === t.occ.id).gap) assert.equal(g.label, lab[g.id]);
});

test('golden: rusty by age, credential credit and expiry, own rating wins', () => {
  const now = { now: 2026 };
  const one = (skills, needs, opts = now, creds) => coverage({ v: 1, roles: [], skills, creds }, needs, opts);
  const need = [{ id: 'tec:x', label: 'X', w: 1, ai: 'mixed' }];
  assert.equal(one([{ id: 'tec:x', strength: 'used', last: 2022 }], need).coverage, 0.4);    // 4 years since last use: rusty
  assert.equal(one([{ id: 'tec:x', strength: 'used', last: 2023 }], need).coverage, 0.85);   // exactly 3 years: still used (owner decision O1)
  assert.equal(one([{ id: 'tec:x', strength: 'used', last: 2022 }], need, {}).coverage, 0.85); // no 'now': the age rule cannot run
  assert.equal(one([{ id: 'tec:x', strength: 'strong', last: 2000 }], need).coverage, 1);
  const teaches = { 'cred:a': ['tec:x'] };
  assert.equal(one([], need, { now: 2026, teaches }, [{ id: 'cred:a', expires: 2030 }]).coverage, 0.85);   // valid: the used level
  assert.equal(one([], need, { now: 2026, teaches }, [{ id: 'cred:a', expires: 2025 }]).coverage, 0.4);
  assert.equal(one([], need, { now: 2026, teaches }, [{ id: 'cred:a', expires: null }]).coverage, 0.85);
  assert.equal(one([], need, { now: 2026 }, [{ id: 'cred:a' }]).coverage, 0);                // no teaches data: no credit
  assert.equal(one([{ id: 'tec:x', strength: 'rusty' }], need, { now: 2026, teaches }, [{ id: 'cred:a' }]).coverage, 0.4);
});

test('gap: below 0.7, ordered by weight with the 1.5x boost for "people still do this"', () => {
  const needs = [
    { id: 'skl:a', label: 'A', w: 0.6, ai: 'mixed' }, { id: 'skl:b', label: 'B', w: 0.5, ai: 'people_do' },
    { id: 'skl:c', label: 'C', w: 0.9, ai: 'ai_does_much' }, { id: 'skl:d', label: 'D', w: 0.9, ai: 'mixed' },
  ];
  const r = coverage({ v: 1, roles: [], skills: [{ id: 'skl:c', strength: 'used' }, { id: 'skl:d', strength: 'rusty' }] }, needs, {});
  assert.deepEqual(r.gap.map(g => g.id), ['skl:d', 'skl:b', 'skl:a']);   // 0.9, 0.75, 0.6; skl:c is covered at 0.85
  assert.equal(r.gap[1].priority, 0.75);
});

test('near (owner decision O2): only the 3 closest neighbours of the skill being credited, and only at 0.90 or more', () => {
  const need = id => [{ id, label: id, w: 1, ai: 'unknown' }];
  const cov = (skills, id, near) => coverage({ v: 1, roles: [], skills: skills.map(([k, st]) => ({ id: k, strength: st })) }, need(id), { near });
  const near = { 'skl:t': { 'skl:a': 0.97, 'skl:b': 0.95, 'skl:c': 0.95, 'skl:d': 0.94 } };
  assert.equal(cov([['skl:d', 'strong']], 'skl:t', near).coverage, 0);                   // fourth closest: never counts
  assert.equal(cov([['skl:c', 'strong']], 'skl:t', near).coverage, q(0.5 * 0.95, 4));      // third: b and c tie at 0.95, b sorts first
  assert.equal(cov([['skl:c', 'strong'], ['skl:d', 'strong']], 'skl:t', near).needs[0].near_via, 'skl:c');
  assert.equal(cov([['skl:b', 'used']], 'skl:t', near).coverage, q(0.5 * 0.95 * 0.85, 4));
  assert.equal(cov([['skl:a', 'strong']], 'skl:t', { 'skl:a': { 'skl:t': 0.89 } }).coverage, 0);    // under the floor
  assert.equal(cov([['skl:a', 'strong']], 'skl:t', { 'skl:a': { 'skl:t': 0.9 } }).coverage, 0.45);  // the floor counts
  assert.equal(cov([['skl:a', 'strong']], 'skl:t', { 'skl:t': { 'skl:a': 0.5 }, 'skl:a': { 'skl:t': 0.95 } }).coverage, q(0.5 * 0.95, 4));   // both ways: the larger
  // the rank is the credited skill's: skl:d is fourth for skl:t, but skl:t is skl:d's only neighbour, so skl:t credits skl:d
  assert.equal(cov([['skl:t', 'strong']], 'skl:d', near).coverage, 0.47);
  // golden near-rank: systems analysis is credited from Java (third), not from SQL (fourth, rated strong)
  const c = G.cases.find(x => x.id === 'near-rank'), [p, s, o] = caseInputs(c);
  const sa = coverage(p, s.targets.find(t => t.occ.id === 'occ:15-1211.00').needs, o).needs.find(n => n.id === 'skl:2.B.4.g');
  assert.equal(sa.near_via, 'tec:java'); assert.equal(sa.near, q(0.5 * 0.95 * 0.85, 4));
  const cs = coverage(p, s.targets.find(t => t.occ.id === 'occ:15-1242.00').needs, o).needs.find(n => n.id === 'skl:2.C.3.a');
  assert.equal(cs.near, 0);
});

test('acc-real-tools: the fixture was exported with every tool weight capped at the median of the other needs in its list (owner decision O3)', () => {
  const s = fixture('fixtures/slice_acc_real.json');
  const median = xs => { const v = xs.slice().sort((a, b) => a - b), n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; };
  for (const list of [s.needs, ...s.targets.map(t => t.needs)]) {
    const cap = q(median(list.filter(n => !n.id.startsWith('tec:')).map(n => n.w)), 4);
    const tools = list.filter(n => n.id.startsWith('tec:'));
    assert.ok(tools.length > 0);
    for (const n of tools) assert.ok(n.w <= cap, n.id + ' ' + n.w + ' > ' + cap);
  }
});

test('default sliders (owner decision O4): short move 3, pay 1, AI safety 1, demand 1, enjoy 0', () => {
  const c = G.cases.find(x => x.id === 'acc-core'), [p, s, o] = caseInputs(c);
  assert.ok(!p.priorities);
  assert.deepEqual(match(p, s, o).weights, { pay: 1, ai_safe: 1, short: 3, demand: 1, enjoy: 0 });
  assert.deepEqual(match({ ...p, priorities: { pay: 1, ai_safe: 1, short_move: 3, demand: 1, enjoy: 0 } }, s, o), match(p, s, o));
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
      assert.deepEqual(e.flags, r.flags, `input ${i} ${r.id} flags`);
      assert.equal(e.kind, r.kind, `input ${i} ${r.id} kind`);
      assert.equal(e.target, r.level.target, `input ${i} ${r.id} target`);
      assert.equal(e.fit, r.level.fit, `input ${i} ${r.id} fit`);
      assert.equal(e.pay_change_pct, r.pay_change_pct, `input ${i} ${r.id} pay change`);
      assert.deepEqual(e.bridges, r.bridges, `input ${i} ${r.id} bridges`);
      assert.deepEqual(e.bridge_left, r.bridge_detail.skills, `input ${i} ${r.id} skills left without a bridge`);
      assert.deepEqual(e.bridge_detail, r.bridge_detail.items.map(b => ({ id: b.id, covers: b.covers, gain: b.gain, hours: b.hours, renew: b.renew })),
        `input ${i} ${r.id} bridge detail`);
    });
    assert.deepEqual(ref.credentials, js.credentials.map(c => ({ id: c.id, status: c.status })), `input ${i} credentials`);
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

// ---- S2 (matcher 1.2.0): levels, kinds, pay, flags, bridges (SPEC 7.2 to 7.4) ----

const LADDER_JSON = readJson(path.join(MATCHER, 'ladder.json'));
const sNeed = (id, w = 1, ai = 'mixed') => ({ id, label: id, kind: 'skill', w, ai, as_of: '2026-10', src: 'fixture' });
const sOcc = (id, extra = {}) => ({ id, label: id, job_zone: 4, as_of: '2026-10', src: 'fixture', ...extra });
const sSig = (kind, value, period = '2026Q1') => ({ kind, period, value, as_of: '2026-10', src: 'fixture' });
// A small slice: from occupation `from` (options in fromExtra), targets [[id, occ extra, needs, signals]].
function mini(from, targets, fromExtra = {}, fromSignals = []) {
  return {
    slice_v: 1, release: 'fixture-unit', occ: sOcc(from, fromExtra), needs: [sNeed('skl:a')], tasks: [], signals: fromSignals,
    targets: targets.map(([id, extra, needs, signals]) => ({ occ: sOcc(id, extra), via: ['close_to'], needs: needs || [sNeed('skl:a')], signals: signals || [] })),
    sources: [{ id: 'fixture', name: 'unit test', trust: 'estimate', as_of: '2026-10' }],
  };
}
const person = (years, extra = {}) => ({ v: 1, roles: years.map((y, i) => ({ occ: 'occ:13-2011.00', level: 1, industry: 'it', years: y, current: i === 0 })), skills: [{ id: 'skl:a', strength: 'strong' }], ...extra });
const road = (res, id) => res.roads.find(r => r.id === id);

test('ladder.json: match.js holds the same steps; each is in one minor group and marked for owner review', () => {
  assert.deepEqual(LADDER.map(([a, b]) => [a, b]), LADDER_JSON.steps.map(s => [s.from, s.to]));
  assert.match(LADDER_JSON.status, /owner review/);
  for (const s of LADDER_JSON.steps) {
    const soc = id => /^occ:([0-9]{2}-[0-9]{2})/.exec(id)[1];
    assert.equal(soc(s.from), soc(s.to), s.from + ' -> ' + s.to);
    assert.notEqual(s.from, s.to);
    assert.ok(!s.to.startsWith('occ:11-'), 'management steps need no table');
    assert.match(s.why, /O\*NET related occupation/);
  }
});

test('target level (SPEC 7.2): from the job zone, or from typical_level for a new role; null when neither is known', () => {
  const sl = mini('occ:13-2011.00', [1, 2, 3, 4, 5].map(z => ['occ:13-202' + z + '.00', { job_zone: z }])
    .concat([['occ:ai-x', { job_zone: null, typical_level: [2, 5] }], ['occ:ai-y', { job_zone: null }], ['occ:13-2099.00', { job_zone: 2, typical_level: [4, 4] }]]));
  const res = match(person(['5-8']), sl);
  assert.deepEqual([1, 2, 3, 4, 5].map(z => road(res, 'occ:13-202' + z + '.00').level.range), [[1, 2], [1, 2], [2, 3], [3, 4], [4, 5]]);
  assert.deepEqual(road(res, 'occ:ai-x').level, { target: 2, fit: 'in', range: [2, 5], basis: 'typical_level' });
  assert.deepEqual(road(res, 'occ:ai-y').level, { target: null, fit: null, range: null, basis: null });
  assert.deepEqual(road(res, 'occ:13-2099.00').level.range, [4, 4]);   // typical_level wins over the job zone
  assert.equal(road(res, 'occ:ai-y').kind, null);
});

test('experience fit (SPEC 7.2): total years against the years band of the target levels', () => {
  const sl = mini('occ:13-2011.00', [['occ:13-2031.00', { job_zone: 4 }]]);   // levels 3-4: 5 to under 12 years
  const fit = years => road(match(person(years), sl), 'occ:13-2031.00').level.fit;
  assert.equal(fit(['2-5']), 'below');
  assert.equal(fit(['5-8']), 'in');
  assert.equal(fit(['8-12']), 'in');
  assert.equal(fit(['12-18']), 'above');
  assert.equal(fit(['2-5', '8-12']), 'in');     // 2 + 8 = 10 years
  const six = mini('occ:13-2011.00', [['occ:ai-x', { job_zone: null, typical_level: [5, 6] }]]);
  assert.equal(road(match(person(['18+', '18+']), six), 'occ:ai-x').level.fit, 'in');   // level 6 has no top
  assert.equal(road(match({ v: 1, roles: [], skills: [] }, sl), 'occ:13-2031.00').level.fit, null);
});

test('road kind (SPEC 7.2): up, across, diagonal, reset, fork', () => {
  // person level 3 (5-8 years); coverage 1 unless the target needs a skill they lack
  const lacks = [sNeed('skl:zz')];
  const sl = mini('occ:13-2011.00', [
    ['occ:13-2031.00', { job_zone: 4 }],                 // same group 13-20, levels 3-4: across (not above)
    ['occ:13-2099.00', { job_zone: 5 }],                 // same group, levels 4-5: up
    ['occ:15-2051.00', { job_zone: 5 }],                 // other group, entry level 4 = one up: diagonal
    ['occ:43-3031.00', { job_zone: 4 }],                 // other group, same level: across
    ['occ:43-9061.00', { job_zone: 1 }, lacks],          // entry level 1, two below, coverage 0: reset
    ['occ:43-4051.00', { job_zone: 1 }],                 // two below but coverage 1: not a reset, across
    ['occ:11-3031.01', { job_zone: 5 }],                 // management: fork
    ['occ:11-9111.00', { job_zone: 1 }, lacks],          // management, but a reset first
  ]);
  const res = match(person(['5-8']), sl);
  const k = id => road(res, id).kind;
  assert.equal(res.person.level, 3);
  assert.deepEqual(['occ:13-2031.00', 'occ:13-2099.00', 'occ:15-2051.00', 'occ:43-3031.00', 'occ:43-9061.00', 'occ:43-4051.00', 'occ:11-3031.01', 'occ:11-9111.00'].map(k),
    ['across', 'up', 'diagonal', 'across', 'reset', 'across', 'fork', 'reset']);
  // two levels up in another group is still diagonal; coverage exactly 0.5 is not a reset
  const two = mini('occ:13-2011.00', [['occ:15-2051.00', { job_zone: 5 }], ['occ:43-9061.00', { job_zone: 1 }, [sNeed('skl:a'), sNeed('skl:zz')]]]);
  const r2 = match(person(['2-5', '2-5', '0-2']), two);   // 4 years: level 2
  assert.equal(road(r2, 'occ:15-2051.00').kind, 'diagonal');
  const r3 = match(person(['5-8']), two);
  assert.equal(road(r3, 'occ:43-9061.00').coverage, 0.5);
  assert.equal(road(r3, 'occ:43-9061.00').kind, 'across');
  // a manager to a manager is not a fork: the level rules apply. The minor group is the first 4 digits (11-3021 and 11-3031: 11-30)
  const mgr = mini('occ:11-3021.00', [['occ:11-3031.01', { job_zone: 5 }], ['occ:11-9111.00', { job_zone: 5 }]]);
  const rm = match(person(['5-8']), mgr);
  assert.equal(road(rm, 'occ:11-3031.01').kind, 'up');
  assert.equal(road(rm, 'occ:11-9111.00').kind, 'diagonal');
  // occ.soc, when present, wins over the code in the id
  const soc = mini('occ:13-2011.00', [['occ:15-2051.00', { job_zone: 5, soc: '13-2099' }]]);
  assert.equal(road(match(person(['5-8']), soc), 'occ:15-2051.00').kind, 'up');
  // a known specialist step (matcher/ladder.json) is a fork; the same move without a step is up
  const nurse = mini('occ:29-1141.00', [['occ:29-1171.00', { job_zone: 5 }], ['occ:29-1181.00', { job_zone: 5 }]]);
  const rn = match(person(['5-8']), nurse);
  assert.equal(road(rn, 'occ:29-1171.00').kind, 'fork');
  assert.equal(road(rn, 'occ:29-1181.00').kind, 'up');
  // a new role without a SOC code is never in the person's minor group
  const nr = mini('occ:15-1253.00', [['occ:ai-llm-evaluator', { job_zone: null, typical_level: [4, 5] }]]);
  assert.equal(road(match(person(['5-8']), nr), 'occ:ai-llm-evaluator').kind, 'diagonal');
});

test('pay change (SPEC 7.3): from numeric pay_band_in; 0.5 otherwise; below_pay_floor compares the percent to 2 decimals', () => {
  const pay = v => [sSig('pay_band_in', v, '2023-24')];
  const sl = mini('occ:41-3031.00', [['occ:41-3021.00', {}, null, pay(90)], ['occ:13-2072.00', {}, null, pay(130)],
    ['occ:43-4011.00', {}, null, pay('PLFS broad group: clerical')]], {}, pay(100));
  const res = match(person(['5-8'], { constraints: { pay_floor_pct: -10 } }), sl);
  assert.equal(road(res, 'occ:41-3021.00').pay_change_pct, -10);
  assert.deepEqual(road(res, 'occ:41-3021.00').flags, []);   // -10 percent is not below a floor of -10
  assert.equal(road(res, 'occ:41-3021.00').components.pay.value, 0.45);
  assert.equal(road(res, 'occ:13-2072.00').components.pay.value, 0.65);
  assert.deepEqual(road(res, 'occ:43-4011.00').components.pay, { value: 0.5, norm: 0.25, weight: 1, status: 'unknown' });   // a band name: no number
  assert.equal(road(res, 'occ:43-4011.00').pay_change_pct, null);
  assert.deepEqual(match(person(['5-8'], { constraints: { pay_floor_pct: 0 } }), sl).roads.map(r => [r.id, r.flags]).sort(),
    [['occ:13-2072.00', []], ['occ:41-3021.00', ['below_pay_floor']], ['occ:43-4011.00', []]]);
  // no pay on the person's own job: not yet measured, never a flag
  const none = match(person(['5-8'], { constraints: { pay_floor_pct: 20 } }), { ...sl, signals: [] });
  for (const r of none.roads) { assert.equal(r.components.pay.status, 'not_yet_measured'); assert.deepEqual(r.flags, []); }
  assert.ok(none.stubs.includes('pay') && !res.stubs.includes('pay'));
});

const BRIDGE_NEEDS = ['skl:a', 'skl:b', 'skl:c', 'skl:d', 'skl:e'].map((id, i) => sNeed(id, [0.9, 0.8, 0.7, 0.6, 0.5][i]));
const BRIDGE_CAT = [
  { id: 'cred:x', label: 'X', teaches: ['skl:a', 'skl:e'], hours: 10, cost_inr: 100, validity_years: 2, official_url: 'https://example.org/x', issuer: 'I' },
  { id: 'cred:y', label: 'Y', teaches: ['skl:b', 'skl:c'], hours: 30 },
  { id: 'cred:z', label: 'Z', teaches: [{ id: 'skl:a', quote: 'q' }, 'skl:b'], hours: 40 },
  { id: 'cred:w', label: 'W', teaches: ['skl:d'], hours: 50 },
  { id: 'cred:v', label: 'V', teaches: ['skl:zz'] },
];

test('bridges (SPEC 7.4): greedy cover of the gap weight, up to 3; "no reviewed course" without a catalogue', () => {
  const sl = mini('occ:13-2011.00', [['occ:13-2031.00', {}, BRIDGE_NEEDS]]);
  const p = { v: 1, roles: [], skills: [] };
  // round 1: Z covers a + b (1.7); round 2: Y covers c (0.7) over W (0.6) and X (e, 0.5); round 3: W (0.6) over X (0.5)
  const r = road(match(p, sl, { credentials: BRIDGE_CAT }), 'occ:13-2031.00');
  assert.deepEqual(r.bridges, ['cred:z', 'cred:y', 'cred:w']);
  assert.deepEqual(r.bridge_detail.skills, ['skl:e']);
  assert.equal(r.bridge_detail.status, 'reviewed');
  assert.deepEqual(r.bridge_detail.items[0], { id: 'cred:z', label: 'Z', issuer: null, covers: ['skl:a', 'skl:b'], gain: 1.7, cost_inr: null, hours: 40, validity_years: null, url: null, renew: false });
  // a tie goes to the smaller id
  const tie = road(match(p, mini('occ:13-2011.00', [['occ:13-2031.00', {}, [sNeed('skl:a')]]]), { credentials: [{ id: 'cred:b', label: 'B', teaches: ['skl:a'] }, { id: 'cred:a', label: 'A', teaches: ['skl:a'] }] }), 'occ:13-2031.00');
  assert.deepEqual(tie.bridges, ['cred:a']);
  // without a catalogue: no bridges, every gap skill listed, and the stub says so
  const none = match(p, sl);
  assert.equal(road(none, 'occ:13-2031.00').bridges, null);
  assert.deepEqual(road(none, 'occ:13-2031.00').bridge_detail, { status: 'no_reviewed_course', items: [], skills: ['skl:a', 'skl:b', 'skl:c', 'skl:d', 'skl:e'] });
  assert.ok(none.stubs.includes('bridges'));
  // a catalogue that covers nothing in the gap: an empty list, still "no reviewed course"
  const empty = road(match(p, sl, { credentials: [BRIDGE_CAT[4]] }), 'occ:13-2031.00');
  assert.deepEqual([empty.bridges, empty.bridge_detail.status], [[], 'no_reviewed_course']);
});

test('credentials held: valid ones credit and are never bridges; expired ones credit at 0.4 and come back marked renew', () => {
  const sl = mini('occ:13-2011.00', [['occ:13-2031.00', {}, BRIDGE_NEEDS]]);
  const valid = match({ v: 1, roles: [], skills: [], creds: [{ id: 'cred:z', expires: 2030 }] }, sl, { now: 2026, credentials: BRIDGE_CAT });
  assert.deepEqual(valid.credentials, [{ id: 'cred:z', status: 'valid', renew: false }]);
  assert.ok(!road(valid, 'occ:13-2031.00').bridges.includes('cred:z'));
  assert.ok(!road(valid, 'occ:13-2031.00').gap.some(g => g.id === 'skl:a'));   // the catalogue's teaches list credits it at 0.85
  const old = match({ v: 1, roles: [], skills: [], creds: [{ id: 'cred:z', expires: 2024 }] }, sl, { now: 2026, credentials: BRIDGE_CAT });
  assert.deepEqual(old.credentials, [{ id: 'cred:z', status: 'expired', renew: true }]);
  const b = road(old, 'occ:13-2031.00').bridge_detail.items.find(x => x.id === 'cred:z');
  assert.equal(b.renew, true);
  // held twice, one still valid: valid
  const both = match({ v: 1, roles: [], skills: [], creds: [{ id: 'cred:z', expires: 2024 }, { id: 'cred:z', expires: 2030 }] }, sl, { now: 2026, credentials: BRIDGE_CAT });
  assert.deepEqual(both.credentials, [{ id: 'cred:z', status: 'valid', renew: false }]);
  // opts.teaches, when given, is what credits held credentials (the catalogue is then only for bridges)
  const t = match({ v: 1, roles: [], skills: [], creds: [{ id: 'cred:z' }] }, sl, { credentials: BRIDGE_CAT, teaches: {} });
  assert.ok(road(t, 'occ:13-2031.00').gap.some(g => g.id === 'skl:a'));
});

test('outside_time: the bridges need more than 12 months at the top of the person\'s study-hours band', () => {
  const sl = mini('occ:13-2011.00', [['occ:13-2031.00', {}, BRIDGE_NEEDS]]);   // bridges Z, Y, W: 40 + 30 + 50 = 120 hours
  const flags = hm => road(match({ v: 1, roles: [], skills: [], constraints: hm ? { hours_month: hm } : {} }, sl, { credentials: BRIDGE_CAT }), 'occ:13-2031.00').flags;
  assert.deepEqual(flags('0-5'), ['outside_time']);    // 60 a year
  assert.deepEqual(flags('5-10'), []);                 // 120 a year: not more
  assert.deepEqual(flags('40+'), []);
  assert.deepEqual(flags(null), []);
  const noCat = match({ v: 1, roles: [], skills: [], constraints: { hours_month: '0-5' } }, sl);
  assert.deepEqual(road(noCat, 'occ:13-2031.00').flags, []);
  assert.ok(noCat.stubs.includes('outside_time'));
});

test('needs_relocation (SPEC 5.9, provisional city_share encoding): under half the openings in accepted places', () => {
  const sig = [sSig('city_share', 'city:bom=0.6,city:pnq=0.3,city:other=0.1'), sSig('remote_share', 0.15)];
  const sl = mini('occ:41-3031.00', [['occ:41-3021.00', {}, null, sig], ['occ:13-2072.00', {}, null, []]]);
  const flag = cons => road(match({ v: 1, roles: [], skills: [], constraints: cons }, sl), 'occ:41-3021.00').flags;
  assert.deepEqual(flag({ city: 'city:pnq', open_to: ['city:pnq'] }), ['needs_relocation']);   // 0.3 + 0.15 remote
  assert.deepEqual(flag({ city: 'city:pnq', open_to: ['city:pnq', 'city:other'] }), []);       // 0.55
  assert.deepEqual(flag({ city: 'city:bom' }), []);
  assert.deepEqual(flag({ city: 'city:pnq', open_to: ['open:india'] }), []);
  assert.deepEqual(flag({ open_to: ['open:remote'] }), ['needs_relocation']);                  // 0.15 remote only
  assert.deepEqual(flag({}), []);                                                              // nothing to compare
  assert.deepEqual(road(match({ v: 1, roles: [], skills: [], constraints: { city: 'city:pnq' } }, sl), 'occ:13-2072.00').flags, []);   // no data
  assert.ok(match({ v: 1, roles: [], skills: [] }, { ...sl, targets: [sl.targets[1]] }).stubs.includes('needs_relocation'));
});

test('ADR-16: city and openness to move change only the needs_relocation flag, never a score, a component or the order', () => {
  const r = rng(SEED + 5);
  const places = ['city:blr', 'city:hyd', 'city:pnq', 'city:bom', 'city:ncr', 'city:other'];
  const strip = res => res.roads.map(x => ({ ...x, flags: x.flags.filter(f => f !== 'needs_relocation') }));
  const pf = G.cases.find(c => c.id === 'bfsi-pay-floor');
  const inputs = [caseInputs(pf), ...RANDOM.slice(0, 200)];
  let moved = 0;
  for (const [p, s, o] of inputs) {
    const base = match(p, s, o);
    for (let i = 0; i < 3; i++) {
      const cons = { ...(p.constraints || {}), city: places[Math.floor(r() * places.length)], open_to: places.filter(() => r() < 0.3).concat(r() < 0.3 ? ['open:remote'] : []) };
      const other = match({ ...p, constraints: cons }, s, o);
      assert.deepEqual(ids(other), ids(base));
      assert.deepEqual(strip(other), strip(base));
      if (JSON.stringify(other.roads.map(x => x.flags)) !== JSON.stringify(base.roads.map(x => x.flags))) moved++;
    }
  }
  assert.ok(moved > 0, 'the test never moved the needs_relocation flag');
});
