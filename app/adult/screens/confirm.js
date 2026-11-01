// Screen 6 (SPEC 8, T4.6): check what the reader found. Jobs, skills (each with the line it came from), "People in your role usually have…",
// leadership, credentials. Everything is editable. Titles and source lines are shown from memory and are never put in the profile:
// "See my roads" copies only ids and bands (intake_profile.js confirmedProfile, then state.js buildProfile).
import { h, mount, clear } from '../dom.js';
import { state } from '../state.js';
import { loadSkillsIndex, loadTitles, loadOccupations, loadSlice } from '../data.js';
import { findOccupations, findSkills } from '../lookup.js';
import { YEARS, INDUSTRIES, LEAD_PEOPLE, confirmedProfile } from '../intake_profile.js';
import { YEARS_LABEL } from '../state.js';
import { chipsFor } from '../intake_read.js';

export function title() { return 'Check what we found'; }

const STRENGTH = [['used', 'Used'], ['strong', 'Strong'], ['rusty', 'Rusty']];
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
let uid = 0;

export async function render() {
  const m = state.reading;
  let titles, occs, index;
  try { [titles, occs, index] = await Promise.all([loadTitles(), loadOccupations(), loadSkillsIndex()]); } catch (e) {
    return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Check what we found'),
      h('p', { class: 'error', role: 'alert' }, 'We could not load the job list. Check your connection and reload.'), h('p', null, h('a', { href: '#/intake' }, 'Back')));
  }
  const occById = new Map(occs.map(o => [o.id, o]));
  const err = h('p', { id: 'confirm-error', class: 'error', role: 'alert' });
  const count = h('p', { id: 'skill-count', class: 'status', role: 'status', 'aria-live': 'polite' });
  const roleCards = new Map();      // role key -> { root, skillsUl, sync }
  const skillRows = new Map();      // skill object -> li
  const chipsBox = h('div', { id: 'chips', class: 'chips' });
  const chipsStatus = h('p', { id: 'chips-status', class: 'status', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  let chipsRun = 0;

  const keptSkills = () => m.skills.filter(s => s.include && (!s.roleKey || (m.roles.find(r => r.key === s.roleKey) || {}).include));
  const updateCount = () => { const n = keptSkills().length; count.textContent = n + (n === 1 ? ' skill kept.' : ' skills kept.'); };
  const startRole = () => { const used = m.roles.filter(r => r.include && r.occ); return used.find(r => r.current) || used[0] || null; };

  // ---- skills -------------------------------------------------------------------------------------------------------------
  function skillRow(s) {
    const n = ++uid;
    const cb = h('input', { type: 'checkbox', id: 'cs-' + n, checked: s.include });
    const strength = h('fieldset', { class: 'strength', hidden: !s.include },
      h('legend', { class: 'sr' }, 'How well do you know ' + s.label + '?'),
      STRENGTH.map(([v, t]) => {
        const r = h('input', { type: 'radio', name: 'cst-' + n, id: 'cst-' + n + '-' + v, value: v, checked: s.strength === v });
        r.addEventListener('change', () => { if (r.checked) s.strength = v; });
        return h('span', { class: 'seg' }, r, h('label', { for: r.id }, t));
      }));
    cb.addEventListener('change', () => { s.include = cb.checked; strength.hidden = !cb.checked; updateCount(); refreshChips(); });
    const src = s.sourceLine ? h('p', { class: 'src' }, h('span', { class: 'src-tag' }, 'From your resume: '), '“' + clip(s.sourceLine, 220) + '”') :
      (s.added ? h('p', { class: 'src' }, 'You added this.') : null);
    const li = h('li', { class: 'skill', 'data-skill': s.id },
      h('div', { class: 'skill-main' }, cb, h('label', { for: cb.id }, s.label), s.lastYear ? h('span', { class: 'tag' }, 'last used ' + s.lastYear) : null),
      src, strength);
    skillRows.set(s, li);
    return li;
  }

  function addSkill(sk) {
    if (m.skills.some(x => x.id === sk.id)) {
      const ex = m.skills.find(x => x.id === sk.id);
      if (!ex.include) { ex.include = true; const li = skillRows.get(ex); if (li) { li.querySelector('input[type=checkbox]').checked = true; li.querySelector('.strength').hidden = false; } }
    } else {
      const s = { id: sk.id, label: sk.label, sourceLine: null, roleKey: null, lastYear: null, strength: 'used', include: true, added: true };
      m.skills.push(s);
      addedList.appendChild(skillRow(s));
      addedBox.hidden = false;
    }
    updateCount();
    return refreshChips();
  }

  // ---- "People in your role usually have…" ---------------------------------------------------------------------------------
  async function refreshChips() {
    const me = ++chipsRun, r = startRole();
    if (!r) { clear(chipsBox); chipsStatus.textContent = 'Pick a job above to see the skills people in it usually have.'; return; }
    const o = occById.get(r.occ);
    if (!o || !o.slice) { clear(chipsBox); chipsStatus.textContent = ''; return; }
    let list;
    try { list = await chipsFor(await loadSlice(o.slice), keptSkills().map(s => s.id)); } catch (e) { if (me === chipsRun) { clear(chipsBox); chipsStatus.textContent = 'We could not load the usual skills for this job.'; } return; }
    if (me !== chipsRun) return;
    chipsStatus.textContent = list.length ? 'Tap the ones you also do. Each one you tap is added as Used.' : 'You already have the usual skills for this job.';
    mount(chipsBox, list.map(c => {
      const b = h('button', { type: 'button', class: 'chip', 'data-chip': c.id }, '+ ' + c.label);
      b.addEventListener('click', async () => {
        await addSkill(c);
        (chipsBox.querySelector('.chip') || chipsStatus).focus();
        chipsStatus.textContent = c.label + ' added. ' + chipsStatus.textContent;
      });
      return b;
    }));
  }

  // ---- jobs ---------------------------------------------------------------------------------------------------------------
  function roleCard(r, i) {
    const hid = 'role-h-' + r.key;
    const inc = h('input', { type: 'checkbox', id: 'inc-' + r.key, checked: r.include });
    const occBox = h('fieldset', { class: 'occ-pick' });
    const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    const search = h('input', { type: 'text', id: 'occ-search-' + r.key, autocomplete: 'off', spellcheck: false, maxLength: 80, 'aria-label': 'Search for another job' });
    const results = h('ul', { class: 'picks' });

    function drawOcc() {
      const rows = r.candidates.map((c, k) => {
        const rad = h('input', { type: 'radio', name: 'occ-' + r.key, id: 'occ-' + r.key + '-' + k, value: c.occ, checked: r.occ === c.occ, disabled: !c.ready });
        rad.addEventListener('change', () => { if (rad.checked) { r.occ = c.occ; r.occLabel = c.label; refreshChips(); } });
        return h('div', { class: 'seg wide' }, rad, h('label', { for: rad.id }, c.label, c.ready ? '' : ' (no data for this job yet)'));
      });
      mount(occBox, h('legend', null, 'Closest job in our list'),
        rows.length ? rows : h('p', { class: 'hint' }, 'We could not match “' + clip(r.titleText, 80) + '” to a job. Search for the closest one.'));
    }
    function doSearch() {
      const typed = search.value; clear(results);
      if (typed.trim().length < 2) { status.textContent = ''; return; }
      const found = findOccupations(titles, occs, typed, 6).items;
      status.textContent = found.length ? found.length + (found.length === 1 ? ' job found.' : ' jobs found.') : 'No job found. Try a simpler name.';
      for (const o of found) {
        const ready = !!o.slice;
        const b = h('button', { type: 'button', class: 'pick', disabled: !ready }, h('span', { class: 'pick-label' }, o.label), ready ? null : h('span', { class: 'pick-note' }, 'No data for this job yet'));
        if (ready) b.addEventListener('click', () => {
          if (!r.candidates.some(c => c.occ === o.id)) r.candidates.push({ occ: o.id, label: o.label, ready: true });
          r.occ = o.id; r.occLabel = o.label; search.value = ''; clear(results); status.textContent = o.label + ' chosen.';
          drawOcc(); refreshChips();
        });
        results.appendChild(h('li', null, b));
      }
    }
    search.addEventListener('input', doSearch);
    drawOcc();

    const industry = h('select', { id: 'ind-' + r.key }, INDUSTRIES.map(([v, t]) => h('option', { value: v, selected: r.industry === v }, t)));
    industry.addEventListener('change', () => { r.industry = industry.value; });
    const years = h('select', { id: 'yrs-' + r.key }, [h('option', { value: '', selected: !r.years }, 'Choose…')].concat(YEARS.map(y => h('option', { value: y, selected: r.years === y }, YEARS_LABEL[y]))));
    years.addEventListener('change', () => { r.years = years.value; });
    const cur = h('input', { type: 'checkbox', id: 'cur-' + r.key, checked: r.current });
    cur.addEventListener('change', () => { r.current = cur.checked; refreshChips(); });

    const skillsUl = h('ul', { class: 'skills' });
    const mine = m.skills.filter(s => s.roleKey === r.key);
    for (const s of mine) skillsUl.appendChild(skillRow(s));
    const body = h('div', { class: 'role-body' },
      r.titleText ? h('p', { class: 'src' }, h('span', { class: 'src-tag' }, 'In your resume: '), '“' + clip(r.titleText, 120) + '”') : null,
      occBox,
      h('div', { class: 'field' }, h('label', { for: search.id }, 'Not right? Search for another job'), search, status, results),
      h('div', { class: 'field' }, h('label', { for: industry.id }, 'Industry'), industry, h('p', { class: 'hint' }, 'A guess from the words in this job’s lines. Change it if it is wrong.')),
      h('div', { class: 'field' }, h('label', { for: years.id }, 'How long did you do this job?'), years,
        h('p', { class: 'hint' }, r.yearsFromDates ? 'Worked out from the dates in your resume (' + (r.startYear || '') + ' to ' + (r.current ? 'now' : (r.endYear || '')) + '). Change it if it is wrong.' : 'We could not work this out from your resume. Please choose.')),
      h('div', { class: 'field inline' }, cur, h('label', { for: cur.id }, 'I still work here')),
      mine.length ? h('h4', null, 'Skills from this job (' + mine.length + ')') : h('p', { class: 'hint' }, 'We found no skills in this job’s lines. You can add some below.'),
      skillsUl);
    const root = h('section', { class: 'role-card', 'aria-labelledby': hid, 'data-role': r.key },
      h('h3', { id: hid }, 'Job ' + (i + 1) + ': ' + (r.occLabel || clip(r.titleText, 60) || 'not matched yet')),
      h('div', { class: 'field inline' }, inc, h('label', { for: inc.id }, 'Include this job')),
      body);
    inc.addEventListener('change', () => { r.include = inc.checked; body.hidden = !inc.checked; root.classList.toggle('off', !inc.checked); updateCount(); refreshChips(); });
    body.hidden = !r.include;
    roleCards.set(r.key, { root });
    return root;
  }

  // ---- added skills and search --------------------------------------------------------------------------------------------
  const addedList = h('ul', { class: 'skills', id: 'added-skills' }, m.skills.filter(s => s.added).map(skillRow));
  const addedBox = h('div', { id: 'added-box', hidden: !m.skills.some(s => s.added) }, h('h3', null, 'Skills you added'), addedList);
  const orphan = m.skills.filter(s => !s.roleKey && !s.added);
  const orphanList = h('ul', { class: 'skills' }, orphan.map(skillRow));
  const orphanBox = orphan.length ? h('div', { id: 'other-skills' }, h('h3', null, 'Other skills in your resume (' + orphan.length + ')'),
    h('p', { class: 'hint' }, 'These are not under one job, for example in a skills list.'), orphanList) : null;
  const sInput = h('input', { type: 'text', id: 'skill-search', autocomplete: 'off', spellcheck: false, maxLength: 80, 'aria-describedby': 'skill-search-status' });
  const sStatus = h('p', { id: 'skill-search-status', class: 'status', role: 'status', 'aria-live': 'polite' });
  const sResults = h('ul', { class: 'picks', id: 'skill-results' });
  sInput.addEventListener('input', () => {
    clear(sResults);
    if (sInput.value.trim().length < 2) { sStatus.textContent = ''; return; }
    const present = new Set(m.skills.filter(s => s.include).map(s => s.id));
    const found = findSkills(index, sInput.value, 8, present);
    sStatus.textContent = found.length ? found.length + (found.length === 1 ? ' skill found.' : ' skills found.') : 'No skill found. Try another word.';
    for (const sk of found) {
      const b = h('button', { type: 'button', class: 'pick', 'aria-label': 'Add ' + sk.label }, h('span', { class: 'pick-label' }, sk.label));
      b.addEventListener('click', () => { addSkill(sk); sInput.value = ''; clear(sResults); sStatus.textContent = sk.label + ' added.'; sInput.focus(); });
      sResults.appendChild(h('li', null, b));
    }
  });

  // ---- leadership (three taps) --------------------------------------------------------------------------------------------
  m.lead = m.lead || null;
  function leadGroup(key, legend, options, def) {
    return h('fieldset', { class: 'lead-q' }, h('legend', null, legend),
      options.map(([v, t], k) => {
        const rad = h('input', { type: 'radio', name: 'lead-' + key, id: 'lead-' + key + '-' + k, value: v, checked: m.lead ? (key === 'people' ? m.lead.people === v : (m.lead[key] ? 'yes' : 'no') === v) : false });
        rad.addEventListener('change', () => {
          if (!m.lead) { m.lead = { people: '0', budget: false, expert: false }; for (const k2 of ['people', 'budget', 'expert']) { if (k2 === key) continue; const d = leadBox.querySelector('input[name=lead-' + k2 + '][data-default]'); if (d) d.checked = true; } }
          m.lead[key] = key === 'people' ? v : v === 'yes';
        });
        if (v === def) rad.setAttribute('data-default', '');
        return h('span', { class: 'seg' }, rad, h('label', { for: rad.id }, t));
      }));
  }
  const leadBox = h('div', { class: 'lead-box' },
    leadGroup('people', 'How many people do you lead?', LEAD_PEOPLE, '0'),
    leadGroup('budget', 'Do you own a budget?', [['yes', 'Yes'], ['no', 'No']], 'no'),
    leadGroup('expert', 'Are you the person others ask about your subject?', [['yes', 'Yes'], ['no', 'No']], 'no'));

  // ---- credentials --------------------------------------------------------------------------------------------------------
  const credBox = m.creds.length ? h('section', { id: 'creds' }, h('h2', null, 'Certificates and licences we found'),
    h('ul', { class: 'plain' }, m.creds.map(c => h('li', null, c.name, c.sourceLine ? h('span', { class: 'src' }, ' From your resume: “' + clip(c.sourceLine, 160) + '”') : null))),
    h('p', { class: 'hint' }, 'Your roads do not use certificates yet, because we do not have a checked list of them. So these are not saved. They will count once we do.')) : null;

  // ---- go on --------------------------------------------------------------------------------------------------------------
  const go = h('button', { type: 'button', class: 'btn primary', id: 'see-roads' }, 'Continue');
  go.addEventListener('click', async () => {
    err.textContent = '';
    const r = confirmedProfile(m);
    if (r.error) {
      err.textContent = r.error;
      const el = r.roleKey ? document.getElementById(r.field === 'years' ? 'yrs-' + r.roleKey : 'occ-search-' + r.roleKey) : null;
      if (el) el.focus(); else err.scrollIntoView({ block: 'center' });
      return;
    }
    if (!r.skills.size) { err.textContent = 'Keep at least one skill, or add one, to see your roads.'; document.getElementById('skill-search').focus(); return; }
    go.disabled = true;
    try {
      const o = occById.get(r.startRole.occ);
      const slice = await loadSlice(o.slice);
      state.occ = { id: r.startRole.occ, label: r.startRole.label || o.label }; state.slice = slice;
      state.skills = r.skills; state.skillLast = r.last; state.roles = r.roles; state.years = r.startRole.years;
      state.lead = m.lead ? { people: m.lead.people, budget: !!m.lead.budget, expert: !!m.lead.expert } : null;
      location.hash = '#/constraints';
    } catch (e) { err.textContent = 'We could not load that job. Check your connection and try again.'; go.disabled = false; }
  });

  const t = m.timing || {};
  // Source lines (the resume line each skill came from) are hidden at first and shown on tap (owner decision 2026-10-30).
  const srcBtn = h('button', { type: 'button', class: 'btn small', id: 'show-sources', 'aria-pressed': 'false' }, 'Where did this come from?');
  srcBtn.addEventListener('click', () => { const on = root.classList.toggle('show-src'); srcBtn.setAttribute('aria-pressed', String(on)); srcBtn.textContent = on ? 'Hide where this came from' : 'Where did this come from?'; });
  const root = h('section', { class: 'screen', 'data-extract-ms': String(t.extractMs == null ? '' : t.extractMs), 'data-total-ms': String(t.totalMs == null ? '' : t.totalMs) },
    h('h1', { tabindex: '-1' }, 'Check what we found'),
    h('p', { class: 'lead' }, 'We read your resume on this device. Check each job and skill, fix what is wrong, and add what we missed. Nothing here is saved or sent anywhere.'),
    h('p', null, srcBtn),
    h('p', { class: 'hint' }, 'A skill starts as Used if your resume shows you used it in the last 3 years, and as Rusty if it was longer ago. Tap Strong for what you could teach. Your roads are worked out only from the skills you keep.'),
    m.warnings.length ? h('ul', { class: 'plain hint' }, m.warnings.slice(0, 5).map(w => h('li', null, w))) : null,
    h('h2', null, m.roles.length === 1 ? 'Your job' : 'Your jobs (' + m.roles.length + ')'),
    m.roles.length ? h('div', { class: 'roles' }, m.roles.map(roleCard)) : h('p', null, 'We found no jobs with dates in your resume. The skills we found are listed below. Go back and type your job title to start from a job.'),
    orphanBox, addedBox,
    h('h2', null, 'Add a skill'),
    h('div', { class: 'field' }, h('label', { for: 'skill-search' }, 'Search for a skill we missed'), sInput, sStatus, sResults),
    h('h2', null, 'People in your role usually have…'),
    chipsStatus, chipsBox,
    h('h2', null, 'Leading others'),
    h('p', { class: 'hint' }, 'Three quick questions. You can skip them.'),
    leadBox,
    credBox,
    count, err,
    h('p', null, go, ' ', h('a', { class: 'btn small', href: '#/' , id: 'start-again' }, 'Start again')),
    h('p', null, h('a', { href: '#/intake' }, 'Back')));
  updateCount();
  refreshChips();
  return root;
}
