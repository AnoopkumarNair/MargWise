import re, json, urllib.request, time
car=json.load(open('careers.json'))['careers']
socs=sorted({c['soc'] for c in car.values()})
out={}
for soc in socs:
    u=f'https://www.onetonline.org/link/summary/{soc}'
    h=None
    for a in range(3):
        try: h=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode('utf8','ignore'); break
        except Exception as e: time.sleep(2)
    if not h: out[soc]=None; continue
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',h,flags=re.S); t=re.sub(r'<[^>]+>','\n',t); t=re.sub(r'[ \t]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
    d={}
    m=re.search(r'Median wages\s*\n\((\d{4})\)\s*\n([^\n]+)',t)
    if m:
        d['wageYear']=int(m.group(1)); line=m.group(2)
        a=re.search(r'\$([\d,]+)\s*annual',line); hr=re.search(r'\$([\d.,]+)\s*hourly',line)
        if a: d['annual']=int(a.group(1).replace(',',''))
        if hr: d['hourly']=float(hr.group(1).replace(',',''))
        d['raw']=line.strip()
    g=re.search(r'Projected growth\s*\n\(([\d\-]+)\)\s*\n\s*([^\n]+)',t)
    if g: d['growthYears']=g.group(1); d['growth']=re.sub(r'\s*\(.*\)','',g.group(2)).strip()
    o=re.search(r'Projected job openings\s*\n\(([\d\-]+)\)\s*\n\s*([\d,]+)',t)
    if o: d['openings']=int(o.group(2).replace(',',''))
    out[soc]=d
json.dump(out,open('wages.json','w'),indent=1)
print(len(out),'socs;', sum(1 for v in out.values() if v and 'annual' in v),'with annual wage;', [k for k,v in out.items() if not v or 'annual' not in v][:20])
