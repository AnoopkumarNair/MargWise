// Screen: one road in full (SPEC 8 screen 10, T5.3 without "Add this road", which needs sign-in).
import { h } from '../dom.js';
import { state } from '../state.js';
import { computeRoads, coverPct, importance, AI_TEXT, badges, coverageBar, signalList, flagList } from './common.js';

export function title() { return 'Road detail'; }
export async function render(args) {
  const id = decodeURIComponent(args[0] || '');
  let res; try { res = await computeRoads(); } catch (e) { return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Road detail'), h('p', { class: 'error', role: 'alert' }, 'We could not work out this road. Go back and try again.')); }
  const r = res.roads.find(x => x.id === id);
  if (!r) return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Road not found'), h('p', null, 'That road is not in your list.'), h('p', null, h('a', { href: '#/roads' }, 'Back to roads')));
  const t = state.slice.targets.find(x => x.occ.id === id);
  return h('section', { class: 'screen' },
    h('p', null, h('a', { href: '#/roads' }, '← All roads')),
    h('h1', { tabindex: '-1' }, r.label),
    badges(r), coverageBar(r), flagList(r),
    t && t.occ.description ? h('p', null, t.occ.description) : null,
    h('h2', null, 'Skills you would still need'),
    r.gaps.length ? h('ol', { class: 'gap-list' }, r.gaps.map(g => h('li', null,
      h('strong', null, g.label),
      h('span', { class: 'meta' }, (g.w == null ? '' : 'Importance in this job: ' + importance(g.w) + '. ') + (AI_TEXT[g.ai] ? AI_TEXT[g.ai] + '.' : '')),
      h('span', { class: 'reason' }, g.reason)))) : h('p', null, 'None. You cover the main skills of this job.'),
    h('h2', null, 'Courses and credentials'),
    r.bridges.length ? h('ul', null, r.bridges.map(b => h('li', null, b.label))) : h('p', null, 'No reviewed course yet for these skills.'),
    h('h2', null, 'Your level and experience'),
    h('p', { class: r.fit ? '' : 'nm' }, r.fit ? 'Your experience fit for this job: ' + r.fit + '.' : 'Level and experience fit: not yet measured.'),
    h('h2', null, 'Pay, demand and AI'),
    signalList(r),
    h('h2', null, 'How this road was scored'),
    h('p', null, 'Each part is a number from 0 to 1. Your priority sliders decide how much each part counts. A part that is not yet measured is shown as such.'),
    h('table', { class: 'comps' },
      h('caption', { class: 'sr' }, 'Parts of the score for ' + r.label),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Part'), h('th', { scope: 'col' }, 'Value'), h('th', { scope: 'col' }, 'Your priority'))),
      h('tbody', null, r.components.filter(c => c.key !== 'enjoy').map(c => h('tr', null,
        h('th', { scope: 'row' }, c.label),
        h('td', { class: c.measured ? '' : 'nm' }, c.measured ? c.value.toFixed(2) : 'not yet measured'),
        h('td', null, String(state.priorities[c.key])))))),
    h('p', null, 'Score: ', h('strong', null, r.score.toFixed(2)), '. Coverage: ', coverPct(r.coverage), '.'),
    h('p', null, h('a', { href: '#/roads' }, 'Back to roads')));
}
