import { json, readJson, keyOk, checkToken } from './_util.js';
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
  code_shown: () => ({}), code_copy: () => ({}), code_share: () => ({}),
  walk_start: d => ({ seed: int(d.seed, 0, 1e9), vw: int(d.vw, 0, 10000), vh: int(d.vh, 0, 10000) }),
  place_done: d => { const spent = {}; if (d.spent && typeof d.spent === 'object') for (const k of Object.keys(d.spent).slice(0, 8)) { const n = int(d.spent[k], 0, 2); if (optId.test(k) && n !== null) spent[k] = n; } return { scene: sceneId.test(String(d.scene)) ? d.scene : null, echo: bool(d.echo), spent, order: arr(d.order, 4, x => (optId.test(String(x)) ? x : null)), ms: int(d.ms, 0, 3600000), n: int(d.n, 0, 30) }; },
  intro: d => ({ n: int(d.n, 0, 12) }),
  why_open: d => ({ id: str(d.id, 12) }),
  walk_resume: d => ({ n: int(d.n, 0, 40) }),
  beat: d => ({ who: str(d.who, 30) }),
  context: d => ({ cls: str(d.cls, 8), board: str(d.board, 8), lean: str(d.lean, 12) }),
  result: d => ({ code: arr(d.code, 3, area), alts: arr(d.alts, 6, a => (Array.isArray(a) ? a.slice(0, 3).map(area) : null)), profile: obj6(d.profile, num), scores: obj6(d.scores, num), confidence: str(d.confidence, 10), noSignal: bool(d.noSignal), cautious: bool(d.cautious), biased: bool(d.biased), sd: num(d.sd), stops: int(d.stops, 0, 30), mixed: bool(d.mixed), lowEngagement: bool(d.lowEngagement), slots: arr(d.slots, 4, x => int(x, 0, 100)) }),
  snapshot: d => {
    const choices = arr(d.choices, 40, c => { if (!c || typeof c !== 'object') return null; const sp = {}; if (c.spent && typeof c.spent === 'object') for (const k of Object.keys(c.spent).slice(0, 8)) { const n = int(c.spent[k], 0, 2); if (optId.test(k) && n !== null) sp[k] = n; } const o = { sceneId: str(c.sceneId, 12), spent: sp }; if (c.echoOf) o.echoOf = str(c.echoOf, 8); return /^s\d{2}(~echo)?$/.test(o.sceneId) ? o : null; });
    const apt = {}; if (d.apt && typeof d.apt === 'object') for (const k of ['N', 'V', 'S', 'P']) apt[k] = arr(d.apt[k], 2, x => (Array.isArray(x) ? [int(x[0], 0, 600000) || 0, x[1] ? 1 : 0, x[2] ? 1 : 0] : null));
    return { v: 1, choices, apt, seed: int(d.seed, 0, 1e9), slots: arr(d.slots, 4, x => int(x, 0, 100)), ctx: { cls: str(d.ctx && d.ctx.cls, 8), board: str(d.ctx && d.ctx.board, 8), lean: str(d.ctx && d.ctx.lean, 12) }, code: arr(d.code, 3, area), noSignal: bool(d.noSignal) };
  },
  progress: d => { const o = V.snapshot(d); delete o.code; delete o.noSignal; const ld = {}; if (d.lockDone && typeof d.lockDone === 'object') for (const k of Object.keys(d.lockDone).slice(0, 12)) ld[str(k, 12)] = d.lockDone[k] ? 1 : 0; o.lockDone = ld; return o; },
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
  const id = String(b.testerId || ''); if (!(await checkToken(env, id, b.token))) return json({ error: 'Not allowed.' }, 403);
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE tester_id = ? AND ts > ?').bind(id, Date.now() - 86400000).first();
  if (day && day.n > 4000) return json({ error: 'Daily limit reached.' }, 429);
  const evs = Array.isArray(b.events) ? b.events.slice(0, 40) : [], session = str(b.session, 16), stmts = [], now = Date.now();
  for (const e of evs) {
    if (!e || typeof e !== 'object' || !V[e.type]) continue;
    const d = e.data && typeof e.data === 'object' ? e.data : {}, data = JSON.stringify(V[e.type](d));
    if (data.length > 6000) continue;
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO events (tester_id, session_id, ts, type, data, eid) VALUES (?, ?, ?, ?, ?, ?)').bind(id, session, now, e.type, data, str(e.eid, 40) || null));
  }
  if (evs.some(e => e && (e.type === 'progress' || e.type === 'snapshot'))) stmts.unshift(env.DB.prepare("DELETE FROM events WHERE tester_id = ? AND type = 'progress'").bind(id));   // only the latest unfinished walk is kept
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, n: stmts.length });
}
