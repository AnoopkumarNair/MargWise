// Screen 8 (SPEC 8, T5.1): your job today, from the current occupation's slice. Skills with how much AI does of each, the tasks split by
// AI use, the pay band if the slice holds one. Figures the slice does not hold are left out. Dates and sources are on the About page.
// A fact older than its source's cadence is greyed or hidden (SPEC 5.5) only when the slice gives that cadence; today none does.
import { h } from '../dom.js';
import { state } from '../state.js';
import { AI_TEXT_TODAY, importance, drillHref, pct } from './common.js';
import { splitTasks, sortedNeeds, latestSignal, sourceOf, factFreshness } from '../today_model.js';
import { summaryLines } from '../constraints_model.js';

export function title() { return 'Your job today'; }
const SHOWN = 12;
const TASK_TAG = { automation: 'AI does this', augmentation: 'AI helps with this', used: 'AI use seen' };

export async function render() {
  const s = state.slice, today = new Date();
  // Freshness: a need or signal is dropped when hidden and greyed when greyed. With no cadence in the slice, nothing changes.
  const fresh = f => factFreshness(s, f, today).state;
  const needs = sortedNeeds(s).filter(n => fresh(n) !== 'hidden');
  const more = h('button', { type: 'button', class: 'btn', id: 'show-all-skills', 'aria-expanded': 'false', hidden: needs.length <= SHOWN }, 'Show all ' + needs.length);
  const rows = needs.map((n, i) => {
    const ai = AI_TEXT_TODAY[n.ai];
    return h('li', { class: 'tskill' + (fresh(n) === 'grey' ? ' grey' : ''), hidden: i >= SHOWN, 'data-skill': n.id },
      h('strong', null, n.label),
      h('span', { class: 'meta' }, 'Importance: ' + importance(n.w) + (ai ? '. ' + ai : '') + '.'),
      h('a', { class: 'drill-link', href: drillHref(n.id), 'aria-label': 'Jobs that need ' + n.label }, 'Jobs that need this'));
  });
  more.addEventListener('click', () => { for (const li of rows) li.hidden = false; more.hidden = true; });

  const t = splitTasks(s.tasks);
  const taskList = (items, tag) => h('ul', { class: 'task-list' }, items.map(x => h('li', null, h('span', null, x.label), tag ? h('span', { class: 'tag' }, tag(x)) : null)));

  // Pay band and other signals: only what the slice really holds.
  const pay = latestSignal(s.signals, 'pay_band_in'), demand = latestSignal(s.signals, 'demand_trend'), aiObs = latestSignal(s.signals, 'ai_obs');
  const keep = x => x && fresh(x) !== 'hidden';
  const facts = [];
  if (keep(pay)) {
    const src = sourceOf(s, pay.src);
    facts.push(h('div', { id: 'pay-band' }, h('dt', null, 'Pay band'), h('dd', null, String(pay.value), src ? h('span', { class: 'hint' }, ' (' + src.name + ', ' + src.trust + ')') : null,
      src && /PLFS|Periodic Labour/i.test(src.name) ? h('span', { class: 'hint block' }, 'This is a band for a broad group of jobs in India, not for your employer or your city.') : null)));
  }
  if (keep(demand)) facts.push(h('div', null, h('dt', null, 'Demand'), h('dd', null, String(demand.value))));
  if (keep(aiObs) && typeof aiObs.value === 'number') facts.push(h('div', null, h('dt', null, 'AI at work'), h('dd', null, 'AI use was seen in ' + pct(aiObs.value) + ' of the work in this job.')));

  const answers = summaryLines(state.constraints);
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'Your job today: ' + state.occ.label),
    s.occ.description ? h('p', null, s.occ.description) : null,
    facts.length ? h('dl', { class: 'signals wide', id: 'today-facts' }, facts) : null,
    keep(pay) && keep(demand) ? null : h('p', { class: 'hint', id: 'no-figures' }, 'Pay and demand figures are coming.'),
    h('h2', null, 'Skills in this job'),
    h('p', { class: 'hint' }, 'Most important first. Tap “Jobs that need this” to see other jobs that use the skill.'),
    h('ul', { class: 'tskills' }, rows), h('p', null, more),
    h('h2', null, 'Tasks and AI'),
    t.used.length ? h('div', { id: 'tasks-ai' }, h('h3', null, 'AI used today (' + t.used.length + ')'), taskList(t.used, x => TASK_TAG[x.ai_mode])) : null,
    t.none.length ? h('div', { id: 'tasks-none' }, h('h3', null, 'No AI use seen (' + t.none.length + ')'), taskList(t.none)) : null,
    !t.used.length && !t.none.length ? h('p', null, 'We have no AI data for the tasks of this job.') : h('p', { class: 'hint' }, '“AI used today” means people used AI for the task. It does not say AI will take the job.'),
    answers.length ? h('div', { id: 'your-answers' }, h('h2', null, 'Your answers'), h('ul', { class: 'plain' }, answers.map(a => h('li', null, a))), h('p', { class: 'hint' }, 'They never change the order of your roads.')) : null,
    h('p', null, h('a', { class: 'btn primary', href: '#/roads', id: 'to-roads' }, 'See my roads'), ' ', h('a', { class: 'btn', href: '#/constraints', id: 'change-answers' }, 'Change my answers')));
}
