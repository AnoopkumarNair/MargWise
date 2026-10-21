import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage(); await pg.route('**/fonts.g*/**', r=>r.abort());
await pg.goto('file://'+process.argv[2]);
const out = await pg.evaluate(()=>{
  const M=Margwise, bank=M.JOURNEY_BANK, A=['R','I','A','S','E','C'];
  function rank(v){const idx=v.map((x,i)=>[x,i]).sort((a,b)=>b[0]-a[0]);const r=[];idx.forEach((p,k)=>r[p[1]]=k+1);return r}
  function sp(a,b){const ra=rank(a),rb=rank(b),n=a.length;let d=0;for(let i=0;i<n;i++)d+=(ra[i]-rb[i])**2;return 1-6*d/(n*(n*n-1))}
  let seed=1; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const res={N:0,top1:0,top3set:0,rhoTrue:[],rho2:[],stops:[],top3retest:0,broad:0,noSig:0};
  for(let n=0;n<400;n++){
    const lv={}; A.forEach(a=>lv[a]=rnd());
    const ch1=M.playJourney(lv,5000+n,bank,0.8,lv), r1=M.journeyResult(bank,ch1);
    const ch2=M.playJourney(lv,9000+n,bank,0.8,lv), r2=M.journeyResult(bank,ch2);
    const tv=A.map(a=>lv[a]), p1=A.map(a=>r1.profile[a]), p2=A.map(a=>r2.profile[a]);
    const topTrue=A.slice().sort((x,y)=>lv[y]-lv[x]).slice(0,3);
    res.N++; res.top1+= r1.code.code[0]===topTrue[0]?1:0; res.top3set+= r1.code.code.filter(c=>topTrue.includes(c)).length/3;
    res.rhoTrue.push(sp(tv,p1)); res.rho2.push(sp(p1,p2)); res.stops.push(ch1.filter(c=>!c.echoOf).length);
    res.top3retest+= r1.code.code.filter(c=>r2.code.code.includes(c)).length/3; if(r1.confidence==='broad')res.broad++;
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length, med=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
  return {N:res.N, top1Acc:res.top1/res.N, top3Overlap:res.top3set/res.N, medRhoTrueVsEst:med(res.rhoTrue), meanRhoTrueVsEst:mean(res.rhoTrue), medTestRetestRho:med(res.rho2), top3RetestOverlap:res.top3retest/res.N, meanPlaces:mean(res.stops), broadShare:res.broad/res.N};
});
console.log(JSON.stringify(out,null,1)); await b.close();
