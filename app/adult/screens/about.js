// "About this data": the one place that says where the numbers come from, how old they are and what is missing (owner decision 2026-10-30).
// Adults see this only if they open it from the footer. The default screens stay short.
import { h } from '../dom.js';
import { state } from '../state.js';
import { ratingsLine } from '../today_model.js';

export function title() { return 'About this data'; }
export async function render() {
  const m = state.manifest, s = state.slice;
  const back = h('button', { type: 'button', class: 'btn', id: 'about-back' }, 'Back');
  back.addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#/'));
  const src = s ? s.sources : (m && m.sources) || [];
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'About this data'),
    h('p', { class: 'lead' }, 'Margwise is a guide built from public data on jobs in the United States (O*NET), with data on where AI is used at work. It is a guide, not a promise.'),
    h('h2', null, 'What it does not know'),
    h('ul', { class: 'plain' },
      h('li', null, 'It has no pay or demand figures for India yet. Where we have none, we leave them out.'),
      h('li', null, 'It does not know about job openings, or about one employer.'),
      h('li', null, 'Roles newer than the official lists may be missing.'),
      h('li', null, 'Skill ratings come from US surveys. Some are several years old.')),
    s ? h('p', { id: 'ratings-line' }, ratingsLine(s)) : null,
    h('h2', null, 'Where the data comes from'),
    src.length ? h('ul', { class: 'asof', id: 'data-sources' }, src.map(x => h('li', null, x.name + ': as of ' + x.as_of + ' (' + x.trust + ')'))) : h('p', null, 'The sources show here once the data has loaded.'),
    m && m.onet_version ? h('p', null, 'O*NET version: ', h('strong', { id: 'onet-version' }, m.onet_version)) : null,
    h('p', null, 'Job data release: ', h('strong', null, m ? m.release_id : '…')),
    h('h2', null, 'How the order is worked out'),
    h('p', null, 'Each road gets a score from how much of the job you already cover, and from the sliders you set. A job you cover more of is a shorter move. Your answers about time, money and place never change the order. They only add notes.'),
    h('p', null, back));
}
