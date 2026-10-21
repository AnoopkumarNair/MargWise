"""Run after content.py and plfs.py: adds Plan B routes, the college-comparison line, and the field-score null (nullcal_4.json)."""
import json, os
c = json.load(open('content.json', encoding='utf8'))
B = {
 'health': "If the NEET result does not go your way: allied health degrees (B.Sc Nursing, physiotherapy, pharmacy, medical laboratory or radiography technology), BAMS or BHMS through NEET, or a B.Sc in a life science with a later master's in public health or biotechnology.",
 'sci': "If IISER or NISER is not possible: a B.Sc at a central or state university (often through CUET), then an M.Sc and NET or GATE for research.",
 'eng': "If the JEE rank falls short: state engineering entrance tests, private universities through BITSAT, VITEEE or their own tests, or a 3-year diploma followed by lateral entry into the second year of B.Tech.",
 'tec': "If a computer science seat at a top college is out of reach: BCA then MCA, a B.Sc in computer science or data science, or a diploma with lateral entry into B.Tech. Real projects and certificates count for a lot in this field.",
 'com': "If CA is not for you: B.Com with CMA, CS or CFA alongside, or BBA and an MBA later. Banking and other exams are open after any graduation.",
 'des': "If UCEED or NID is missed: other design schools with their own tests, a B.Des at a private university, or a degree in fine arts or architecture with a strong portfolio.",
 'psy': "If a psychology honours seat is hard to get: a BA in Psychology at any good college, then an MA or M.Sc and approved training if you want to practise as a clinical psychologist.",
 'law': "If CLAT or AILET does not work out: other law school tests (such as SLAT or state tests) or a 3-year LLB after any degree.",
 'media': "If IIMC is out of reach: a BA in journalism, English or mass communication at a university, plus a portfolio of writing, audio or video that you build yourself.",
 'pub': "Civil services and defence exams can be tried more than once, and a degree in any subject keeps that door open. State public service and SSC exams are other routes.",
 'hos': "If the NCHM JEE is missed: private hotel management institutes or a BBA in hospitality. For airline roles, check each airline's rules and training.",
 'spo': "If top sports institutes are out of reach: a B.P.Ed or a BA in physical education at a university, coaching certificates, or sports science courses.",
 'agr': "If ICAR-linked seats are missed: a B.Sc in botany, zoology or environmental science, or the admissions run by state agricultural universities.",
 'voc': "ITI and polytechnic diplomas are the direct way in. A diploma can lead to lateral entry into B.Tech later, and apprenticeship schemes often pay a stipend.",
 'arts': "If a music, drama or film school place is missed: private institutes, a university BA in music or performing arts, and a performance or recording portfolio you build yourself.",
 'mar': "If IMU CET is missed: other maritime institutes approved by the DG Shipping, or a nautical science degree at an approved college. Check the approval before you pay.",
}
for f in c['fields']:
    f['backup'] = B[f['id']]
    f['compare'] = "Compare colleges with the official NIRF rankings at nirfindia.org, and ask the exam body for last year's cut-offs and seat numbers."
    v = f.setdefault('verify', [])
    t = 'Plan B routes are suggestions, not rules. Check each admission process on the official site.'
    if t not in v: v.append(t)
if os.path.exists('nullcal_4.json'):
    n = json.load(open('nullcal_4.json'))['nf']; c['fieldNull'] = n; c['fieldK'] = 4
json.dump(c, open('content.json', 'w', encoding='utf8'), indent=1, ensure_ascii=False); print('extras ok', 'fieldNull' in c)
