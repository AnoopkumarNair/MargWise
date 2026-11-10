// One JSON line per request (BACKEND ADR-10). Only these fields can ever be written. Anything else is dropped here,
// so a handler cannot log a body, an email, a token or an IP by mistake.
export const LOG_FIELDS = ['ts', 'rid', 'route', 'status', 'ms', 'release', 'api_v', 'error_code'];
const clean = {
  ts: v => Number.isFinite(v) ? Math.trunc(v) : null,
  ms: v => Number.isFinite(v) ? Math.max(0, Math.round(v)) : null,
  status: v => Number.isInteger(v) && v >= 100 && v <= 599 ? v : null,
  rid: v => typeof v === 'string' && /^[0-9a-f]{8,32}$/.test(v) ? v : null,
  route: v => typeof v === 'string' && /^[A-Z]{3,7} \/[a-z0-9/_-]{0,80}$/.test(v) ? v : '?',   // a fixed route name, never the real URL
  release: v => typeof v === 'string' && /^[A-Za-z0-9._-]{1,40}$/.test(v) ? v : null,
  api_v: v => typeof v === 'string' || Number.isInteger(v) ? (/^[A-Za-z0-9._-]{1,12}$/.test(String(v)) ? v : null) : null,
  error_code: v => typeof v === 'string' && /^[a-z_]{1,24}$/.test(v) ? v : null,
};
export function logLine(entry) {
  const out = {}; for (const k of LOG_FIELDS) out[k] = clean[k](entry ? entry[k] : undefined) ?? null;
  return JSON.stringify(out);
}
// A logger writes the line with `sink` (console.log on the platform; an array push in tests).
export const makeLogger = sink => entry => { try { sink(logLine(entry)); } catch { /* logging must never break a request */ } };
