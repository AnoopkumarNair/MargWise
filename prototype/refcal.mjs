import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage(); await pg.route('**/fonts.g*/**', r=>r.abort());
await pg.goto('file:///tmp/claude-0/-home-user/f4b06d8a-580e-5b33-bacd-fb95950c9cc3/scratchpad/site/index.html'); await pg.waitForTimeout(1500);
const out = await pg.evaluate((K)=>{
  const M=Margwise, bank=M.JOURNEY_BANK, A=['R','I','A','S','E','C'], C=window.MW_CONTENT, CAR=C.careers, FIELDS=C.fields;
  function raw(pr){ const ms=M.careerPaths(pr,CAR.map(c=>({careerId:c.id,values:c.values}))),by={}; ms.forEach(m=>by[m.careerId]=m.r); const o={}; FIELDS.forEach(f=>{const cs=CAR.filter(c=>c.field===f.id).map(c=>by[c.id]).sort((a,b)=>b-a).slice(0,K); o[f.id]=cs.reduce((a,c)=>a+c,0)/cs.length}); return o; }
  const perm=[]; for(const x of A)for(const y of A)for(const z of A) if(x!==y&&y!==z&&x!==z) perm.push([x,y,z]);
  function ideal(seedBase){ const res=[]; perm.forEach((p,i)=>{ const lv={}; A.forEach(a=>lv[a]=.1); lv[p[0]]=1; lv[p[1]]=.8; lv[p[2]]=.6; const ch=M.playJourney(lv,seedBase+i*7,bank,.8,lv); res.push(M.journeyResult(bank,ch).profile); }); return res; }
  const refProfiles=[...ideal(100),...ideal(5000),...ideal(9000)];
  const refRaw={}; FIELDS.forEach(f=>refRaw[f.id]=[]); refProfiles.forEach(p=>{const s=raw(p); FIELDS.forEach(f=>refRaw[f.id].push(s[f.id]))});
  const Q=41, tab={}; FIELDS.forEach(f=>{const v=refRaw[f.id].slice().sort((a,b)=>a-b); tab[f.id]=Array.from({length:Q},(_,i)=>+v[Math.round(i*(v.length-1)/(Q-1))].toFixed(3))});
  function pct(id,x){const t=tab[id]; if(x<=t[0])return 0; if(x>=t[Q-1])return 1; let i=0; while(t[i+1]<x)i++; const w=(x-t[i])/((t[i+1]-t[i])||1); return (i+w)/(Q-1)}
  function rank(p){const s=raw(p); return FIELDS.map(f=>({id:f.id,sc:pct(f.id,s[f.id])+.002*s[f.id]})).sort((a,b)=>b.sc-a.sc)}
  // evaluate on fresh ideal profiles
  const fresh=ideal(31000), top1={}, top3={}; fresh.forEach(p=>{const r=rank(p); top1[r[0].id]=(top1[r[0].id]||0)+1; r.slice(0,3).forEach(x=>top3[x.id]=(top3[x.id]||0)+1)});
  // random tappers
  let seed=3; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  function jr(mode){ let ch=[],g=0; while(g++<40){const s=M.step(bank,ch); if(s.done)break; const ids=s.scene.options.map(o=>o.id), sp={}; if(mode===0){const a=ids.slice().sort(()=>rnd()-.5); sp[a[0]]=1; sp[a[1]]=1} else {const i=ids[Math.floor(rnd()*4)]; sp[i]=2} ch.push(s.echo?{sceneId:s.scene.id+'~echo',echoOf:s.scene.id,spent:sp}:{sceneId:s.scene.id,spent:sp});} return M.journeyResult(bank,ch); }
  const rt3={}, sds={rand:[],ideal:[]}; let share2=0,prev=null;
  for(let i=0;i<500;i++){ const r=jr(i%2), rk=rank(r.profile); rk.slice(0,3).forEach(x=>rt3[x.id]=(rt3[x.id]||0)+1); const vs=A.map(a=>r.profile[a]), mu=vs.reduce((a,b)=>a+b,0)/6; sds.rand.push(Math.sqrt(vs.reduce((a,b)=>a+(b-mu)**2,0)/6)); }
  fresh.forEach(p=>{const vs=A.map(a=>p[a]), mu=vs.reduce((a,b)=>a+b,0)/6; sds.ideal.push(Math.sqrt(vs.reduce((a,b)=>a+(b-mu)**2,0)/6))});
  const q=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.floor(p*(a.length-1))];
  return {tab, idealTop1:top1, idealTop3:top3, randTop3:rt3, sd:{randP10:q(sds.rand,.1),randP50:q(sds.rand,.5),randP90:q(sds.rand,.9),idealP10:q(sds.ideal,.1),idealP50:q(sds.ideal,.5),idealP90:q(sds.ideal,.9)}};
},4);
fs.writeFileSync('refcal.json',JSON.stringify(out));
const s=o=>JSON.stringify(Object.entries(o).sort((a,b)=>b[1]-a[1]));
console.log('idealTop1',s(out.idealTop1)); console.log('idealTop3',s(out.idealTop3)); console.log('randTop3',s(out.randTop3)); console.log(out.sd);
await b.close();
