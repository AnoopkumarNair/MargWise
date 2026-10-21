import { json } from './_util.js';
export async function onRequestGet({ env }) {
  let n = 0; try { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE active = 1').first(); n = r ? r.n : 0; } catch { n = 0; }
  return json({ needsCode: !!String(env.INVITE_CODE || '').trim() || n > 0 });
}
