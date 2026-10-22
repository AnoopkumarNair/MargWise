#!/usr/bin/env python3
"""Stage: attach AI-exposure facts to every career in content.json.

Sources (registry: data/sources.yaml)
  bls_ai_exposure          BLS "AI exposure categories" (Aug 2026): relative exposure of 831 occupations, built from five studies
                           (three theoretical, two based on observed AI use, including Anthropic and Microsoft). Also carries the 2025-35 projections.
  anthropic_job_exposure   Anthropic Economic Index observed exposure by occupation (CC BY)
  anthropic_task_pen       Anthropic Economic Index AI use by O*NET task (CC BY)
  onet_tasks               O*NET task statements (CC BY 4.0)

The old 2023 theoretical estimate (Eloundou et al.) is no longer shown on its own: BLS already folds it into its composite.

Usage: python3 ai_exposure.py [--content content.json] [--cache ai] [--refresh]
BLS blocks scripted downloads (HTTP 403). With --refresh we try, and otherwise fall back to the committed copy. To update by hand, download
https://www.bls.gov/emp/ind-occ-matrix/ai-exposure-categories.xlsx into <cache>/bls_ai_exposure.xlsx and re-run; it is parsed into the CSV.
"""
import argparse, csv, json, os, re, time, urllib.request, datetime
ap = argparse.ArgumentParser(); ap.add_argument('--content', default='content.json'); ap.add_argument('--cache', default='ai'); ap.add_argument('--refresh', action='store_true')
a = ap.parse_args(); os.makedirs(a.cache, exist_ok=True)
SRC = {
 'job_exposure.csv': 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/job_exposure.csv',
 'task_pen.csv': 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/task_penetration.csv',
}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
def fetch(name):
    p = os.path.join(a.cache, name)
    if a.refresh or not os.path.exists(p): urllib.request.urlretrieve(SRC[name], p)
    return p
def load_bls():
    csvp, xl = os.path.join(a.cache, 'bls_ai_exposure.csv'), os.path.join(a.cache, 'bls_ai_exposure.xlsx')
    if a.refresh and not os.path.exists(xl):
        try:
            req = urllib.request.Request('https://www.bls.gov/emp/ind-occ-matrix/ai-exposure-categories.xlsx', headers={'User-Agent': UA}); open(xl, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
        except Exception as e: print('NOTE: BLS download blocked (%s); using the committed copy. Download the xlsx by hand to update.' % e)
    if os.path.exists(xl) and (not os.path.exists(csvp) or os.path.getmtime(xl) > os.path.getmtime(csvp)):
        import openpyxl
        ws = openpyxl.load_workbook(xl, read_only=True, data_only=True).active; rows = []
        for r in ws.iter_rows(values_only=True):
            if r and isinstance(r[1], str) and re.fullmatch(r'\d\d-\d{4}', r[1]):
                rows.append({'code': r[1], 'title': r[0], 'emp2025k': r[2], 'emp2035k': r[3], 'chgPct': r[5], 'openingsK': r[7], 'wage2025': r[8], 'ai': r[12]})
        w = csv.DictWriter(open(csvp, 'w', newline='', encoding='utf8'), fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    return {r['code']: r for r in csv.DictReader(open(csvp, encoding='utf8'))}
bls = load_bls()
ex = {r['occ_code']: float(r['observed_exposure']) for r in csv.DictReader(open(fetch('job_exposure.csv'), encoding='utf8'))}
pen = {r['task'].strip(): float(r['penetration']) for r in csv.DictReader(open(fetch('task_pen.csv'), encoding='utf8'))}
c = json.load(open(a.content, encoding='utf8'))
tp = os.path.join(a.cache, 'tasks.json'); tasks = json.load(open(tp)) if os.path.exists(tp) and not a.refresh else {}
for x in c['careers']:
    soc = x['soc']
    if soc in tasks and tasks[soc] is not None: continue
    h = None
    for t in range(3):
        try: h = urllib.request.urlopen(urllib.request.Request('https://www.onetonline.org/link/details/%s?c=tk' % soc, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read().decode('utf8', 'ignore'); break
        except Exception: time.sleep(2)
    if not h: tasks[soc] = None; continue
    txt = re.sub(r'<script.*?</script>|<style.*?</style>', '', h, flags=re.S); txt = re.sub(r'<[^>]+>', '\n', txt); L = [z.strip() for z in re.sub(r'\n\s*\n+', '\n', txt).split('\n') if z.strip()]
    seen = set(); out = []
    for i, z in enumerate(L):
        if z == 'Related occupations' and i > 0 and L[i - 1] in pen and L[i - 1] not in seen: seen.add(L[i - 1]); out.append({'t': L[i - 1], 'p': pen[L[i - 1]]})
    tasks[soc] = out
json.dump(tasks, open(tp, 'w'))
BKEY = {'Very high': 'veryhigh', 'High': 'high', 'Moderate': 'moderate', 'Low': 'low'}
def obs_tier(o):
    if o is None: return None
    return 'high' if o >= .30 else 'moderate' if o >= .10 else 'low' if o >= .01 else 'none'
def short(t, n=120):
    t = t.rstrip('.'); return t if len(t) <= n else t[:n - 1].rsplit(' ', 1)[0] + '...'
old = {x['id']: (x.get('ai') or {}).get('tier') for x in c['careers']}; changes = []
for x in c['careers']:
    s7 = x['soc'][:7]; b = bls.get(s7); o = ex.get(s7); o = None if o is None else round(o, 3)
    ts = tasks.get(x['soc']) or []
    used = sorted([z for z in ts if z['p'] >= .15], key=lambda z: -z['p'])[:3]; unused = [z for z in ts if z['p'] == 0][:2]
    tier = BKEY.get(b['ai']) if b else 'nodata'
    watch = bool(tier == 'veryhigh' and o is not None and o >= .10)
    x['ai'] = {'tier': tier, 'obs': o, 'obsTier': obs_tier(o), 'watch': watch, 'used': [short(z['t']) for z in used], 'human': [short(z['t']) for z in unused], 'nTasks': len(ts)}
    if b:
        x.setdefault('us', {})
        try: x['us']['growthPct'] = float(b['chgPct']); x['us']['growthYears'] = '2025-35'
        except Exception: pass
    if old.get(x['id']) != tier: changes.append({'id': x['id'], 'title': x['title'], 'was': old.get(x['id']), 'now': tier})
c.pop('aiMeta', None)
c['aiMeta'] = {'retrieved': datetime.date.today().isoformat(),
 'tiers': {'veryhigh': 'BLS: very high relative exposure (top quarter of occupations)', 'high': 'BLS: high', 'moderate': 'BLS: moderate', 'low': 'BLS: low', 'nodata': 'not covered'},
 'watch': 'BLS very high AND Anthropic observed exposure of 0.10 or more',
 'sources': [
  {'id': 'bls_ai_exposure', 'name': 'U.S. Bureau of Labor Statistics, AI exposure categories (Aug 2026)', 'url': 'https://www.bls.gov/emp/publications/ai-exposure-categories.htm', 'licence': 'US government work'},
  {'id': 'anthropic_job_exposure', 'name': 'Anthropic Economic Index: observed exposure (Massenkoff and McCrory, 2026)', 'url': 'https://www.anthropic.com/research/labor-market-impacts', 'licence': 'CC BY'},
  {'id': 'onet_tasks', 'name': 'O*NET task statements', 'url': 'https://www.onetonline.org', 'licence': 'CC BY 4.0'}]}
json.dump(c, open(a.content, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
json.dump(changes, open(os.path.join(a.cache, 'ai_changes.json'), 'w'), indent=1)
cnt = {}; [cnt.__setitem__(x['ai']['tier'], cnt.get(x['ai']['tier'], 0) + 1) for x in c['careers']]
print('ai layer ok', cnt, 'watch', sum(1 for x in c['careers'] if x['ai']['watch']), 'changed', len(changes))
