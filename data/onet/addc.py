import json,re,sys
sys.argv=['x']
src=open('scrape.py').read()
head=src[:src.index('fields=[];careers=[]')]
head=head.replace('CAREERS = """','CAREERS = """',1)
exec(head)
NEW=[('pub','pub-5','Civil Services Officer (administration)','11-3012.00'),('com','com-9','Compliance or Company Secretary','13-1041.00'),
('health','doc-7','Medical Laboratory Technologist','29-2011.00'),('health','doc-8','Radiologic Technologist','29-2034.00'),('law','law-3','Forensic Science Technician','19-4092.00')]
d=json.load(open('careers.json'))
for fid,cid,title,soc in NEW:
    r=get(soc); print(cid,soc,r)
    if r and len(r['values'])==6: d['careers'][cid]={'field':fid,'title':title,'soc':soc,'values':r['values'],'onetTitle':r['otitle'][:90]}
json.dump(d,open('careers.json','w'),indent=1)
