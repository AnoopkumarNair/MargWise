import json
c=json.load(open('content.json',encoding='utf8'))
D=json.load(open('plfs_2025.json',encoding='utf8')); G=D['groups']
M,P,T,S,CR,PL='Managers','Professionals','Technicians and associate professionals','Service and sales workers','Craft and related trades workers','Plant and machine operators and assemblers'
ov={'53-2011.00':T,'53-2031.00':S,'53-5021.00':T,'33-3051.00':S,'39-9031.00':T,'27-2021.00':T,'27-2022.00':T,'35-1011.00':T,'13-2072.00':T,'13-2053.00':T,'27-4032.00':T,'27-4021.00':T,'19-4092.00':T,'17-3023.00':T,'17-3022.00':T,'47-2111.00':CR,'49-3023.00':CR,'51-4121.00':CR,'51-4041.00':CR,'11-9161.00':M,'11-3012.00':M,'13-1081.00':P}
n=0
for x in c['careers']:
    soc=x['soc']; pre=soc[:2]
    if soc in ov: g=ov[soc]
    elif pre=='11': g=M
    elif soc.startswith('29-2'): g=T
    elif pre in ('13','15','17','19','21','23','25','27','29'): g=P
    elif pre in ('35','39','33'): g=S
    elif pre in ('47','49'): g=CR
    elif pre in ('51','53'): g=PL
    else: print('unmapped',x['id'],soc); continue
    x['in']={'group':g,'monthly':G[g]}; n+=1
c['plfs']={k:D[k] for k in ('year','note','education','age','conf','src','verify')}
json.dump(c,open('content.json','w',encoding='utf8'),indent=1,ensure_ascii=False); print(n,'mapped')
