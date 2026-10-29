// Screen: type a job title (T4.7). Looks in titles.json first, then searches occupation labels.
import { h, mount } from '../dom.js';
import { state, resetPick } from '../state.js';
import { loadTitles, loadOccupations, loadSlice } from '../data.js';
import { findOccupations } from '../lookup.js';

export function title() { return 'Your job title'; }
export async function render() {
  const input = h('input', { id: 'job-title', type: 'text', autocomplete: 'off', spellcheck: false, maxLength: 80, 'aria-describedby': 'job-hint job-status', value: '' });
  const status = h('p', { id: 'job-status', class: 'status', role: 'status', 'aria-live': 'polite' }, 'Loading job titles…');
  const list = h('ul', { class: 'picks', id: 'job-picks' });
  const hint = h('p', { id: 'job-hint', class: 'hint' }, 'A plain name works best, such as “Accountant” or “Software engineer”. We do not keep what you type.');
  let titles = null; let occs = null;

  async function pick(o) {
    status.textContent = 'Loading ' + o.label + '…';
    try {
      const slice = await loadSlice(o.slice);
      resetPick(); state.occ = { id: o.id, label: o.label }; state.slice = slice;
      location.hash = '#/skills';
    } catch (e) { status.textContent = 'We could not load that job. Check your connection and try again.'; }
  }
  function update() {
    const typed = input.value;
    mount(list);
    if (!titles || !occs) return;
    if (typed.trim().length < 2) { status.textContent = 'Type your job title. Two letters are enough to start.'; return; }
    const r = findOccupations(titles, occs, typed, 8);
    if (!r.items.length) { status.textContent = 'No job found for “' + typed.trim() + '”. Try a simpler or shorter name.'; return; }
    status.textContent = r.items.length + (r.items.length === 1 ? ' job found.' : ' jobs found.') + (r.exact ? '' : ' These are the closest matches.') + ' Pick the one closest to yours.';
    for (const o of r.items) {
      const ready = !!o.slice;
      const btn = h('button', { type: 'button', class: 'pick', disabled: !ready }, h('span', { class: 'pick-label' }, o.label), ready ? null : h('span', { class: 'pick-note' }, 'No data for this job yet'));
      if (ready) btn.addEventListener('click', () => pick(o));
      list.appendChild(h('li', null, btn));
    }
  }
  input.addEventListener('input', update);
  const form = h('form', { class: 'find', novalidate: true },
    h('label', { for: 'job-title', class: 'lbl' }, 'Your job title'), hint, input, status, list);
  form.addEventListener('submit', ev => { ev.preventDefault(); const b = list.querySelector('button:not([disabled])'); if (b) b.click(); });
  Promise.all([loadTitles(), loadOccupations()]).then(([t, o]) => { titles = t; occs = o; update(); },
    () => { status.textContent = 'We could not load the job list. Check your connection and reload.'; });
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'What is your job title?'),
    form,
    h('p', null, h('a', { href: '#/' }, 'Back')));
}
