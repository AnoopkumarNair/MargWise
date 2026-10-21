import json, re
c = json.load(open('content.json', encoding='utf8')); out = []
for f in c['fields']:
    urls = ' | '.join(s['url'] for s in f.get('sources', []) if 'onetonline' not in s['url'])
    for key in ('exams', 'degree', 'pick'):
        for sent in re.split(r'(?<=[.!?])\s+', f.get(key) or ''):
            if len(sent) > 25: out.append({'key': f['id'] + '.' + key, 'statement': sent.strip(), 'urls': urls})
    for v in f.get('verify', []): out.append({'key': f['id'] + '.verify', 'statement': v, 'urls': urls})
    for k, v in (f.get('subjects') or {}).items(): out.append({'key': f['id'] + '.subj.' + k, 'statement': v, 'urls': urls})
p = c.get('plfs')
if p: out.append({'key': 'plfs.note', 'statement': 'India PLFS 2025: average monthly earnings of salaried employees are about Rs 32,683 for graduates and Rs 45,430 for postgraduates.', 'urls': ' | '.join(p['src'])})
json.dump(out, open('deploy/public/admin/claims.json', 'w'), ensure_ascii=False)
print(len(out), 'claims')
