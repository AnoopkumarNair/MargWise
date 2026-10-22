#!/usr/bin/env python3
"""Quality gate. Validates data/*.json against the data contracts (data/schemas/README.md).
Errors fail the build; warnings are printed in the report. Usage: python3 pipeline/validate.py [data_dir]"""
import json, re, sys, datetime, os
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'data')
err, warn = [], []
def E(m): err.append(m)
def W(m): warn.append(m)
def load(n): return json.load(open(os.path.join(D, n), encoding='utf8'))
TR = ['R', 'I', 'A', 'S', 'E', 'C']; CONF = ('official', 'secondary', 'estimate'); TIERS = ('veryhigh', 'high', 'moderate', 'low', 'nodata')
today = datetime.date.today()
def age(ds):
    try: return (today - datetime.date.fromisoformat(ds)).days
    except Exception: return None
c = load('content.json')
fids = [f['id'] for f in c['fields']]
if len(fids) != len(set(fids)): E('duplicate field ids')
for f in c['fields']:
    for k in ('id', 'name', 'group', 'stream', 'blurb', 'areas', 'pick', 'subjects', 'exams', 'degree', 'early', 'verify', 'sources', 'backup', 'compare'):
        if k not in f or f[k] in ('', None): E('field %s missing %s' % (f.get('id'), k))
    for b in ('cbse', 'isc', 'state'):
        if not (f.get('subjects') or {}).get(b): E('field %s missing subjects.%s' % (f['id'], b))
    for s in f.get('sources', []):
        if not str(s.get('url', '')).startswith('https://'): E('field %s source not https: %s' % (f['id'], s.get('url')))
    if sum(1 for x in c['careers'] if x['field'] == f['id']) < 3: W('field %s has fewer than 3 careers' % f['id'])
ids = [x['id'] for x in c['careers']]
if len(ids) != len(set(ids)): E('duplicate career ids')
groups = c.get('plfs', {}).get('groups') or None
for x in c['careers']:
    i = x['id']
    if x['field'] not in fids: E('%s unknown field %s' % (i, x['field']))
    if not re.fullmatch(r'\d\d-\d{4}\.\d\d', x['soc']): E('%s bad soc %s' % (i, x['soc']))
    if sorted(x['values']) != sorted(TR) or not all(0 <= v <= 100 for v in x['values'].values()): E('%s bad interest values' % i)
    if not x.get('line'): E('%s missing line' % i)
    a = x.get('ai')
    if not a: E('%s missing ai block' % i)
    else:
        if a['tier'] not in TIERS: E('%s bad ai tier' % i)
        if a.get('obs') is not None and not 0 <= a['obs'] <= 1: E('%s ai.obs out of range' % i)
        if a['tier'] == 'nodata' and a.get('watch'): E('%s nodata but flagged watch' % i)
        if bool(a.get('watch')) != bool(a['tier'] == 'veryhigh' and a.get('obs') is not None and a['obs'] >= .10): E('%s watch flag does not match the rule' % i)
    if x.get('in') and groups is not None and x['in']['group'] not in c['plfs'].get('groupsNames', list(c.get('plfs', {}).get('groups', {}).keys()) or [x['in']['group']]): pass
    if not x.get('in'): W('%s has no India pay group' % i)
if not c.get('fieldRef') or set(c['fieldRef']) != set(fids): E('fieldRef missing or does not cover all fields (run refcal)')
ca = age(c.get('checked', ''))
if ca is None: E('content.checked is not a date')
elif ca > 180: W('content last checked %d days ago' % ca)
am = c.get('aiMeta', {}); aa = age(am.get('retrieved', ''))
if aa is None: E('aiMeta.retrieved missing')
elif aa > 120: W('AI exposure data is %d days old; re-run the ai stage with --refresh' % aa)
ab = load('abroad.json')
if len(ab['countries']) != 8: E('abroad should list 8 countries, found %d' % len(ab['countries']))
for k in ab['countries']:
    for part in ('ug', 'pg', 'living'):
        x = k[part]
        if not x['lo'] <= x['hi']: E('%s %s lo > hi' % (k['id'], part))
        if x['conf'] not in CONF: E('%s %s bad conf' % (k['id'], part))
        if x['conf'] in ('official', 'secondary') and not x.get('src', '').startswith('https://'): E('%s %s %s figure without https source' % (k['id'], part, x['conf']))
    if k['after']['conf'] not in CONF: E('%s after bad conf' % k['id'])
da = age(ab.get('asOf', ''))
if da is None: E('abroad.asOf not a date')
elif da > 200: W('abroad data is %d days old' % da)
if age(ab['fx'].get('date', '')) is None: E('abroad fx date missing')
elif age(ab['fx']['date']) > 60: W('exchange rates are %d days old' % age(ab['fx']['date']))
st = load('story2.json')['scenes']
for sid, sc in st.items():
    for t, txt in sc['o'].items():
        if t not in TR: E('%s bad trait %s' % (sid, t))
        if len(txt) > 95: W('%s card %s is long (%d chars)' % (sid, t, len(txt)))
for m in warn: print('WARN ', m)
for m in err: print('ERROR', m)
print('validate: %d errors, %d warnings' % (len(err), len(warn)))
sys.exit(1 if err else 0)
