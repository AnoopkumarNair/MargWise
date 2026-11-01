// The "keep this for later" box on the roads screen. Saving is optional: signed out, it only offers an account. Signed in, it saves the
// profile (ids and bands) to the account and says whether the saved copy is up to date.
import { h } from '../dom.js';
import { sync, signedIn, saveNow, saveStatus, takeFlash } from './sync.js';

const LINE = { out: '', none: '', never: 'Not saved yet.', saved: 'Saved to your account.', changed: 'You have changes that are not saved yet.' };

export function renderSaveBox() {
  const box = h('section', { class: 'savebox', id: 'save-box', 'aria-labelledby': 'save-h' });
  const flash = takeFlash();
  if (!signedIn()) {
    const make = h('a', { class: 'btn primary', href: '#/signup', id: 'make-account-link' }, 'Make an account to save');
    make.addEventListener('click', () => { sync.wantSave = true; });
    const logIn = h('a', { class: 'btn', href: '#/login', id: 'login-link' }, 'Log in');
    logIn.addEventListener('click', () => { sync.wantSave = true; });
    box.append(h('h2', { id: 'save-h' }, 'Keep this for later (optional)'),
      flash ? h('p', { class: 'status', role: 'status' }, flash) : null,
      h('p', null, 'You do not need an account. With one, your jobs and skills are saved and you can open them on another device.'),
      h('p', { class: 'actions' }, make, ' ', logIn));
    return box;
  }
  const status = h('p', { class: 'status', id: 'save-status', role: 'status', 'aria-live': 'polite' }, LINE[saveStatus()]);
  const err = h('p', { class: 'error', id: 'save-error', role: 'alert' });
  const btn = h('button', { type: 'button', class: 'btn primary', id: 'save-profile' }, 'Save to my account');
  btn.addEventListener('click', async () => {
    err.textContent = ''; btn.disabled = true; status.textContent = 'Saving…';
    const r = await saveNow();
    btn.disabled = false;
    if (r.ok) { status.textContent = LINE.saved; return; }
    status.textContent = '';
    if (r.code === 'conflict' && r.conflict) { sync.conflict = { current: r.conflict, reason: 'conflict' }; location.hash = '#/saved'; return; }
    if (r.code === 'unauthorized') { err.textContent = 'Your session has ended. Please log in again to save.'; return; }
    err.textContent = r.message;
  });
  box.append(h('h2', { id: 'save-h' }, 'Your account'), flash ? h('p', { class: 'status', id: 'save-flash' }, flash) : null, status, sync.note ? h('p', { class: 'hint', id: 'restore-note' }, sync.note) : null, err,
    h('p', { class: 'actions' }, btn, ' ', h('a', { class: 'btn', href: '#/account', id: 'account-link' }, 'My account')));
  return box;
}
