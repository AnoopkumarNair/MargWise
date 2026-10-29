// The footer on every screen (SPEC 8): job release id, the O*NET version, "as of" dates, and the O*NET credit (copied from README.md).
import { h, mount } from './dom.js';
import { state } from './state.js';

export const ONET_CREDIT = 'O*NET OnLine, U.S. Department of Labor, Employment and Training Administration (CC BY 4.0). Margwise has modified this information. USDOL/ETA has not approved, endorsed or tested these modifications. O*NET® is a trademark of USDOL/ETA.';

export function renderFooter(root) {
  const m = state.manifest;
  const rel = m ? m.release_id : '…';
  const dev = m && m.dev_build;
  const onet = m && m.onet_version;   // set by build.py from the slices, in dev builds too; fixtures have none
  const src = state.slice ? state.slice.sources : (m && m.sources) || [];
  const dates = src.length
    ? h('ul', { class: 'asof' }, src.map(s => h('li', null, s.name + ': as of ' + s.as_of + ' (' + s.trust + ')')))
    : h('p', null, 'Data dates show here once the data has loaded.');
  mount(root,
    h('p', { class: 'rel' }, 'Job data release: ', h('strong', { id: 'release-id' }, rel), dev ? ' (test build, not for real use)' : ''),
    onet ? h('p', { class: 'rel' }, 'O*NET version: ', h('strong', { id: 'onet-version' }, onet)) : null,
    h('h2', { class: 'small' }, 'Data dates'), dates,
    h('h2', { class: 'small' }, 'What this is'),
    h('p', null, 'A guide built from public data on jobs in the United States (O*NET), with data on where AI is used at work. It has no pay or demand data for India yet. It does not know about job openings or about one employer. Where we have not measured something, we say so.'),
    h('h2', { class: 'small' }, 'Credits'),
    h('p', null, ONET_CREDIT));
}
