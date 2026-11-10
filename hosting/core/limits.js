// Abuse limits that use the existing tables (SPEC 9, BACKEND ADR-04). Counts only, no personal data.
//   per IP bucket:  rows in `joins` (the student sign-up table), with the key prefix 'e:' (start) or 'v:' (verify) plus a keyed hash of the IP bucket.
//                   Rows expire after 24 hours (purge.js). The raw IP is never stored.
//   per address:    rows in `email_sends`: the hour 'YYYY-MM-DDTHH' and the day 'YYYY-MM-DD' for the keyed email hash.
//   site-wide:      the day's `codes_sent` counter in ops_daily.
import { ipKey } from './keys.js';

export const HOUR = 3600000, DAY = 86400000;
export const LIMITS = { startPerIpHour: 20, verifyPerIpHour: 60, codesPerAddressHour: 3, codesPerAddressDay: 10 };
export const hourKey = ms => new Date(ms).toISOString().slice(0, 13);
export const dayKey = ms => new Date(ms).toISOString().slice(0, 10);

// Counts this attempt and says whether the bucket is over its hourly limit. Every attempt counts, including the one that is refused.
export async function ipLimited(deps, request, prefix, max) {
  const key = prefix + await ipKey(deps, request), now = deps.now();
  const r = await deps.db.prepare('SELECT COUNT(*) AS n FROM joins WHERE ip = ? AND ts > ?').bind(key, now - HOUR).first();
  await deps.db.prepare('INSERT INTO joins (ip, ts) VALUES (?, ?)').bind(key, now).run();
  return !!(r && r.n >= max);
}
export async function sentCounts(deps, eh) {
  const now = deps.now(), get = async k => { const r = await deps.db.prepare('SELECT n FROM email_sends WHERE email_hash = ? AND day = ?').bind(eh, k).first(); return r ? r.n : 0; };
  return { hour: await get(hourKey(now)), day: await get(dayKey(now)) };
}
