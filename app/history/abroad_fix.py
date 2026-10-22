import json
a=json.load(open('abroad.json',encoding='utf8'))
C={c['id']:c for c in a['countries']}
# routes: remove unverified "often cheaper" claim, add debt / not-guaranteed wording
a['routes'][0]['lines']=[l for l in a['routes'][0]['lines'] if 'often work out cheaper' not in l]
a['routes'][0]['lines'].append("Total cost depends heavily on the country and university. Compare the cards below before deciding.")
a['routes'][1]['lines']=[l for l in a['routes'][1]['lines'] if 'Many students find work and settle' not in l]
a['routes'][1]['lines'].append("Some students find work and settle abroad this way, but it is never guaranteed. Visa rules, job markets and your field all matter.")
a['routes'][1]['lines'].append("If you borrow for fees, work out how you would repay the loan if you do not get a job abroad.")
# salaries: official medians shown as points, estimates not invented
for k in ('ca','nl'):
    c=C[k]; c.pop('salaryRange',None)
    c['salary']="No checked figure yet. "+("Statistics Canada table 37-10-0122-01 has current figures by field." if k=='ca' else "CBS (Statistics Netherlands) and Nuffic have current figures.")+" Please check before relying on any number."
C['uk']['salaryPoints']=[{"l":"Median, UK graduates in full-time work 15 months after","v":"£30,000 a year","conf":"official"}]; C['uk'].pop('salaryRange',None)
C['au']['salaryPoints']=[{"l":"Median, undergraduates (2023)","v":"A$71,000 a year","conf":"official"},{"l":"Median, postgraduate coursework (2023)","v":"A$96,600 a year","conf":"official"}]; C['au'].pop('salaryRange',None)
C['sg']['salaryPoints']=[{"l":"Median, local-university fresh graduates (2025)","v":"S$4,500 a month","conf":"official"},{"l":"NUS Computing median","v":"S$6,400 a month","conf":"official"}]; C['sg'].pop('salaryRange',None); C['sg'].pop('salaryMonthly',None)
C['sg']['salary']=C['sg']['salary']+" Note: the local graduate median (S$4,500) is below the Employment Pass minimum (S$5,600), so a foreign graduate needs a better-than-median offer to stay."
C['us']['salary']=C['us']['salary']+" These are US medians for each job, not a guarantee for new graduates. Doctors trained abroad must also pass US licensing (USMLE) and match into a residency; the odds are low."
# conservative badges
C['ca']['living']['conf']='estimate'; C['ca']['ug']['conf']='secondary'
C['de']['after']['conf']='secondary'
# US H-1B text
u=C['us']['after']
u['verify']="US rules changed sharply in 2025 and 2026. USCIS guidance in October 2025 says the US$100,000 fee on new H-1B petitions applies to people outside the US, and does not apply to students already in the US who change status. Court challenges are ongoing. The wage-weighted lottery also changed. Check USCIS before planning."
# NMC note for China / medicine
C['cn']['notes']=[n for n in C['cn']['notes'] if 'Medicine in China' not in n]+["Medicine abroad (China and elsewhere): to practise in India you must have NEET, a course of at least 54 months plus a 12-month internship, English-medium teaching, all at the same foreign institution, a licence to practise in that country, and then pass the FMGE (until NExT starts). Check the NMC website before choosing a university."]
a['fieldNotes']['health']=a['fieldNotes']['health']+" Medicine abroad does not follow the 4 + 2 pattern, so we do not show a rough total for it."
a['disclaimer']=a['disclaimer']+" Borrowing for study abroad is a serious commitment. Settling abroad is never guaranteed."
json.dump(a,open('abroad.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
print('ok')
