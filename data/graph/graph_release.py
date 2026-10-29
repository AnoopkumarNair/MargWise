"""The graph part of `pipeline/run.py --accept` (BUILD_PLAN T1.6). Owner only: it writes data/releases/graph/.

accept_graph(root, man) copies slices/, skills_index.json and titles.json from data/graph/ to data/releases/graph/<release_id>/,
writes that folder's manifest.json (release id, O*NET version, hashes, every id a profile can hold) and data/releases/graph/latest.json,
and puts the hashes in `man['graph']` (the caller writes data/releases/manifest.json).

It refuses to run when the exports are older than the graph, or when an id is missing from data/graph/id_registry.json
(run data/graph/registry_fill.py --release <id> --write first; pipeline/check_registry.py enforces the same rules in CI).
"""
import datetime, hashlib, json, os, shutil


def sha(b):
    return hashlib.sha256(b).hexdigest()


def tree_sha(d):
    """One hash for a folder: the sorted 'relative path:file hash' lines."""
    lines = []
    for r, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(r, f)
            with open(p, 'rb') as fh: lines.append('%s:%s' % (os.path.relpath(p, d).replace(os.sep, '/'), sha(fh.read())))
    return sha('\n'.join(sorted(lines)).encode())


def accept_graph(root, man, now=None):
    g = os.path.join(root, 'data', 'graph')
    with open(os.path.join(g, 'export_report.json'), encoding='utf8') as f: exp = json.load(f)
    with open(os.path.join(g, 'build_report.json'), encoding='utf8') as f: bld = json.load(f)
    if exp['graph_hash'] != bld['graph_hash']: raise SystemExit('the exports in data/graph/ are not from the current graph: run the pipeline again')
    rid = exp['release']
    with open(os.path.join(g, 'skills_index.json'), encoding='utf8') as f: idx = json.load(f)
    ids = sorted({'occ:' + n[:-5] for n in os.listdir(os.path.join(g, 'slices')) if n.endswith('.json')} | {e['id'] for e in idx})
    with open(os.path.join(g, 'id_registry.json'), encoding='utf8') as f: reg = {e['id']: e for e in json.load(f)['entries']}
    missing = [i for i in ids if i not in reg or reg[i].get('status') != 'live']
    if missing: raise SystemExit('%d ids are not live in data/graph/id_registry.json (for example %s). Run: python3 data/graph/registry_fill.py --release %s --write' % (len(missing), ', '.join(missing[:3]), rid))
    base = os.path.join(root, 'data', 'releases', 'graph'); dest = os.path.join(base, rid)
    if os.path.isdir(dest): shutil.rmtree(dest)
    os.makedirs(dest)
    shutil.copytree(os.path.join(g, 'slices'), os.path.join(dest, 'slices'))
    for n in ('skills_index.json', 'titles.json'): shutil.copy(os.path.join(g, n), os.path.join(dest, n))
    files = {'skills_index.json': None, 'titles.json': None}
    for n in files:
        with open(os.path.join(dest, n), 'rb') as fh: files[n] = sha(fh.read())
    files['slices (folder)'] = tree_sha(os.path.join(dest, 'slices'))
    stamp = (now or datetime.datetime.now(datetime.timezone.utc)).isoformat(timespec='seconds')
    manifest = {'release_id': rid, 'accepted_at': stamp, 'onet_version': bld['onet_version'], 'onet_release': bld['onet_release'], 'graph_hash': bld['graph_hash'], 'files': files, 'ids': ids}
    with open(os.path.join(dest, 'manifest.json'), 'w', encoding='utf8') as f: json.dump(manifest, f, indent=1); f.write('\n')
    with open(os.path.join(base, 'latest.json'), 'w', encoding='utf8') as f: json.dump({'release_id': rid}, f); f.write('\n')
    man['graph'] = {'release_id': rid, 'onet_version': bld['onet_version'], 'onet_release': bld['onet_release'], 'graph_hash': bld['graph_hash'], 'files': files}
    return rid
