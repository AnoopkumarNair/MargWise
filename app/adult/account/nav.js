// The small account link in the page header: "Log in" when signed out, "My account" when signed in. Drawing it sends nothing.
import { h, mount } from '../dom.js';
import { signedIn } from './sync.js';

export function renderNav(root) {
  if (!root) return;
  mount(root, signedIn() ? h('a', { href: '#/account', id: 'nav-account' }, 'My account') : h('a', { href: '#/login', id: 'nav-login' }, 'Log in'));
}
