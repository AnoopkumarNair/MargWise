// Hosted-site tablet and desktop walk. Usage: SITE=https://margwise.byteheaven.in/ CODE=<invite code> OUT=<dir> node app/tests/hosted_tablet.mjs [viewport-name]
// Plays the whole game on tablet viewports (fake clock), screenshots every screen, and flags elements outside the viewport. Needs playwright and a Chromium.
import { chromium } from 'playwright'; import fs from 'fs';
const URL=process.env.SITE||'https://margwise.byteheaven.in/', CODE=process.env.CODE; if(!CODE){console.error('Set CODE to a valid invite code');process.exit(1)};
const VPS={ 'ipad-portrait':[768,1024], 'ipad-landscape':[1024,768], 'tab-large-portrait':[820,1180], 'tab-large-landscape':[1180,820], 'android-tab':[800,1280] };
const only=process.argv[2]; const out={};
const b=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});
for(const [name,[w,h]] of Object.entries(VPS)){ if(only&&only!==name)continue;
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:false}); const pg=await ctx.newPage(); pg.setDefaultTimeout(6000); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('requestfailed',r=>errs.push('reqfail '+r.url().slice(-50)));
  const issues=[]; let k=0;
  const snap=async(tag)=>{ await pg.waitForTimeout(1000); k++; const f=`${process.env.OUT||'/tmp/tab'}/${name}_${String(k).padStart(2,'0')}_${tag}.png`; await pg.screenshot({path:f});
    const m=await pg.evaluate(()=>{const vw=innerWidth,vh=innerHeight,bad=[];const sc=document.querySelector('.screen.on');
      document.querySelectorAll('button,a,input,select,textarea').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none'||e.closest('[hidden]'))return;
        let p=e.parentElement,scroll=false;while(p){const o=getComputedStyle(p).overflowY;if((o==='auto'||o==='scroll')&&p.scrollHeight>p.clientHeight+2){scroll=true;break}p=p.parentElement}
        if(r.left<-1||r.right>vw+1||(!scroll&&(r.bottom>vh+1||r.top<-1)))bad.push((e.id||e.className||e.tagName).toString().slice(0,30)+' '+Math.round(r.left)+','+Math.round(r.top)+'-'+Math.round(r.right)+','+Math.round(r.bottom))});
      return {hScroll:document.documentElement.scrollWidth-vw,screen:sc&&sc.id,bad}});
    if(m.hScroll>0||m.bad.length)issues.push({tag,...m}); };
  await pg.clock.install(); await pg.goto(URL); await pg.clock.fastForward(3500); await snap('cover');
  await pg.click('#gStart'); await pg.clock.fastForward(1200); await snap('gate');
  await pg.fill('#gName','E2E Tablet'); await pg.fill('#gCode',CODE); await pg.check('#gOk'); await pg.click('#gGo'); await pg.clock.fastForward(2500);
  await snap('after-join');
  if(await pg.locator('#consentYes').isVisible().catch(()=>false)){await snap('consent');await pg.click('#consentYes');await pg.clock.fastForward(1500)}
  await snap('welcome');
  await pg.click('#begin'); await pg.clock.fastForward(900); await snap('intro1');
  for(let i=0;i<3;i++){await pg.click('#introNext');await pg.clock.fastForward(700)} await snap('intro4'); await pg.click('#introNext'); await pg.clock.fastForward(2000);
  const st=()=>pg.evaluate(()=>({v:document.querySelector('.screen.on')?.id,busy:document.body.classList.contains('busy'),beat:!document.getElementById('beat').hidden,next:!document.getElementById('nextBtn').hidden}));
  let places=0,locks=0,shotBeat=false,shotStop=false,shotNext=false,shotLock=false;const t0=Date.now();
  for(let i=0;i<5000&&Date.now()-t0<150000;i++){const s=await st();
    if(s.v==='dreams')break;
    if(s.beat){if(!shotBeat){await snap('beat');shotBeat=true}await pg.click('#beatGo');await pg.clock.fastForward(1500);continue}
    if(s.next){if(!shotNext){await snap('after-light');shotNext=true}await pg.click('#nextBtn');await pg.clock.fastForward(2500);continue}
    if(s.v==='lock'){if(!shotLock){await snap('lock');shotLock=true}locks++;await pg.locator('#lkOpts button').nth(locks%4).click();await pg.clock.fastForward(300);await pg.click('#lkNext');await pg.clock.fastForward(1800);continue}
    if(s.v==='stop'&&!s.busy){if(!shotStop){await snap('stop1');shotStop=true}places++;const ids=await pg.evaluate(()=>[...document.querySelectorAll('.obj')].map(o=>o.dataset.id));const pri='IRASEC';const pick=ids.slice().sort((a,b)=>pri.indexOf(a.split('-')[1])-pri.indexOf(b.split('-')[1])).slice(0,2);for(const id of pick)await pg.locator('.obj[data-id="'+id+'"]').click({force:true});if(places===1)await snap('stop1-picked');await pg.click('#light');await pg.clock.fastForward(1400);continue}
    await pg.clock.fastForward(500)}
  await snap('dreams'); await pg.click('#dreamGo'); await pg.clock.fastForward(1500); await pg.waitForTimeout(800); await snap('fieldnote'); await pg.click('#fnSkip'); await pg.clock.fastForward(1500); await pg.waitForTimeout(500); await pg.click('#fnGo'); await pg.clock.fastForward(4000); await snap('reveal');
  await pg.clock.fastForward(9000); await snap('reveal2'); await pg.click('#openDoors'); await pg.clock.fastForward(2500); await snap('doors');
  await pg.locator('.fcard').first().click(); await pg.clock.fastForward(1200); await snap('field'); await pg.evaluate(()=>{document.getElementById('field').scrollTop=99999}); await pg.clock.fastForward(300); await snap('field-bottom');
  await pg.click('#fBack').catch(async()=>{await pg.goBack()}); await pg.clock.fastForward(800);
  await pg.click('#dHow').catch(()=>{}); await pg.clock.fastForward(800); await snap('how');
  await pg.click('#howBack').catch(()=>{}); await pg.clock.fastForward(800);
  await pg.click('#dParent').catch(()=>{}); await pg.clock.fastForward(800); await snap('parent');
  out[name]={places,locks,issues,errs:errs.slice(0,5)}; await ctx.close(); }
fs.writeFileSync((process.env.OUT||'/tmp/tab')+'/result_'+(only||'all')+'.json',JSON.stringify(out,null,1)); console.log(JSON.stringify(out,null,1).slice(0,3500)); await b.close();
