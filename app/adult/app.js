// Margwise for working adults: a small hash router. One ES module per screen (./screens/). No framework, no inline scripts.
// Routes: #/ welcome, #/title, #/skills, #/roads, #/road/<occ id>
import { h, mount } from './dom.js';
import { state } from './state.js';
import { loadManifest } from './data.js';
import { renderFooter } from './footer.js';

const ROUTES = {
  '': () => import('./screens/welcome.js'),
  title: () => import('./screens/title.js'),
  skills: () => import('./screens/skills.js'),
  roads: () => import('./screens/roads.js'),
  road: () => import('./screens/road.js'),
};
const main = document.getElementById('main');
const foot = document.getElementById('footer');
const live = document.getElementById('route-status');
let token = 0;

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || '', args: parts.slice(1) };
}

async function go() {
  const me = ++token;
  let { name, args } = parse();
  if (!(name in ROUTES)) name = '';
  // Nothing is stored, so a reload loses the profile. Send the person back to where it can be rebuilt.
  if ((name === 'skills') && !state.slice) { location.replace('#/title'); return; }
  if ((name === 'roads' || name === 'road') && (!state.slice || !state.skills.size)) { location.replace(state.slice ? '#/skills' : '#/title'); return; }
  try {
    await loadManifest();
    const mod = await ROUTES[name]();
    const node = await mod.render(args);
    if (me !== token) return; // a newer navigation won
    mount(main, node);
    renderFooter(foot);
    document.title = mod.title() + ' · Margwise for working adults';
    live.textContent = mod.title();
    const h1 = main.querySelector('h1'); if (h1) h1.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    if (me !== token) return;
    mount(main, h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Something went wrong'), h('p', { role: 'alert' }, 'The page could not load. Check your connection and reload.')));
    renderFooter(foot);
  }
}
window.addEventListener('hashchange', go);
go();
