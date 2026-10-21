import json
c=json.load(open('content.json',encoding='utf8'))
G={'Managers':50408,'Professionals':38466,'Technicians and associate professionals':26175,'Clerical support workers':24289,'Service and sales workers':15541,'Craft and related trades workers':16773,'Plant and machine operators and assemblers':17301}
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
c['plfs']={'year':2025,'note':'Average monthly earnings of salaried (regular wage) employees in India, by broad occupation group (NCO-2015 division). All ages and experience; self-employed people are not included.','education':{'Diploma or certificate':25722,'Graduate':32683,'Postgraduate and above':45430,'Higher secondary':18539},'age':{'20-24':14779,'25-29':20860},'conf':'secondary','src':['https://www.pib.gov.in/PressReleasePage.aspx?PRID=2246009&lang=1&reg=3','https://indialabourobservatory.com/data/plfs-2025/earnings/'],'verify':'Headline figures (male 24,217 and female 18,353 a month) match the MoSPI press note. The occupation split is computed by the India Labour Observatory from MoSPI unit-level records.'}
json.dump(c,open('content.json','w',encoding='utf8'),indent=1,ensure_ascii=False); print(n,'mapped')
