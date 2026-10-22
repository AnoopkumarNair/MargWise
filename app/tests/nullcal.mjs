import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage(); await pg.route('**/fonts.g*/**', r=>r.abort());
await pg.goto('file:///tmp/claude-0/-home-user/f4b06d8a-580e-5b33-bacd-fb95950c9cc3/scratchpad/site/index.html'); await pg.waitForTimeout(1500);
const out = await pg.evaluate((K)=>{
  const M=Margwise, bank=M.JOURNEY_BANK, A=['R','I','A','S','E','C'], C=window.MW_CONTENT, CAR=C.careers, FIELDS=C.fields;
  function mk(seed0){let seed=seed0; return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
  function field(pr){ const ms=M.careerPaths(pr,CAR.map(c=>({careerId:c.id,values:c.values}))),by={}; ms.forEach(m=>by[m.careerId]=m.r); const o={}; FIELDS.forEach(f=>{const cs=CAR.filter(c=>c.field===f.id).map(c=>by[c.id]).sort((a,b)=>b-a).slice(0,K); o[f.id]=cs.reduce((a,c)=>a+c,0)/cs.length}); return o; }
  function journey(rnd,mode){ let ch=[],g=0; while(g++<40){const s=M.step(bank,ch); if(s.done)break; const ids=s.scene.options.map(o=>o.id), sp={}; if(mode===0){const a=ids.slice().sort(()=>rnd()-.5); sp[a[0]]=1; sp[a[1]]=1} else {for(let k=0;k<2;k++){const i=ids[Math.floor(rnd()*ids.length)]; sp[i]=Math.min(2,(sp[i]||0)+1)}} ch.push(s.echo?{sceneId:s.scene.id+'~echo',echoOf:s.scene.id,spent:sp}:{sceneId:s.scene.id,spent:sp});} return M.journeyResult(bank,ch).profile; }
  const rnd=mk(5), vals={}; FIELDS.forEach(f=>vals[f.id]=[]);
  for(let i=0;i<1200;i++){ const s=field(journey(rnd,i%2)); FIELDS.forEach(f=>vals[f.id].push(s[f.id])); }
  const nf={}; FIELDS.forEach(f=>{const v=vals[f.id],m=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||1; nf[f.id]={m:+m.toFixed(4),sd:+sd.toFixed(4)}});
  // evaluate on fresh seed
  const rnd2=mk(999), top1={}, top3={}; for(let i=0;i<600;i++){ const s=field(journey(rnd2,i%2)); const z=FIELDS.map(f=>({id:f.id,z:(s[f.id]-nf[f.id].m)/nf[f.id].sd})).sort((a,b)=>b.z-a.z); top1[z[0].id]=(top1[z[0].id]||0)+1; z.slice(0,3).forEach(x=>top3[x.id]=(top3[x.id]||0)+1); }
  const tri={}; const cmb=[]; for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)for(let k=j+1;k<6;k++)cmb.push([A[i],A[j],A[k]]);
  cmb.forEach(t=>{const p={};A.forEach(x=>p[x]=-.6); p[t[0]]=1.4;p[t[1]]=1;p[t[2]]=.7; const s=field(p); tri[t.join('')]=FIELDS.map(f=>({id:f.id,z:(s[f.id]-nf[f.id].m)/nf[f.id].sd})).sort((x,y)=>y.z-x.z).slice(0,3).map(x=>x.id).join(',')});
  const single={}; A.forEach(a=>{const p={};A.forEach(x=>p[x]=-.5); p[a]=1.8; const s=field(p); single[a]=FIELDS.map(f=>({id:f.id,z:(s[f.id]-nf[f.id].m)/nf[f.id].sd})).sort((x,y)=>y.z-x.z).slice(0,4).map(x=>x.id).join(',')});
  return {nf,top1,top3,tri,single,distinctTriTop1:new Set(Object.values(tri).map(v=>v.split(',')[0])).size};
},+process.argv[2]);
fs.writeFileSync('nullcal_'+process.argv[2]+'.json',JSON.stringify(out)); 
console.log('top1',JSON.stringify(Object.entries(out.top1).sort((a,b)=>b[1]-a[1]))); console.log('distinct top1 across 20 triples',out.distinctTriTop1); console.log(JSON.stringify(out.single)); console.log(JSON.stringify(out.tri));
await b.close();
