// Screen 7 (SPEC 8, T4.6 constraints part): six quick questions. All of them can be skipped. The answers go into the in-memory profile
// (constraints, checked against profile.schema.json). They never change the order of the roads (ADR-16): they only add notes to a road.
import { h } from '../dom.js';
import { state } from '../state.js';
import { HOURS, BUDGET, CITIES, CITY_LABEL, OPEN_EXTRA, PAY_FLOOR, MODE, cleanConstraints } from '../constraints_model.js';

export function title() { return 'A few questions'; }

export async function render() {
  const cur = cleanConstraints(state.constraints);
  const form = h('form', { class: 'qs', novalidate: true });
  form.addEventListener('submit', ev => ev.preventDefault());

  // One question as big tap targets. The first choice is "Skip", checked unless the person answered before.
  function radios(key, legend, list, current, hint) {
    const name = 'q-' + key;
    const mk = (value, text, k) => {
      const r = h('input', { type: 'radio', name, id: name + '-' + k, value: String(value), checked: value === current });
      return h('span', { class: 'seg opt' }, r, h('label', { for: r.id }, text));
    };
    return h('fieldset', { class: 'q', id: 'fs-' + key },
      h('legend', null, legend), hint ? h('p', { class: 'hint' }, hint) : null,
      h('div', { class: 'opts' }, mk('', 'Skip', 'skip'), list.map(([v, t], k) => mk(v, t, k))));
  }
  const pick = key => { const r = form.querySelector('input[name=q-' + key + ']:checked'); return r ? r.value : ''; };

  // Place: the city is a menu (19 cities), "places you would work" is a set of ticks.
  const city = h('select', { id: 'q-city', 'aria-label': 'Your city', 'aria-describedby': 'q-city-hint' },
    h('option', { value: '' }, 'Skip'), CITIES.map(c => h('option', { value: c, selected: c === cur.city }, CITY_LABEL[c])));
  const sameBox = h('input', { type: 'checkbox', id: 'open-same', disabled: !cur.city, checked: !!(cur.city && (cur.open_to || []).includes(cur.city)) });
  const sameLbl = h('label', { for: 'open-same' }, 'In my own city');
  const sameNote = h('span', { class: 'hint', id: 'same-note' }, cur.city ? '' : ' (choose your city first)');
  city.addEventListener('change', () => {
    sameBox.disabled = !city.value; if (!city.value) sameBox.checked = false;
    sameNote.textContent = city.value ? '' : ' (choose your city first)';
  });
  const extra = OPEN_EXTRA.map(([v, t], k) => {
    const c = h('input', { type: 'checkbox', id: 'open-' + k, value: v, checked: (cur.open_to || []).includes(v) });
    return h('span', { class: 'seg opt' }, c, h('label', { for: c.id }, t));
  });
  const others = CITIES.map((v, k) => {
    const c = h('input', { type: 'checkbox', id: 'open-c' + k, value: v, checked: (cur.open_to || []).includes(v) && v !== cur.city });
    return h('span', { class: 'seg opt' }, c, h('label', { for: c.id }, CITY_LABEL[v]));
  });

  form.append(
    radios('hours', '1. How many hours a month can you study?', HOURS, cur.hours_month),
    radios('budget', '2. How much can you spend on courses?', BUDGET, cur.course_budget),
    h('fieldset', { class: 'q', id: 'fs-city' }, h('legend', null, '3. Which city do you work in now?'),
      h('p', { class: 'hint', id: 'q-city-hint' }, 'We keep only the city name, never an address.'), city),
    h('fieldset', { class: 'q', id: 'fs-open' }, h('legend', null, '4. Where would you work?'),
      h('p', { class: 'hint' }, 'Tick all that fit. Tick nothing to skip.'),
      h('div', { class: 'opts' }, h('span', { class: 'seg opt' }, sameBox, sameLbl), extra),
      sameNote,
      h('details', { class: 'more-cities' }, h('summary', null, 'Pick other cities'), h('div', { class: 'opts' }, others))),
    radios('floor', '5. What is the lowest pay change you would accept?', PAY_FLOOR, cur.pay_floor_pct, 'Compared with what you earn now.'),
    radios('mode', '6. How do you want to work?', MODE, cur.mode));

  const next = h('button', { type: 'button', class: 'btn primary', id: 'constraints-next' }, 'Save and continue');
  const skip = h('button', { type: 'button', class: 'btn', id: 'skip-constraints' }, 'Skip these questions');
  const go = () => { location.hash = '#/today'; };
  next.addEventListener('click', () => {
    const c = {};
    const hrs = pick('hours'), bud = pick('budget'), fl = pick('floor'), mode = pick('mode');
    if (hrs) c.hours_month = hrs;
    if (bud) c.course_budget = bud;
    if (city.value) c.city = city.value;
    const open = new Set();
    if (sameBox.checked && city.value) open.add(city.value);
    for (const i of form.querySelectorAll('.opts input[type=checkbox]')) if (i !== sameBox && i.checked && i.value) open.add(i.value);
    if (open.size) c.open_to = [...open];
    if (fl !== '') c.pay_floor_pct = Number(fl);
    if (mode) c.mode = mode;
    state.constraints = cleanConstraints(c);
    go();
  });
  skip.addEventListener('click', () => { state.constraints = {}; go(); });

  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'A few quick questions'),
    h('p', { class: 'lead' }, 'These help us flag roads that may not fit your time, money or place. Every question is optional.'),
    h('p', { class: 'privacy' }, h('strong', null, 'They never change the order of your roads. '), 'They only add a note to a road when it may not fit. Nothing here is saved or sent anywhere.'),
    form,
    h('p', { class: 'actions' }, next, ' ', skip),
    h('p', null, h('a', { href: state.path === 'resume' ? '#/confirm' : '#/skills' }, 'Back')));
}
