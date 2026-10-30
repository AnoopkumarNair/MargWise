#!/usr/bin/env python3
"""Build data/graph/graph.sqlite from the raw files (SPEC 5.2, BUILD_PLAN T1.3). Offline and deterministic.

  python3 data/graph/build_graph.py [--out PATH] [--report PATH]

Reads   data/graph/raw/onet/<pinned version>/*.txt, data/graph/raw/soc_aliases.csv,
        data/ai/{task_pen.csv, job_exposure.csv, bls_ai_exposure.csv, retrieved.json}, data/content.json
Writes  graph.sqlite (git-ignored) and build_report.json (committed: counts, content hash, what was left out).

Not in this round (S1): SOC to ISCO and NCO crosswalks (blocked host, see raw/crosswalk/README.md), so attrs have no `isco`;
PLFS pay bands (S2); emerging roles, credentials, cities (S2).
"""
import argparse, collections, csv, hashlib, json, math, os, re, sqlite3, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from fetch_onet import ONET_VERSION, ONET_RELEASE  # noqa: E402

SRC_ONET = 'onet_database'
MIN_IM = 2.5                 # SPEC 5.2: keep a needs edge only where importance is 2.5 or more
MIN_NEEDS = 10               # SPEC 5.3
TEC_W, TEC_HOT_W = 0.6, 0.8  # BUILD_PLAN T1.3
CLOSE_COS_MIN, CLOSE_COS_TOP = 0.93, 10   # skill-vector close_to: top 10 per occupation, cosine at least this (chosen from the distribution; see report)
NEAR_MIN, NEAR_TOP = 0.5, 10              # SPEC 5.2 skill_near
BLS_AI_AS_OF = '2026-08'     # data/content.json aiMeta: "BLS AI exposure categories (Aug 2026)"
TIER_KEY = {'Very high': 'veryhigh', 'High': 'high', 'Moderate': 'moderate', 'Low': 'low'}   # same keys as data/ai_exposure.py


def norm_title(s):
    """The same normal form as app/adult/lookup.js normalise(): accents off, lower case, & as 'and', everything but a-z 0-9 + # becomes a space."""
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(ch for ch in s if not 0x300 <= ord(ch) <= 0x36f).lower().replace('&', ' and ')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9+#]+', ' ', s)).strip()


def slug(name):
    s = name.lower().replace('c++', 'cpp').replace('c#', 'csharp').replace('f#', 'fsharp').replace('.net', 'dotnet').replace('&', ' and ')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s)).strip('-')


def mmyyyy(d):
    m = re.fullmatch(r'(\d\d)/(\d{4})', d.strip())
    if not m: raise ValueError('bad O*NET date %r' % d)
    return '%s-%s' % (m.group(2), m.group(1))


def rd_tsv(path):
    with open(path, encoding='utf8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def jd(o):
    return None if o is None else json.dumps(o, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def need_weight(im, lv):
    """SPEC 5.2: (IM-1)/4 * (LV/7), clipped to 0..1."""
    return round(min(1.0, max(0.0, (im - 1) / 4 * (lv / 7))), 4)


def cosine(a, b, na, nb):
    return 0.0 if not na or not nb else sum(map(float.__mul__, a, b)) / (na * nb)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'graph.sqlite')); ap.add_argument('--report', default=os.path.join(HERE, 'build_report.json'))
    ap.add_argument('--data', default=os.path.join(ROOT, 'data'), help='the data folder that holds ai/ and content.json')
    a = ap.parse_args()
    raw = os.path.join(HERE, 'raw', 'onet', ONET_VERSION); ai_dir = os.path.join(a.data, 'ai')
    REL = ONET_RELEASE    # nodes without their own date carry the database release month
    report = {'onet_version': ONET_VERSION, 'onet_release': ONET_RELEASE, 'left_out': {}}

    # ---- occupations and ratings
    occ_rows = {r['O*NET-SOC Code']: r for r in rd_tsv(os.path.join(raw, 'Occupation Data.txt'))}
    # (file, node kind) ; skill_kind for the skills_index and slice
    rating_files = [('Essential Skills.txt', 'skill'), ('Transferable Skills.txt', 'skill'), ('Knowledge.txt', 'knowledge'), ('Work Activities.txt', 'activity')]
    elem_name, elem_kind = {}, {}
    needs = collections.defaultdict(dict)          # occ -> element id -> (w, date)
    suppressed = 0; dropped_pairs = 0
    for fn, kind in rating_files:
        pair = collections.defaultdict(dict)
        for r in rd_tsv(os.path.join(raw, fn)):
            pair[(r['O*NET-SOC Code'], r['Element ID'])][r['Scale ID']] = r
            elem_name[r['Element ID']] = r['Element Name']; elem_kind[r['Element ID']] = kind
        for (o, e), sc in sorted(pair.items()):
            if 'IM' not in sc or 'LV' not in sc: dropped_pairs += 1; continue
            low = sc['IM']['Recommend Suppress'] == 'Y' or sc['LV']['Recommend Suppress'] == 'Y'   # O*NET flags low precision (few raters). Kept, and marked on the edge: dropping them removed Programming for software developers.
            im, lv = float(sc['IM']['Data Value']), float(sc['LV']['Data Value'])
            if im < MIN_IM: continue
            w = need_weight(im, lv)
            if w <= 0: continue
            d = min(mmyyyy(sc['IM']['Date']), mmyyyy(sc['LV']['Date']))   # the two rows share a date in 31.0; if they ever differ, keep the older (the honest age)
            needs[o][e] = (w, d, low); suppressed += low
    report['rating_pairs_flagged_low_precision_by_onet'] = suppressed
    report['left_out']['rating_pairs_missing_im_or_lv'] = dropped_pairs
    # The 83 student careers must be in the graph (SPEC 5.3). One of them (13-2051.00) has no skill ratings in O*NET 31.0:
    # it stays as an occupation with its tools and tasks, flagged attrs.no_skill_ratings, and gets no skill-vector links.
    content = json.load(open(os.path.join(a.data, 'content.json'), encoding='utf8'))
    aliases = {r['old_soc']: r['new_soc'] for r in csv.DictReader(open(os.path.join(HERE, 'raw', 'soc_aliases.csv'), encoding='utf8'))}
    career_socs = {aliases.get(c['soc'], c['soc']) for c in content['careers']}
    occs = sorted(o for o in occ_rows if len(needs.get(o, {})) >= MIN_NEEDS or o in career_socs)
    report['left_out']['occupations_without_enough_ratings'] = sorted(o for o in occ_rows if o not in set(occs))
    report['kept_without_skill_ratings'] = sorted(o for o in occs if len(needs.get(o, {})) < MIN_NEEDS)
    occset = set(occs)

    jz = {r['O*NET-SOC Code']: int(r['Job Zone']) for r in rd_tsv(os.path.join(raw, 'Job Zones.txt')) if r['Job Zone'].isdigit()}
    # skill -> work activities (for SPEC 5.5 labels)
    acts = collections.defaultdict(set)
    for fn, c1 in (('Essential Skills to Work Activities.txt', 'Essential Skills Element ID'), ('Transferable Skills to Work Activities.txt', 'Transferable Skills Element ID')):
        for r in rd_tsv(os.path.join(raw, fn)): acts[r[c1]].add(r['Work Activities Element ID'])

    nodes, edges, signals = {}, {}, {}
    def add_node(i, kind, label, alt, attrs, source, trust, as_of):
        assert i not in nodes, i
        nodes[i] = (i, kind, label, jd(alt), jd(attrs), source, trust, as_of)
    def add_edge(s, d, kind, w, attrs, source, trust, as_of):
        k = (s, d, kind)
        if k in edges: return False
        edges[k] = (s, d, kind, w, jd(attrs), source, trust, as_of); return True

    # ---- titles (alternate titles)
    titles = collections.defaultdict(set)           # norm -> {original}
    title_occ = collections.defaultdict(set)
    own_title = set()
    for o in occs:
        n = norm_title(occ_rows[o]['Title'])
        if n: titles[n].add(occ_rows[o]['Title']); title_occ[n].add(o); own_title.add((n, o))
    alts = collections.defaultdict(set)
    for r in rd_tsv(os.path.join(raw, 'Job Titles.txt')):
        o = r['O*NET-SOC Code']
        if o not in occset: continue
        n = norm_title(r['Job Title'])
        if not n: continue
        titles[n].add(r['Job Title'].strip()); title_occ[n].add(o)
        if n != norm_title(occ_rows[o]['Title']): alts[o].add(r['Job Title'].strip())

    # ---- occupation nodes
    rating_ages = {}
    for o in occs:
        alt_list = sorted(alts[o], key=lambda t: (len(t), t))[:30]
        attrs = {'description': occ_rows[o]['Description'].strip(), 'job_zone': jz.get(o), 'soc': o}
        if len(needs.get(o, {})) >= MIN_NEEDS:
            ds = sorted(d for (_, d, _l) in needs[o].values()); rating_ages[o] = {'oldest': ds[0], 'newest': ds[-1]}; attrs['ratings'] = rating_ages[o]
        else: attrs['no_skill_ratings'] = True
        add_node('occ:' + o, 'occupation', occ_rows[o]['Title'].strip(), alt_list or None, attrs, SRC_ONET, 'official', REL)

    # ---- skills, knowledge, activities: nodes and needs edges
    used_elems = sorted({e for o in occs for e in needs[o]})
    for e in used_elems:
        attrs = {'skill_kind': elem_kind[e]}
        if acts.get(e): attrs['acts'] = sorted(acts[e])
        add_node('skl:' + e, 'skill', elem_name[e], None, attrs, SRC_ONET, 'official', REL)
    for o in occs:
        for e, (w, d, low) in sorted(needs[o].items()):
            add_edge('occ:' + o, 'skl:' + e, 'needs', w, {'low_precision': True} if low else None, SRC_ONET, 'official', d)

    # ---- technology
    tec_names = collections.defaultdict(collections.Counter); tec_cat = collections.defaultdict(set); tec_hot = collections.defaultdict(set)
    for r in rd_tsv(os.path.join(raw, 'Software Skills.txt')):
        o = r['O*NET-SOC Code']
        if o not in occset: continue
        key = r['Workplace Example'].strip().lower()
        if not slug(key): continue
        tec_names[key][r['Workplace Example'].strip()] += 1; tec_cat[key].add(r['Element Name'].strip())
        if r['Hot Technology'] == 'Y': tec_hot[key].add(o)
    tec_id, taken = {}, {}
    for key in sorted(tec_names):
        s = slug(key); tid = 'tec:' + s
        if len(tid) > 76 or (tid in taken and taken[tid] != key): tid = 'tec:' + s[:60].strip('-') + '-' + hashlib.sha1(key.encode()).hexdigest()[:8]
        taken[tid] = key; tec_id[key] = tid
        label = sorted(tec_names[key].items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        add_node(tid, 'skill', label, None, {'skill_kind': 'technology', 'categories': sorted(tec_cat[key])}, SRC_ONET, 'official', REL)
    hot_pairs = collections.defaultdict(set); dem_pairs = collections.defaultdict(set)
    tec_seen = set()
    for r in rd_tsv(os.path.join(raw, 'Software Skills.txt')):
        o = r['O*NET-SOC Code']
        if o not in occset: continue
        key = r['Workplace Example'].strip().lower()
        if key not in tec_id: continue
        tec_seen.add((o, key))
        if r['Hot Technology'] == 'Y': hot_pairs[o].add(key)
        if r['In Demand'] == 'Y': dem_pairs[o].add(key)
    for o, key in sorted(tec_seen):
        hot = key in hot_pairs[o]; dem = key in dem_pairs[o]
        at = {}
        if hot: at['hot'] = True
        if dem: at['in_demand'] = True
        add_edge('occ:' + o, tec_id[key], 'needs', TEC_HOT_W if hot else TEC_W, at or None, SRC_ONET, 'official', REL)

    # ---- tasks and AI use
    pen = {}
    for r in csv.DictReader(open(os.path.join(ai_dir, 'task_pen.csv'), encoding='utf8')): pen[r['task'].strip()] = float(r['penetration'])
    ai_asof = json.load(open(os.path.join(ai_dir, 'retrieved.json')))['retrieved']
    gwa_ids = {e for e, k in elem_kind.items() if k == 'activity'}
    task_gwa = collections.defaultdict(set)
    for r in rd_tsv(os.path.join(raw, 'Tasks to DWAs.txt')):
        g = '.'.join(r['DWA Element ID'].split('.')[:5])
        if g in gwa_ids: task_gwa[r['Task ID']].add(g)
    unmatched_tasks = 0; n_pen_used = 0
    for r in rd_tsv(os.path.join(raw, 'Task Statements.txt')):
        o = r['O*NET-SOC Code']
        if o not in occset: continue
        tid = 'tsk:' + r['Task ID']; text = r['Task'].strip(); d = mmyyyy(r['Date'])
        add_node(tid, 'task', text, None, {'type': r['Task Type']}, SRC_ONET, 'official', d)
        p = pen.get(text)
        ea = {'type': r['Task Type']}
        if p is not None: ea['pen'] = p
        if task_gwa.get(r['Task ID']): ea['gwa'] = sorted(task_gwa[r['Task ID']])
        add_edge('occ:' + o, tid, 'has_task', None, ea, SRC_ONET, 'official', d)
        # AI use. The data has one penetration number per task and no automation/augmentation split: a task with use is 'used'
        # (slice contract amendment A1), one with penetration 0 is 'none'. A task missing from the AI data gets no signal ('unknown' at export).
        if p is None: unmatched_tasks += 1
        else:
            signals[(tid, 'ai_task_mode', 'latest')] = (tid, 'ai_task_mode', 'latest', 'none' if p == 0 else 'used', 'anthropic_task_penetration', 'official', ai_asof)
            n_pen_used += p > 0
    report['tasks_without_ai_data'] = unmatched_tasks; report['tasks_with_ai_use'] = n_pen_used

    # ---- titles nodes and edges
    for n in sorted(titles):
        add_node('ttl:' + n, 'title', sorted(titles[n])[0], None, None, SRC_ONET, 'official', REL)
        for o in sorted(title_occ[n]):
            add_edge('ttl:' + n, 'occ:' + o, 'is_title_of', None, {'official': True} if (n, o) in own_title else None, SRC_ONET, 'official', REL)

    # ---- vectors for cosine
    elems = used_elems
    rated = [o for o in occs if o in rating_ages]
    vec = {o: [needs[o][e][0] if e in needs[o] else 0.0 for e in elems] for o in rated}
    nrm = {o: math.sqrt(sum(x * x for x in v)) for o, v in vec.items()}

    # ---- close_to: O*NET related occupations, then skill-vector cosine
    rel_rows = collections.defaultdict(dict)
    for r in rd_tsv(os.path.join(raw, 'Related Occupations.txt')):
        s, t = r['O*NET-SOC Code'], r['Related O*NET-SOC Code']
        if s not in occset or t not in occset or s == t: continue
        w = 1.0 if r['Relatedness Tier'] == 'Primary-Short' else 0.7
        cur = rel_rows[s].get(t)
        if cur is None or w > cur[0]: rel_rows[s][t] = (w, r['Relatedness Tier'], int(r['Index']))
    cos_all = {}
    cos_hist = collections.Counter()
    for i, s in enumerate(rated):
        row = []
        for t in rated:
            if t == s: continue
            c = cosine(vec[s], vec[t], nrm[s], nrm[t]); row.append((-round(c, 6), t))
        row.sort(); cos_all[s] = row
        for c, _ in row[:CLOSE_COS_TOP]: cos_hist[round(-c * 20) / 20] += 1
    cosmap = {s: {t: -c for c, t in row} for s, row in cos_all.items()}
    n_rel = n_cos = n_both = 0
    for s in occs:
        for t, (w, tier, idx) in sorted(rel_rows[s].items()):
            attrs = {'via': ['related'], 'tier': tier, 'index': idx}
            if t in cosmap.get(s, {}): attrs['cos'] = round(cosmap[s][t], 4)
            add_edge('occ:' + s, 'occ:' + t, 'close_to', w, attrs, SRC_ONET, 'official', REL); n_rel += 1
        for c, t in cos_all.get(s, [])[:CLOSE_COS_TOP]:
            c = -c
            if c < CLOSE_COS_MIN: break
            k = ('occ:' + s, 'occ:' + t, 'close_to')
            if k in edges:
                n_both += 1
                e = list(edges[k]); at = json.loads(e[4]); at['via'] = ['related', 'cosine']; e[4] = jd(at); edges[k] = tuple(e)
            else:
                add_edge('occ:' + s, 'occ:' + t, 'close_to', round(c, 4), {'via': ['cosine'], 'cos': round(c, 4)}, SRC_ONET, 'estimate', REL); n_cos += 1
    report['close_to'] = {'from_related': n_rel, 'cosine_only': n_cos, 'cosine_also_related': n_both, 'cosine_min': CLOSE_COS_MIN, 'cosine_top_per_occupation': CLOSE_COS_TOP}

    # ---- skill_near: cosine between the occupation-weight vectors of two skills (skl: only)
    sv = {e: [needs[o][e][0] if e in needs[o] else 0.0 for o in occs] for e in elems}
    sn = {e: math.sqrt(sum(x * x for x in v)) for e, v in sv.items()}
    n_near = 0
    for e in elems:
        row = sorted((-round(cosine(sv[e], sv[f], sn[e], sn[f]), 6), f) for f in elems if f != e)
        for c, f in row[:NEAR_TOP]:
            c = -c
            if c < NEAR_MIN: break
            add_edge('skl:' + e, 'skl:' + f, 'skill_near', round(c, 4), None, SRC_ONET, 'estimate', REL); n_near += 1

    # ---- clusters from content.json
    cdate = content.get('checked') or REL
    for f in sorted(content['fields'], key=lambda f: f['id']):
        add_node('fld:' + f['id'], 'cluster', f['name'], None, {'group': f.get('group')}, 'margwise_fields', 'estimate', cdate)
    in_cluster = 0; aliased = []
    for c in sorted(content['careers'], key=lambda c: c['id']):
        soc = aliases.get(c['soc'], c['soc'])
        if soc != c['soc']: aliased.append([c['soc'], soc])
        if soc in occset:
            add_edge('occ:' + soc, 'fld:' + c['field'], 'in_cluster', None, {'career': c['id']}, 'margwise_fields', 'estimate', cdate); in_cluster += 1
    report['left_out']['content_careers_not_in_graph'] = sorted(c['soc'] for c in content['careers'] if aliases.get(c['soc'], c['soc']) not in occset)
    report['soc_aliases_used'] = aliased

    # ---- AI signals per occupation (only on the plain SOC-6 code ending .00; detailed codes would inherit an "all other" group's number)
    obs = {r['occ_code']: float(r['observed_exposure']) for r in csv.DictReader(open(os.path.join(ai_dir, 'job_exposure.csv'), encoding='utf8'))}
    bls = {r['code']: r['ai'] for r in csv.DictReader(open(os.path.join(ai_dir, 'bls_ai_exposure.csv'), encoding='utf8')) if r.get('code')}
    for o in occs:
        if not o.endswith('.00'): continue
        s6 = o[:7]; nid = 'occ:' + o
        if s6 in obs: signals[(nid, 'ai_obs', 'latest')] = (nid, 'ai_obs', 'latest', repr(round(obs[s6], 3)), 'anthropic_job_exposure', 'official', ai_asof)
        if bls.get(s6) in TIER_KEY: signals[(nid, 'ai_tier', 'latest')] = (nid, 'ai_tier', 'latest', TIER_KEY[bls[s6]], 'bls_ai_exposure', 'official', BLS_AI_AS_OF)

    # ---- write
    if os.path.exists(a.out): os.remove(a.out)
    db = sqlite3.connect(a.out)
    db.executescript('''
PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
CREATE TABLE node (id TEXT PRIMARY KEY, kind TEXT NOT NULL,
  label TEXT NOT NULL, alt TEXT, attrs TEXT,
  source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL);
CREATE TABLE edge (src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL,
  weight REAL, attrs TEXT, source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL,
  PRIMARY KEY (src, dst, kind));
CREATE TABLE signal (node TEXT NOT NULL, kind TEXT NOT NULL,
  period TEXT NOT NULL, value TEXT NOT NULL, source TEXT NOT NULL, trust TEXT NOT NULL, as_of TEXT NOT NULL,
  PRIMARY KEY (node, kind, period));
''')
    db.executemany('INSERT INTO node VALUES (?,?,?,?,?,?,?,?)', [nodes[k] for k in sorted(nodes)])
    db.executemany('INSERT INTO edge VALUES (?,?,?,?,?,?,?,?)', [edges[k] for k in sorted(edges)])
    db.executemany('INSERT INTO signal VALUES (?,?,?,?,?,?,?)', [signals[k] for k in sorted(signals)])
    db.commit()

    # content hash over the sorted rows (independent of how sqlite lays out the file)
    h = hashlib.sha256()
    for t, order in (('node', 'id'), ('edge', 'src,dst,kind'), ('signal', 'node,kind,period')):
        h.update(t.encode())
        for row in db.execute('SELECT * FROM %s ORDER BY %s' % (t, order)): h.update(json.dumps(row, ensure_ascii=False, separators=(',', ':')).encode()); h.update(b'\n')
    db.close()

    def kind_of(i):
        p = i.split(':', 1)[0]
        if p == 'skl': return 'skl:' + json.loads(nodes[i][4])['skill_kind']
        return p
    nc = collections.Counter(kind_of(i) for i in nodes)
    ec = collections.Counter(k[2] for k in edges)
    sc = collections.Counter(k[1] for k in signals)
    report.update({
        'graph_hash': h.hexdigest(), 'nodes': dict(sorted(nc.items())), 'edges': dict(sorted(ec.items())), 'signals': dict(sorted(sc.items())),
        'occupations': len(occs), 'cosine_top10_histogram': {str(k): v for k, v in sorted(cos_hist.items())},
        'skill_near_edges': n_near, 'in_cluster_edges': in_cluster,
        'rating_year_counts': dict(sorted(collections.Counter(d[:4] for o in occs for (_, d, _l) in needs[o].values()).items())),
        'occupation_oldest_rating_counts': dict(sorted(collections.Counter(rating_ages[o]['oldest'][:4] for o in rated).items())),
    })
    json.dump(report, open(a.report, 'w', encoding='utf8'), indent=1, sort_keys=True, ensure_ascii=False); open(a.report, 'a').write('\n')
    print('graph ok: %d nodes, %d edges, %d signals, hash %s' % (len(nodes), len(edges), len(signals), report['graph_hash'][:12]))


if __name__ == '__main__':
    main()
