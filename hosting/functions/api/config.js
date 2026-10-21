import { json } from './_util.js';
export async function onRequestGet({ env }) { return json({ needsCode: !!String(env.INVITE_CODE || '').trim() }); }
