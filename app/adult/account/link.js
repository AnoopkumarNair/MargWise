// The emailed link is <origin>/work/#link=<token> (deviations D34). The token is in the fragment, so no server or log ever sees it. The router
// takes it out of the address bar at once and keeps it here, in memory, until the link screen has used it.
let held = null;
export function holdLink(t) { held = t; }
export function takeLink() { const t = held; held = null; return t; }
// '#link=abc' -> 'abc'; anything else -> null
export function linkFromHash(hash) { const m = /^#link=(.*)$/.exec(String(hash || '')); if (!m) return null; try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
