// The only code in the app that sends anything to the server. It talks to /api/v1/ with JSON (BACKEND ADR-09): replies are
// {ok:true,...} or {ok:false,error:{code,message}}. A reply header x-session-token means "replace the stored token" (deviations D33).
// Callers get one plain object back and never see a thrown error:
//   { ok, status, body, error }   body is the parsed reply; error is {code, message}. code 'network' means no reply at all.
// A 401 on a request that carried a token clears the token: the session has ended (log out everywhere, 31 days, an admin revoke).
import * as session from './session.js';

export const NETWORK = { code: 'network', message: 'We could not reach Margwise. Check your connection and try again.' };

export function makeApi({ fetchFn, store = session } = {}) {
  async function call(method, path, body, { auth = true } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = auth ? store.getToken() : null;
    if (token) headers.authorization = 'Bearer ' + token;
    let res;
    try {
      res = await (fetchFn || ((...a) => fetch(...a)))('/api/v1' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store' });
    } catch (e) { return { ok: false, status: 0, body: null, error: NETWORK }; }
    const fresh = res.headers && res.headers.get && res.headers.get('x-session-token');
    if (fresh && token) store.setToken(fresh);
    let j = null; try { j = await res.json(); } catch (e) { j = null; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, status: res.status, body: null, error: { code: 'bad_reply', message: 'Margwise sent a reply we could not read. Please try again.' } };
    if (j.ok === true && res.status >= 200 && res.status < 300) return { ok: true, status: res.status, body: j, error: null };
    const error = j.error && typeof j.error.code === 'string' ? { code: j.error.code, message: String(j.error.message || '') } : { code: 'bad_reply', message: 'Something went wrong. Please try again.' };
    if (error.code === 'unauthorized' && token && auth) store.clearToken();
    return { ok: false, status: res.status, body: j, error };
  }
  return { get: (p, o) => call('GET', p, undefined, o), post: (p, b, o) => call('POST', p, b === undefined ? {} : b, o), put: (p, b, o) => call('PUT', p, b, o) };
}

export const api = makeApi();

// What to tell a person for a failed call. The server's own messages are written to be shown; a network failure has ours.
export function sayError(res, fallback) {
  if (!res || !res.error) return fallback || 'Something went wrong. Please try again.';
  if (res.error.code === 'network') return NETWORK.message;
  return res.error.message || fallback || 'Something went wrong. Please try again.';
}
