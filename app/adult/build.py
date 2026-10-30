#!/usr/bin/env python3
"""Build the adult app (slices S1, S3 and S2) into hosting/public/work/.

  python3 app/adult/build.py --dev   build from the working files in data/graph/ (or the test fixtures in app/adult/dev/fixtures/ while
                                     that folder has no slices yet); stamps the release id 'dev-unaccepted'. Never deploy this.
  python3 app/adult/build.py --dev --fixtures   as --dev, but always with the small test fixtures (what the e2e tests use)
  python3 app/adult/build.py         build from the owner-accepted release in data/releases/graph/<release>/ (BACKEND ADR-12): unpacks
                                     slices.jsonl.xz and checks every hash in that release's manifest.json

Inputs : app/adult/*.js, index.html, styles.css, screens/, intake/ (the resume reader) ; matcher/*.js ; contracts/validate_lib.js, profile.schema.json ;
         graph files: slices/*.json, skills_index.json, titles.json
Output : hosting/public/work/ (the app), hosting/public/work/graph/<release_id>/ (raw .json graph files and occupations.json), manifest.json
The app and its graph files always carry the same release id (ADR-12): the graph release id (for example onet-31-0-6148d5ec), or
'dev-unaccepted' for --dev. index.html is stamped with it, and the app checks it against manifest.json.
The graph files are written as plain .json: the web server compresses them on the way (the 60 KB slice limit is the gzipped size).
hosting/public/work/ is a build output and is git-ignored (hosting/.gitignore), like the student game's index.html; it is built before
each deploy (deviations D15). A --dev build also writes a .gitignore into work/, so it is never committed even without that rule.
Uses only the Python standard library.
"""
import argparse, glob, hashlib, json, os, re, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
APP = os.path.join(ROOT, 'app', 'adult')
OUT = os.path.join(ROOT, 'hosting', 'public', 'work')
REL = os.path.join(ROOT, 'data', 'releases')
GRAPH_DEV = os.path.join(ROOT, 'data', 'graph')
FIXTURES = os.path.join(APP, 'dev', 'fixtures')
RELEASE_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
ONET_RE = re.compile(r'^onet-([0-9]+)-([0-9]+)-[0-9a-f]+$')   # a slice's release id, such as onet-31-0-6148d5ec
sys.path.insert(0, os.path.join(ROOT, 'data', 'graph'))
import graph_release  # noqa: E402  (PACK, read_pack, slices_sha: the release pack format)


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def shab(b):
    return hashlib.sha256(b).hexdigest()


def die(msg):
    sys.exit('app/adult/build.py: ' + msg)


def pick_graph(dev, fixtures=False):
    """Returns (source_dir, source_label, release_id, is_fixture)."""
    if dev:
        if fixtures:
            print('note: --fixtures: using the hand-written TEST FIXTURES in app/adult/dev/fixtures/graph (not real data).')
            return os.path.join(FIXTURES, 'graph'), 'app/adult/dev/fixtures/graph (FIXTURE)', 'dev-unaccepted', True
        if glob.glob(os.path.join(GRAPH_DEV, 'slices', '*.json')):
            return GRAPH_DEV, 'data/graph', 'dev-unaccepted', False
        print('note: data/graph/slices/ has no slices yet. Using the hand-written TEST FIXTURES in app/adult/dev/fixtures/graph (not real data).')
        return os.path.join(FIXTURES, 'graph'), 'app/adult/dev/fixtures/graph (FIXTURE)', 'dev-unaccepted', True
    # Release: data/releases/graph/latest.json names the accepted graph release; its folder holds manifest.json, slices.jsonl.xz,
    # skills_index.json and titles.json (data/graph/graph_release.py). data/releases/manifest.json must name the same release.
    lp = os.path.join(REL, 'graph', 'latest.json')
    if not os.path.exists(lp):
        die('No accepted graph release found (expected data/releases/graph/latest.json). The owner creates it with: python3 pipeline/run.py --accept. '
            'For a local test build use: python3 app/adult/build.py --dev')
    release_id = json.load(open(lp, encoding='utf8')).get('release_id')
    if not release_id or not RELEASE_RE.match(release_id):
        die('data/releases/graph/latest.json has no valid release_id')
    gdir = os.path.join(REL, 'graph', release_id)
    gm_path = os.path.join(gdir, 'manifest.json')
    if not os.path.exists(gm_path):
        die('data/releases/graph/%s/manifest.json is missing. Re-run: python3 pipeline/run.py --accept' % release_id)
    gm = json.load(open(gm_path, encoding='utf8'))
    top = json.load(open(os.path.join(REL, 'manifest.json'), encoding='utf8')) if os.path.exists(os.path.join(REL, 'manifest.json')) else {}
    if (top.get('graph') or {}).get('release_id') != release_id or gm.get('release_id') != release_id:
        die('data/releases/manifest.json, data/releases/graph/latest.json and the release manifest do not name the same graph release. Re-accept.')
    hashes = gm.get('files') or {}
    for f in ('skills_index.json', 'titles.json', graph_release.PACK):
        p = os.path.join(gdir, f)
        if not os.path.exists(p) or not hashes.get(f) or sha(p) != hashes[f] or (top['graph'].get('files') or {}).get(f) != hashes[f]:
            die('graph file %s is missing or does not match its recorded hash. Re-accept the release.' % f)
    return gdir, 'data/releases/graph/' + release_id, release_id, False


def graph_files(gsrc, is_release):
    """{relative path: bytes} for the graph files: slices/<soc>.json, skills_index.json, titles.json. A release unpacks its slice pack and
    checks the unpacked slices against the folder hash in its manifest."""
    out = {}
    for name in ('skills_index.json', 'titles.json'):
        if os.path.exists(os.path.join(gsrc, name)):
            out[name] = open(os.path.join(gsrc, name), 'rb').read()
    if is_release:
        packed = graph_release.read_pack(os.path.join(gsrc, graph_release.PACK))
        want = json.load(open(os.path.join(gsrc, 'manifest.json'), encoding='utf8'))['files'].get('slices (folder)')
        if graph_release.slices_sha(packed) != want:
            die('the unpacked slices do not match the folder hash in data/releases/graph/<release>/manifest.json. Re-accept the release.')
        for n, b in sorted(packed.items()): out['slices/' + n] = b
    else:
        for p in sorted(glob.glob(os.path.join(gsrc, 'slices', '*.json'))):
            out['slices/' + os.path.basename(p)] = open(p, 'rb').read()
    return out


def collect_matcher(dev):
    """Returns {output relative path: source path}. matcher/*.js plus any contracts/ files they import. Dev falls back to the stub."""
    mdir = os.path.join(ROOT, 'matcher')
    files = {}
    if os.path.exists(os.path.join(mdir, 'match.js')):
        for p in sorted(glob.glob(os.path.join(mdir, '*.js'))):
            files['matcher/' + os.path.basename(p)] = p
        todo = list(files.values()); seen = set(todo)
        while todo:
            p = todo.pop()
            for imp in re.findall(r'''(?:from|import)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]''', open(p, encoding='utf8').read()):
                q = os.path.normpath(os.path.join(os.path.dirname(p), imp))
                if q in seen or not os.path.exists(q):
                    continue
                rel = os.path.relpath(q, ROOT)
                if rel.startswith('..'):
                    die('matcher imports a file outside the repository: ' + imp)
                if rel.startswith('matcher' + os.sep) or rel.startswith('contracts' + os.sep):
                    files[rel.replace(os.sep, '/')] = q; seen.add(q); todo.append(q)
                else:
                    die('matcher/ imports %s, which the app build does not know how to ship' % rel)
        return files, 'matcher/match.js'
    if not dev:
        die('matcher/match.js does not exist. A release build needs the real matcher.')
    print('note: matcher/match.js does not exist yet. Using the STAND-IN matcher in app/adult/dev/fixtures/match_stub.js (tests only).')
    return {'matcher/match.js': os.path.join(FIXTURES, 'match_stub.js')}, 'app/adult/dev/fixtures/match_stub.js (STUB)'


def collect_intake(dev):
    """Returns ({output path: source path}, label). The resume reader is app/adult/intake/*.js (tier 1, written by the intake lane). A dev build
    falls back to the stand-in reader while read.js does not exist; a release build needs the real one."""
    idir = os.path.join(APP, 'intake')
    if os.path.exists(os.path.join(idir, 'read.js')):
        return {'intake/' + os.path.basename(p): p for p in sorted(glob.glob(os.path.join(idir, '*.js')))}, 'app/adult/intake'
    if not dev:
        die('app/adult/intake/read.js does not exist. A release build needs the real resume reader.')
    print('note: app/adult/intake/read.js does not exist yet. Using the STAND-IN reader in app/adult/dev/fixtures/intake_stub/read.js (tests only).')
    return {'intake/read.js': os.path.join(FIXTURES, 'intake_stub', 'read.js')}, 'app/adult/dev/fixtures/intake_stub/read.js (STUB)'


def main():
    ap = argparse.ArgumentParser(description='Build the adult app into hosting/public/work/')
    ap.add_argument('--dev', action='store_true', help="build from the working data files (never deploy this); stamps 'dev-unaccepted'")
    ap.add_argument('--fixtures', action='store_true', help='with --dev: use the hand-written test fixtures even if data/graph/ has slices (the e2e tests do this)')
    args = ap.parse_args()
    if args.fixtures and not args.dev:
        die('--fixtures only works together with --dev. A release build never uses fixtures.')

    gsrc, glabel, release_id, is_fixture = pick_graph(args.dev, args.fixtures)
    gdata = graph_files(gsrc, not args.dev)
    gfiles = sorted(gdata)
    if not any(f.startswith('slices/') for f in gfiles) or 'titles.json' not in gfiles or 'skills_index.json' not in gfiles:
        die('graph source %s must hold slices/*.json, skills_index.json and titles.json' % glabel)
    mfiles, mlabel = collect_matcher(args.dev)
    mfiles_intake, ilabel = collect_intake(args.dev)

    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    app_files = {}

    def put(rel, src):
        dst = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        app_files[rel] = sha(dst)

    # 1. the app: everything at the top of app/adult/ that the browser needs, and screens/
    for name in ('styles.css', 'app.js', 'dom.js', 'lookup.js', 'matcher_adapter.js', 'state.js', 'data.js', 'footer.js',
                 'intake_file.js', 'intake_profile.js', 'intake_read.js', 'constraints_model.js', 'today_model.js'):
        put(name, os.path.join(APP, name))
    for p in sorted(glob.glob(os.path.join(APP, 'screens', '*.js'))):
        put('screens/' + os.path.basename(p), p)
    html = open(os.path.join(APP, 'index.html'), encoding='utf8').read()
    assert html.count('__RELEASE__') == 1, 'index.html must hold the __RELEASE__ marker exactly once'
    stamped = html.replace('__RELEASE__', release_id)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf8').write(stamped)
    app_files['index.html'] = sha(os.path.join(OUT, 'index.html'))

    # 1b. the resume reader (S3): app/adult/intake/*.js, or the stand-in reader in a dev build while the real one does not exist
    for rel, src in sorted(mfiles_intake.items()):
        put(rel, src)

    # 2. contracts the page uses (profile check) and the matcher
    for name in ('validate_lib.js', 'profile.schema.json'):
        put('contracts/' + name, os.path.join(ROOT, 'contracts', name))
    for rel, src in sorted(mfiles.items()):
        put(rel, src)

    # 3. graph files, paired with the release id by their folder name (ADR-12)
    gbase = os.path.join('graph', release_id)
    gout = {}
    occs, srcs, onet = {}, {}, set()
    for f in gfiles:
        dst = os.path.join(OUT, gbase, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'wb').write(gdata[f])
        gout[f] = shab(gdata[f])
        if not f.startswith('slices/'):
            continue
        s = json.loads(gdata[f])
        # occupations.json: every occupation named in a slice (as the start of one, or as a road target), for the title search fallback.
        # Labels only: alternative names are already in titles.json, and listing them here would add about 100 KB for nothing
        o = s['occ']; occs[o['id']] = {'id': o['id'], 'label': o['label'], 'slice': f}
        m = ONET_RE.match(s.get('release') or '')
        if m: onet.add(m.group(1) + '.' + m.group(2))
        for t in s.get('targets', []):
            to = t['occ']
            occs.setdefault(to['id'], {'id': to['id'], 'label': to['label'], 'slice': None})
        # release-wide "as of" dates for the footer before a job is chosen: each source once, with its newest date
        for so in s.get('sources', []):
            cur = srcs.get(so['id'])
            if cur is None or so['as_of'] > cur['as_of']:
                srcs[so['id']] = {k: so[k] for k in ('id', 'name', 'trust', 'as_of')}
    if len(onet) > 1: die('the slices come from more than one O*NET version: %s' % sorted(onet))
    occ_list = [occs[k] for k in sorted(occs)]
    slice_names = [f for f in gfiles if f.startswith('slices/')]
    op = os.path.join(OUT, gbase, 'occupations.json')
    json.dump(occ_list, open(op, 'w', encoding='utf8'), separators=(',', ':'), ensure_ascii=False)
    gout['occupations.json'] = sha(op)

    manifest = {
        'app': 'adult', 'slice': 'S2', 'release_id': release_id, 'dev_build': args.dev, 'fixture_data': is_fixture,
        'built_at': None,  # no clock, so a rebuild of the same inputs gives the same bytes
        'sources': [srcs[k] for k in sorted(srcs)],
        # the O*NET version the slices were built from (their release id 'onet-31-0-<hash>'), so a dev build's footer can show it too
        'onet_version': (sorted(onet)[0] if len(onet) == 1 else None),
        # The browser loads this file first, so it holds one folder hash for the slices rather than 910 file hashes (about 80 KB)
        'graph': {'base': gbase.replace(os.sep, '/') + '/', 'source': glabel, 'slices': len(slice_names),
                  'files': dict({k: v for k, v in gout.items() if not k.startswith('slices/')},
                                **{'slices (folder)': graph_release.slices_sha({k[7:]: gdata[k] for k in slice_names})})},
        'matcher': {'source': mlabel, 'sha256': app_files['matcher/match.js']},
        'intake': {'source': ilabel, 'sha256': app_files['intake/read.js']},
        'app_files': app_files,
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf8'), indent=1, sort_keys=True)
    if args.dev:
        open(os.path.join(OUT, '.gitignore'), 'w').write('# dev build output: never commit. A release build (no --dev) does not write this file.\n*\n')
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in app_files)
    print('built hosting/public/work/  release=%s  graph=%s  matcher=%s  intake=%s  app=%d files, %d KB' % (release_id, glabel, mlabel, ilabel, len(app_files), size // 1024))


if __name__ == '__main__':
    main()
