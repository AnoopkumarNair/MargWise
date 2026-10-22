"""Builds disjoint fact-check batches from content.json.
Each task is ONE public fact plus the official page to check it against. No product name, no scoring, no game context.
Tasks are shuffled and split so no single checker sees a whole field, and each task can go to two different checkers."""
import json, re, random, csv, os, sys
random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
c = json.load(open('content.json', encoding='utf8'))
tasks = []
for f in c['fields']:
    urls = [s['url'] for s in f.get('sources', []) if 'onetonline' not in s['url']]
    for key in ('exams', 'degree', 'pick'):
        t = f.get(key) or ''
        for sent in re.split(r'(?<=[.!?])\s+', t):
            if len(sent) > 25: tasks.append((f['id'] + '.' + key, sent.strip(), ' | '.join(urls)))
    for v in f.get('verify', []):
        tasks.append((f['id'] + '.verify', v, ' | '.join(urls)))
    for k, v in (f.get('subjects') or {}).items():
        tasks.append((f['id'] + '.subj.' + k, v, ' | '.join(urls)))
random.shuffle(tasks)
import secrets
mapping = {}
new = []
for t in tasks:
    k = secrets.token_hex(3); mapping[k] = t[0]; new.append((k, t[1], t[2]))
tasks = new
os.makedirs('claims', exist_ok=True)
B = 12
for i in range(0, len(tasks), B):
    with open('claims/batch-%02d.csv' % (i // B + 1), 'w', newline='', encoding='utf8') as fh:
        w = csv.writer(fh); w.writerow(['task_id', 'statement', 'official_pages_to_check', 'verdict (correct / wrong / outdated / cannot find)', 'what the page says (paste the exact words)', 'date you checked'])
        for t in tasks[i:i + B]: w.writerow([t[0], t[1], t[2], '', '', ''])
json.dump(mapping, open('claims/_private_map.json', 'w'))  # keep this file to yourself
print(len(tasks), 'tasks in', (len(tasks) + B - 1) // B, 'batches')
