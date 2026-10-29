#!/usr/bin/env python3
"""Graph checks (SPEC 5.3, BUILD_PLAN T1.4). A failure blocks the build.

  python3 pipeline/validate_graph.py                 checks on data/graph/graph.sqlite (stage 10)
  python3 pipeline/validate_graph.py --exports       also the exported files in data/graph/ (stage 11)
  options: --graph PATH  --exports-dir DIR  --data DIR  --no-raw (skip the comparison with the raw O*NET dates)

Prints the counts by node kind and edge kind, then every failure (up to 25 per check), and exits 1 if there is any.
"""
import argparse, collections, csv, gzip, json, os, re, shutil, sqlite3, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GRAPH_DIR = os.path.join(ROOT, 'data', 'graph')
sys.path.insert(0, GRAPH_DIR)
from fetch_onet import ONET_VERSION, ONET_RELEASE  # noqa: E402
from build_graph import norm_title, mmyyyy  # noqa: E402

TRUST = {'official', 'secondary', 'estimate', 'observed'}
NODE_KINDS = {'occupation', 'skill', 'task', 'title', 'credential', 'cluster'}
EDGE_KINDS = {'needs', 'has_task', 'close_to', 'co_occurs', 'teaches', 'asked_for', 'in_cluster', 'is_title_of', 'skill_near', 'moved', 'moved_via'}
SIGNAL_KINDS = {'ai_obs', 'ai_tier', 'ai_task_mode', 'pay_band_in', 'demand_trend', 'skill_trend', 'entry_share', 'city_share', 'remote_share', 'pay_band_city'}
ID_RE = {'occupation': r'occ:\d\d-\d{4}\.\d\d', 'skill': r'(skl:[0-9A-Za-z]+(\.[0-9A-Za-z]+)*|tec:[a-z0-9]+(-[a-z0-9]+)*)', 'task': r'tsk:\d+', 'title': r'ttl:[a-z0-9+# ]+', 'cluster': r'fld:[a-z]+'}
ASOF_RE = re.compile(r'^\d{4}-\d{2}(-\d{2})?$')
SLICE_MAX_GZ = 60000        # bytes gzipped at level 6, what a browser downloads (SPEC 5.3, owner decision 2026-10-29)
GZ_LEVEL = 6
INDEX_MAX_GZ = 1500000


class Report:
    def __init__(self): self.fails = collections.OrderedDict()
    def fail(self, check, msg): self.fails.setdefault(check, []).append(msg)
    def ok(self): return not self.fails


def source_ids(path):
    with open(path, encoding='utf8') as f: return set(re.findall(r'^  - id:\s*(\S+)', f.read(), re.M))


def check_graph(db, data_dir, rep, raw=True):
    node = {r[0]: r for r in db.execute('SELECT id,kind,label,attrs,source,trust,as_of FROM node')}
    srcs = source_ids(os.path.join(data_dir, 'sources.yaml'))
    # ids and kinds
    for i, (id_, kind, label, attrs, source, trust, as_of) in node.items():
        if kind not in NODE_KINDS: rep.fail('node kinds', '%s has kind %r' % (i, kind)); continue
        if not re.fullmatch(ID_RE[kind], i): rep.fail('node id format', '%s (kind %s)' % (i, kind))
        if not label.strip(): rep.fail('node label', i + ' has an empty label')
    # provenance on nodes, edges, signals
    for tbl, cols in (('node', 'id'), ('edge', 'src,dst,kind'), ('signal', 'node,kind,period')):
        for row in db.execute('SELECT %s, source, trust, as_of FROM %s' % (cols, tbl)):
            key, (s, t, a) = row[:-3], row[-3:]
            if not s or not str(s).strip(): rep.fail('empty source', '%s %s' % (tbl, key))
            elif s not in srcs: rep.fail('source not in data/sources.yaml', '%s %s: %r' % (tbl, key, s))
            if not t or t not in TRUST: rep.fail('trust', '%s %s: %r' % (tbl, key, t))
            if not a or not ASOF_RE.match(str(a)): rep.fail('as_of', '%s %s: %r' % (tbl, key, a))
    # endpoints
    for s, d, k in db.execute('SELECT src,dst,kind FROM edge'):
        if k not in EDGE_KINDS: rep.fail('edge kinds', '%s %s %s' % (s, d, k))
        if s not in node: rep.fail('edge endpoint exists', 'src %s (%s)' % (s, k))
        if d not in node: rep.fail('edge endpoint exists', 'dst %s (%s)' % (d, k))
    for n, k, p in db.execute('SELECT node,kind,period FROM signal'):
        if n not in node: rep.fail('edge endpoint exists', 'signal node %s' % n)
        if k not in SIGNAL_KINDS: rep.fail('signal kinds', '%s %s' % (n, k))
    for s, d, k, w in db.execute("SELECT src,dst,kind,weight FROM edge WHERE kind IN ('needs','close_to','skill_near')"):
        if w is None or not 0 <= w <= 1: rep.fail('edge weight in 0..1', '%s %s %s %r' % (s, d, k, w))
    # structure of needs
    nn = collections.Counter(r[0] for r in db.execute("SELECT src FROM edge WHERE kind='needs'"))
    for i, n in node.items():
        if n[1] == 'occupation' and nn[i] < 10: rep.fail('occupation has 10 or more needs', '%s has %d' % (i, nn[i]))
    for s, d in db.execute("SELECT src,dst FROM edge WHERE kind='needs'"):
        if not (s.startswith('occ:') and d.startswith(('skl:', 'tec:'))): rep.fail('needs goes from occupation to skill or technology', '%s -> %s' % (s, d))
    # the 83 careers
    with open(os.path.join(data_dir, 'content.json'), encoding='utf8') as f: content = json.load(f)
    with open(os.path.join(GRAPH_DIR, 'raw', 'soc_aliases.csv'), encoding='utf8') as f: aliases = {r['old_soc']: r['new_soc'] for r in csv.DictReader(f)}
    inc = {(s, d) for s, d in db.execute("SELECT src,dst FROM edge WHERE kind='in_cluster'")}
    for c in content['careers']:
        soc = aliases.get(c['soc'], c['soc'])
        if 'occ:' + soc not in node: rep.fail('every student career has its SOC code as an occupation', '%s (%s)' % (c['id'], c['soc']))
        elif ('occ:' + soc, 'fld:' + c['field']) not in inc: rep.fail('every student career is in its field', '%s' % c['id'])
    n_careers = len(content['careers'])
    # needs dates are O*NET's own rating dates
    if raw:
        rawdir = os.path.join(GRAPH_DIR, 'raw', 'onet', ONET_VERSION)
        dates = {}
        for fn in ('Essential Skills.txt', 'Transferable Skills.txt', 'Knowledge.txt', 'Work Activities.txt'):
            with open(os.path.join(rawdir, fn), encoding='utf8', newline='') as f:
                for r in csv.DictReader(f, delimiter='\t'):
                    if r['Scale ID'] in ('IM', 'LV'):
                        k = (r['O*NET-SOC Code'], r['Element ID']); d = mmyyyy(r['Date']); dates[k] = min(dates.get(k, d), d)
        for s, d, ao in db.execute("SELECT src,dst,as_of FROM edge WHERE kind='needs'"):
            if d.startswith('skl:'):
                want = dates.get((s[4:], d[4:]))
                if want is None: rep.fail('needs edge has an O*NET rating date', '%s -> %s has no rating row in the raw file' % (s, d))
                elif want != ao: rep.fail('needs edge has an O*NET rating date', '%s -> %s: edge %s, O*NET %s' % (s, d, ao, want))
            elif ao != ONET_RELEASE: rep.fail('technology needs edge carries the database release date', '%s -> %s: %s' % (s, d, ao))
    # counts for the printout
    def skind(i):
        if i.startswith('skl:'): return 'skill:' + json.loads(node[i][3] or '{}').get('skill_kind', '?')
        if i.startswith('tec:'): return 'technology'
        return node[i][1]
    nc = collections.Counter(skind(i) if node[i][1] == 'skill' else node[i][1] for i in node)
    ec = collections.Counter(k for (k,) in db.execute('SELECT kind FROM edge'))
    sc = collections.Counter(k for (k,) in db.execute('SELECT kind FROM signal'))
    return nc, ec, sc, n_careers, node


def node_cmd():
    return shutil.which('node')


def check_exports(db_nodes, exp_dir, rep):
    sdir = os.path.join(exp_dir, 'slices')
    files = sorted(f for f in os.listdir(sdir) if f.endswith('.json')) if os.path.isdir(sdir) else []
    if not files: rep.fail('slices exist', 'no slices in %s' % sdir)
    ids = set(db_nodes)
    n_targets = 0
    for f in files:
        path = os.path.join(sdir, f)
        with open(path, 'rb') as fh: body = fh.read()
        gz = len(gzip.compress(body, GZ_LEVEL, mtime=0))
        if gz > SLICE_MAX_GZ: rep.fail('slice at most 60 KB gzipped', '%s is %d bytes gzipped' % (f, gz))
        s = json.loads(body)
        if s['occ']['id'] != 'occ:' + f[:-5]: rep.fail('slice file name matches its occupation', f)
        refs = [s['occ']['id']] + [n['id'] for n in s['needs']] + [t['id'] for t in s['tasks']]
        for tg in s['targets']:
            n_targets += 1
            refs.append(tg['occ']['id']); refs += [n['id'] for n in tg['needs']]
            if not tg['needs']: rep.fail('every road target carries its needs', '%s -> %s' % (f, tg['occ']['id']))
        for r in refs:
            if r not in ids: rep.fail('every id in a slice exists in the graph', '%s: %s' % (f, r))
        nb = s.get('near')
        if nb is not None:   # slice contract amendment A1
            in_needs = {n['id'] for n in s['needs']} | {n['id'] for tg in s['targets'] for n in tg['needs']}
            last = None
            for p in nb['pairs']:
                a, b, w = p
                if a not in in_needs or b not in in_needs: rep.fail('near pairs only join skills in the slice needs', '%s: %s %s' % (f, a, b))
                if not a < b or (last is not None and (a, b) <= last): rep.fail('near pairs are sorted, once each, a before b', '%s: %s %s' % (f, a, b))
                if not 0.9 <= w <= 1: rep.fail('near similarity is 0.9 to 1 (only pairs the matcher can count, owner decision O2)', '%s: %s %s %r' % (f, a, b, w))
                last = (a, b)
        have = {x['id'] for x in s['sources']}
        used = {s['occ']['src']} | {n['src'] for n in s['needs']} | {t['src'] for t in s['tasks']} | {x['src'] for x in s['signals']} | ({s['near']['src']} if s.get('near') else set())
        if used - have: rep.fail('slice sources are listed', '%s uses %s' % (f, sorted(used - have)))
    # the contracts' own validator
    nd = node_cmd()
    if nd:
        for what, schema, paths in (('slices', 'slice.schema.json', [os.path.join(sdir, f) for f in files]), ('skills_index', 'skills_index.schema.json', [os.path.join(exp_dir, 'skills_index.json')])):
            for i in range(0, len(paths), 200):
                r = subprocess.run([nd, os.path.join(ROOT, 'contracts', 'validate.js'), os.path.join(ROOT, 'contracts', schema)] + paths[i:i + 200], capture_output=True, text=True)
                if r.returncode: rep.fail('%s match contracts/%s' % (what, schema), (r.stderr or r.stdout).strip().splitlines()[0][:300] if (r.stderr or r.stdout).strip() else 'validator exit %d' % r.returncode)
    elif os.environ.get('RAW_STRICT'): rep.fail('contract validator', 'node is not installed; CI must have it')
    else: print('  note: node not found, the contract validator was skipped')
    # skills_index
    ip = os.path.join(exp_dir, 'skills_index.json')
    with open(ip, 'rb') as fh: raw = fh.read()
    gz = len(gzip.compress(raw, 9, mtime=0))
    if gz >= INDEX_MAX_GZ: rep.fail('skills_index under 1.5 MB gzipped', '%d bytes' % gz)
    idx = json.loads(raw); seen_id = set(); term = {}
    for e in idx:
        if e['id'] in seen_id: rep.fail('skills_index has no duplicate ids', e['id'])
        seen_id.add(e['id'])
        if e['id'] not in ids: rep.fail('skills_index ids exist in the graph', e['id'])
        for t in e['alt']:
            k = norm_title(t)
            if k in term and term[k] != e['id'] and t not in e.get('ambiguous', []): rep.fail('no term points at two ids unless it is marked ambiguous', '%r: %s and %s' % (t, term[k], e['id']))
            term.setdefault(k, e['id'])
    # titles
    with open(os.path.join(exp_dir, 'titles.json'), encoding='utf8') as fh: tj = json.load(fh)
    with_slice = {'occ:' + f[:-5] for f in files}
    for k, v in tj.items():
        if norm_title(k) != k: rep.fail('titles keys are normalised', repr(k))
        for o in v:
            if o not in with_slice: rep.fail('titles point at occupations that have a slice', '%r -> %s' % (k, o))
    return len(files), n_targets, gz, len(idx), len(tj)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--graph', default=os.path.join(GRAPH_DIR, 'graph.sqlite')); ap.add_argument('--data', default=os.path.join(ROOT, 'data'))
    ap.add_argument('--exports', action='store_true'); ap.add_argument('--exports-dir', default=GRAPH_DIR); ap.add_argument('--no-raw', action='store_true')
    a = ap.parse_args()
    if not os.path.exists(a.graph): print('FAIL: %s does not exist; run data/graph/build_graph.py' % a.graph); return 1
    rep = Report(); db = sqlite3.connect(a.graph)
    nc, ec, sc, n_careers, node = check_graph(db, a.data, rep, raw=not a.no_raw)
    print('nodes by kind: ' + ', '.join('%s %d' % kv for kv in sorted(nc.items())))
    print('edges by kind: ' + ', '.join('%s %d' % kv for kv in sorted(ec.items())))
    print('signals by kind: ' + ', '.join('%s %d' % kv for kv in sorted(sc.items())))
    print('student careers checked: %d; O*NET %s' % (n_careers, ONET_VERSION))
    if a.exports:
        n, t, gz, ni, nt = check_exports(node, a.exports_dir, rep)
        print('exports: %d slices (%d road targets), skills_index %d entries (%d bytes gzipped), titles %d keys' % (n, t, ni, gz, nt))
    if rep.ok(): print('graph checks passed'); return 0
    for check, msgs in rep.fails.items():
        print('FAIL %s (%d)' % (check, len(msgs)))
        for m in msgs[:25]: print('   ', m)
    return 1


if __name__ == '__main__':
    sys.exit(main())
