import json, re, os
c = json.load(open('content.json', encoding='utf8')); out = []
for f in c['fields']:
    urls = ' | '.join(s['url'] for s in f.get('sources', []) if 'onetonline' not in s['url'])
    for key in ('exams', 'degree', 'pick'):
        for sent in re.split(r'(?<=[.!?])\s+', f.get(key) or ''):
            if len(sent) > 45: out.append({'key': f['id'] + '.' + key, 'statement': sent.strip(), 'urls': urls})
    if f.get('backup'): out.append({'key': f['id'] + '.backup', 'statement': f['backup'], 'urls': urls})
    for v in f.get('verify', []): out.append({'key': f['id'] + '.verify', 'statement': v, 'urls': urls})
    for k, v in (f.get('subjects') or {}).items(): out.append({'key': f['id'] + '.subj.' + k, 'statement': v, 'urls': urls})
ab = json.load(open('abroad.json', encoding='utf8'))
for k in ab['countries']:
    for part in ('ug', 'pg', 'living'):
        x = k[part]; out.append({'key': 'abroad.' + k['id'] + '.' + part, 'statement': '%s %s per year: %s to %s %s. %s' % (k['name'], {'ug': "bachelor's tuition", 'pg': "master's tuition", 'living': 'living cost'}[part], x['lo'], x['hi'], k['cur'], x['note']), 'urls': x.get('src', '')})
    out.append({'key': 'abroad.' + k['id'] + '.after', 'statement': k['after']['t'], 'urls': k['after'].get('src', '')})
    if k.get('salary'): out.append({'key': 'abroad.' + k['id'] + '.pay', 'statement': k['salary'], 'urls': (k.get('salaryRange') or {}).get('src', '')})
for x in c['careers']:
    if x.get('in'): out.append({'key': 'pay.map.' + x['id'], 'statement': 'In the Indian PLFS occupation grouping (NCO-2015 divisions), the job "%s" belongs to the group "%s".' % (x['title'], x['in']['group']), 'urls': 'https://www.mospi.gov.in'})
for x in c['careers']:
    a = x.get('ai')
    if a and (a['tier'] in ('veryhigh', 'nodata') or a['watch']):
        names = {'veryhigh': 'Very high', 'high': 'High', 'moderate': 'Moderate', 'low': 'Low', 'nodata': None}
        out.append({'key': 'ai.' + x['id'], 'statement': 'In the BLS AI exposure categories (2025-35 projections), the occupation "%s" (SOC %s) is in the category: %s.' % (x['title'], x['soc'][:7], names[a['tier']] or 'not listed'), 'urls': 'https://www.bls.gov/emp/publications/ai-exposure-categories.htm'})
p = c.get('plfs')
if p: out.append({'key': 'plfs.note', 'statement': 'India PLFS 2025: average monthly earnings of salaried employees are about Rs 32,683 for graduates and Rs 45,430 for postgraduates.', 'urls': ' | '.join(p['src'])})
json.dump(out, open(os.environ.get('CLAIMS_OUT', 'claims.json'), 'w'), ensure_ascii=False)
print(len(out), 'claims')
