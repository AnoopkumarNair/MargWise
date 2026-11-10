// Dev page (BUILD_PLAN T4.5 "done when"): tier 1 and tier 2 results side by side for a pasted text. Not part of a release build.
// Tier 1 runs at once. Tier 2 loads the model only when the button is pressed, and the label says how much it downloads.
import { h, mount } from './dom.js';
import { loadManifest, loadSkillsIndex, loadTitles, loadOccupations } from './data.js';
import { tier2Info, megabytes, findMoreSkills } from './intake_embed.js';

const $ = id => document.getElementById(id);
const SAMPLE = [
  'Operations Manager', 'Northwind Services, Kochi', 'Apr 2021 - Present',
  '- Trained 30 new hires every quarter on call handling and the billing system.',
  '- Planned the weekly shift roster for 60 agents across three time zones.',
  '- Handled escalated customer complaints and settled most of them on the first call.',
  '- Coached team leads on how to give feedback and set weekly targets.',
  '- Negotiated a new service contract with the telecom vendor that saved 18 lakh rupees a year.',
  '- Reported weekly numbers in Microsoft Excel and Tableau.',
  'Skills: Excel, SQL, Jira',
].join('\n');
$('text').value = SAMPLE;

let tier1 = null, lines = [], index = null;
const rows = (t, head, data) => mount(t, h('tr', null, head.map(x => h('th', null, x))), data.map(r => h('tr', null, r.map(c => h('td', null, String(c == null ? '' : c))))));

async function run1() {
  $('status').textContent = 'Running tier 1…';
  await loadManifest();
  const [skillsIndex, titles, occs] = await Promise.all([loadSkillsIndex(), loadTitles(), loadOccupations()]);
  index = skillsIndex;
  const { readResume } = await import('./intake/read.js');
  const { achievementLines } = await import('./intake/tier2.js');
  const text = $('text').value, now = new Date().getFullYear();
  const t0 = performance.now();
  tier1 = readResume(text, { skillsIndex, titles, now, occupations: occs.map(o => ({ id: o.id, label: o.label })) });
  const ms = Math.round(performance.now() - t0);
  lines = achievementLines(text, { nowYear: now, roles: tier1.roles });
  rows($('t1'), ['id', 'skill', 'from your resume'], tier1.skills.map(s => [s.id, s.label, s.sourceLine]));
  $('t1meta').textContent = tier1.skills.length + ' skills, ' + tier1.roles.length + ' jobs, ' + ms + ' ms. Looks like a resume: ' + tier1.looksLikeResume + '.';
  $('t2meta').textContent = lines.length + ' sentences would be compared.';
  const info = await tier2Info();
  $('run2').disabled = !info.available || !lines.length;
  $('run2').textContent = info.available ? 'Run tier 2 (downloads ' + megabytes(info.totalBytes) + ' the first time)' : 'Tier 2 is not in this build';
  $('status').textContent = 'Tier 1 done.';
}

async function run2() {
  if (!tier1) await run1();
  $('run2').disabled = true; $('bar').hidden = false;
  const t0 = performance.now();
  try {
    const found = await findMoreSkills(lines, {
      exclude: tier1.skills.map(s => s.id), threshold: Number($('threshold').value), cap: Number($('cap').value) || 12,
      onStatus: p => { $('bar').value = Math.round(100 * p.doneBytes / p.totalBytes); $('status').textContent = p.text; },
    });
    const label = new Map(index.map(e => [e.id, e.label]));
    const keep = found;
    rows($('t2'), ['id', 'skill', 'score', 'from your resume'], keep.map(f => [f.id, label.get(f.id), f.score.toFixed(3), f.sourceLine]));
    $('t2meta').textContent = keep.length + ' suggestions at ' + $('threshold').value + ' or more, ' + Math.round(performance.now() - t0) + ' ms in all.';
    $('status').textContent = 'Tier 2 done.';
  } catch (e) { $('status').textContent = 'Tier 2 failed: ' + e.message; }
  $('bar').hidden = true; $('run2').disabled = false;
}

$('run1').addEventListener('click', run1);
$('run2').addEventListener('click', run2);
