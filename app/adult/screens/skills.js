// Screen: the title-only path (no resume). The occupation's top 12 needs start ticked as Used (a lighter start, owner decision 2026-10-29), the
// first 18 are shown, and "Show all" reveals the rest (up to 40). The person says how strong each one is.
// Coverage counts only what is ticked (SPEC 7.1), so the screen asks the person to tick everything they do, and helps with "tick all".
import { h } from '../dom.js';
import { state, YEARS, YEARS_LABEL } from '../state.js';
import { TASK_AI_TEXT } from './common.js';

const GROUPS = [['skill', 'Skills'], ['knowledge', 'Knowledge'], ['activity', 'Work activities'], ['technology', 'Tools and software']];
const STRENGTH = [['used', 'Used'], ['strong', 'Strong'], ['rusty', 'Rusty']];
const MAX = 40;        // the slice holds the occupation's top 40 needs (SPEC 5.4)
const PRETICK = 12;    // the top needs that start ticked as Used
const FIRST = 18;      // how many are shown before "Show all" (15 to 20)
const NUDGE_BELOW = 20;   // measured on five real jobs with matcher 1.1.0: about 20 ticks as Used give 5 or more close or stretch roads (deviations D19)

export function title() { return 'Your skills'; }
export async function render() {
  const top = state.slice.needs.slice().sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : 1)).slice(0, MAX);
  if (!state.pretick) { state.pretick = true; if (!state.skills.size) for (const n of top.slice(0, PRETICK)) state.skills.set(n.id, 'used'); }
  const shownIds = new Set(top.slice(0, FIRST).map(n => n.id));
  let showAll = top.length <= FIRST;
  const visible = n => showAll || shownIds.has(n.id);
  const more = h('button', { type: 'button', class: 'btn', id: 'show-all', 'aria-expanded': String(showAll), hidden: showAll }, 'Show all ' + top.length);
  const count = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', id: 'tick-count' });
  const err = h('p', { class: 'error', role: 'alert', id: 'tick-error' });
  const groupSync = [];
  const updateCount = () => {
    const n = state.skills.size;
    count.textContent = n + ' of ' + top.length + ' ticked.' + (n < NUDGE_BELOW ? ' Tick everything you do, even now and then: your roads are worked out only from what you tick.' : '');
    for (const f of groupSync) f();
  };

  const rows = new Map();
  const liOf = new Map();
  function row(n) {
    const cb = h('input', { type: 'checkbox', id: 'sk-' + n.id, checked: state.skills.has(n.id) });
    const strength = h('fieldset', { class: 'strength', hidden: !state.skills.has(n.id) },
      h('legend', { class: 'sr' }, 'How well do you know ' + n.label + '?'),
      STRENGTH.map(([v, t]) => {
        const r = h('input', { type: 'radio', name: 'st-' + n.id, id: 'st-' + n.id + '-' + v, value: v, checked: (state.skills.get(n.id) || 'used') === v });
        r.addEventListener('change', () => { if (r.checked && state.skills.has(n.id)) state.skills.set(n.id, v); });
        return h('span', { class: 'seg' }, r, h('label', { for: r.id }, t));
      }));
    const set = on => {
      cb.checked = on;
      if (on) { const sel = strength.querySelector('input:checked'); state.skills.set(n.id, sel ? sel.value : 'used'); }
      else state.skills.delete(n.id);
      strength.hidden = !on;
    };
    cb.addEventListener('change', () => { set(cb.checked); err.textContent = ''; updateCount(); });
    rows.set(n.id, set);
    const li = h('li', { class: 'skill', hidden: !visible(n) }, h('div', { class: 'skill-main' }, cb, h('label', { for: cb.id }, n.label)), strength);
    liOf.set(n.id, li);
    return li;
  }

  const groups = GROUPS.map(([kind, label]) => {
    const items = top.filter(n => (GROUPS.some(g => g[0] === n.kind) ? n.kind : 'skill') === kind);
    if (!items.length) return null;
    const btn = h('button', { type: 'button', class: 'btn small tick-all', id: 'tick-all-' + kind });
    const vis = () => items.filter(visible);
    const all = () => vis().every(n => state.skills.has(n.id));
    groupSync.push(() => {
      btn.textContent = all() ? 'Untick all' : 'Tick all ' + vis().length;
      section.hidden = vis().length === 0;
      btn.setAttribute('aria-label', (all() ? 'Untick all in ' : 'Tick all in ') + label);
    });
    btn.addEventListener('click', () => { const on = !all(); for (const n of vis()) rows.get(n.id)(on); err.textContent = ''; updateCount(); });
    const hid = 'grp-' + kind;
    const section = h('section', { class: 'skill-group', 'aria-labelledby': hid },
      h('div', { class: 'group-head' }, h('h2', { id: hid }, label + ' (' + items.length + ')'), btn),
      h('ul', { class: 'skills' }, items.map(row)));
    return section;
  });

  const years = h('select', { id: 'years' }, YEARS.map(y => h('option', { value: y, selected: y === state.years }, YEARS_LABEL[y])));
  years.addEventListener('change', () => { state.years = years.value; });
  const go = h('button', { type: 'button', class: 'btn primary', id: 'see-roads' }, 'See my roads');
  go.addEventListener('click', () => {
    if (!state.skills.size) { err.textContent = 'Tick at least one skill to see your roads.'; return; }
    location.hash = '#/roads';
  });
  more.addEventListener('click', () => {
    showAll = true; more.hidden = true; more.setAttribute('aria-expanded', 'true');
    for (const n of top) liOf.get(n.id).hidden = false;
    updateCount();
    const first = top.find(n => !shownIds.has(n.id)); if (first) document.getElementById('sk-' + first.id).focus();
  });
  updateCount();
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'What do you do as ' + state.occ.label + '?'),
    h('p', { class: 'lead' }, 'We ticked the ' + Math.min(PRETICK, top.length) + ' things that matter most in this job, as Used. Untick any you do not do, and tick the others you do, even if only now and then. Your roads are more useful with 20 or more ticked.'),
    h('p', { class: 'hint' }, 'Your roads are worked out only from what you tick, so a skill you leave out counts as one you do not have. Use “Tick all” for a group you do, then untick what you do not.'),
    h('p', { class: 'hint' }, 'For each one you tick, pick how well you know it. Used: you do it in your work now; this counts almost as much as Strong. Strong: you could teach it. Rusty: you have done it, but not in the last few years.'),
    h('div', { class: 'skill-groups' }, groups),
    h('p', null, more),
    count,
    taskBlock(state.slice.tasks || []),
    h('div', { class: 'field' }, h('label', { for: 'years' }, 'How long have you done this job?'), years),
    err,
    h('p', null, go, ' ', h('a', { href: '#/title' }, 'Change job'), ' · ', h('a', { href: '#/', id: 'start-again' }, 'Start again')));
}

// The job's tasks with their AI use (SPEC 5.5, slice amendment A1). A task with no AI data shows no AI label.
function taskBlock(tasks) {
  if (!tasks.length) return null;
  const n = m => tasks.filter(t => t.ai_mode === m).length;
  const seen = n('automation') + n('augmentation') + n('used'), none = n('none'), unknown = tasks.length - seen - none;
  const sum = 'AI use was seen in ' + seen + ' of these ' + tasks.length + ' tasks, and no AI use was seen in ' + none + '.' +
    (unknown ? ' For ' + unknown + ' there is no AI data yet.' : '');
  return h('details', { class: 'tasks', id: 'job-tasks' },
    h('summary', null, 'Tasks in this job, and where AI is used (' + tasks.length + ')'),
    h('p', { class: 'hint' }, sum + ' “AI use seen” means people used AI for the task in the data; it does not say whether AI does the task or helps with it.'),
    h('ul', { class: 'task-list' }, tasks.map(t => h('li', null, h('span', null, t.label),
      TASK_AI_TEXT[t.ai_mode] ? h('span', { class: 'tag ai-' + t.ai_mode }, TASK_AI_TEXT[t.ai_mode]) : null))));
}
