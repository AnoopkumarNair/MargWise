// Cloudflare Turnstile (SPEC 9, BACKEND ADR-04): the human check for sign-up and log-in. Turnstile cannot be copied into /vendor/ (Cloudflare
// requires its own script), so this is the one place the page loads a script from another site. The /work/ policy allows exactly that host for
// scripts and frames (hosting/public/_headers), and the script is added only when the person reaches the email step.
// The site key is public. build.py puts it in <meta name="mw-turnstile"> (env TURNSTILE_SITEKEY at build time).
//   mode 'widget'  a key is set: show the check
//   mode 'dev'     no key and a test build (manifest.dev_build): no widget; the server's test setting accepts a placeholder
//   mode 'off'     no key in a real build: sign-up and log-in say they are not open yet (fails closed)
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const DEV_TOKEN = 'dev-no-widget';
let loading = null;

export function siteKey() { const m = document.querySelector('meta[name="mw-turnstile"]'); const v = m ? String(m.content || '').trim() : ''; return /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : ''; }
export function turnstileMode(manifest, key = siteKey()) { return key ? 'widget' : (manifest && manifest.dev_build ? 'dev' : 'off'); }

function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = SRC; s.async = true; s.defer = true;
    s.onload = () => (window.turnstile ? ok(window.turnstile) : (loading = null, bad(new Error('turnstile missing'))));
    s.onerror = () => { loading = null; bad(new Error('turnstile blocked')); };
    document.head.appendChild(s);
  });
  return loading;
}

// Shows the check inside `el`. Returns { reset(), remove() }. A token works once, so call reset() after every try.
export async function mountTurnstile(el, key, { onToken, onExpire, onError }) {
  const t = await loadScript();
  const id = t.render(el, { sitekey: key, theme: 'light', callback: tok => onToken(tok), 'expired-callback': () => onExpire(), 'error-callback': () => onError() });
  return { reset() { try { t.reset(id); } catch (e) { /* gone */ } }, remove() { try { t.remove(id); } catch (e) { /* gone */ } } };
}
