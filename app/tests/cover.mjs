import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const pg = await b.newPage(); await pg.route('**/fonts.g*/**', r=>r.abort());
await pg.goto(process.env.PAGE || ('file://' + new URL('../dist/index.html', import.meta.url).pathname)); await pg.waitForTimeout(1500);
const out = await pg.evaluate(()=>{
  const M=Margwise, bank=M.JOURNEY_BANK, A=['R','I','A','S','E','C'];
  let seed=7; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  function run(strategy){
    let choices=[], guard=0;
    while(guard++<40){
      const s=M.step(bank,choices); if(s.done) break;
      const sc=s.scene, ids=sc.options.map(o=>o.id), spent={};
      strategy(ids,spent,sc,s,choices.length);
      const ch = s.echo ? {sceneId:sc.id+'~echo',echoOf:sc.id,spent} : {sceneId:sc.id,spent};
      choices.push(ch);
    }
    const r=M.journeyResult(bank,choices); const pr=r.profile, vs=A.map(a=>pr[a]), mu=vs.reduce((a,b)=>a+b,0)/6, sd=Math.sqrt(vs.reduce((a,b)=>a+(b-mu)**2,0)/6);
    return {code:r.code.code.join(''),top1:r.code.code[0],conf:r.confidence,sd,noSignal:!(sd>=.2)||!!r.lowEngagement,stops:choices.filter(c=>!c.echoOf).length};
  }
  const strategies={
    random2distinct:(ids,sp)=>{const a=ids.slice().sort(()=>rnd()-.5); sp[a[0]]=1; sp[a[1]]=1},
    randomAny:(ids,sp)=>{for(let k=0;k<2;k++){const i=ids[Math.floor(rnd()*ids.length)]; sp[i]=(sp[i]||0)+1; if(sp[i]>2)sp[i]=2}},
    firstTwoCards:(ids,sp)=>{sp[ids[0]]=1; sp[ids[1]]=1},
    alwaysFirstDouble:(ids,sp)=>{sp[ids[0]]=2},
    lastTwoCards:(ids,sp)=>{sp[ids[2]]=1; sp[ids[3]]=1},
    spendNothing:()=>{}
  };
  const res={};
  for(const [name,f] of Object.entries(strategies)){
    const N=600, codes={}, top1={}, sets={}; let ns=0, broad=0, stops=0;
    for(let i=0;i<N;i++){ const r=run(f); codes[r.code]=(codes[r.code]||0)+1; top1[r.top1]=(top1[r.top1]||0)+1; const st=r.code.split('').sort().join(''); sets[st]=(sets[st]||0)+1; if(r.noSignal)ns++; if(r.conf==='broad')broad++; stops+=r.stops; }
    const top=Object.entries(codes).sort((a,b)=>b[1]-a[1]).slice(0,4);
    res[name]={distinctOrdered:Object.keys(codes).length,distinctSets:Object.keys(sets).length,top1,mostCommon:top,noSignalPct:+(100*ns/N).toFixed(1),broadPct:+(100*broad/N).toFixed(1),meanStops:+(stops/N).toFixed(1)};
  }
  // target coverage: all 120 ordered triples
  const perm=[]; for(const x of A)for(const y of A)for(const z of A) if(x!==y&&y!==z&&x!==z) perm.push([x,y,z]);
  let exact=0,set3=0,top1ok=0, miss=[];
  for(const p of perm){ const lv={}; A.forEach(a=>lv[a]=.1); lv[p[0]]=1; lv[p[1]]=.8; lv[p[2]]=.6;
    let e=0,s3=0,t1=0; const T=6; for(let k=0;k<T;k++){ const ch=M.playJourney(lv,100+k*13+perm.indexOf(p),bank,.8,lv), r=M.journeyResult(bank,ch); const c=r.code.code; if(c.join('')===p.join(''))e++; if(c.slice().sort().join('')===p.slice().sort().join(''))s3++; if(c[0]===p[0])t1++; }
    exact+=e/T; set3+=s3/T; top1ok+=t1/T; if(s3/T<.5) miss.push(p.join('')+':'+(s3/T).toFixed(2));
  }
  res.targets={exactOrderPct:+(100*exact/120).toFixed(1),sameSetPct:+(100*set3/120).toFixed(1),top1Pct:+(100*top1ok/120).toFixed(1),weakTargets:miss.slice(0,20),weakCount:miss.length};
  return res;
});
console.log(JSON.stringify(out,null,1)); await b.close();
