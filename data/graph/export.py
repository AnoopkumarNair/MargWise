#!/usr/bin/env python3
"""Export graph.sqlite to the files the adult app reads (SPEC 5.4, BUILD_PLAN T1.5). Offline and deterministic.

  python3 data/graph/export.py [--graph PATH] [--out DIR]

Writes (default DIR = data/graph/):
  slices/<onet-soc>.json   one per occupation that has skill ratings; contracts/slice.schema.json
  skills_index.json        contracts/skills_index.schema.json
  titles.json              { normalised title: [occ ids] }
  export_report.json       sizes, trims, left-out occupations, hashes (committed; a change shows up in review)

Size rules (SPEC 5.3, owner decision 2026-10-29): a slice is at most 60,000 bytes GZIPPED (what a browser downloads; gzip level 6,
about what a web server uses); skills_index.json is under 1.5 MB gzipped. Slices have the full SPEC 5.4 shape: the occupation's top 40
needs and up to 80 tasks, and up to 30 road targets each with its top 40 needs, plus the skill_near pairs between those skills that
the matcher can count (slice contract amendment A1; owner decision O2). Tool weights are capped per needs list (owner decision O3). `LADDER` below is a last resort only: a slice that is still too big takes the first smaller step that
fits, and every such trim is counted in export_report.json. With O*NET 31.0 no slice needs it.

slices/ is a build output and is not committed (deviations D15): the pipeline rebuilds it, and export_report.json (committed) holds
its hashes and sizes, so CI sees any change. --accept stores the accepted slices as one compressed pack in data/releases/graph/.
"""
import argparse, collections, csv, gzip, hashlib, json, math, os, shutil, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_graph import norm_title  # noqa: E402

SLICE_V = 1
SLICE_MAX_GZ = 60000        # bytes, gzipped (SPEC 5.3)
GZ_LEVEL = 6
INDEX_MAX_GZ = 1500000
NEEDS_OWN = 40
TASKS_OWN = 80
TARGETS = 30
MIX = (18, 8, 4)            # target slots: close_to, two_step, same_cluster; unused slots are refilled from the rest in rank order
TEC_SHARE = 4               # at most n // 4 of a needs list are technologies, so tools do not crowd out skills (tools all weigh 0.6 or 0.8)
# Which tools fill those slots (review finding B1): an occupation's own O*NET 'In Demand' tools first, then the tools most typical of the
# occupation's SOC minor group (the first four digits, such as 15-12) compared with all occupations: a TF-IDF style score,
#   (occupations in the same minor group that list the tool / occupations in the group) * ln(occupations listing any tool / occupations listing it)
# so a tool that every job lists (Microsoft Office) scores low and a tool shared by the job's neighbours scores high. Ties by label, then id.
# The graph keeps the tool weights of BUILD_PLAN T1.3 (0.8 Hot Technology, 0.6 other). The export caps them (owner decision O3,
# 2026-10-29, deviations): in each needs list it writes (the occupation's own list, and each target's list, separately), a tool's weight
# is at most the median weight of the non-tool needs in that same list. See cap_tool_weights. Candidate ranking uses the graph weights.
# skill_near pairs (owner decision O2): the matcher counts a near skill only when the pair is among the 3 closest neighbours of the skill
# being credited and its similarity is 0.90 or more. A pair that can never count is left out of the slice (near_block).
NEAR_RANK, NEAR_FLOOR = 3, 0.9
TWO_STEP_VIA = 10           # follow the 10 strongest close_to links, then their close_to links
TWO_STEP_MIN_COVERAGE = 0.4
AI_MIN_TASKS = 3            # a skill label needs at least this many tasks to look at
AI_HI, AI_LO = 0.5, 0.15    # SPEC 5.5
# Trim ladder, last resort only: (targets, needs per target, tasks). The first step is the SPEC 5.4 shape. A slice takes the first step
# whose gzipped size fits; any step after the first is counted in export_report.json ('slices_trimmed') for the owner to see.
LADDER = [(TARGETS, 40, TASKS_OWN), (TARGETS, 40, 40), (TARGETS, 30, 40), (24, 30, 30), (20, 24, 30), (12, 20, 30), (5, 12, 15), (0, 8, 10)]
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
    """SPEC 5.5 on a list of task penetrations, only tasks that have AI data: a share of 0.5 or more with AI use = ai_does_much, 0.15 or
    less = people_do, between = mixed. Fewer than 3 such tasks = unknown. A task without AI data is left out (None), never counted as no use."""
    pens = [p for p in pens if p is not None]
    if len(pens) < AI_MIN_TASKS: return 'unknown'
    share = sum(1 for p in pens if p > 0) / len(pens)
    return 'ai_does_much' if share >= AI_HI else 'people_do' if share <= AI_LO else 'mixed'


def ai_labels(g, occ):
    """SPEC 5.5. For a skill or work activity: the share of the occupation's tasks (linked through the detailed work activity) that have AI
    use, over the linked tasks that have AI data. 'Weighted share' is implemented as: a task counts once per linked activity, so a task that
    reaches the skill through two activities counts twice. Tasks with no AI data are unknown and left out of both counts (review finding S4)."""
    tasks = [(d, at) for d, w, at, ao in g.out[occ]['has_task']]
    by_gwa = collections.defaultdict(list)
    for d, at in tasks:
        if at.get('pen') is None: continue   # no AI data for this task: unknown, not 'no use'
        for gw in at.get('gwa', []): by_gwa[gw].append(at['pen'])
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


def minor_group(soc):
    """SOC minor group: the first four digits, '15-1252.00' -> '15-12'."""
    return soc[:5]


def tec_scores(g):
    """{occ: {tec id: score}} for the TF-IDF style tool ranking described at TEC_SHARE. Deterministic: plain counts and one log."""
    lists = {o: sorted({d for d, w, at, ao in g.out[o]['needs'] if d.startswith('tec:')}) for o, n in g.node.items() if n['kind'] == 'occupation'}
    lists = {o: t for o, t in lists.items() if t}
    N = len(lists)
    df = collections.Counter(t for ts in lists.values() for t in ts)
    group = collections.defaultdict(list)
    for o in lists: group[minor_group(o[4:])].append(o)
    gdf = {k: collections.Counter(t for o in os_ for t in lists[o]) for k, os_ in group.items()}
    out = {}
    for o, ts in lists.items():
        k = minor_group(o[4:]); size = len(group[k])
        out[o] = {t: round(gdf[k][t] / size * math.log(N / df[t]), 9) for t in ts}
    return out


def tec_key(r, scores):
    """Sort key for an occupation's tool rows (d, w, attrs, as_of, node): In Demand first, then the score, then label, then id. Never id alone."""
    d, w, at, ao, nd = r
    return (not at.get('in_demand'), -scores.get(d, 0.0), nd['label'], d)


def need_rows(g, occ, n, label_fn, scores=None):
    rows = []
    for d, w, at, ao in g.out[occ]['needs']:
        nd = g.node[d]; rows.append((d, w, at, ao, nd))
    sc = (scores or {}).get(occ, {})
    tec = sorted((r for r in rows if r[0].startswith('tec:')), key=lambda r: tec_key(r, sc))
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


def median(xs):
    xs = sorted(xs); n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def cap_tool_weights(needs):
    """Owner decision O3: in one needs list as written to a slice, a tool's (tec:) weight is at most the median weight of the non-tool
    needs in that list (rounded to 4 decimals; for an even count, the mean of the two middle values). A list with no non-tool need is left
    as it is. Returns a new list in the usual order (weight, then id); the graph's own weights are not changed."""
    other = [n['w'] for n in needs if not n['id'].startswith('tec:')]
    if not other: return [dict(n) for n in needs]
    cap = round(median(other), 4)
    out = [dict(n, w=min(n['w'], cap)) if n['id'].startswith('tec:') else dict(n) for n in needs]
    return sorted(out, key=lambda n: (-n['w'], n['id']))


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


def near_block(g, needs_lists):
    """skill_near pairs (SPEC 5.2) between the skl: ids in these needs lists: [a, b, similarity] once each, a < b, best similarity of the two
    directions (cosine is symmetric, but each skill keeps only its own top 10, so a pair can be stored in one direction only), then only
    the pairs the matcher can count (countable_pairs, owner decision O2)."""
    ids = sorted({n['id'] for lst in needs_lists for n in lst if n['id'].startswith('skl:')})
    have = set(ids); best = {}; asof = None
    for a in ids:
        for d, w, at, ao in g.out[a]['skill_near']:
            if d not in have or d == a: continue
            k = (a, d) if a < d else (d, a)
            if w > best.get(k, -1): best[k] = w
            asof = max(asof or ao, ao)
    pairs = [[a, b, round(w, 4)] for (a, b), w in sorted(best.items()) if w >= 0.5]
    return {'pairs': countable_pairs(pairs), 'as_of': asof or SRC_ASOF['onet_database'], 'src': SHORT['onet_database'], 'trust': 'estimate'}


def countable_pairs(pairs):
    """Owner decision O2: the matcher credits skill s from a near skill k only when k is among the NEAR_RANK closest neighbours of s in
    the slice's pairs (by similarity, then id) and the similarity is NEAR_FLOOR or more. Keep only the pairs that can count for one of
    their two skills. This changes no match result: a dropped pair ranks below the top NEAR_RANK of both its skills, or is under the floor
    (and so is everything ranked after it), so no skill's top NEAR_RANK above the floor changes."""
    nb = collections.defaultdict(list)
    for a, b, w in pairs: nb[a].append((-w, b)); nb[b].append((-w, a))
    keep = set()
    for x, lst in nb.items():
        for negw, y in sorted(lst)[:NEAR_RANK]:
            if -negw >= NEAR_FLOOR: keep.add((x, y) if x < y else (y, x))
    return [p for p in pairs if (p[0], p[1]) in keep]


def tool_counts(g, o, targets, sl):
    """(tool needs written, tool needs whose weight the O3 cap lowered) in one slice, for export_report.json."""
    graph_w = lambda occ: {d: w for d, w, at, ao in g.out[occ]['needs']}
    lists = [(o, sl['needs'])] + [(tg['occ']['id'], tg['needs']) for tg in sl['targets']]
    tools = [(graph_w(occ)[n['id']], n['w']) for occ, lst in lists for n in lst if n['id'].startswith('tec:')]
    return len(tools), sum(1 for gw, w in tools if w < round(gw, 4))


def gz_size(body):
    return len(gzip.compress(body.encode('utf8'), GZ_LEVEL, mtime=0))


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
    scores = tec_scores(g)
    top_cache = {}
    def top(o, n):
        if (o, n) not in top_cache: top_cache[(o, n)] = need_rows(g, o, n, labels[o], scores)
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
            sl = {'slice_v': SLICE_V, 'release': release, 'occ': occ_obj(g, o, True), 'needs': cap_tool_weights(top(o, NEEDS_OWN)), 'tasks': task_rows(g, o, nk), 'signals': sig_rows(g, o), 'targets': []}
            for t in chosen[:nt]:
                sl['targets'].append({'occ': occ_obj(g, t, False), 'via': via[t], 'needs': cap_tool_weights(top(t, NEEDS_OWN)[:nn]), 'signals': sig_rows(g, t)})
            sl['near'] = near_block(g, [sl['needs']] + [tg['needs'] for tg in sl['targets']])
            ids = {SHORT['onet_database']}
            for blk in [sl['needs'], sl['tasks'], sl['signals']] + [x for tg in sl['targets'] for x in (tg['needs'], tg['signals'])]:
                ids.update(r['src'] for r in blk)
            srcs = []
            for sid in sorted(ids):
                full = LONG[sid]; d = dict(SOURCES[full]); d['id'] = sid; d['as_of'] = SRC_ASOF[full]; srcs.append({k: d[k] for k in ('id', 'name', 'url', 'trust', 'as_of', 'licence')})
            sl['sources'] = srcs
            body = dump(sl)
            gz = gz_size(body)
            if gz <= SLICE_MAX_GZ: break
        else:
            raise SystemExit('slice %s is over %d bytes gzipped even at the last trim step' % (o, SLICE_MAX_GZ))
        if step: trims['targets_%d_needs_%d_tasks_%d' % (nt, nn, nk)] += 1
        slices[o[4:]] = body; sizes[o[4:]] = (len(body.encode('utf8')), (nt, nn, nk), len(sl['targets']), gz, len(sl['near']['pairs']), len(sl['tasks']), *tool_counts(g, o, chosen[:nt], sl))
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

    byt = sorted(v[0] for v in sizes.values()); gzs = sorted(v[3] for v in sizes.values()); npairs = sorted(v[4] for v in sizes.values())
    med = lambda xs: xs[len(xs) // 2]
    report = {
        'release': release, 'graph_hash': rep['graph_hash'], 'onet_version': rep['onet_version'],
        'slices': len(slices),
        'slice_bytes_gz_max': gzs[-1], 'slice_bytes_gz_median': med(gzs), 'slice_bytes_gz_total': sum(gzs), 'slice_gz_level': GZ_LEVEL,
        'slice_bytes_max': byt[-1], 'slice_bytes_median': med(byt), 'slice_bytes_total': sum(byt),
        'slices_trimmed (targets_needs_tasks)': dict(sorted(trims.items())),
        'slices_at_full_spec_shape': sum(1 for v in sizes.values() if v[1] == LADDER[0]),
        'targets_per_slice_histogram': {str(k): n for k, n in sorted(collections.Counter(v[2] for v in sizes.values()).items())},
        'tasks_per_slice_max': max(v[5] for v in sizes.values()),
        'near_pairs_per_slice': {'max': npairs[-1], 'median': med(npairs), 'min': npairs[0]},
        'near_rule': {'rank': NEAR_RANK, 'floor': NEAR_FLOOR},
        'tool_weight_cap': {'rule': 'median of the non-tool needs in the same list', 'tool_needs': sum(v[6] for v in sizes.values()), 'tool_needs_capped': sum(v[7] for v in sizes.values())},
        'occupations_without_slice': no_slice,
        'skills_index': {'entries': len(idx), 'bytes': len(idx_body), 'bytes_gz': idx_gz, 'alt_terms': sum(len(e['alt']) for e in idx)},
        'titles': {'keys': len(tj), 'bytes': len(tbody), 'bytes_gz': len(gzip.compress(tbody, 9, mtime=0)), 'from_owner_review_lists': len(title_add)},
        'hashes': {'skills_index.json': sha(idx_body), 'titles.json': sha(tbody), 'slices (sha256 of the sorted name:sha lines)': sha('\n'.join('%s:%s' % (s, sha(slices[s].encode('utf8'))) for s in sorted(slices)).encode())},
        'limits': {'slice_max_bytes_gz': SLICE_MAX_GZ, 'skills_index_max_gz': INDEX_MAX_GZ},
    }
    json.dump(report, open(os.path.join(a.out, 'export_report.json'), 'w'), indent=1, sort_keys=True); open(os.path.join(a.out, 'export_report.json'), 'a').write('\n')
    print('export ok: %d slices (gzipped max %d B, median %d B; raw max %d B), %d trimmed, skills_index %d entries (%d B gz), titles %d keys' % (len(slices), gzs[-1], med(gzs), byt[-1], sum(trims.values()), len(idx), idx_gz, len(tj)))


if __name__ == '__main__':
    main()
