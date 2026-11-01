import { h, mount } from '../dom.js';
import { signedIn, loadSaved, restore, sync, takeFlash } from '../account/sync.js';

export function title() { return 'Welcome'; }
export async function render() {
  const flash = takeFlash();
  const note = h('p', { class: 'status', id: 'welcome-note', role: 'status', 'aria-live': 'polite' }, flash);
  // Signed in: offer the saved profile. The call is made only when the person presses the button.
  const back = h('div', { id: 'welcome-back' });
  if (signedIn()) {
    const open = h('button', { type: 'button', class: 'btn', id: 'open-saved' }, 'Open my saved profile');
    const err = h('p', { class: 'error', role: 'alert', id: 'open-error' });
    open.addEventListener('click', async () => {
      open.disabled = true; err.textContent = '';
      const r = await loadSaved();
      if (!r.ok) { open.disabled = false; err.textContent = r.code === 'not_found' ? 'You have not saved a profile yet. Press Start to make one.' : r.message; return; }
      const x = await restore(r);
      if (x.ok) { sync.flash = 'Your saved profile is open.'; location.hash = '#/roads'; } else { open.disabled = false; err.textContent = x.message; }
    });
    mount(back, h('p', null, 'You are logged in. ', open), err);
  }
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'Find your next move from the job you do today'),
    h('p', { class: 'lead' }, 'Share your resume, or type your job title. Then see the jobs you could move to, and what you would still need to learn.'),
    note,
    h('h2', null, 'What you get'),
    h('ul', { class: 'plain' },
      h('li', null, 'The jobs and skills we found in your resume, for you to check and fix.'),
      h('li', null, 'A list of jobs near yours, from close moves to big leaps.'),
      h('li', null, 'For each job: how much of it you already cover, and the top skills still missing.'),
      h('li', null, 'The reasons behind the order. You can change what matters to you.')),
    h('p', null, 'It takes a few minutes.'),
    h('p', { class: 'privacy' }, h('strong', null, 'Your privacy: '), 'no sign-in needed. Your resume is read in your browser. Nothing leaves your device. What you share stays on this page unless you make an account.'),
    h('p', { class: 'actions' }, h('a', { class: 'btn primary', href: '#/intake', id: 'start' }, 'Start'), ' ', h('a', { class: 'btn', href: '#/login', id: 'have-account' }, 'I have been here before')),
    back);
}
