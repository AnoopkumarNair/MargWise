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
    if x.get('in'): E('%s still carries a per-career India pay mapping' % i)
if not c.get('fieldRef') or set(c['fieldRef']) != set(fids): E('fieldRef missing or does not cover all fields (run refcal)')
def _h(t):
    h = 5381
    for ch in t: h = ((h * 33) ^ ord(ch)) & 0xFFFFFFFF
    return h
_key = _h(json.dumps([[x['id'], x['field'], [x['values'][t] for t in TR]] for x in c['careers']], separators=(',', ':')))
if c.get('fieldRefKey') != _key: E('field reference table is stale: careers or their fields changed since it was calibrated (run app/tests/refcal.mjs, then pipeline/run.py)')
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
c0 = load('content.json')
if c0.get('fieldRef') and not c0.get('fieldBias'): W('fieldBias missing or stale: field ranking is not balanced (node engine/tests/make_fieldbias.mjs)')
# raw inputs must match what was accepted (a fetch changes them on purpose; CI sets RAW_STRICT=1 so a silent edit fails)
import hashlib
mp = os.path.join(D, 'releases', 'manifest.json')
if os.path.exists(mp):
    for r, h in (json.load(open(mp)).get('raw') or {}).items():
        fp = os.path.join(D, r)
        if not os.path.exists(fp) or hashlib.sha256(open(fp, 'rb').read()).hexdigest() != h: (E if os.environ.get('RAW_STRICT') == '1' else W)('raw input %s differs from the accepted release' % r)
# scraped or typed text must not carry markup characters (the game renders some of it as HTML)
def walk(o, path):
    if isinstance(o, str):
        if '<' in o or '>' in o: E('markup character in %s: %r' % (path, o[:60]))
    elif isinstance(o, dict):
        for k, v in o.items(): walk(v, path + '.' + k)
    elif isinstance(o, list):
        for i, v in enumerate(o): walk(v, path + '[%d]' % i)
for n in ('content.json', 'abroad.json', 'story2.json'): walk(load(n), n)
for m in warn: print('WARN ', m)
for m in err: print('ERROR', m)
print('validate: %d errors, %d warnings' % (len(err), len(warn)))
sys.exit(1 if err else 0)
