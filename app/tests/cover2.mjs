import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage(); await pg.route('**/fonts.g*/**', r=>r.abort());
await pg.goto('file:///tmp/claude-0/-home-user/f4b06d8a-580e-5b33-bacd-fb95950c9cc3/scratchpad/site/index.html'); await pg.waitForTimeout(1500);
const out = await pg.evaluate(()=>{
  const M=Margwise, bank=M.JOURNEY_BANK, A=['R','I','A','S','E','C'], C=window.MW_CONTENT, FIELDS=C.fields, CAR=C.careers;
  let seed=11; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}; const gauss=()=>{const u=1-rnd(),v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  function fieldScores(pr){ const ms=M.careerPaths(pr,CAR.map(c=>({careerId:c.id,values:c.values}))),by={}; ms.forEach(m=>by[m.careerId]=m.r); const o={}; FIELDS.forEach(f=>{const cs=CAR.filter(c=>c.field===f.id); o[f.id]=cs.reduce((a,c)=>a+by[c.id],0)/cs.length}); return o; }
  // null stats like the app
  const vals={}; FIELDS.forEach(f=>vals[f.id]=[]); for(let k=0;k<150;k++){const p={};A.forEach(a=>p[a]=gauss()); const s=fieldScores(p); FIELDS.forEach(f=>vals[f.id].push(s[f.id]))}
  const nf={}; FIELDS.forEach(f=>{const v=vals[f.id],m=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)||1; nf[f.id]={m,sd}});
  // random journeys
  function run(){ let choices=[],g=0; while(g++<40){const s=M.step(bank,choices); if(s.done)break; const ids=s.scene.options.map(o=>o.id), sp={}; const a=ids.slice().sort(()=>rnd()-.5); sp[a[0]]=1; sp[a[1]]=1; choices.push(s.echo?{sceneId:s.scene.id+'~echo',echoOf:s.scene.id,spent:sp}:{sceneId:s.scene.id,spent:sp});} return M.journeyResult(bank,choices); }
  const topCount={}, top1={}, N=500; let sameTop3=0, prev=null;
  for(let i=0;i<N;i++){ const r=run(); const s=fieldScores(r.profile); const z=FIELDS.map(f=>({id:f.id,z:(s[f.id]-nf[f.id].m)/nf[f.id].sd})).sort((a,b)=>b.z-a.z); const t3=z.slice(0,3).map(x=>x.id); t3.forEach(x=>topCount[x]=(topCount[x]||0)+1); top1[t3[0]]=(top1[t3[0]]||0)+1; const key=t3.join(','); if(prev===key)sameTop3++; prev=key; }
  // per-trait extremes: what fields come first when each single trait is dominant
  const byTrait={}; A.forEach(a=>{const p={};A.forEach(x=>p[x]=-.5); p[a]=2; const s=fieldScores(p); byTrait[a]=FIELDS.map(f=>({id:f.id,z:(s[f.id]-nf[f.id].m)/nf[f.id].sd})).sort((x,y)=>y.z-x.z).slice(0,3).map(x=>x.id+':'+x.z.toFixed(1))});
  // which fields never appear in any top3 among 500 random
  const never=FIELDS.map(f=>f.id).filter(id=>!topCount[id]);
  return {top1Dist:top1,top3Counts:topCount,never,adjacentRepeats:sameTop3,byTrait};
});
console.log(JSON.stringify(out,null,1)); await b.close();
