// Sign-up and log-in (SPEC 8 screens 2 and 3). One flow with four steps, drawn into the screen's root:
//   birth    birth year first. Under the age limit: a polite refusal, and nothing is sent or kept. (Sign-up; log-in asks it with the email.)
//   email    email, invite code and the human check (Turnstile), then "Send me a code"  -> POST /email/start
//   code     the six digits from the email (or the link in it)                            -> POST /email/verify
//   profile  a new address only: nickname, the notice, the required tick, the research tick (off) -> POST /email/complete
// The email address, the birth year and the pending token live in this module's memory until the flow ends. None is stored.
// The server wants an invite code and a birth year on every code request, also for an address that already has an account (deviations D36),
// so log-in asks for them too. The invite code is remembered on this device after a sign-in, so it is asked for once.
import { h, mount } from '../dom.js';
import { state } from '../state.js';
import { api, sayError } from './api.js';
import { setToken, rememberInvite, recalledInvite } from './session.js';
import { ageAllowed, parseYear, latestBirthYear } from './age.js';
import { loadNotice, renderNotice, noticeComplete } from './notice.js';
import { mountTurnstile, siteKey, turnstileMode, DEV_TOKEN } from './turnstile.js';
import { afterSignIn } from './sync.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_RE = /^[A-Za-z0-9_-]{1,24}$/;
const NICK_RE = /^[^<>@\u0000-\u001f]+$/;

function newKey() { const b = crypto.getRandomValues(new Uint8Array(16)); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }

export function startFlow(root, { mode, link } = {}) {
  const f = { mode, birthYear: null, email: '', invite: recalledInvite(), pending: null, key: newKey(), widget: null };
  const login = mode === 'login';
  const noun = login ? 'Log in' : 'Make an account';

  function show(step, ...kids) {
    if (f.widget) { f.widget.remove(); f.widget = null; }
    mount(root, h('section', { class: 'screen', 'data-step': step }, ...kids));
    const el = root.querySelector('h1'); if (el) el.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  const err = () => h('p', { id: 'flow-error', class: 'error', role: 'alert' });
  const stat = () => h('p', { id: 'flow-status', class: 'status', role: 'status', 'aria-live': 'polite' });
  const field = (id, label, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), hint ? h('p', { class: 'hint', id: id + '-hint' }, hint) : null, input);
  const back = (href, text = 'Back') => h('p', null, h('a', { href }, text));
  function done() { f.pending = null; f.email = ''; f.birthYear = null; }

  // ---- step: birth year ----------------------------------------------------------------------------------------------------
  function stepBirth() {
    const e = err();
    const year = h('input', { type: 'text', id: 'birth-year', inputmode: 'numeric', autocomplete: 'bday-year', maxLength: 4, pattern: '[0-9]{4}', 'aria-describedby': 'birth-year-hint', value: f.birthYear ? String(f.birthYear) : '' });
    const go = h('button', { type: 'submit', class: 'btn primary', id: 'birth-next' }, 'Continue');
    const form = h('form', { novalidate: true }, field('birth-year', 'The year you were born', year, 'We ask this first, to check your age. We do not keep the year.'), e, h('p', null, go));
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const y = parseYear(year.value);
      if (y == null) { e.textContent = 'Type the four digits of your birth year, for example 1990.'; year.focus(); return; }
      if (!ageAllowed(y)) { f.birthYear = null; stepRefused(); return; }
      f.birthYear = y; stepEmail();
    });
    show('birth', h('h1', { tabindex: '-1' }, noun), h('p', { class: 'lead' }, 'Margwise for working adults is free. An account lets you save your jobs and skills and open them on another device. You can use the app without one.'), form,
      h('p', null, h('a', { href: '#/login', id: 'to-login' }, 'I already have an account'), ' · ', h('a', { href: '#/' }, 'Back to the start')));
  }

  function stepRefused() {
    f.birthYear = null;
    show('refused', h('h1', { tabindex: '-1' }, 'We cannot open an account for you'),
      h('p', { id: 'refused', role: 'alert' }, 'Margwise for working adults is for people born in ' + latestBirthYear() + ' or earlier. We have not sent or saved anything.'),
      h('p', null, h('a', { class: 'btn', href: '#/' }, 'Back to the start')));
  }

  // ---- step: email, invite, human check ------------------------------------------------------------------------------------
  function stepEmail(message) {
    const mode_ = turnstileMode(state.manifest);
    const e = err(), s = stat(); if (message) s.textContent = message;
    const email = h('input', { type: 'email', id: 'email', autocomplete: 'email', maxLength: 254, spellcheck: false, value: f.email });
    const invite = h('input', { type: 'text', id: 'invite', autocomplete: 'off', maxLength: 24, spellcheck: false, value: f.invite });
    const year = login ? h('input', { type: 'text', id: 'birth-year', inputmode: 'numeric', autocomplete: 'bday-year', maxLength: 4, 'aria-describedby': 'birth-year-hint', value: f.birthYear ? String(f.birthYear) : '' }) : null;
    const box = h('div', { id: 'turnstile', class: 'turnstile' });
    const go = h('button', { type: 'submit', class: 'btn primary', id: 'send-code', disabled: true }, 'Send me a code');
    let token = mode_ === 'dev' ? DEV_TOKEN : null;
    const ready = () => { go.disabled = !token; };
    const form = h('form', { novalidate: true },
      login ? field('birth-year', 'The year you were born', year, 'We check your age each time. We do not keep the year.') : null,
      field('email', 'Your email address', email, 'We send a six-digit code to this address.'),
      field('invite', 'Your invite code', invite, 'From the link or message you were given.'),
      mode_ === 'widget' ? h('div', { class: 'field' }, h('p', { class: 'hint', id: 'ts-hint' }, 'A quick check that you are a person.'), box) : null,
      e, s, h('p', null, go));
    if (mode_ === 'off') { s.textContent = ''; e.textContent = 'Sign-up and log-in are not open yet.'; go.disabled = true; }
    else ready();
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      e.textContent = '';
      let y = f.birthYear;
      if (login) { y = parseYear(year.value); if (y == null) { e.textContent = 'Type the four digits of your birth year, for example 1990.'; year.focus(); return; } if (!ageAllowed(y)) { stepRefused(); return; } }
      const addr = email.value.trim(), inv = invite.value.trim();
      if (!EMAIL_RE.test(addr) || addr.length > 254) { e.textContent = 'Check your email address. It should look like name@example.com.'; email.focus(); return; }
      if (!inv) { e.textContent = 'Type the invite code you were given.'; invite.focus(); return; }
      if (!INVITE_RE.test(inv)) { e.textContent = 'An invite code has only letters, numbers, - and _.'; invite.focus(); return; }
      if (!token) { e.textContent = 'Please finish the check first.'; return; }
      go.disabled = true; s.textContent = 'Sending your code…';
      const res = await api.post('/email/start', { invite: inv, birthYear: y, email: addr, turnstile: token }, { auth: false });
      if (res.ok) { f.email = addr; f.invite = inv; f.birthYear = y; stepCode(res.body.message); return; }
      s.textContent = '';
      if (res.error.code === 'refused_age') { stepRefused(); return; }
      e.textContent = sayError(res);
      if (mode_ === 'widget') { token = null; if (f.widget) f.widget.reset(); } else ready();
      ready();
    });
    show('email', h('h1', { tabindex: '-1' }, noun), h('p', { class: 'lead' }, login ? 'We will email you a code. Use the address you signed up with.' : 'We will email you a code to check this address.'), form,
      back('#/', 'Back to the start'));
    if (mode_ === 'widget') {
      mountTurnstile(box, siteKey(), {
        onToken: t => { token = t; ready(); }, onExpire: () => { token = null; ready(); },
        onError: () => { token = null; ready(); e.textContent = 'The check could not load. Check your connection and try again.'; },
      }).then(w => { f.widget = w; }, () => { e.textContent = 'The check could not load. Check your connection and reload the page.'; });
    }
  }

  // ---- step: the code ------------------------------------------------------------------------------------------------------
  function stepCode(message) {
    const e = err(), s = stat();
    const code = h('input', { type: 'text', id: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', maxLength: 7, spellcheck: false, 'aria-describedby': 'code-hint' });
    const go = h('button', { type: 'submit', class: 'btn primary', id: 'check-code' }, 'Continue');
    const again = h('button', { type: 'button', class: 'btn', id: 'new-code' }, 'Send a new code');
    const other = h('button', { type: 'button', class: 'btn', id: 'other-email' }, 'Use a different email');
    const form = h('form', { novalidate: true }, field('code', 'The six-digit code', code, 'It works for 15 minutes. You can also open the link in the email, on this device or another.'), e, s, h('p', { class: 'actions' }, go, ' ', again, ' ', other));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); e.textContent = '';
      const digits = code.value.replace(/[\s-]/g, '');
      if (!/^[0-9]{6}$/.test(digits)) { e.textContent = 'The code is six digits. Check the email and try again.'; code.focus(); return; }
      go.disabled = true; s.textContent = 'Checking…';
      const res = await api.post('/email/verify', { email: f.email, code: digits }, { auth: false });
      go.disabled = false; s.textContent = '';
      if (res.ok) return afterVerify(res.body);
      e.textContent = sayError(res); code.focus();
    });
    again.addEventListener('click', () => stepEmail('Ask for a new code. The old one stops working.'));
    other.addEventListener('click', () => { f.email = ''; stepEmail(); });
    show('code', h('h1', { tabindex: '-1' }, 'Check your email'), h('p', { class: 'lead', id: 'code-sent' }, message || 'If this address can sign in, we have sent a code. It works for 15 minutes.'), form);
  }

  async function afterVerify(body) {
    if (body.token) { await signedIn(body.token); return; }
    if (body.needsProfile && body.pending) { f.pending = body.pending; stepProfile(!login ? '' : 'We have no account for this address yet, so we will make one.'); return; }
    stepEmail('That did not work. Please try again.');
  }
  async function signedIn(token) {
    if (!setToken(token)) { stepEmail('We could not start your session. Please try again.'); return; }
    if (f.invite) rememberInvite(f.invite);
    done(); await afterSignIn();
  }

  // ---- step: nickname and the notice ---------------------------------------------------------------------------------------
  async function stepProfile(intro) {
    show('profile', h('h1', { tabindex: '-1' }, 'Almost done'), h('p', { class: 'status', role: 'status' }, 'Loading…'));
    let n;
    try { n = await loadNotice(); } catch (e) { n = null; }
    if (!n || !noticeComplete(n)) { show('profile', h('h1', { tabindex: '-1' }, 'Almost done'), h('p', { class: 'error', role: 'alert', id: 'flow-error' }, 'We could not load the notice you need to read first. Check your connection and reload the page.')); return; }
    if (n.blanks && !(state.manifest && state.manifest.dev_build)) { show('profile', h('h1', { tabindex: '-1' }, 'Sign-up is not open yet'), h('p', { class: 'error', role: 'alert', id: 'flow-error' }, 'Account sign-up opens soon. You can keep using Margwise without an account.'), h('p', null, h('a', { class: 'btn', href: '#/' }, 'Back to the start'))); return; }
    const e = err(), s = stat(); if (intro) s.textContent = intro;
    const nick = h('input', { type: 'text', id: 'nickname', autocomplete: 'nickname', maxLength: 40, spellcheck: false, 'aria-describedby': 'nickname-hint' });
    const consent = h('input', { type: 'checkbox', id: 'consent' });
    const research = h('input', { type: 'checkbox', id: 'research' });
    const go = h('button', { type: 'submit', class: 'btn primary', id: 'make-account', disabled: true }, 'Make my account');
    const valid = () => { const t = nick.value.trim(); return t.length >= 1 && t.length <= 40 && NICK_RE.test(t); };
    const update = () => { go.disabled = !(valid() && consent.checked); };
    nick.addEventListener('input', update); consent.addEventListener('change', update);
    const form = h('form', { novalidate: true },
      field('nickname', 'A first name or nickname', nick, 'We use it to greet you. Please do not use your full name.'),
      h('h2', null, n.title), renderNotice(n),
      h('div', { class: 'tick' }, consent, h('label', { for: 'consent' }, n.consent)),
      h('div', { class: 'tick' }, research, h('label', { for: 'research' }, n.research)),
      e, s, h('p', null, go));
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); e.textContent = '';
      if (!valid()) { e.textContent = 'Type a nickname of up to 40 characters, without < > or @.'; nick.focus(); return; }
      if (!consent.checked) { e.textContent = 'Please tick the box to say you have read the notice.'; consent.focus(); return; }
      go.disabled = true; s.textContent = 'Making your account…';
      const res = await api.post('/email/complete', { pending: f.pending, nickname: nick.value.trim(), consent: true, research: !!research.checked, idempotency_key: f.key }, { auth: false });
      if (res.ok && res.body.token) { await signedIn(res.body.token); return; }
      s.textContent = ''; update();
      if (res.error && (res.error.code === 'expired' || res.error.code === 'invalid_code')) { f.pending = null; stepEmail('That took too long. Ask for a new code to carry on.'); return; }
      e.textContent = sayError(res);
    });
    show('profile', h('h1', { tabindex: '-1' }, 'Almost done'), form);
  }

  // ---- start ---------------------------------------------------------------------------------------------------------------
  async function fromLink(token) {
    show('link', h('h1', { tabindex: '-1' }, 'Checking your link'), h('p', { class: 'status', role: 'status', 'aria-live': 'polite' }, 'One moment…'));
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return linkFailed('That link is not right.');
    const res = await api.post('/email/verify', { link: token }, { auth: false });
    if (res.ok) return afterVerify(res.body);
    linkFailed(sayError(res));
  }
  function linkFailed(msg) {
    show('link', h('h1', { tabindex: '-1' }, 'That link did not work'), h('p', { class: 'error', role: 'alert', id: 'flow-error' }, msg),
      h('p', null, 'Links work once and for 15 minutes. Ask for a new code and use that.'), h('p', null, h('a', { class: 'btn primary', href: '#/login', id: 'to-login' }, 'Log in')));
  }

  if (link !== undefined) fromLink(link); else if (login) stepEmail(); else stepBirth();
}
