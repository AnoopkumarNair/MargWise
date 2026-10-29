#!/usr/bin/env python3
"""Export graph.sqlite to the files the adult app reads (SPEC 5.4, BUILD_PLAN T1.5). Offline and deterministic.

  python3 data/graph/export.py [--graph PATH] [--out DIR]

Writes (default DIR = data/graph/):
  slices/<onet-soc>.json   one per occupation that has skill ratings; contracts/slice.schema.json
  skills_index.json        contracts/skills_index.schema.json
  titles.json              { normalised title: [occ ids] }
  export_report.json       sizes, trims, left-out occupations, hashes (committed; a change shows up in review)

Size rules (SPEC 5.3): a slice is under 60,000 bytes; skills_index.json is under 1.5 MB gzipped.
SPEC 5.4 asks for 40 needs per target and 30 targets. With this schema that is about 150 KB, so slices are trimmed by `LADDER` below
until they fit, and each trim is counted in export_report.json.
"""
import argparse, collections, csv, gzip, hashlib, json, os, shutil, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_graph import norm_title  # noqa: E402

SLICE_V = 1
SLICE_MAX_BYTES = 60000
INDEX_MAX_GZ = 1500000
NEEDS_OWN = 40
TASKS_OWN = 80
TARGETS = 30
MIX = (18, 8, 4)            # target slots: close_to, two_step, same_cluster; unused slots are refilled from the rest in rank order
TEC_SHARE = 4               # at most n // 4 of a needs list are technologies, so tools do not crowd out skills (tools all weigh 0.6 or 0.8)
TWO_STEP_VIA = 10           # follow the 10 strongest close_to links, then their close_to links
TWO_STEP_MIN_COVERAGE = 0.4
AI_MIN_TASKS = 3            # a skill label needs at least this many tasks to look at
AI_HI, AI_LO = 0.5, 0.15    # SPEC 5.5
# Trim ladder: (targets, needs per target, tasks). The first step is the SPEC 5.4 shape. A slice takes the first step that fits.
TASKS_KEPT = 30             # tasks are shown from S2 on; 30 per occupation (core tasks first) keeps room for the road targets
LADDER = [(30, 40, 80), (30, 40, TASKS_KEPT), (30, 30, TASKS_KEPT), (24, 30, TASKS_KEPT), (24, 24, TASKS_KEPT), (20, 24, TASKS_KEPT), (20, 20, TASKS_KEPT),
          (16, 20, TASKS_KEPT), (12, 20, TASKS_KEPT), (12, 16, TASKS_KEPT), (10, 16, TASKS_KEPT), (8, 16, TASKS_KEPT), (8, 12, TASKS_KEPT), (5, 12, TASKS_KEPT),
          (5, 12, 15), (5, 8, 10), (0, 8, 10)]
KIND = {'skill': 'skill', 'knowledge': 'knowledge', 'activity': 'activity', 'technology': 'technology'}

SHORT = {'onet_database': 'onet', 'anthropic_task_penetration': 'aei_task', 'anthropic_job_exposure': 'aei_obs', 'bls_ai_exposure': 'bls_ai'}   # ids inside a slice are short, to save bytes
SOURCES = {   # keys are the ids in data/sources.yaml; texts match it
    'onet_database': {'name': 'O*NET database (US Department of Labor, Employment and Training Administration)', 'url': 'https://www.onetcenter.org/database.html', 'trust': 'official', 'licence': 'CC BY 4.0'},
    'anthropic_task_penetration': {'name': 'Anthropic Economic Index, AI use by O*NET task', 'url': 'https://huggingface.co/datasets/Anthropic/EconomicIndex', 'trust': 'official', 'licence': 'CC BY'},
    'anthropic_job_exposure': {'name': 'Anthropic Economic Index, observed exposure by occupation', 'url': 'https://huggingface.co/datasets/Anthropic/EconomicIndex', 'trust': 'official', 'licence': 'CC BY'},
    'bls_ai_exposure': {'name': 'BLS AI exposure categories', 'url': 'https://www.bls.gov/emp/publications/ai-exposure-categories.htm', 'trust': 'official', 'licence': 'US government work'},
}
SENIORITY = ['associate', 'senior associate', 'senior', 'lead', 'assistant manager', 'deputy manager', 'manager', 'assistant vice president', 'vice president', 'avp', 'vp', 'am', 'dm']


def jl(s):
    return json.loads(s) if s else None


def dump(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def sha(b):
    return hashlib.sha256(b).hexdigest()


class Graph:
    def __init__(self, path):
        db = sqlite3.connect(path)
        self.node = {r[0]: {'kind': r[1], 'label': r[2], 'alt': jl(r[3]), 'attrs': jl(r[4]) or {}, 'source': r[5], 'trust': r[6], 'as_of': r[7]} for r in db.execute('SELECT * FROM node ORDER BY id')}
        self.out = collections.defaultdict(lambda: collections.defaultdict(list))   # src -> kind -> [(dst, weight, attrs, as_of)]
        for s, d, k, w, at, src, tr, ao in db.execute('SELECT * FROM edge ORDER BY src, dst, kind'):
            self.out[s][k].append((d, w, jl(at) or {}, ao))
        self.sig = collections.defaultdict(list)
        for n, k, p, v, src, tr, ao in db.execute('SELECT * FROM signal ORDER BY node, kind, period'): self.sig[n].append((k, p, v, src, ao))
        self.hash = None
        db.close()


def ai_share_label(pens):
    """SPEC 5.5 on a list of task penetrations: 0.5 or more with AI use = ai_does_much, 0.15 or less = people_do, between = mixed. Fewer than 3 tasks = unknown."""
    if len(pens) < AI_MIN_TASKS: return 'unknown'
    share = sum(1 for p in pens if p > 0) / len(pens)
    return 'ai_does_much' if share >= AI_HI else 'people_do' if share <= AI_LO else 'mixed'


def ai_labels(g, occ):
    """SPEC 5.5. For a skill or work activity: the share of the occupation's tasks (linked through the detailed work activity) that have AI use."""
    tasks = [(d, at) for d, w, at, ao in g.out[occ]['has_task']]
    by_gwa = collections.defaultdict(list)
    for d, at in tasks:
        for gw in at.get('gwa', []): by_gwa[gw].append(at.get('pen') or 0.0)
    cache = {}
    def label(e):
        if e in cache: return cache[e]
        n = g.node[e]; kind = n['attrs'].get('skill_kind')
        if kind == 'activity': gwas = [e[4:]]
        elif kind == 'skill': gwas = n['attrs'].get('acts', [])
        else: return cache.setdefault(e, 'unknown')
        pens = [p for gw in gwas for p in by_gwa.get(gw, [])]   # a task counts once per linked activity: that is the weighting
        return cache.setdefault(e, ai_share_label(pens))
    return label


def need_rows(g, occ, n, label_fn):
    rows = []
    for d, w, at, ao in g.out[occ]['needs']:
        nd = g.node[d]; rows.append((d, w, at, ao, nd))
    tec = sorted((r for r in rows if r[0].startswith('tec:')), key=lambda r: (-r[1], not r[2].get('in_demand'), r[0]))
    oth = sorted((r for r in rows if not r[0].startswith('tec:')), key=lambda r: (-r[1], r[0]))
    cap = n // TEC_SHARE
    take_oth = oth[:max(n - min(cap, len(tec)), 0)]
    take_tec = tec[:n - len(take_oth)]
    pick = sorted(take_oth + take_tec, key=lambda r: (-r[1], r[0]))
    out = []
    for d, w, at, ao, nd in pick:
        k = nd['attrs']['skill_kind']
        out.append({'id': d, 'label': nd['label'][:200], 'kind': KIND[k], 'w': round(w, 4), 'ai': label_fn(d), 'as_of': ao, 'src': SHORT['onet_database']})
    return out


def occ_obj(g, o, full):
    n = g.node[o]; a = n['attrs']
    ob = {'id': o, 'label': n['label'][:200]}
    if full:
        if n['alt']: ob['alt'] = n['alt'][:30]
        ob['description'] = (a['description'] if len(a['description']) <= 1000 else a['description'][:997].rsplit(' ', 1)[0] + '...')
    ob['soc'] = a['soc']
    ob['job_zone'] = a.get('job_zone')
    if a.get('ratings'): ob['ratings'] = a['ratings']
    ob['as_of'] = n['as_of']; ob['src'] = SHORT['onet_database']
    return ob


def sig_rows(g, o):
    out = []
    for k, p, v, src, ao in g.sig.get(o, []):
        if k not in ('ai_obs', 'ai_tier'): continue
        out.append({'kind': k, 'period': p, 'value': float(v) if k == 'ai_obs' else v, 'as_of': ao, 'src': SHORT[src]})
    return out


def task_rows(g, o, limit):
    rows = []
    for d, w, at, ao in g.out[o]['has_task']:
        rows.append((0 if at.get('type') == 'Core' else 1, -(at.get('pen') or 0.0), d, at, ao))
    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    out = []
    for _, _, d, at, ao in rows[:limit]:
        tid = d
        s = [x for x in g.sig.get(tid, []) if x[0] == 'ai_task_mode']
        if s: mode, src, asof = s[0][2], SHORT[s[0][3]], s[0][4]
        else: mode, src, asof = 'unknown', SHORT['onet_database'], ao
        out.append({'id': tid, 'label': g.node[tid]['label'][:400], 'ai_mode': mode, 'as_of': asof, 'src': src})
    return out


def coverage(own, tgt_needs):
    """How much of the target's top needs the occupation's own profile reaches: sum(min(w_target, w_own)) / sum(w_target). Used to rank candidates only; the matcher computes the real coverage."""
    tot = sum(n['w'] for n in tgt_needs)
    return sum(min(n['w'], own.get(n['id'], 0.0)) for n in tgt_needs) / tot if tot else 0.0


def build_slices(g, release):
    occs = sorted(i for i, n in g.node.items() if n['kind'] == 'occupation')
    rated = [o for o in occs if g.node[o]['attrs'].get('ratings')]
    rated_set = set(rated)
    cluster = collections.defaultdict(set); members = collections.defaultdict(set)
    for o in occs:
        for d, w, at, ao in g.out[o]['in_cluster']: cluster[o].add(d); members[d].add(o)
    labels = {o: ai_labels(g, o) for o in rated}
    top_cache = {}
    def top(o, n):
        if (o, n) not in top_cache: top_cache[(o, n)] = need_rows(g, o, n, labels[o])
        return top_cache[(o, n)]
    own_w = {o: {d: w for d, w, at, ao in g.out[o]['needs']} for o in rated}
    close = {o: sorted([(d, w, at) for d, w, at, ao in g.out[o]['close_to'] if d in rated_set and d != o], key=lambda r: (-r[1], -(r[2].get('cos') or 0), r[0])) for o in rated}
    cos = {o: {d: at.get('cos') or 0.0 for d, w, at in close[o]} for o in rated}

    def candidates(o):
        cov = {}
        def c(t):
            if t not in cov: cov[t] = coverage(own_w[o], top(t, 40))
            return cov[t]
        direct = [(d, w) for d, w, at in close[o]]
        direct_ids = {d for d, _ in direct}
        two = {}
        for m, _, _ in close[o][:TWO_STEP_VIA]:
            for t, w2, at2 in close[m]:
                if t == o or t in direct_ids or t in two: continue
                if c(t) >= TWO_STEP_MIN_COVERAGE: two[t] = c(t)
        same = {}
        for f in sorted(cluster[o]):
            for t in sorted(members[f]):
                if t != o and t in rated_set: same[t] = c(t)
        pools = [
            ('close_to', [d for d, w in direct]),   # already ordered by weight
            ('two_step', sorted(two, key=lambda t: (-two[t], t))),
            ('same_cluster', sorted(same, key=lambda t: (-same[t], t))),
        ]
        chosen, seen = [], set()
        for (name, ids), slots in zip(pools, MIX):
            for t in ids[:slots]:
                if t not in seen: seen.add(t); chosen.append(t)
        for name, ids in pools:   # refill
            for t in ids:
                if len(chosen) >= TARGETS: break
                if t not in seen: seen.add(t); chosen.append(t)
        via = {}
        for t in chosen:
            v = []
            if t in direct_ids: v.append('close_to')
            if t in two: v.append('two_step')
            if t in same: v.append('same_cluster')
            via[t] = v
        return chosen, via

    slices, sizes, trims = {}, {}, collections.Counter()
    for o in rated:
        chosen, via = candidates(o)
        used_src = set()
        for step, (nt, nn, nk) in enumerate(LADDER):
            sl = {'slice_v': SLICE_V, 'release': release, 'occ': occ_obj(g, o, True), 'needs': top(o, NEEDS_OWN), 'tasks': task_rows(g, o, nk), 'signals': sig_rows(g, o), 'targets': []}
            for t in chosen[:nt]:
                sl['targets'].append({'occ': occ_obj(g, t, False), 'via': via[t], 'needs': top(t, nn), 'signals': sig_rows(g, t)})
            ids = {SHORT['onet_database']}
            for blk in [sl['needs'], sl['tasks'], sl['signals']] + [x for tg in sl['targets'] for x in (tg['needs'], tg['signals'])]:
                ids.update(r['src'] for r in blk)
            srcs = []
            for sid in sorted(ids):
                full = LONG[sid]; d = dict(SOURCES[full]); d['id'] = sid; d['as_of'] = SRC_ASOF[full]; srcs.append({k: d[k] for k in ('id', 'name', 'url', 'trust', 'as_of', 'licence')})
            sl['sources'] = srcs
            body = dump(sl)
            if len(body.encode('utf8')) < SLICE_MAX_BYTES: break
        else:
            raise SystemExit('slice %s cannot be made small enough' % o)
        if step: trims['targets_%d_needs_%d_tasks_%d' % (nt, nn, nk)] += 1
        slices[o[4:]] = body; sizes[o[4:]] = (len(body.encode('utf8')), (nt, nn, nk), len(sl['targets']))
    return slices, sizes, trims, [o for o in occs if o not in rated_set]


SRC_ASOF = {}
LONG = {v: k for k, v in SHORT.items()}


def read_csv(path):
    if not os.path.exists(path): return []
    return list(csv.DictReader(open(path, encoding='utf8', newline='')))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--graph', default=os.path.join(HERE, 'graph.sqlite')); ap.add_argument('--out', default=HERE)
    ap.add_argument('--report', default=os.path.join(HERE, 'build_report.json'), help='the build report of the graph being exported')
    a = ap.parse_args()
    g = Graph(a.graph)
    rep = json.load(open(a.report))
    release = 'onet-%s-%s' % (rep['onet_version'].replace('.', '-'), rep['graph_hash'][:8])
    SRC_ASOF.update({'onet_database': rep['onet_release']})
    # the AI sources' dates come from the signals themselves
    for n, rows in g.sig.items():
        for k, p, v, src, ao in rows: SRC_ASOF.setdefault(src, ao)
    for k in SOURCES: SRC_ASOF.setdefault(k, rep['onet_release'])
    slices, sizes, trims, no_slice = build_slices(g, release)

    sdir = os.path.join(a.out, 'slices')
    if os.path.isdir(sdir): shutil.rmtree(sdir)
    os.makedirs(sdir)
    for soc in sorted(slices): open(os.path.join(sdir, soc + '.json'), 'w', encoding='utf8').write(slices[soc])

    # ---- abbreviations and Indian titles (owner review needed)
    alt_add = collections.defaultdict(set); amb = collections.defaultdict(set); title_add = collections.defaultdict(set)
    abbrev_rows = read_csv(os.path.join(HERE, 'raw', 'abbrev_in.csv'))
    for r in abbrev_rows:
        tid, term = r['maps_to_id'].strip(), r['term'].strip()
        if tid not in g.node: raise SystemExit('abbrev_in.csv: %s is not in the graph (term %s)' % (tid, term))
        if tid.startswith(('skl:', 'tec:')):
            if norm_title(term) != norm_title(g.node[tid]['label']): alt_add[tid].add(term)
            if 'ambiguous' in r['note'].lower(): amb[tid].add(term)
        elif tid.startswith('occ:') and tid[4:] in slices: title_add[norm_title(term)].add(tid)
    for r in read_csv(os.path.join(HERE, 'raw', 'titles_in.csv')):
        ids = [x for x in r['maps_to'].split('|') if x]
        for x in ids:
            if x not in g.node: raise SystemExit('titles_in.csv: %s is not in the graph' % x)
        ids = [x for x in ids if x[4:] in slices]
        if not ids: continue
        title_add[norm_title(r['title'])].update(ids)
        if r.get('levels', '').strip().upper() == 'Y':
            for p in SENIORITY: title_add[norm_title(p + ' ' + r['title'])].update(ids)

    # ---- skills_index.json
    idx = []
    for i in sorted(g.node):
        if not i.startswith(('skl:', 'tec:')): continue
        n = g.node[i]; e = {'id': i, 'label': n['label'][:200], 'alt': sorted(alt_add[i])[:60], 'kind': KIND[n['attrs']['skill_kind']]}
        if amb[i]: e['ambiguous'] = sorted(amb[i])
        idx.append(e)
    # a term must not point at two ids unless it is marked ambiguous (TEST_PLAN layer 1)
    seen = {}
    for e in idx:
        for t in e['alt']:
            k = norm_title(t)
            if k in seen and seen[k] != e['id'] and t not in e.get('ambiguous', []):
                raise SystemExit('term %r points at %s and %s without being marked ambiguous' % (t, seen[k], e['id']))
            seen.setdefault(k, e['id'])
    idx_body = dump(idx).encode('utf8')
    open(os.path.join(a.out, 'skills_index.json'), 'wb').write(idx_body)
    idx_gz = len(gzip.compress(idx_body, 9, mtime=0))
    if idx_gz >= INDEX_MAX_GZ: raise SystemExit('skills_index.json is %d bytes gzipped (limit %d)' % (idx_gz, INDEX_MAX_GZ))

    # ---- titles.json
    titles = collections.defaultdict(set)
    for t, n in g.node.items():
        if n['kind'] != 'title': continue
        for d, w, at, ao in g.out[t]['is_title_of']:
            if d[4:] in slices: titles[t[4:]].add(d)
    for k, ids in title_add.items(): titles[k].update(ids)
    tj = {k: sorted(v) for k, v in sorted(titles.items()) if k}
    tbody = dump(tj).encode('utf8'); open(os.path.join(a.out, 'titles.json'), 'wb').write(tbody)

    byt = [v[0] for v in sizes.values()]
    report = {
        'release': release, 'graph_hash': rep['graph_hash'], 'onet_version': rep['onet_version'],
        'slices': len(slices), 'slice_bytes_max': max(byt), 'slice_bytes_median': sorted(byt)[len(byt) // 2], 'slice_bytes_total': sum(byt),
        'slice_bytes_gz_total': sum(len(gzip.compress(slices[s].encode('utf8'), 9, mtime=0)) for s in slices),
        'slice_shape_counts (targets_needs_tasks)': dict(sorted(trims.items())),
        'slices_at_full_spec_shape': sum(1 for v in sizes.values() if v[1] == LADDER[0]),
        'targets_per_slice_histogram': dict(sorted(collections.Counter(v[2] for v in sizes.values()).items())),
        'occupations_without_slice': no_slice,
        'skills_index': {'entries': len(idx), 'bytes': len(idx_body), 'bytes_gz': idx_gz, 'alt_terms': sum(len(e['alt']) for e in idx)},
        'titles': {'keys': len(tj), 'bytes': len(tbody), 'bytes_gz': len(gzip.compress(tbody, 9, mtime=0)), 'from_owner_review_lists': len(title_add)},
        'hashes': {'skills_index.json': sha(idx_body), 'titles.json': sha(tbody), 'slices (sha256 of the sorted name:sha lines)': sha('\n'.join('%s:%s' % (s, sha(slices[s].encode('utf8'))) for s in sorted(slices)).encode())},
        'limits': {'slice_max_bytes': SLICE_MAX_BYTES, 'skills_index_max_gz': INDEX_MAX_GZ},
    }
    json.dump(report, open(os.path.join(a.out, 'export_report.json'), 'w'), indent=1, sort_keys=True); open(os.path.join(a.out, 'export_report.json'), 'a').write('\n')
    print('export ok: %d slices (max %d B), skills_index %d entries (%d B gz), titles %d keys' % (len(slices), max(byt), len(idx), idx_gz, len(tj)))


if __name__ == '__main__':
    main()
