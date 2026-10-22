#!/usr/bin/env python3
"""Stage: attach AI-exposure facts to every career in content.json.

Sources (all public, licences recorded in pipeline/sources.yaml):
  anthropic_job_exposure  Anthropic Economic Index, labor_market_impacts/job_exposure.csv  (CC BY)   observed exposure by SOC
  anthropic_task_pen      Anthropic Economic Index, labor_market_impacts/task_penetration.csv (CC BY) AI use by O*NET task
  openai_gpts_are_gpts    Eloundou et al. 2023, data/occ_level.csv (MIT)                              theoretical exposure by O*NET-SOC
  onet_tasks              O*NET OnLine task lists (CC BY 4.0)                                         task statements per occupation

Usage: python3 ai_exposure.py [--content content.json] [--cache ai] [--refresh]
Idempotent: re-running with fresh files updates the numbers and writes a change list to <cache>/ai_changes.json.
"""
import argparse, csv, json, os, re, time, urllib.request, datetime
ap = argparse.ArgumentParser(); ap.add_argument('--content', default='content.json'); ap.add_argument('--cache', default='ai'); ap.add_argument('--refresh', action='store_true')
a = ap.parse_args(); os.makedirs(a.cache, exist_ok=True)
SRC = {
 'job_exposure.csv': 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/job_exposure.csv',
 'task_pen.csv': 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/task_penetration.csv',
 'elo.csv': 'https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/occ_level.csv',
}
def fetch(name):
    p = os.path.join(a.cache, name)
    if a.refresh or not os.path.exists(p):
        urllib.request.urlretrieve(SRC[name], p)
    return p
ex = {r['occ_code']: float(r['observed_exposure']) for r in csv.DictReader(open(fetch('job_exposure.csv'), encoding='utf8'))}
pen = {r['task'].strip(): float(r['penetration']) for r in csv.DictReader(open(fetch('task_pen.csv'), encoding='utf8'))}
elo = {r['O*NET-SOC Code']: (float(r['human_rating_beta']) + float(r['dv_rating_beta'])) / 2 for r in csv.DictReader(open(fetch('elo.csv'), encoding='utf8'))}
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
def tier(o):
    if o is None: return 'nodata'
    return 'high' if o >= .30 else 'moderate' if o >= .10 else 'low' if o >= .01 else 'none'
def short(t, n=120):
    t = t.rstrip('.'); return t if len(t) <= n else t[:n - 1].rsplit(' ', 1)[0] + '...'
old = {x['id']: (x.get('ai') or {}).get('obs') for x in c['careers']}; changes = []
for x in c['careers']:
    o = ex.get(x['soc'][:7]); o = None if o is None else round(o, 3); th = elo.get(x['soc']); ts = [z for z in (tasks.get(x['soc']) or [])]
    used = sorted([z for z in ts if z['p'] >= .15], key=lambda z: -z['p'])[:3]
    unused = [z for z in ts if z['p'] == 0][:2]
    x['ai'] = {'obs': None if o is None else round(o, 3), 'theo': None if th is None else round(th, 2), 'tier': tier(o), 'used': [short(z['t']) for z in used], 'human': [short(z['t']) for z in unused], 'nTasks': len(ts)}
    if old.get(x['id']) != x['ai']['obs']: changes.append({'id': x['id'], 'title': x['title'], 'was': old.get(x['id']), 'now': x['ai']['obs']})
c['aiMeta'] = {'retrieved': datetime.date.today().isoformat(), 'tiers': {'high': '>= 0.30', 'moderate': '0.10 to 0.30', 'low': '0.01 to 0.10', 'none': 'below 0.01 (not enough use seen)'},
 'sources': [
  {'id': 'anthropic_job_exposure', 'name': 'Anthropic Economic Index: observed exposure (Massenkoff and McCrory, 2026)', 'url': 'https://www.anthropic.com/research/labor-market-impacts', 'licence': 'CC BY'},
  {'id': 'openai_gpts_are_gpts', 'name': 'Eloundou et al. 2023, GPTs are GPTs: theoretical exposure', 'url': 'https://github.com/openai/GPTs-are-GPTs', 'licence': 'MIT'},
  {'id': 'onet_tasks', 'name': 'O*NET task statements', 'url': 'https://www.onetonline.org', 'licence': 'CC BY 4.0'}]}
json.dump(c, open(a.content, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
json.dump(changes, open(os.path.join(a.cache, 'ai_changes.json'), 'w'), indent=1)
cnt = {}; [cnt.__setitem__(x['ai']['tier'], cnt.get(x['ai']['tier'], 0) + 1) for x in c['careers']]
print('ai layer ok', cnt, 'changed', len(changes))
