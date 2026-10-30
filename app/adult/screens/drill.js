// Screen 11 (SPEC 8, T5.3): tap a skill to see the jobs that need it; tap a job to open its own roads (same profile, other starting job).
// Uses the jobs in the loaded slice: the current job and its road targets. Light by design: no extra data is fetched until a job is tapped.
import { h } from '../dom.js';
import { active } from '../state.js';
import { loadOccupations } from '../data.js';
import { rolesNeeding, skillLabel } from '../today_model.js';
import { importance, AI_TEXT, roadsHref } from './common.js';

export function title() { return 'Jobs that need a skill'; }
export async function render(args) {
  const id = decodeURIComponent((args && args[0]) || '');
  const { occ, slice } = active();
  const label = skillLabel(slice, id);
  const back = h('p', null, h('a', { href: roadsHref(), id: 'drill-back' }, '← Back to roads'));
  if (!label) return h('section', { class: 'screen' }, back, h('h1', { tabindex: '-1' }, 'Skill not found'), h('p', null, 'None of these jobs list that skill.'));
  let occs = []; try { occs = await loadOccupations(); } catch (e) { occs = []; }
  const ready = new Set(occs.filter(o => o.slice).map(o => o.id));
  const roles = rolesNeeding(slice, id);
  return h('section', { class: 'screen' }, back,
    h('h1', { tabindex: '-1' }, 'Jobs that need ' + label),
    h('p', { class: 'lead' }, roles.length + (roles.length === 1 ? ' job' : ' jobs') + ' near ' + occ.label + ' need this skill. Most important first.'),
    h('ul', { class: 'drill-list' }, roles.map(r => {
      const meta = 'Importance: ' + importance(r.w) + '.' + (AI_TEXT[r.ai] ? ' ' + AI_TEXT[r.ai] + '.' : '');
      const open = ready.has(r.occ.id) && r.occ.id !== occ.id;
      return h('li', { class: 'card', 'data-role': r.occ.id },
        h('h3', null, r.occ.label, r.current ? h('span', { class: 'tag' }, 'where you are looking from') : null),
        h('p', { class: 'meta' }, meta),
        open ? h('a', { class: 'btn small', href: '#/roads/' + encodeURIComponent(r.occ.id), 'aria-label': 'See roads from ' + r.occ.label }, 'See roads from this job')
          : (r.occ.id === occ.id ? null : h('p', { class: 'hint' }, 'No roads for this job yet.')));
    })),
    back);
}
