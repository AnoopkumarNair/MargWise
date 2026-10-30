// The footer on every screen (SPEC 8): the release id (small), one link to "About this data" (version, dates and sources are there), and the O*NET credit, which the licence requires (copied from README.md).
import { h, mount } from './dom.js';
import { state } from './state.js';

export const ONET_CREDIT = 'O*NET OnLine, U.S. Department of Labor, Employment and Training Administration (CC BY 4.0). Margwise has modified this information. USDOL/ETA has not approved, endorsed or tested these modifications. O*NET® is a trademark of USDOL/ETA.';

export function renderFooter(root) {
  const m = state.manifest;
  const rel = m ? m.release_id : '…';
  const dev = m && m.dev_build;
  mount(root,
    h('p', { class: 'rel' }, h('a', { href: '#/about', id: 'about-link' }, 'About this data')),
    h('p', { class: 'credit' }, ONET_CREDIT),
    h('p', { class: 'rel small' }, 'Release ', h('span', { id: 'release-id' }, rel), dev ? ' (test build, not for real use)' : ''));
}
