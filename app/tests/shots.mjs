// Walks the road with simulated taps and full-page screenshots each result screen (reveal, doors, field, parent).
// OUT=dir node app/tests/shots.mjs
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const OUT = process.env.OUT || '/tmp';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage({viewport:{width:390,height:844}}); pg.setDefaultTimeout(4000); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/fonts.g*/**', r=>r.abort());
await pg.goto(process.env.PAGE || ('file://' + new URL('../dist/index.html', import.meta.url).pathname)); await pg.waitForTimeout(3000);
const P = +(process.env.PERSONA || 0);
await pg.click('#aboutBtn'); await pg.locator('#personas button').nth(P).click(); await pg.waitForTimeout(1500);
const shot=async n=>{ await pg.waitForTimeout(2500); const h=await pg.evaluate(()=>{const s=document.querySelector('.screen.on'); return Math.max(s.scrollHeight, 844)}); await pg.setViewportSize({width:390,height:Math.min(h,9000)}); await pg.waitForTimeout(300); await pg.screenshot({path:OUT+'/'+n+'.png'}); await pg.setViewportSize({width:390,height:844}); console.log(n, h); };
await pg.locator('#cClass button').nth(1).click(); await pg.locator('#cBoard button').first().click();
await pg.click('#dreamGo'); await pg.waitForTimeout(800);
if (await pg.locator('#finale.on').count()) { await pg.click('#fnSkip'); await pg.waitForTimeout(1500); await pg.click('#fnGo'); await pg.waitForTimeout(1500); }
await shot('1-reveal');
await pg.click('#openDoors'); await shot('2-doors');
await pg.locator('#fields > *').first().click(); await shot('3-field');
await pg.click('#fBack'); await pg.waitForTimeout(800); await pg.click('#dParent'); await shot('4-parent');
console.log(errs); await b.close();
