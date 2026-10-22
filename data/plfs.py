import json
c=json.load(open('content.json',encoding='utf8'))
D=json.load(open('plfs_2025.json',encoding='utf8')); G=D['groups']
for x in c['careers']: x.pop('in', None)   # per-career India pay was removed: PLFS gives broad group averages only
n = 0
c['plfs']={k:D[k] for k in ('year','note','education','age','conf','src','verify')}
json.dump(c,open('content.json','w',encoding='utf8'),indent=1,ensure_ascii=False); print('plfs block ok; per-career mapping removed')
