import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage({viewport:{width:390,height:844}}); pg.setDefaultTimeout(4000); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.clock.install();
await pg.route('**/fonts.g*/**', r=>r.abort()); await pg.route('**/gsap.min.js', r=>r.fulfill({path:'gsap.min.js',contentType:'application/javascript'}));
await pg.goto('file:///tmp/claude-0/-home-user/f4b06d8a-580e-5b33-bacd-fb95950c9cc3/scratchpad/site/index.html'); await pg.clock.fastForward(3000);
await pg.click('#begin'); await pg.clock.fastForward(1500); await pg.click('#beatGo'); await pg.clock.fastForward(2000);
const st=()=>pg.evaluate(()=>({v:document.querySelector('.screen.on')?.id, prog:document.getElementById('prog')?.innerText, busy:document.body.classList.contains('busy'), beat:!document.getElementById('beat').hidden, n:document.querySelectorAll('.obj').length}));
let places=0, locks=0; const lockNames=[]; const t0=Date.now();
for(let i=0;i<4000 && Date.now()-t0<100000;i++){
  const s=await st();
  if(s.v==='dreams'){console.log('DREAMS; places',places,'lock screens',locks,lockNames.join('|'));break}
  if(s.beat){await pg.click('#beatGo'); await pg.clock.fastForward(1500); continue}
  if(s.v==='lock'){ const nm=await pg.evaluate(()=>document.getElementById('lkName').innerText); lockNames.push(nm.slice(5,12)); locks++; await pg.locator('#lkOpts button').nth(locks%4).click(); await pg.clock.fastForward(300); await pg.click('#lkNext'); await pg.clock.fastForward(1800); continue}
  if(s.v==='stop' && !s.busy){ places++; const ids=await pg.evaluate(()=>[...document.querySelectorAll('.obj')].map(o=>o.dataset.id)); const pref=['R','I','A'].map(t=>ids.findIndex(x=>x.endsWith('-'+t))); const a=pref[0]>=0?pref[0]:(pref[1]>=0?pref[1]:0); const b2=pref[1]>=0&&pref[1]!==a?pref[1]:(a+1)%4; await pg.locator('.obj').nth(a).click({force:true}); await pg.locator('.obj').nth(b2).click({force:true}); await pg.click('#light'); await pg.clock.fastForward(3000); continue }
  await pg.clock.fastForward(500);
}
const s=await st(); console.log(JSON.stringify(s));
if(s.v==='dreams'){ await pg.click('#dreamGo'); await pg.clock.fastForward(800); await pg.click('#fnSkip'); await pg.clock.fastForward(800); await pg.click('#fnGo'); await pg.clock.fastForward(1200);
 console.log('apt:',await pg.evaluate(()=>document.getElementById('aptCard')?.innerText.replace(/\n/g,' | ')),'\nnotes:',await pg.evaluate(()=>document.getElementById('notes').innerText)); }
console.log(errs); await b.close();
