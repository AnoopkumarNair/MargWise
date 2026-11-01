// Two versions of the profile: which one to keep? Shown when a save finds that the profile changed somewhere else (409), and after a
// sign-in when the account already has a saved profile and the page holds another. Nothing is lost until a button is pressed, and the
// server never merges (BACKEND ADR-06).
import { h, mount } from '../dom.js';
import { buildProfile } from '../state.js';
import { sync, saveNow, restore, describe, hasLocalProfile } from '../account/sync.js';

export function title() { return 'Which profile to keep'; }

export async function render() {
  const c = sync.conflict;
  if (!c || !c.current) return h('section', { class: 'screen' }, h('h1', { tabindex: '-1' }, 'Nothing to choose'), h('p', null, h('a', { class: 'btn primary', href: '#/account' }, 'My account')));
  const root = h('section', { class: 'screen', id: 'saved-choice' });
  let mineText = '';
  if (hasLocalProfile()) { try { mineText = await describe(buildProfile()); } catch (e) { mineText = ''; } }
  const err = h('p', { class: 'error', id: 'saved-error', role: 'alert' });
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const useSaved = h('button', { type: 'button', class: 'btn primary', id: 'use-saved' }, 'Use the saved profile');
  const keepMine = h('button', { type: 'button', class: 'btn', id: 'keep-mine', disabled: !mineText }, 'Keep mine');
  const busy = on => { useSaved.disabled = on; keepMine.disabled = on || !mineText; };

  useSaved.addEventListener('click', async () => {
    err.textContent = ''; busy(true); status.textContent = 'Opening it…';
    const r = await restore(c.current);
    if (r.ok) { sync.flash = 'Your saved profile is open.'; location.hash = '#/roads'; return; }
    status.textContent = ''; busy(false); err.textContent = r.message;
  });
  keepMine.addEventListener('click', async () => {
    err.textContent = ''; busy(true); status.textContent = 'Saving…';
    const r = await saveNow({ rev: c.current.rev });
    if (r.ok) { sync.conflict = null; sync.flash = 'Saved. Your version replaced the other one.'; location.hash = '#/roads'; return; }
    status.textContent = ''; busy(false);
    if (r.code === 'conflict' && r.conflict) { sync.conflict = { current: r.conflict, reason: 'conflict' }; mount(root, ...(await body())); return; }
    err.textContent = r.message;
  });

  async function body() {
    const cur = sync.conflict.current, reason = sync.conflict.reason;
    const t = await describe(cur.data);
    return [
      h('h1', { tabindex: '-1' }, 'Which profile do you want to keep?'),
      h('p', { class: 'lead', id: 'saved-why' }, reason === 'signin' ? 'Your account already has a saved profile, and this page holds a different one.' : 'Your saved profile changed on another device after you opened it.'),
      h('div', { class: 'two' },
        h('div', { class: 'choice', id: 'saved-theirs' }, h('h2', null, 'The saved profile'), h('p', null, t)),
        h('div', { class: 'choice', id: 'saved-mine' }, h('h2', null, 'The one on this page'), h('p', null, mineText || 'Nothing here yet.'))),
      h('p', null, 'If you keep yours, it replaces the saved one. If you use the saved one, what is on this page is replaced. We do not mix them.'),
      status, err, h('p', { class: 'actions' }, useSaved, ' ', keepMine),
      h('p', null, h('a', { href: '#/account' }, 'Decide later')),
    ];
  }
  mount(root, ...(await body()));
  return root;
}
