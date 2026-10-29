// Screen: tick skills from the occupation's top 25 needs and say how strong each one is.
import { h } from '../dom.js';
import { state, YEARS, YEARS_LABEL } from '../state.js';

const KIND = { skill: 'Skill', knowledge: 'Knowledge', activity: 'Activity', technology: 'Tool' };
const STRENGTH = [['used', 'Used'], ['strong', 'Strong'], ['rusty', 'Rusty']];

export function title() { return 'Your skills'; }
export async function render() {
  const top = state.slice.needs.slice().sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : 1)).slice(0, 25);
  const count = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', id: 'tick-count' });
  const err = h('p', { class: 'error', role: 'alert', id: 'tick-error' });
  const updateCount = () => { count.textContent = state.skills.size + ' ticked.'; };

  const rows = top.map(n => {
    const cb = h('input', { type: 'checkbox', id: 'sk-' + n.id, checked: state.skills.has(n.id) });
    const strength = h('fieldset', { class: 'strength', hidden: !state.skills.has(n.id) },
      h('legend', { class: 'sr' }, 'How well do you know ' + n.label + '?'),
      STRENGTH.map(([v, t]) => {
        const r = h('input', { type: 'radio', name: 'st-' + n.id, id: 'st-' + n.id + '-' + v, value: v, checked: (state.skills.get(n.id) || 'used') === v });
        r.addEventListener('change', () => { if (r.checked && state.skills.has(n.id)) state.skills.set(n.id, v); });
        return h('span', { class: 'seg' }, r, h('label', { for: r.id }, t));
      }));
    cb.addEventListener('change', () => {
      if (cb.checked) { const sel = strength.querySelector('input:checked'); state.skills.set(n.id, sel ? sel.value : 'used'); }
      else state.skills.delete(n.id);
      strength.hidden = !cb.checked; err.textContent = ''; updateCount();
    });
    return h('li', { class: 'skill' },
      h('div', { class: 'skill-main' }, cb, h('label', { for: cb.id }, n.label), h('span', { class: 'tag' }, KIND[n.kind] || n.kind)),
      strength);
  });

  const years = h('select', { id: 'years' }, YEARS.map(y => h('option', { value: y, selected: y === state.years }, YEARS_LABEL[y])));
  years.addEventListener('change', () => { state.years = years.value; });
  const go = h('button', { type: 'button', class: 'btn primary', id: 'see-roads' }, 'See my roads');
  go.addEventListener('click', () => {
    if (!state.skills.size) { err.textContent = 'Tick at least one skill to see your roads.'; return; }
    location.hash = '#/roads';
  });
  updateCount();
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'What do you do as ' + state.occ.label + '?'),
    h('p', { class: 'lead' }, 'These are the ' + top.length + ' things that matter most in this job. Tick the ones you use.'),
    h('p', { class: 'hint' }, 'For each one you tick, pick how well you know it. Used: you use it now. Strong: you could teach it. Rusty: you have used it, but not lately.'),
    h('ul', { class: 'skills' }, rows),
    count,
    h('div', { class: 'field' }, h('label', { for: 'years' }, 'How long have you done this job?'), years),
    err,
    h('p', null, go, ' ', h('a', { href: '#/title' }, 'Change job')));
}
