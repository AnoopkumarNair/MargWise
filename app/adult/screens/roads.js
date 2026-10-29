// Screen: roads (SPEC 8 screen 9, T5.2). Priority sliders re-sort the list live. Leaps stay hidden until asked for.
import { h, mount } from '../dom.js';
import { state, PRIORITIES } from '../state.js';
import { computeRoads, timing, pct, badges, coverageBar, signalList, flagList } from './common.js';

export function title() { return 'Your roads'; }
export async function render() {
  const list = h('div', { id: 'road-list', 'data-compute-ms': '' });
  const note = h('p', { class: 'hint', id: 'prio-note' });
  const leapBtn = h('button', { type: 'button', class: 'btn', id: 'show-leaps', 'aria-pressed': String(state.showLeaps) });
  const count = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', id: 'road-count' });
  let res;

  function card(r) {
    const gaps = r.gaps.slice(0, 3);
    return h('li', { class: 'card tier-' + r.tier, 'data-road': r.id },
      h('h3', null, h('a', { href: '#/road/' + encodeURIComponent(r.id) }, r.label)),
      badges(r), coverageBar(r),
      h('p', { class: 'sub' }, 'Top skills still missing'),
      gaps.length ? h('ul', { class: 'gaps' }, gaps.map(g => h('li', null, g.label))) : h('p', null, 'None. You cover this job’s main skills.'),
      r.gaps.length > 3 ? h('p', { class: 'more' }, '+ ' + (r.gaps.length - 3) + ' more on the detail page') : null,
      signalList(r), flagList(r),
      h('p', null, h('a', { class: 'btn small', href: '#/road/' + encodeURIComponent(r.id), 'aria-label': 'See details for ' + r.label }, 'See details')));
  }

  async function refresh() {
    try { res = await computeRoads(); } catch (e) { mount(list, h('p', { class: 'error', role: 'alert' }, 'We could not work out your roads. Reload the page and try again.')); return; }
    list.setAttribute('data-compute-ms', String(timing.ms));
    const all = res.roads;
    const leaps = all.filter(r => r.tier === 'leap');
    const shown = state.showLeaps ? all : all.filter(r => r.tier !== 'leap');
    leapBtn.textContent = state.showLeaps ? 'Hide leaps' : 'Show leaps' + (leaps.length ? ' (' + leaps.length + ' more)' : '');
    leapBtn.setAttribute('aria-pressed', String(state.showLeaps));
    leapBtn.hidden = leaps.length === 0;
    count.textContent = shown.length + (shown.length === 1 ? ' road' : ' roads') + ' shown.';
    mount(list, shown.length ? h('ol', { class: 'cards' }, shown.map(card)) : h('p', null, 'No close or stretch roads from the skills you ticked. Show leaps to see bigger moves, or go back and tick more skills.'));
    const nm = [];
    if (!all.some(r => r.signals.pay)) nm.push('Pay');
    if (!all.some(r => r.signals.demand)) nm.push('Demand');
    note.textContent = nm.length ? nm.join(' and ') + (nm.length > 1 ? ' are' : ' is') + ' not yet measured for these roads, so ' + (nm.length > 1 ? 'those sliders change' : 'that slider changes') + ' nothing yet.' : '';
  }

  const sliders = h('fieldset', { class: 'prios' },
    h('legend', null, 'What matters to you?'),
    h('p', { class: 'hint' }, '0 is not at all. 5 is very much. The list re-orders as you move a slider.'),
    PRIORITIES.map(([k, label]) => {
      const out = h('output', { for: 'pr-' + k, id: 'out-' + k }, String(state.priorities[k]));
      const inp = h('input', { type: 'range', id: 'pr-' + k, min: '0', max: '5', step: '1', value: String(state.priorities[k]) });
      inp.addEventListener('input', () => { state.priorities[k] = Number(inp.value); out.textContent = inp.value; refresh(); });
      return h('div', { class: 'slider' }, h('label', { for: inp.id }, label), inp, out);
    }), note);
  leapBtn.addEventListener('click', () => { state.showLeaps = !state.showLeaps; refresh(); });

  const root = h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'Roads from ' + state.occ.label),
    h('p', { class: 'lead' }, 'Coverage is the share of each job’s skills that you already cover. A higher number is a shorter move.'),
    sliders, h('h2', null, 'Jobs you could move to'), count, list, h('p', null, leapBtn),
    h('p', null, h('a', { href: '#/skills' }, 'Change my skills')));
  await refresh();
  return root;
}
