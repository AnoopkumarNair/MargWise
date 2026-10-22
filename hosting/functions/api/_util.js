export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export function safeEq(a, b) {
  a = String(a); b = String(b); if (!b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}
export const keyOk = key => typeof key === 'string' && key.length >= 16;
async function hmac(msg, key) {
  if (!keyOk(key)) throw new Error('SIGN_KEY is missing or too short');
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const sign = (id, key) => hmac(id, key);   // legacy token format, still accepted for recent testers (see checkToken)
// Tokens are `<issued-at-ms>.<hmac(id|issued-at)>`. Self-signup tokens last 31 days, counsellor-led ones 7 hours; an admin revoke (testers.tok_after) kills older tokens.
export async function mintToken(id, key, now = Date.now()) { return now + '.' + await hmac(id + '|' + now, key); }
export async function checkToken(env, id, token, now = Date.now()) {
  const t = await env.DB.prepare('SELECT id, name, source, created_at, tok_after FROM testers WHERE id = ?').bind(id).first(); if (!t) return null;
  const maxAge = t.source === 'counsellor' ? 7 * 3600000 : 31 * 86400000; token = String(token || '');
  const dot = token.indexOf('.'); let iat;
  if (dot > 0) { iat = Number(token.slice(0, dot)); if (!Number.isFinite(iat) || iat > now + 60000 || !safeEq(token.slice(dot + 1), await hmac(id + '|' + iat, env.SIGN_KEY))) return null; }
  else { if (!safeEq(token, await hmac(id, env.SIGN_KEY))) return null; iat = t.created_at; }   // legacy token: valid only while the tester is within the normal lifetime
  if (now - iat > maxAge || (t.tok_after && iat < t.tok_after)) return null;
  return t;
}
export const retHash = (code, key) => hmac('ret:' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), key);
const RET_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRetCode() { let c = ''; while (c.length < 8) for (const x of crypto.getRandomValues(new Uint8Array(16))) if (x < 248 && c.length < 8) c += RET_ALPHA[x % 31]; return c.slice(0, 4) + '-' + c.slice(4); }
export function ipBucket(ip) {   // IPv6 addresses are bucketed by /64 so rotating inside a prefix does not dodge the limits
  ip = String(ip || 'x'); if (!ip.includes(':')) return ip;
  const [a, b = ''] = ip.split('::'); const head = a ? a.split(':') : [], tail = b ? b.split(':') : []; const full = ip.includes('::') ? head.concat(Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), tail) : head;
  return full.slice(0, 4).map(g => g.padStart(4, '0')).join(':');
}
export const ipHash = async (request, key) => (await hmac('ip:' + ipBucket(request.headers.get('cf-connecting-ip')), key)).slice(0, 16);
export async function readJson(request, max = 120000) {
  const raw = await request.text(); if (raw.length > max) return { err: 'Too large.', status: 413 };
  try { const b = JSON.parse(raw); if (!b || typeof b !== 'object' || Array.isArray(b)) return { err: 'Bad request.', status: 400 }; return { b }; } catch { return { err: 'Bad request.', status: 400 }; }
}
// Retention is OFF unless the RETENTION_DAYS env var is set. When set, the lazy daily purge deletes testers and events older than that; every purge is logged to `audit`.
// A manual admin purge (force) uses RETENTION_DAYS or, failing that, 90.
// Students whose consent sheet covers follow-up checks keep only their first name, class, consent date and follow-up notes; their game data and counsellor review are deleted
// with everyone else's. Everyone else is deleted completely. `everything` (end of pilot) ignores the age cut-off.
export async function purgeOld(env, now, force = false, everything = false) {
  if (!force && !Number(env.RETENTION_DAYS)) return null;
  const days = Math.max(1, Math.min(3650, Number(env.RETENTION_DAYS) || 90));
  if (!force) { const last = await env.DB.prepare("SELECT v FROM meta WHERE k = 'last_purge'").first(); if (last && now - Number(last.v) < 86400000) return null; }
  const cut = everything ? now + 86400000 : now - days * 86400000;
  const gone = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at < ? AND COALESCE(followup_ok, 0) = 0').bind(cut).first();
  const kept = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at < ? AND COALESCE(followup_ok, 0) = 1').bind(cut).first();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE tester_id IN (SELECT id FROM testers WHERE created_at < ?)').bind(cut),
    env.DB.prepare('DELETE FROM reviews WHERE tester_id IN (SELECT id FROM testers WHERE created_at < ?)').bind(cut),
    env.DB.prepare('DELETE FROM followups WHERE tester_id IN (SELECT id FROM testers WHERE created_at < ? AND COALESCE(followup_ok, 0) = 0)').bind(cut),
    env.DB.prepare('UPDATE testers SET ret_hash = NULL WHERE created_at < ? AND COALESCE(followup_ok, 0) = 1').bind(cut),   // kept-for-follow-up students can no longer sign back in
    env.DB.prepare('DELETE FROM testers WHERE created_at < ? AND COALESCE(followup_ok, 0) = 0').bind(cut),
    env.DB.prepare("INSERT INTO meta (k, v) VALUES ('last_purge', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(now)),
    env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, everything ? 'end_of_pilot' : 'purge', JSON.stringify({ deleted: gone ? gone.n : 0, keptForFollowUp: kept ? kept.n : 0, retentionDays: days, forced: !!force })),
  ]);
  return { deleted: gone ? gone.n : 0, keptForFollowUp: kept ? kept.n : 0, retentionDays: days };
}
