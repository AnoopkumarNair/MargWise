// The adult session token (BACKEND ADR-04: a Bearer token kept in localStorage; it never goes in a URL). This is the only file in the app
// that touches browser storage, and the token and the invite code are the only things it keeps. Reading does not write: a person who
// never signs in has nothing stored. Storage can be blocked (private windows, site settings), so every call is wrapped and the token
// also lives in memory for this visit.
const TOKEN_KEY = 'mw_adult_token';
const INVITE_KEY = 'mw_adult_invite';
const TOKEN_RE = /^v[1-9][0-9]{0,2}\.[0-9a-f-]{36}\.[0-9]{13}\.[0-9a-f]{64}$/;
let mem = null; let inviteMem = null; let loaded = false;
const listeners = new Set();

function store() { try { return window.localStorage; } catch (e) { return null; } }
function read(key) { try { const s = store(); return s ? s.getItem(key) : null; } catch (e) { return null; } }
function write(key, value) { try { const s = store(); if (s) { if (value == null) s.removeItem(key); else s.setItem(key, value); } } catch (e) { /* memory only */ } }
function tell() { for (const f of listeners) { try { f(); } catch (e) { /* a listener must not break the others */ } } }

export function getToken() {
  if (!loaded) { loaded = true; const t = read(TOKEN_KEY); if (t && TOKEN_RE.test(t)) mem = t; else if (t) write(TOKEN_KEY, null); }
  return mem;
}
export function setToken(t) {
  if (typeof t !== 'string' || !TOKEN_RE.test(t)) return false;
  loaded = true; const changed = t !== mem; mem = t; write(TOKEN_KEY, t); if (changed) tell(); return true;
}
export function clearToken() { loaded = true; const had = !!mem; mem = null; write(TOKEN_KEY, null); if (had) tell(); }
export function onSessionChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// The invite code is not personal. It is remembered on this device after a sign-in so that logging in again does not ask for it twice
// (the server wants it on every request for a code). A code from ?c= is held in memory first.
export function hintInvite(code) { if (typeof code === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(code)) inviteMem = code; }
export function recalledInvite() { return inviteMem || (() => { const v = read(INVITE_KEY); return v && /^[A-Za-z0-9_-]{1,24}$/.test(v) ? v : ''; })(); }
export function rememberInvite(code) { if (typeof code === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(code)) { inviteMem = code; write(INVITE_KEY, code); } }
export function forgetInvite() { inviteMem = null; write(INVITE_KEY, null); }
