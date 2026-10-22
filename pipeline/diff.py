#!/usr/bin/env python3
"""Change report between two content.json builds. Usage: python3 pipeline/diff.py old.json new.json > CHANGES.md"""
import json, sys
a, b = (json.load(open(p, encoding='utf8')) for p in sys.argv[1:3])
out = ['# Data changes', '']
ca = {x['id']: x for x in a['careers']}; cb = {x['id']: x for x in b['careers']}
for i in sorted(set(cb) - set(ca)): out.append('- NEW career %s: %s' % (i, cb[i]['title']))
for i in sorted(set(ca) - set(cb)): out.append('- REMOVED career %s: %s' % (i, ca[i]['title']))
for i in sorted(set(ca) & set(cb)):
    x, y = ca[i], cb[i]
    for k in ('title', 'soc', 'values', 'us', 'in', 'line'):
        if x.get(k) != y.get(k): out.append('- %s (%s) %s: %s -> %s' % (i, y['title'], k, json.dumps(x.get(k), ensure_ascii=False)[:90], json.dumps(y.get(k), ensure_ascii=False)[:90]))
    xa, ya = x.get('ai') or {}, y.get('ai') or {}
    if xa.get('tier') != ya.get('tier'): out.append('- %s (%s) AI tier: %s -> %s (obs %s -> %s)' % (i, y['title'], xa.get('tier'), ya.get('tier'), xa.get('obs'), ya.get('obs')))
fa = {f['id']: f for f in a['fields']}; fb = {f['id']: f for f in b['fields']}
for i in sorted(set(fa) & set(fb)):
    for k in ('exams', 'degree', 'pick', 'subjects', 'verify', 'backup', 'compare', 'note'):
        if fa[i].get(k) != fb[i].get(k): out.append('- field %s %s changed' % (i, k))
if a.get('plfs') != b.get('plfs'): out.append('- PLFS block changed')
if len(out) == 2: out.append('No changes.')
print('\n'.join(out))
