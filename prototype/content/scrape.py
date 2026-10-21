import re, json, urllib.request, time, sys
CAREERS = """health|Health and medicine
doc-1|Doctor (Physician)|29-1215.00
doc-2|Dentist|29-1021.00
doc-3|Nurse|29-1141.00
doc-4|Pharmacist|29-1051.00
doc-5|Physiotherapist|29-1123.00
doc-6|Veterinarian|29-1131.00
sci|Science and research
sci-1|Physicist|19-2012.00
sci-2|Biologist|19-1020.01
sci-3|Chemist|19-2031.00
sci-4|Environmental Scientist|19-2041.00
sci-5|Statistician|15-2041.00
sci-6|Food Scientist|19-1012.00
eng|Engineering
eng-1|Mechanical Engineer|17-2141.00
eng-2|Civil Engineer|17-2051.00
tec-3|Electronics and EV Engineer|17-2072.00
eng-4|Aerospace Engineer|17-2011.00
eng-5|Chemical Engineer|17-2041.00
tec|Technology and data
tec-1|AI and Software Engineer|15-1252.00
tec-2|Data Scientist|15-2051.00
tec-4|Cybersecurity Analyst|15-1212.00
com|Business and finance
com-1|Chartered Accountant|13-2011.00
com-2|Business Manager or Founder|11-1021.00
com-3|Financial Analyst|13-2051.00
com-4|Economist|19-3011.00
com-5|Marketing Manager|11-2021.00
com-6|HR Specialist|13-1071.00
des|Design and creative arts
des-1|UX and Product Designer|15-1255.00
des-2|Architect|17-1011.00
des-3|Graphic Designer|27-1024.00
des-4|Fashion Designer|27-1022.00
des-5|Animator and VFX Artist|27-1014.00
des-6|Film and Video Editor|27-4032.00
des-7|Interior Designer|27-1025.00
psy|Understanding people
psy-1|Clinical Psychologist|19-3033.00
psy-2|Counselling Psychologist|19-3033.00
psy-3|School Counsellor|21-1012.00
psy-4|Organisational Psychologist|19-3032.00
psy-5|UX Researcher|17-2112.01
law|Law and justice
law-1|Corporate Lawyer|23-1011.00
law-2|Judge (Judicial Services)|23-1023.00
media|Media, writing and teaching
med-1|Journalist|27-3023.00
med-2|Writer or Author|27-3043.00
med-3|PR and Communications Specialist|27-3031.00
med-4|School Teacher|25-2031.00
med-5|Social Worker|21-1021.00
med-6|Translator or Interpreter|27-3091.00
pub|Public service and defence
pub-1|Policy Analyst (Political Scientist)|19-3094.00
pub-2|Urban Planner|19-3051.00
pub-3|Police Officer|33-3051.00
pub-4|Disaster Management Officer|11-9161.00
hos|Travel, hospitality and aviation
hos-1|Airline Pilot|53-2011.00
hos-2|Chef|35-1011.00
hos-3|Hotel Manager|11-9081.00
hos-4|Cabin Crew|53-2031.00
spo|Sports and fitness
spo-1|Professional Athlete|27-2021.00
spo-2|Coach or Sports Trainer|27-2022.00
spo-3|Fitness Trainer|39-9031.00"""
names={'Realistic':'R','Investigative':'I','Artistic':'A','Social':'S','Enterprising':'E','Conventional':'C'}
cache={}
def get(soc):
    if soc in cache: return cache[soc]
    u=f'https://www.onetonline.org/link/details/{soc}?c=in'
    for a in range(3):
        try:
            h=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode('utf8','ignore'); break
        except Exception as e: h=None; time.sleep(2)
    if not h: return None
    vals={}
    for m in re.finditer(r'style="width: ([\d.]+)%[^"]*"></div>(?:(?!progress-bar).)*?data-text="(Realistic|Investigative|Artistic|Social|Enterprising|Conventional)"',h,re.S):
        vals.setdefault(names[m.group(2)],round(float(m.group(1))))
    t=re.search(r'<title>([^<]*)</title>',h); 
    cache[soc]={'values':vals,'otitle':(t.group(1).strip() if t else '')}; return cache[soc]
fields=[];careers=[];cur=None
for line in CAREERS.split('\n'):
    p=line.split('|')
    if len(p)==2: cur={'id':p[0],'name':p[1],'careers':[]}; fields.append(cur)
    else: careers.append((cur['id'],p[0],p[1],p[2]))
out={}; bad=[]
for fid,cid,title,soc in careers:
    r=get(soc)
    if not r or len(r['values'])!=6: bad.append((cid,soc,r)); continue
    out[cid]={'field':fid,'title':title,'soc':soc,'values':r['values'],'onetTitle':r['otitle'][:90]}
json.dump({'fields':fields,'careers':out},open('careers.json','w'),indent=1)
print(len(out),'ok; bad:',bad)
