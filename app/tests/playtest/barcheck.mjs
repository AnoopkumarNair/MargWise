// Layout check for sticky bottom bars: node barcheck.mjs <port>   (daemon at a screen with a bar, e.g. the reveal screen).
// For each size it scrolls the active screen to the bottom and fails if any text box overlaps a sticky or fixed bar at the bottom.
import http from 'http';
const port = +process.argv[2]; const SIZES = [[390, 844], [360, 640], [820, 1180]];
const call = (cmd, ...args) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, method: 'POST' }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res(d)); }); r.on('error', rej); r.end(JSON.stringify({ cmd, args })); });
const JS = `(() => { const sc = document.querySelector('.screen.on'); sc.scrollTop = sc.scrollHeight;
  const bars = [...sc.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return (c.position === 'sticky' || c.position === 'fixed') && e.getBoundingClientRect().bottom >= innerHeight - 2 && e.getBoundingClientRect().height > 20; });
  const bad = []; for (const bar of bars) { const b = bar.getBoundingClientRect();
    sc.querySelectorAll('*').forEach(e => { if (bar.contains(e) || e.contains(bar)) return; if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = e.getBoundingClientRect(); if (r.width && r.height && r.bottom > b.top + 1 && r.top < b.bottom) bad.push(e.tagName + ' ' + e.textContent.trim().slice(0, 40)); }); }
  return JSON.stringify({ screen: sc.id, bars: bars.length, bad }); })()`;
let fail = false;
for (const [w, h] of SIZES) { await call('resize', String(w), String(h)); const o = await call('eval', JS); const m = /result: "(.*)"\s*$/m.exec(o.split('\n').find(l => l.startsWith('NOTE:')) || ''); const r = m ? JSON.parse(JSON.parse('"' + m[1] + '"')) : { error: 'no result' };
  const ok = r.bars > 0 && !(r.bad && r.bad.length) && !r.error; if (!ok) fail = true; console.log(`${w}x${h}`, ok ? 'ok' : 'FAIL', JSON.stringify(r)); }
process.exit(fail ? 1 : 0);
