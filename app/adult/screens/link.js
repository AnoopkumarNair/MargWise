// The page the emailed link opens (the router moves #link=<token> to #/link). Signs the person in, or goes on to the nickname step.
import { h } from '../dom.js';
import { startFlow } from '../account/flow.js';
import { takeLink } from '../account/link.js';

export function title() { return 'Checking your link'; }
export async function render() {
  const t = takeLink();
  const root = h('div', { id: 'flow' });
  startFlow(root, { mode: 'link', link: t == null ? '' : t });
  return root;
}
