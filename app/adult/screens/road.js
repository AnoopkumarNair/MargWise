// Screen: one road in full (SPEC 8 screen 10, T5.3 without "Add this road", which needs sign-in).
import { h } from '../dom.js';
import { state, active } from '../state.js';
import { computeRoads, coverPct, importance, AI_TEXT, badges, moveNote, coverageBar, signalList, flagList, NO_FIGURES, roadsHref, drillHref } from './common.js';

export function title() { return 'Road detail'; }
export async function render(args) {
  const id = decodeURIComponent(args[0] || '');
  let res; try { res = await computeRoads(); } catch (e) { return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Road detail'), h('p', { class: 'error', role: 'alert' }, 'We could not work out this road. Go back and try again.')); }
  const r = res.roads.find(x => x.id === id);
  if (!r) return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Road not found'), h('p', null, 'That road is not in your list.'), h('p', null, h('a', { href: roadsHref() }, 'Back to roads')));
  const t = active().slice.targets.find(x => x.occ.id === id);
  return h('section', { class: 'screen' },
    h('p', null, h('a', { href: roadsHref() }, '← All roads')),
    h('h1', { tabindex: '-1' }, r.label),
    badges(r), moveNote(r), coverageBar(r),
    r.flags.length ? h('h2', null, 'Notes on this road') : null, flagList(r),
    r.flags.length ? h('p', { class: 'hint' }, 'A note never hides a road or changes the order. It only tells you where this road may not fit your answers.') : null,
    t && t.occ.description ? h('p', null, t.occ.description) : null,
    h('h2', null, 'Skills you would still need'),
    r.gaps.length ? h('ol', { class: 'gap-list' }, r.gaps.map(g => h('li', null,
      h('strong', null, g.label), ' ', h('a', { class: 'drill-link', href: drillHref(g.id), 'aria-label': 'Jobs that need ' + g.label }, 'Jobs that need this'),
      h('span', { class: 'meta' }, (g.w == null ? '' : 'Importance in this job: ' + importance(g.w) + '. ') + (AI_TEXT[g.ai] ? AI_TEXT[g.ai] + '.' : '')),
      h('span', { class: 'reason' }, g.reason)))) : h('p', null, 'None. You cover the main skills of this job.'),
    h('h2', null, 'Courses and credentials'),
    r.bridges.length ? h('ul', null, r.bridges.map(b => h('li', null, h('strong', null, b.label), b.issuer ? ' (' + b.issuer + ')' : '', b.facts.length ? '. ' + b.facts.join('. ') + '.' : '', b.url ? h('a', { class: 'ext', href: b.url, rel: 'noopener noreferrer' }, ' Official page') : null))) : h('p', null, 'No reviewed course yet for these skills.'),
    res.personLevel || r.fitText || r.targetLevel ? h('h2', null, 'Your level and experience') : null,
    res.personLevel ? h('p', null, 'Your level: ', h('strong', null, res.personLevel + ' of 6'), '. It comes from your years of experience, and one more level if you lead 6 or more people or own a budget.') : null,
    r.targetLevel ? h('p', { id: 'target-level' }, 'This job’s usual level: ' + (Array.isArray(r.targetLevel) ? r.targetLevel[0] + (r.targetLevel[1] !== r.targetLevel[0] ? ' to ' + r.targetLevel[1] : '') : r.targetLevel) + ' of 6.') : null,
    r.fitText ? h('p', { id: 'exp-fit' }, r.fitText) : null,
    h('h2', null, 'Pay, demand and AI'),
    signalList(r),
    r.signals.pay && r.signals.demand ? null : h('p', { class: 'hint' }, NO_FIGURES),
    h('details', { class: 'why', id: 'why-order' },
      h('summary', null, 'Why this order?'),
      h('p', null, 'Each part is a number from 0 to 1. Your priority sliders decide how much each part counts. A part we have no figure for counts the same on every road.'),
      h('table', { class: 'comps' },
        h('caption', { class: 'sr' }, 'Parts of the score for ' + r.label),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Part'), h('th', { scope: 'col' }, 'Value'), h('th', { scope: 'col' }, 'Your priority'))),
        h('tbody', null, r.components.filter(c => c.key !== 'enjoy').map(c => h('tr', null,
          h('th', { scope: 'row' }, c.label),
          h('td', null, c.measured ? c.value.toFixed(2) : 'no figure'),
          h('td', null, String(state.priorities[c.key])))))),
      h('p', null, 'Score: ', h('strong', null, r.score.toFixed(2)), '. Coverage: ', coverPct(r.coverage), '.')),
    h('p', null, h('a', { href: roadsHref() }, 'Back to roads')));
}
