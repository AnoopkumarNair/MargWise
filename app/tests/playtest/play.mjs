// Step-by-step play driver for Margwise. See usage at bottom.
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
// Output (logs, screenshots) goes to PLAYTEST_OUT, default app/tests/playtest/out (gitignored).
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SCRATCH = process.env.PLAYTEST_OUT || path.join(HERE, 'out');
const URL_ = process.env.URL_ || 'http://localhost:8788/';
const VPS = { phone: [390, 844, true], tablet: [820, 1180, true], laptop: [1366, 768, false] };

const COLLECT = () => {
  const vis = e => { for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || p.hidden) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  // screen id: highest z-index covering overlay, else .screen.on
  let best = null, bz = -1;
  document.querySelectorAll('[id]').forEach(e => { if (!vis(e)) return; const cs = getComputedStyle(e); if (!['fixed', 'absolute'].includes(cs.position) && !e.classList.contains('screen')) return; const r = e.getBoundingClientRect(); if (r.width < innerWidth * .8 || r.height < innerHeight * .6) return; if (e.classList.contains('screen') && !e.classList.contains('on')) return; if (!(e.innerText || '').trim() && !e.querySelector('button,input')) return; if (cs.pointerEvents === 'none') return; const z = (parseInt(cs.zIndex) || 0) + (e.classList.contains('screen') ? 0 : 0.5); if (z >= bz) { bz = z; best = e; } });
  const screen = best ? best.id : null; const on = document.querySelector('.screen.on');
  // text
  const out = []; const scope = best || document.body; const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName)) continue; const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue; if (!vis(p)) continue; { const d = p.closest('details'); if (d && !d.open && !(p.closest('summary') && p.closest('summary').parentElement === d)) continue; } out.push([t, p.closest('button,a,input,select,textarea,label,.obj,.fcard') ? 1 : 0, p]); }
  // block-ish joining: new line when block ancestor changes
  const lines = []; let lastBlk = null;
  for (const [t, , p] of out) { let b = p; while (b && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement; if (b === lastBlk && lines.length) lines[lines.length - 1] += ' ' + t; else lines.push(t); lastBlk = b; }
  // interactives
  document.querySelectorAll('[data-h]').forEach(e => e.removeAttribute('data-h'));
  const els = []; let k = 0;
  scope.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick],.obj,.fcard,[tabindex]').forEach(e => {
    if (!vis(e)) return; if (e.tagName === 'INPUT' && e.type === 'hidden') return;
    const r = e.getBoundingClientRect(); if (r.right < 0 || r.bottom < 0 || r.left > innerWidth) return;
    if (r.top >= 0 && r.bottom <= innerHeight) { const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = r.top + r.height / 2; const hit = document.elementFromPoint(cx, cy); if (hit && !e.contains(hit) && !hit.contains(e)) return; }
    // skip if an ancestor interactive already listed with same label (nested)
    k++; e.setAttribute('data-h', k);
    let sel = e.id ? '#' + CSS.escape(e.id) : (e.dataset.id ? `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''}[data-id="${e.dataset.id}"]` : `[data-h="${k}"]`);
    let label = (e.innerText || e.value || e.placeholder || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    if (e.tagName === 'INPUT' && (e.type === 'checkbox' || e.type === 'radio')) label = (e.closest('label')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90) + (e.checked ? ' [checked]' : ' [unchecked]');
    if (e.tagName === 'INPUT' && e.type === 'text') label = `(text input) placeholder="${e.placeholder || ''}" value="${e.value}"`;
    const dis = e.disabled || e.getAttribute('aria-disabled') === 'true' || e.classList.contains('dis') || e.classList.contains('disabled');
    els.push({ n: k, sel, tag: e.tagName.toLowerCase(), type: e.type || '', label, disabled: !!dis, sel_on: e.classList.contains('on') || e.classList.contains('sel') || e.getAttribute('aria-pressed') === 'true', y: Math.round(r.top), inView: r.top >= 0 && r.bottom <= innerHeight });
  });
  return { screen, onScreen: on && on.id, busy: document.body.classList.contains('busy'), lines, els, sh: document.documentElement.scrollHeight };
};

async function serve(port) {
  const [w, h, touch] = VPS[process.env.VP || 'phone'] || VPS.phone; const vpName = process.env.VP || 'phone';
  const dir = path.join(SCRATCH, 'runs', String(port)); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(5000); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await pg.goto(URL_); const t0 = Date.now(); let actions = 0; const log = []; let lastEls = [];
  const save = () => fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify({ viewport: vpName, url: URL_, started: new Date(t0).toISOString(), entries: log, errors: errs }, null, 1));
  const settle = async (ms) => { await pg.waitForTimeout(ms); // DOM-quiet + not busy
    const end = Date.now() + 6000; let lastSig = '', still = 0;
    while (Date.now() < end) { const sig = await pg.evaluate(() => document.body.classList.contains('busy') + '|' + document.body.innerText.length + '|' + (document.querySelector('.screen.on')?.id) + '|' + document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length).catch(() => ''); if (sig === lastSig && !sig.startsWith('true')) { if (++still >= 3) break; } else still = 0; lastSig = sig; await pg.waitForTimeout(250); } };
  const look = async (action, note) => {
    const d = await pg.evaluate(COLLECT); lastEls = d.els; const text = d.lines.join('\n'); const words = text.split(/\s+/).filter(Boolean).length;
    const shot = path.join(dir, `shot_${String(actions).padStart(3, '0')}.png`); await pg.screenshot({ path: shot });
    const secs = Math.round((Date.now() - t0) / 1000); const hash = crypto.createHash('md5').update(d.screen + text).digest('hex').slice(0, 8);
    const entry = { n: actions, t: new Date().toISOString(), elapsedSec: secs, action, note: note || undefined, screen: d.screen, activeScreenEl: d.onScreen, busy: d.busy, textLen: text.length, words, hash, text, choices: d.els.map(e => ({ n: e.n, sel: e.sel, label: e.label, disabled: e.disabled })), shot };
    log.push(entry); save();
    let o = `[action #${actions}] elapsed ${secs}s | screen: ${d.screen}${d.busy ? ' (busy/animating)' : ''} | viewport ${vpName} ${w}x${h}\n`;
    o += `--- TEXT (${words} words) ---\n${text}\n--- ELEMENTS ---\n`;
    o += d.els.map(e => `${String(e.n).padStart(2)}. <${e.tag}${e.type && e.tag === 'input' ? ' ' + e.type : ''}> ${e.sel}  "${e.label}"${e.disabled ? ' [DISABLED]' : ''}${e.sel_on ? ' [selected]' : ''}${e.inView ? '' : ' [offscreen: scroll]'}`).join('\n') || '(none)';
    o += `\n--- screenshot: ${shot}` + (note ? `\nNOTE: ${note}` : '') + (errs.length ? `\nPAGE ERRORS: ${errs.splice(0).join(' || ')}` : ''); return o; };
  const target = s => /^\d+$/.test(s) ? `[data-h="${s}"]` : s;
  const cmds = {
    async look() { await settle(300); return look('look'); },
    async click([s]) { const sel = target(s); const lab = lastEls.find(e => String(e.n) === s)?.label; let note; const loc = pg.locator(sel).first();
      try { await loc.click({ timeout: 3000 }); } catch (e) { if (!/\.obj/.test(sel) && !/obj/.test(await loc.getAttribute('class').catch(() => '') || '')) throw e; try { await loc.click({ force: true, timeout: 3000 }); note = 'normal click failed (' + e.message.split('\n')[0].slice(0, 90) + '); used force click'; } catch (e2) { note = 'CLICK FAILED (not clickable like a human would see it): ' + e2.message.split('\n')[0].slice(0, 120); } }
      actions++; await settle(700); return look(`click ${s}${lab ? ' "' + lab + '"' : ''}`, note); },
    async fill([s, ...t]) { await pg.locator(target(s)).first().fill(t.join(' ')); actions++; await settle(400); return look(`fill ${s}`); },
    async check([s]) { await pg.locator(target(s)).first().check({ force: true }); actions++; await settle(400); return look(`check ${s}`); },
    async wait([ms]) { await pg.waitForTimeout(+ms || 1000); actions++; await settle(100); return look(`wait ${ms}`); },
    async scroll([s, px]) { const r = await pg.evaluate(([s, px]) => { let el = s === 'page' ? (document.querySelector('.screen.on') || document.scrollingElement) : document.querySelector(s); if (!el) return 'no such element'; const sc = (e => { for (let p = e; p; p = p.parentElement) { if (p.scrollHeight > p.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(p).overflowY)) return p; } return document.scrollingElement; })(el); const b = sc.scrollTop; sc.scrollBy(0, +px); return 'scrolled ' + (sc.id || sc.tagName) + ' from ' + b + ' to ' + sc.scrollTop; }, [s, px || 400]); actions++; await settle(400); return look(`scroll ${s} ${px}`, r); },
    async eval([...js]) { const r = await pg.evaluate(js.join(' ')).catch(e => 'ERR ' + e.message); actions++; await settle(300); return look('eval', 'result: ' + JSON.stringify(r)); },
    async stop() { save(); setTimeout(() => process.exit(0), 100); return 'stopped. log at ' + path.join(dir, 'log.json'); },
  };
  let busyQ = Promise.resolve();
  http.createServer((req, res) => { let body = ''; req.on('data', c => body += c); req.on('end', () => { busyQ = busyQ.then(async () => { try { const { cmd, args } = JSON.parse(body); const out = await (cmds[cmd] || (async () => 'unknown command ' + cmd))(args || []); res.end(out); if (cmd === 'stop') await b.close().catch(() => { }); } catch (e) { res.end('ERROR ' + e.message); } }); }); }).listen(port, '127.0.0.1', () => console.log(`play daemon on 127.0.0.1:${port}, viewport ${vpName} ${w}x${h}, game ${URL_}`));
  actions = 0; await settle(1500); await look('start'); // initial log entry
}
const [a1, ...rest] = process.argv.slice(2);
if (a1 === 'serve') await serve(+rest[0]);
else if (/^\d+$/.test(a1)) {
  const [cmd, ...args] = rest; const req = http.request({ host: '127.0.0.1', port: +a1, method: 'POST', timeout: 120000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => console.log(d)); });
  req.on('error', e => { console.error('cannot reach daemon: ' + e.message); process.exit(1); }); req.end(JSON.stringify({ cmd: cmd || 'look', args }));
} else console.log('usage: play.mjs serve <port>   |   play.mjs <port> look|click <sel|n>|fill <sel> <text>|check <sel>|wait <ms>|scroll <sel|page> <px>|eval <js>|stop');
