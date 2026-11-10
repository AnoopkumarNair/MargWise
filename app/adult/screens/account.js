// Screen 12 (SPEC 8): the account. See what we keep (a JSON download), delete my data (typed confirm), log out here or everywhere.
// Everything is wired to the /me endpoints. The tester id always comes from the session token, never from anything typed here.
import { h, mount } from '../dom.js';
import { api, sayError } from '../account/api.js';
import { sync, signedIn, hasLocalProfile, loadSaved, restore, describe, forgetSession, takeFlash } from '../account/sync.js';
import { resetAll } from '../state.js';

export function title() { return 'My account'; }

const stamp = () => new Date().toISOString().slice(0, 10);

// The JSON file a person downloads: what the export call returned, without the "ok" flag.
export function exportFile(body) { const o = Object.assign({}, body); delete o.ok; return JSON.stringify(o, null, 2); }

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function render() {
  if (!signedIn()) return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'My account'),
    h('p', { id: 'not-signed-in' }, 'You are not signed in. You can use Margwise without an account.'),
    h('p', { class: 'actions' }, h('a', { class: 'btn primary', href: '#/login', id: 'login-link' }, 'Log in'), ' ', h('a', { class: 'btn', href: '#/signup', id: 'signup-link' }, 'Make an account')));

  const flash = takeFlash();
  const note = h('p', { class: 'status', id: 'account-note', role: 'status', 'aria-live': 'polite' }, flash);
  const savedBox = h('div', { id: 'saved-box' }, h('p', { class: 'status' }, 'Checking your saved profile…'));

  // ---- the saved profile ----
  (async () => {
    const r = await loadSaved();
    if (!signedIn()) { mount(root, ...ended()); return; }
    if (!r.ok) { mount(savedBox, h('p', { id: 'saved-line' }, r.code === 'not_found' ? 'You have not saved a profile yet. Open the roads and choose "Save to my account".' : r.message)); return; }
    sync.rev = r.rev;
    const open = h('button', { type: 'button', class: 'btn', id: 'open-saved' }, 'Open my saved profile');
    const e = h('p', { class: 'error', role: 'alert', id: 'open-error' });
    open.addEventListener('click', async () => {
      open.disabled = true; const x = await restore(r);
      if (x.ok) { sync.flash = 'Your saved profile is open.'; location.hash = '#/roads'; } else { open.disabled = false; e.textContent = x.message; }
    });
    mount(savedBox, h('p', { id: 'saved-line' }, 'Saved: ' + await describe(r.data)), h('p', null, open), e);
  })();

  // ---- download ----
  const dlStatus = h('p', { class: 'status', id: 'export-status', role: 'status', 'aria-live': 'polite' });
  const dl = h('button', { type: 'button', class: 'btn', id: 'export-data' }, 'Download my data');
  dl.addEventListener('click', async () => {
    dl.disabled = true; dlStatus.textContent = 'Getting your data…';
    const res = await api.post('/me/export', {});
    dl.disabled = false;
    if (!res.ok) { dlStatus.textContent = res.error.code === 'unauthorized' ? 'Your session has ended. Please log in again.' : sayError(res); return; }
    download('margwise-my-data-' + stamp() + '.json', exportFile(res.body));
    dlStatus.textContent = 'Your file is downloaded.';
  });

  // ---- log out ----
  const outStatus = h('p', { class: 'status', id: 'logout-status', role: 'status', 'aria-live': 'polite' });
  const outHere = h('button', { type: 'button', class: 'btn', id: 'logout-here' }, 'Log out on this device');
  outHere.addEventListener('click', () => { forgetSession(); sync.flash = 'You are logged out on this device.'; resetAll(); location.hash = '#/'; });
  const outAll = h('button', { type: 'button', class: 'btn', id: 'logout-all' }, 'Log out everywhere');
  outAll.addEventListener('click', async () => {
    outAll.disabled = true; outStatus.textContent = 'Logging out…';
    const res = await api.post('/me/logout-all', {});
    if (res.ok || res.error.code === 'unauthorized') { forgetSession(); resetAll(); sync.flash = 'You are logged out on every device.'; location.hash = '#/'; return; }
    outAll.disabled = false; outStatus.textContent = sayError(res);
  });

  // ---- delete ----
  const confirmBox = h('input', { type: 'text', id: 'delete-confirm', autocomplete: 'off', spellcheck: false, 'aria-describedby': 'delete-hint' });
  const delBtn = h('button', { type: 'button', class: 'btn danger', id: 'delete-data', disabled: true }, 'Delete my data');
  const delStatus = h('p', { class: 'error', id: 'delete-status', role: 'alert' });
  confirmBox.addEventListener('input', () => { delBtn.disabled = confirmBox.value !== 'DELETE'; });
  delBtn.addEventListener('click', async () => {
    if (confirmBox.value !== 'DELETE') return;
    delBtn.disabled = true; delStatus.textContent = '';
    const res = await api.post('/me/delete', { confirm: 'DELETE' });
    if (res.ok || res.error.code === 'unauthorized') {
      forgetSession(); resetAll();
      sync.flash = res.ok ? 'Your account and data are deleted.' : 'Your session had ended, so we could not delete anything. Log in and try again.';
      location.hash = '#/'; return;
    }
    delBtn.disabled = confirmBox.value !== 'DELETE'; delStatus.textContent = sayError(res);
  });

  function ended() { return [h('h1', { tabindex: '-1' }, 'My account'), h('p', { id: 'not-signed-in' }, 'Your session has ended. Please log in again.'), h('p', null, h('a', { class: 'btn primary', href: '#/login', id: 'login-link' }, 'Log in'))]; }

  const root = h('section', { class: 'screen', id: 'account' },
    h('h1', { tabindex: '-1' }, 'My account'), note,
    h('h2', null, 'Your saved profile'), savedBox,
    h('h2', null, 'What we keep'),
    h('p', null, 'Download everything we keep about you, as a file you can read.'),
    h('p', null, dl), dlStatus,
    h('h2', null, 'Log out'),
    h('p', null, '“Log out everywhere” ends your session on every device, including this one.'),
    h('p', { class: 'actions' }, outHere, ' ', outAll), outStatus,
    h('h2', null, 'Research'),
    h('p', { id: 'research-note' }, 'To change your mind about research, write to the contact in the notice you accepted. Deleting your data also ends it.'),
    h('h2', null, 'Delete my data'),
    h('p', { id: 'delete-hint' }, 'This deletes your account, your saved profile and your history, at once. It cannot be undone. Type DELETE to confirm.'),
    h('label', { for: 'delete-confirm', class: 'lbl' }, 'Type DELETE'), confirmBox, h('p', null, delBtn), delStatus,
    h('p', null, hasLocalProfile() ? h('a', { href: '#/roads', id: 'back-roads' }, 'Back to my roads') : null, hasLocalProfile() ? ' · ' : null, h('a', { href: '#/' }, 'Back to the start')));
  return root;
}
