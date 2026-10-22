import { json, safeEq, sign, readJson, keyOk } from './_util.js';
const AREAS = ['R', 'I', 'A', 'S', 'E', 'C'];
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
const num = v => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) < 1e6 ? +n.toFixed(4) : null; };
const bool = v => v === true;
const rate = v => int(v, 1, 5);
const optId = /^s\d{2}-[A-Z]$/, sceneId = /^s\d{2}$/;
const arr = (v, n, f) => (Array.isArray(v) ? v.slice(0, n).map(f).filter(x => x !== null) : []);
const area = v => (AREAS.includes(v) ? v : null);
const obj6 = (v, f) => { const o = {}; if (v && typeof v === 'object') for (const a of AREAS) { const x = f(v[a]); if (x !== null) o[a] = x; } return o; };
const V = {
  join: d => ({ vw: int(d.vw, 0, 10000), vh: int(d.vh, 0, 10000) }),
  walk_start: d => ({ seed: int(d.seed, 0, 1e9), vw: int(d.vw, 0, 10000), vh: int(d.vh, 0, 10000) }),
  place_done: d => { const spent = {}; if (d.spent && typeof d.spent === 'object') for (const k of Object.keys(d.spent).slice(0, 8)) { const n = int(d.spent[k], 0, 2); if (optId.test(k) && n !== null) spent[k] = n; } return { scene: sceneId.test(String(d.scene)) ? d.scene : null, echo: bool(d.echo), spent, order: arr(d.order, 4, x => (optId.test(String(x)) ? x : null)), ms: int(d.ms, 0, 3600000), n: int(d.n, 0, 30) }; },
  beat: d => ({ who: str(d.who, 30) }),
  context: d => ({ cls: str(d.cls, 8), board: str(d.board, 8), lean: str(d.lean, 12) }),
  result: d => ({ code: arr(d.code, 3, area), alts: arr(d.alts, 6, a => (Array.isArray(a) ? a.slice(0, 3).map(area) : null)), profile: obj6(d.profile, num), scores: obj6(d.scores, num), confidence: str(d.confidence, 10), noSignal: bool(d.noSignal), cautious: bool(d.cautious), biased: bool(d.biased), sd: num(d.sd), stops: int(d.stops, 0, 30), mixed: bool(d.mixed), lowEngagement: bool(d.lowEngagement), slots: arr(d.slots, 4, x => int(x, 0, 100)) }),
  fields: d => ({ bias: d.bias === true, order: arr(d.order, 24, x => str(x, 12)), scores: arr(d.scores, 24, num) }),
  field_open: d => ({ id: str(d.id, 12) }),
  abroad: d => ({ field: d.field ? str(d.field, 12) : null, country: str(d.country, 3), route: d.route === 'B' ? 'B' : 'A' }),
  apt: d => { const s = {}; if (d.s && typeof d.s === 'object') for (const k of ['N', 'V', 'S', 'P']) { const n = int(d.s[k], 0, 3); if (n !== null) s[k] = n; } const items = {}; if (d.items && typeof d.items === 'object') for (const k of ['N', 'V', 'S', 'P']) items[k] = arr(d.items[k], 2, x => (Array.isArray(x) ? x.slice(0, 4).map(v => int(v, 0, 600000)).filter(v => v !== null) : null)); return { s, items }; },
  self: d => ({ v: rate(d.v) }),
  areas: d => obj6(d, rate),
  feedback: d => ({ look: rate(d.look), clear: rate(d.clear), fun: rate(d.fun), puz: rate(d.puz), text: str(d.text, 1500) }),
  error: d => ({ msg: str(d.msg, 200), at: str(d.at, 80) })
};
export async function onRequestPost({ request, env }) {
  if (!keyOk(env.SIGN_KEY)) return json({ error: 'Not available right now.' }, 503);
  const r = await readJson(request, 120000); if (r.err) return json({ error: r.err }, r.status); const b = r.b;
  const id = String(b.testerId || ''); if (!safeEq(String(b.token || ''), await sign(id, env.SIGN_KEY))) return json({ error: 'Not allowed.' }, 403);
  const exists = await env.DB.prepare('SELECT 1 AS x FROM testers WHERE id = ?').bind(id).first(); if (!exists) return json({ error: 'Not allowed.' }, 403);
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE tester_id = ? AND ts > ?').bind(id, Date.now() - 86400000).first();
  if (day && day.n > 4000) return json({ error: 'Daily limit reached.' }, 429);
  const evs = Array.isArray(b.events) ? b.events.slice(0, 40) : [], session = str(b.session, 16), stmts = [], now = Date.now();
  for (const e of evs) {
    if (!e || typeof e !== 'object' || !V[e.type]) continue;
    const d = e.data && typeof e.data === 'object' ? e.data : {}, data = JSON.stringify(V[e.type](d));
    if (data.length > 6000) continue;
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO events (tester_id, session_id, ts, type, data, eid) VALUES (?, ?, ?, ?, ?, ?)').bind(id, session, now, e.type, data, str(e.eid, 40) || null));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, n: stmts.length });
}
