export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export function safeEq(a, b) {
  a = String(a); b = String(b); if (!b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}
async function hmac(msg, key) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key || 'missing'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const sign = (id, key) => hmac(id, key);
export const ipHash = async (request, key) => (await hmac('ip:' + (request.headers.get('cf-connecting-ip') || 'x'), key)).slice(0, 16);
export async function readJson(request, max = 120000) {
  const raw = await request.text(); if (raw.length > max) return { err: 'Too large.', status: 413 };
  try { const b = JSON.parse(raw); if (!b || typeof b !== 'object' || Array.isArray(b)) return { err: 'Bad request.', status: 400 }; return { b }; } catch { return { err: 'Bad request.', status: 400 }; }
}
