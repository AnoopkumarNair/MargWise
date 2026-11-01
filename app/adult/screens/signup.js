// Screen 2 (SPEC 8): make an account. The steps are in ../account/flow.js.
import { h } from '../dom.js';
import { startFlow } from '../account/flow.js';
import { signedIn } from '../account/sync.js';

export function title() { return 'Make an account'; }
export async function render() {
  if (signedIn()) return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'You are already signed in'), h('p', null, h('a', { class: 'btn primary', href: '#/account' }, 'My account')));
  const root = h('div', { id: 'flow' });
  startFlow(root, { mode: 'signup' });
  return root;
}
