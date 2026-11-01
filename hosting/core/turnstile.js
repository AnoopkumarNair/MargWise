// Cloudflare Turnstile check, done on the server (BACKEND ADR-04, SPEC 9). makeTurnstile(secret) -> async token => true | false.
// It sends the secret and the token only, never the person's address. A network error or a bad reply throws, and the handler answers
// `unavailable` (fail closed: no check, no code). Local and preview use Cloudflare's test secrets, which always pass or always fail.
const URL_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's documented test secrets (always pass, always fail, token already spent) all look like 1x000...AA. In production they are refused,
// as if no secret were set, because the always-pass one would let any bot through.
export const isTestSecret = s => /^[123]x0{20,}[A-Za-z0-9]*$/.test(String(s));
export function makeTurnstile(secret, fetchFn = (...a) => fetch(...a), { production = false } = {}) {
  if (typeof secret !== 'string' || secret.length < 8) return null;
  if (production && isTestSecret(secret)) return null;
  return async function verify(token) {
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const res = await fetchFn(URL_VERIFY, { method: 'POST', body: new URLSearchParams({ secret, response: token }), signal: ctl.signal });
      if (!res.ok) throw new Error('turnstile status ' + res.status);
      const body = await res.json();
      return !!(body && body.success === true);
    } finally { clearTimeout(timer); }
  };
}
