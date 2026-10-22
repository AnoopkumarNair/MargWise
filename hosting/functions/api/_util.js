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
export const sign = (id, key) => hmac(id, key);
export const ipHash = async (request, key) => (await hmac('ip:' + (request.headers.get('cf-connecting-ip') || 'x'), key)).slice(0, 16);
export async function readJson(request, max = 120000) {
  const raw = await request.text(); if (raw.length > max) return { err: 'Too large.', status: 413 };
  try { const b = JSON.parse(raw); if (!b || typeof b !== 'object' || Array.isArray(b)) return { err: 'Bad request.', status: 400 }; return { b }; } catch { return { err: 'Bad request.', status: 400 }; }
}
// Retention is OFF unless the RETENTION_DAYS env var is set. When set, the lazy daily purge deletes testers and events older than that; every purge is logged to `audit`.
// A manual admin purge (force) uses RETENTION_DAYS or, failing that, 90.
export async function purgeOld(env, now, force = false) {
  if (!force && !Number(env.RETENTION_DAYS)) return null;
  const days = Math.max(1, Math.min(3650, Number(env.RETENTION_DAYS) || 90));
  if (!force) { const last = await env.DB.prepare("SELECT v FROM meta WHERE k = 'last_purge'").first(); if (last && now - Number(last.v) < 86400000) return null; }
  const cut = now - days * 86400000;
  const old = await env.DB.prepare('SELECT COUNT(*) AS n FROM testers WHERE created_at < ?').bind(cut).first();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE tester_id IN (SELECT id FROM testers WHERE created_at < ?)').bind(cut),
    env.DB.prepare('DELETE FROM reviews WHERE tester_id IN (SELECT id FROM testers WHERE created_at < ?)').bind(cut),
    env.DB.prepare('DELETE FROM testers WHERE created_at < ?').bind(cut),
    env.DB.prepare("INSERT INTO meta (k, v) VALUES ('last_purge', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(now)),
    env.DB.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'purge', JSON.stringify({ testers: old ? old.n : 0, retentionDays: days, forced: !!force })),
  ]);
  return { testers: old ? old.n : 0, retentionDays: days };
}
