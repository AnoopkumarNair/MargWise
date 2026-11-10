// The intake evaluation (BUILD_PLAN T7.3, SPEC 11). The owner runs it on the 30 consenting people's resumes. Read app/adult/tests/EVAL.md first.
//
//   node app/adult/tests/eval_intake.mjs <folder> [--now <year>] [--no-tier2] [--json]
//
// The folder is OUTSIDE the repository (the tool refuses a folder inside it). For each person it holds
//   <name>.pdf | <name>.docx | <name>.txt   the resume
//   <name>.profile.json                      the confirmed profile (a profile as the app holds it, or the account export file)
//   <name>.meta.json                         optional, written by hand: { "secondsToConfirm": 210, "roleEdits": 0 }
//
// PRIVACY. This is the point of the tool. It prints only aggregate numbers (counts, rates, medians, pass or fail against each SPEC 11 target),
// from 5 people up. It never prints resume text, names, file names, a person's skills or a source line. It writes no file and opens no network
// connection (the model loads from the local cache and refuses remote files). Redaction misses are listed as a category, a count and an
// anonymous position ("resume #7: 1 email"), never the value. The position is the person's place in the sorted list of file names.
import { readdirSync, realpathSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, sep, extname } from 'node:path';
import { readResume } from '../intake/read.js';
import { toConfirmModel } from '../intake_profile.js';
import { suggestFromText, decodeVectors, DEFAULTS } from '../intake/tier2.js';
import { loadGraph } from './lib/graph.mjs';
import { readFileNode } from './lib/eval_files.mjs';
import { loadNodeEmbedder, nodeDepsInstalled, modelCached } from '../tools/embed/node_embedder.mjs';
import {
  TARGETS, MIN_PEOPLE, median, percentile, rate, skillScores, unionSets, containCounts, redactionMisses, roleOutcome,
} from './lib/eval_measures.mjs';

const REPO = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
const GRAPH = fileURLToPath(new URL('../../../data/graph/', import.meta.url));
const RESUME_EXT = ['.pdf', '.docx', '.txt'];

const lines = [];
const say = s => lines.push(s);
const flush = () => { process.stdout.write(lines.join('\n') + '\n'); lines.length = 0; };
function stop(code, msg) { process.stderr.write(msg + '\n'); process.exit(code); }

const pct = x => (x == null ? 'n/a' : (x * 100).toFixed(1) + '%');
const num = (x, d = 1) => (x == null ? 'n/a' : Number(x).toFixed(d));
const verdict = (value, target, atLeast = true) => (value == null ? 'NOT MEASURED' : (atLeast ? value >= target : value <= target) ? 'PASS' : 'FAIL');

// ---- arguments and the folder ----
const args = process.argv.slice(2);
const flag = f => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const asJson = flag('--json'), noTier2 = flag('--no-tier2');
let nowYear = new Date().getFullYear();
{ const i = args.indexOf('--now'); if (i >= 0) { nowYear = Number(args[i + 1]); args.splice(i, 2); if (!Number.isInteger(nowYear) || nowYear < 2000 || nowYear > 2100) stop(2, 'usage: --now takes a year'); } }
if (args.length !== 1 || args[0].startsWith('-')) stop(2, 'usage: node app/adult/tests/eval_intake.mjs <folder> [--now <year>] [--no-tier2] [--json]');

const insideRepo = p => p === REPO || p.startsWith(REPO + sep);
let folder;
try { folder = realpathSync(args[0]); if (!statSync(folder).isDirectory()) throw new Error(); } catch (e) { stop(2, 'The folder could not be opened.'); }
if (insideRepo(folder)) stop(2, 'Refusing to run: the folder is inside the repository. Keep real resumes outside it (see app/adult/tests/EVAL.md).');

// ---- the people: a resume and a profile with the same name ----
const entries = readdirSync(folder).sort();
const byName = new Map();
const slot = n => { if (!byName.has(n)) byName.set(n, {}); return byName.get(n); };
for (const f of entries) {
  if (f.endsWith('.profile.json')) slot(f.slice(0, -'.profile.json'.length)).profile = f;
  else if (f.endsWith('.meta.json')) slot(f.slice(0, -'.meta.json'.length)).meta = f;
  else if (RESUME_EXT.includes(extname(f).toLowerCase())) slot(f.slice(0, -extname(f).length)).resume = f;
}
const names = [...byName.keys()].sort();
const people = names.filter(n => byName.get(n).resume && byName.get(n).profile);
const noProfile = names.filter(n => byName.get(n).resume && !byName.get(n).profile).length;
const noResume = names.filter(n => !byName.get(n).resume && byName.get(n).profile).length;
if (people.length < MIN_PEOPLE) stop(2, `Found ${people.length} people with both a resume and a profile. Numbers are shown from ${MIN_PEOPLE} people up, so nothing is reported.`);

// A file that resolves (through a link) into the repository is refused too.
for (const n of people) for (const k of ['resume', 'profile', 'meta']) {
  const f = byName.get(n)[k];
  if (f) { let r; try { r = realpathSync(join(folder, f)); } catch (e) { stop(2, 'A file in the folder could not be opened.'); } if (insideRepo(r)) stop(2, 'Refusing to run: a file in the folder is a link into the repository.'); }
}

// The confirmed profile: a bare profile ({ v, roles, skills }) or the account export ({ tables: [{ table: 'profiles', columns, rows }] }).
function profileOf(o) {
  if (o && Array.isArray(o.tables)) {
    const t = o.tables.find(x => x && x.table === 'profiles');
    if (!t || !t.rows || !t.rows[0]) return null;
    let d = t.rows[0][t.columns.indexOf('data')];
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return null; } }
    return profileOf(d);
  }
  if (o && Array.isArray(o.skills) && Array.isArray(o.roles)) return o;
  return null;
}
const readJson = f => { try { return JSON.parse(readFileSync(join(folder, f), 'utf8')); } catch (e) { return null; } };

// ---- the dictionaries, as the app loads them ----
const g = loadGraph();
const occupations = g.occupations.map(o => ({ id: o.id, label: o.label, slice: true }));
const roleMeasured = g.hasSlices;   // without the occupation slices (pipeline/run.py builds them) the reader cannot say which occupation a title is
const opts = { skillsIndex: g.skillsIndex, titles: g.titles, now: nowYear, occupations: occupations.map(o => ({ id: o.id, label: o.label })) };
readResume('', opts);   // builds the word matcher once, like the app does while the person picks a file

// ---- tier 1 for each person ----
const P = [];            // one record per person that could be read
const unreadable = {};   // code -> count
let badProfile = 0;
for (let i = 0; i < people.length; i++) {
  const rec = byName.get(people[i]);
  const prof = profileOf(readJson(rec.profile));
  if (!prof) { badProfile++; continue; }
  const t0 = performance.now();
  let file;
  try { file = await readFileNode(join(folder, rec.resume)); } catch (e) { const c = (e && e.code) || 'unreadable'; unreadable[c] = (unreadable[c] || 0) + 1; continue; }
  const fileMs = performance.now() - t0;
  const t1 = performance.now();
  const found = readResume(file.text, opts);
  const t1ms = performance.now() - t1;
  const model = toConfirmModel(found, occupations, nowYear);
  const first = model.roles.find(r => r.current) || model.roles[0] || null;
  const conf = prof.roles.find(r => r.current) || prof.roles[0] || null;
  let meta = rec.meta ? readJson(rec.meta) : null;
  if (meta && !(Number.isFinite(meta.secondsToConfirm) || Number.isInteger(meta.roleEdits))) meta = null;
  P.push({
    index: i + 1, text: file.text, kind: file.kind, fileMs, t1ms, found, looks: found.looksLikeResume,
    t1ids: new Set(found.skills.map(s => s.id)), confirmed: new Set(prof.skills.map(s => s.id)),
    role: conf ? { conf: conf.occ, first: first ? first.occ : null, cands: first ? first.candidates.map(c => c.occ) : [] } : null,
    meta,
  });
}
if (P.length < MIN_PEOPLE) stop(2, `Only ${P.length} people could be read, so nothing is reported (numbers are shown from ${MIN_PEOPLE} people up).`);

// ---- tier 2, when the model is on this machine ----
let tier2 = { measured: false, why: '' };
if (noTier2) tier2.why = 'switched off with --no-tier2';
else if (!nodeDepsInstalled()) tier2.why = 'the tool packages are missing (cd app/adult/tools/embed && npm ci)';
else if (!modelCached()) tier2.why = 'the model is not in app/adult/tools/model_cache (python3 app/adult/tools/fetch_model.py)';
else {
  try {
    const embed = await loadNodeEmbedder();
    const vecs = decodeVectors(readFileSync(GRAPH + 'skill_vecs.bin'), JSON.parse(readFileSync(GRAPH + 'skill_vecs.json', 'utf8')));
    await embed(['warm up']);
    for (const p of P) {
      const t0 = performance.now();
      const got = await suggestFromText(p.text, { nowYear, embed, vecs, exclude: [...p.t1ids], roles: p.found.roles });
      p.t2ms = performance.now() - t0;
      p.t2ids = new Set(got.map(s => s.id));
    }
    tier2 = { measured: true, why: '' };
  } catch (e) { tier2 = { measured: false, why: 'the model could not be run' }; for (const p of P) { delete p.t2ids; delete p.t2ms; } }
}

// ---- redaction: the redactor arrives with slice S6 (T6.1); until then count what the resumes contain ----
let redactor = null;
const redactPath = fileURLToPath(new URL('../intake/redact.js', import.meta.url));
if (existsSync(redactPath)) { try { const m = await import(pathToFileURL(redactPath).href); if (typeof m.redact === 'function') redactor = m.redact; } catch (e) { /* reported as not measured */ } }
const texts = P.map(p => p.text);
const contain = containCounts(texts);
const red = redactor ? await redactionMisses(texts, redactor) : null;

// ---- the numbers ----
const confirmedArr = P.map(p => p.confirmed);
const s1 = skillScores(P.map(p => p.t1ids), confirmedArr);
const s2 = tier2.measured ? skillScores(P.map(p => p.t2ids), confirmedArr) : null;
const sAll = tier2.measured ? skillScores(unionSets(P.map(p => p.t1ids), P.map(p => p.t2ids)), confirmedArr) : null;

const roleRows = P.filter(p => p.role);
const roleN = roleRows.length;
const roles = roleMeasured ? roleRows.map(p => roleOutcome(p.role.conf, p.role.first, p.role.cands)) : [];
const exact = roleMeasured ? rate(roles.filter(r => r.exact).length, roleN) : null;
const onePick = roleMeasured ? rate(roles.filter(r => r.onePick).length, roleN) : null;
const editRows = P.filter(p => p.meta && Number.isInteger(p.meta.roleEdits));
const recorded = editRows.length >= MIN_PEOPLE ? rate(editRows.filter(p => p.meta.roleEdits <= 1).length, editRows.length) : null;
const roleRate = recorded != null ? recorded : onePick;
const roleBasis = recorded != null ? `recorded edits, ${editRows.length} people` : 'computed: first choice, or the right job is one of the offered choices';

const secs = P.filter(p => p.meta && Number.isFinite(p.meta.secondsToConfirm) && p.meta.secondsToConfirm >= 0).map(p => p.meta.secondsToConfirm);
const medSecs = secs.length >= MIN_PEOPLE ? median(secs) : null;

const recallMain = sAll || s1, recallBasis = sAll ? 'tier 1 and tier 2 together' : 'tier 1 only (tier 2 not measured)';
const checks = {
  precision: { value: s1.precision, target: TARGETS.precision, result: verdict(s1.precision, TARGETS.precision), basis: 'tier 1, the skills the app ticks for the person' },
  recall: { value: recallMain.recall, target: TARGETS.recall, result: verdict(recallMain.recall, TARGETS.recall), basis: recallBasis },
  role: { value: roleRate, target: TARGETS.roleOneEdit, result: verdict(roleRate, TARGETS.roleOneEdit), basis: roleBasis },
  time: { value: medSecs, target: TARGETS.medianSeconds, result: verdict(medSecs, TARGETS.medianSeconds, false), basis: secs.length >= MIN_PEOPLE ? `recorded, ${secs.length} people` : `needs ${MIN_PEOPLE} timings in the meta files, have ${secs.length}` },
  redaction: { value: red ? red.total : null, target: 0, result: red ? (red.total === 0 ? 'PASS' : 'FAIL') : 'NOT MEASURED', basis: red ? 'misses after the redactor' : 'not measured (arrives with S6)' },
};
const ms = k => { const a = P.map(p => p[k]).filter(x => x != null); return { median: median(a), p90: percentile(a, 90), n: a.length }; };
const times = { file: ms('fileMs'), tier1: ms('t1ms'), tier2: tier2.measured ? ms('t2ms') : null };
const doesNotLookLikeResume = P.filter(p => !p.looks).length;

const result = {
  people: { named: people.length, read: P.length, unreadable, badProfile, resumesWithoutProfile: noProfile, profilesWithoutResume: noResume, notLookingLikeResumes: doesNotLookLikeResume },
  tier1: s1, tier2: s2, combined: sAll, tier2Note: tier2.measured ? null : tier2.why,
  role: { measured: roleMeasured, people: roleN, firstChoiceRight: exact, rightWithOnePick: onePick, recordedOneEditOrLess: recorded },
  time: { seconds: { people: secs.length, median: medSecs }, reader: times },
  redaction: { contain, misses: red ? red.misses : null },
  checks,
};

if (asJson) { process.stdout.write(JSON.stringify(result, null, 1) + '\n'); process.exit(0); }

say('Margwise intake evaluation. Aggregate numbers only: no resume text, names or file names are printed.');
say(`Date used for "present": ${nowYear}.`);
say('');
say('PEOPLE');
say(`  with a resume and a profile: ${people.length}; read: ${P.length}`);
const un = Object.entries(unreadable).sort().map(([c, n]) => `${c} ${n}`).join(', ');
if (un) say(`  could not read the file: ${un}`);
if (badProfile) say(`  profile file not understood: ${badProfile}`);
if (noProfile || noResume) say(`  left out: ${noProfile} resumes with no profile, ${noResume} profiles with no resume`);
if (doesNotLookLikeResume) say(`  the reader said "does not look like a resume": ${doesNotLookLikeResume}`);
say('');
say('SKILLS (precision = suggested and confirmed / suggested; recall = confirmed and suggested / confirmed; pooled over everyone, then the median person)');
const row = (name, s) => say(`  ${name.padEnd(28)} suggested ${String(s.suggested).padStart(5)}  confirmed ${String(s.confirmed).padStart(5)}  both ${String(s.hit).padStart(5)}  precision ${pct(s.precision).padStart(6)}  recall ${pct(s.recall).padStart(6)}  (median person: ${pct(s.medianPrecision)} / ${pct(s.medianRecall)})`);
row('tier 1 (dictionary)', s1);
if (s2) { row('tier 2 (model, extra only)', s2); row('tier 1 and tier 2 together', sAll); }
else say(`  tier 2 (model): not measured: ${tier2.why}`);
say('');
say('ROLE');
if (!roleMeasured) say('  not measured: the occupation slices are missing (run python3 pipeline/run.py)');
else {
  say(`  people with a confirmed current job: ${roleN}`);
  say(`  first choice is the confirmed job (no edit): ${pct(exact)}`);
  say(`  right with one pick from the offered choices: ${pct(onePick)}`);
  say(`  recorded as right after at most one edit: ${recorded == null ? `not measured (needs ${MIN_PEOPLE} roleEdits values in meta files, have ${editRows.length})` : pct(recorded)}`);
}
say('');
say('TIME');
say(`  upload to confirmed (from meta files): ${medSecs == null ? `not measured (needs ${MIN_PEOPLE} timings, have ${secs.length})` : `median ${num(medSecs / 60, 1)} minutes, ${secs.length} people`}`);
const t = (name, x) => x && say(`  ${name.padEnd(30)} median ${num(x.median, 1).padStart(7)} ms   p90 ${num(x.p90, 1).padStart(7)} ms   (${x.n} resumes)`);
t('file to text, in Node', times.file);
t('tier 1 read (warm)', times.tier1);
t('tier 2 read (model warm)', times.tier2);
if (!times.tier2) say('  tier 2 read: not measured');
say('  (reader times are this machine, not a phone; file reading here uses the same libraries but not the browser)');
say('');
say('REDACTION');
if (!red) {
  say('  not measured (arrives with S6: there is no redactor yet)');
  say(`  baseline, resumes that CONTAIN (before any redaction, so not leaks): email ${contain.email}, phone-like ${contain.phone}, ID-like ${contain.id}, any ${contain.any} of ${P.length}`);
} else {
  say(`  misses after redaction: ${red.total} in ${new Set(red.misses.map(m => m.index)).size} resumes`);
  for (const m of red.misses) say(`  resume #${m.index}: ${m.count} ${m.category}`);
}
say('');
say('SPEC 11 TARGETS');
say(`  precision of suggested skills >= 85%         ${checks.precision.result.padEnd(12)} ${pct(checks.precision.value)} (${checks.precision.basis})`);
say(`  recall of confirmed skills, no typing >= 70% ${checks.recall.result.padEnd(12)} ${pct(checks.recall.value)} (${checks.recall.basis})`);
say(`  current role right after <= 1 edit >= 90%    ${checks.role.result.padEnd(12)} ${pct(checks.role.value)} (${checks.role.basis})`);
say(`  median upload to confirmed <= 4 minutes     ${checks.time.result.padEnd(12)} ${checks.time.value == null ? 'n/a' : num(checks.time.value / 60, 1) + ' min'} (${checks.time.basis})`);
say(`  zero emails, phones, ID numbers in preview   ${checks.redaction.result.padEnd(12)} ${checks.redaction.basis}`);
flush();
process.exit(0);
