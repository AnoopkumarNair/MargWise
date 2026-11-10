#!/usr/bin/env python3
"""Build the adult app (slices S1, S3, S2 and S4) into hosting/public/work/.

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
Accounts (S4): the page needs the public Turnstile site key. Set it when building: TURNSTILE_SITEKEY=<key> python3 app/adult/build.py ...
(the key is public; the secret stays on the server). Without it a --dev build has no human check and the server's test setting must be on;
a release build without it shows "sign-up is not open yet". The build also publishes ids.json (every id the profile may hold) and a copy of
data/graph/id_registry.json beside the graph files, because the server reads them to check and to map saved ids (deviations D32).
Tier 2 (S5, T4.5): when the pinned model is in the git-ignored cache (python3 app/adult/tools/fetch_model.py) and the graph has skill_vecs.json and
skill_vecs.bin, the build copies the model into work/models/, checks that no file is over the 25 MiB Cloudflare Pages limit, and writes the real
download size into manifest.json (`tier2`). The page shows that size before it loads anything. Without the model or the vectors the build still
works, says so, and the page does not offer tier 2.
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
sys.path.insert(0, os.path.join(APP, 'tools'))
import graph_release  # noqa: E402  (PACK, read_pack, slices_sha: the release pack format)
import fetch_model  # noqa: E402  (the pinned model: its manifest and the check of the cache)
import vec_texts  # noqa: E402  (check that skill_vecs are current)
VENDOR = os.path.join(ROOT, 'hosting', 'public', 'vendor')
FILE_LIMIT = 25 * 1024 * 1024   # Cloudflare Pages: at most 25 MiB per file
# What the page downloads when a person agrees to tier 2, besides the model files: the library, its WebAssembly runtime and the skill vectors.
TIER2_LIB = ['transformers/transformers.min.js', 'transformers/ort-wasm-simd-threaded.mjs', 'transformers/ort-wasm-simd-threaded.wasm']


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
    for name in ('skills_index.json', 'titles.json') + graph_release.VECS:
        if os.path.exists(os.path.join(gsrc, name)):
            out[name] = open(os.path.join(gsrc, name), 'rb').read()
    if is_release:   # the vectors are optional in a release; when its manifest lists them they must match
        want = json.load(open(os.path.join(gsrc, 'manifest.json'), encoding='utf8'))['files']
        for name in graph_release.VECS:
            if name in want and (name not in out or shab(out[name]) != want[name]): die('graph file %s does not match its recorded hash. Re-accept the release.' % name)
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


def tier2_setup(gdata, gsrc, release_id, is_fixture, is_release):
    """Tier 2 (T4.5). Copies the pinned model into OUT/models/ and returns the `tier2` entry of manifest.json: what the page needs to offer it
    and to show its real download size first. When anything is missing, returns {'available': False, 'reason': ...} and the page does not offer
    tier 2; the build itself still succeeds. The size is the sum of the real files the page downloads, so the screen cannot say something else."""
    why = None
    m = fetch_model.load_manifest()
    problems = []
    if is_fixture: why = 'this build uses the test fixtures, which have no skill vectors'
    elif not all(n in gdata for n in graph_release.VECS): why = 'the graph has no skill_vecs.json and skill_vecs.bin (python3 app/adult/tools/embed/embed_skills.mjs makes them)'
    else:
        vm = json.loads(gdata['skill_vecs.json'])
        # the vectors must be the ones the pinned model made, and the bin must be the file the json describes (same length is not enough)
        if vm.get('model') != m['model_id'] or vm.get('revision') != m['revision']: die('skill_vecs.json was made with %s @ %s, but the pinned model is %s @ %s. Re-run embed_skills.mjs.' % (vm.get('model'), vm.get('revision'), m['model_id'], m['revision']))
        if hashlib.sha256(gdata['skill_vecs.bin']).hexdigest() != vm.get('bin_sha256'): die('skill_vecs.bin does not match the bin_sha256 in skill_vecs.json. Do not build from altered vectors; re-run embed_skills.mjs.')
        if not is_release and vec_texts.check(gsrc): why = 'skill_vecs are stale: ' + vec_texts.check(gsrc)[0]
    if not why:
        problems = fetch_model.verify(m)
        if problems: why = 'the model is not in app/adult/tools/model_cache/ or differs from tier2_model.json (run python3 app/adult/tools/fetch_model.py): ' + problems[0]
    if not why:
        for rel in TIER2_LIB:
            if not os.path.exists(os.path.join(VENDOR, rel)): why = 'the vendored library file hosting/public/vendor/%s is missing' % rel
    if why:
        print('note: tier 2 (reading with the on-device model) is NOT in this build: ' + why)
        return {'available': False, 'reason': why}
    files = []   # what the page downloads when a person agrees, in the order it asks
    for rel in TIER2_LIB:
        files.append({'url': '/vendor/' + rel, 'bytes': os.path.getsize(os.path.join(VENDOR, rel))})
    # The model is served from a path that holds the first 12 characters of its revision, so a new revision is a new address: no cache (the browser's,
    # the library's own, or a proxy's) can ever hand back the old files for it, and hosting/public/_headers can mark /work/models/* as never changing.
    mbase = 'models/%s/' % m['revision'][:12]
    mdir = os.path.join(OUT, 'models', m['revision'][:12], m['model_id'])
    for e in m['files']:
        src = os.path.join(fetch_model.CACHE, m['model_id'], *e['path'].split('/'))
        dst = os.path.join(mdir, *e['path'].split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        if e.get('load'): files.append({'url': mbase + '%s/%s' % (m['model_id'], e['path']), 'bytes': e['bytes']})
    for n in m.get('licence_files', []): shutil.copyfile(os.path.join(APP, 'tools', n), os.path.join(mdir, n))
    for n in graph_release.VECS: files.append({'url': 'graph/%s/%s' % (release_id, n), 'bytes': len(gdata[n])})
    return {'available': True, 'model': m['model_id'], 'revision': m['revision'], 'model_path': mbase, 'licence': m['licence'], 'dtype': m['dtype'], 'pooling': m['pooling'], 'dims': m['dims'],
            'recipe': vm.get('recipe'), 'files': files, 'total_bytes': sum(f['bytes'] for f in files)}


def check_file_sizes():
    """No file the site serves may be over the Cloudflare Pages limit of 25 MiB: the built app, its models, and the vendored libraries."""
    for base in (OUT, VENDOR):
        for r, _, fs in os.walk(base):
            for f in fs:
                p = os.path.join(r, f)
                if os.path.getsize(p) > FILE_LIMIT: die('%s is %d bytes, over the 25 MiB limit of Cloudflare Pages' % (os.path.relpath(p, ROOT), os.path.getsize(p)))


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
    for name in ('styles.css', 'notice.md', 'app.js', 'dom.js', 'lookup.js', 'matcher_adapter.js', 'state.js', 'data.js', 'footer.js',
                 'intake_file.js', 'intake_embed.js', 'announce.js', 'intake_profile.js', 'intake_read.js', 'constraints_model.js', 'today_model.js'):
        put(name, os.path.join(APP, name))
    for p in sorted(glob.glob(os.path.join(APP, 'screens', '*.js'))):
        put('screens/' + os.path.basename(p), p)
    for p in sorted(glob.glob(os.path.join(APP, 'account', '*.js'))):
        put('account/' + os.path.basename(p), p)
    html = open(os.path.join(APP, 'index.html'), encoding='utf8').read()
    assert html.count('__RELEASE__') == 1, 'index.html must hold the __RELEASE__ marker exactly once'
    sitekey = os.environ.get('TURNSTILE_SITEKEY', '').strip()
    if sitekey and not re.match(r'^[A-Za-z0-9_-]{8,64}$', sitekey):
        die('TURNSTILE_SITEKEY does not look like a Turnstile site key')
    assert html.count('__TURNSTILE_SITEKEY__') == 1, 'index.html must hold the __TURNSTILE_SITEKEY__ marker exactly once'
    if not sitekey and not args.dev:
        print('WARNING: TURNSTILE_SITEKEY is not set, so this build shows "sign-up is not open yet". Set it before deploying.')
    stamped = html.replace('__RELEASE__', release_id).replace('__TURNSTILE_SITEKEY__', sitekey)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf8').write(stamped)
    app_files['index.html'] = sha(os.path.join(OUT, 'index.html'))

    # 1b. the resume reader (S3): app/adult/intake/*.js, or the stand-in reader in a dev build while the real one does not exist
    for rel, src in sorted(mfiles_intake.items()):
        put(rel, src)

    # 1c. the developer page that shows tier 1 and tier 2 side by side (T4.5): /work/tiers.html. Only in a --dev build: a release never carries it.
    if args.dev:
        for name in ('tiers.html', 'tiers.js'):
            src = open(os.path.join(APP, 'dev', name), encoding='utf8').read().replace('__RELEASE__', release_id)
            open(os.path.join(OUT, name), 'w', encoding='utf8').write(src)   # at the top of work/, so manifest.json and the modules are one folder away

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
    # ids.json: every id a saved profile may hold (skills, technologies and occupations the app offers). The server checks a save against it.
    ids = sorted({e['id'] for e in json.loads(gdata['skills_index.json'])} | {o['id'] for o in occ_list})
    ip = os.path.join(OUT, gbase, 'ids.json')
    json.dump({'release': release_id, 'ids': ids}, open(ip, 'w', encoding='utf8'), separators=(',', ':'))
    gout['ids.json'] = sha(ip)
    # id_registry.json: which retired ids map to which new ones. Real data only: the test fixtures have their own ids and no registry.
    reg = os.path.join(GRAPH_DEV, 'id_registry.json')
    if not is_fixture and os.path.exists(reg):
        rp = os.path.join(OUT, gbase, 'id_registry.json')
        shutil.copyfile(reg, rp)
        gout['id_registry.json'] = sha(rp)

    tier2 = tier2_setup(gdata, gsrc, release_id, is_fixture, not args.dev)
    manifest = {
        'app': 'adult', 'slice': 'S5', 'release_id': release_id, 'dev_build': args.dev, 'fixture_data': is_fixture,
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
        'tier2': tier2,
        'app_files': app_files,
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf8'), indent=1, sort_keys=True)
    check_file_sizes()
    if args.dev:
        open(os.path.join(OUT, '.gitignore'), 'w').write('# dev build output: never commit. A release build (no --dev) does not write this file.\n*\n')
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in app_files)
    print('built hosting/public/work/  release=%s  graph=%s  matcher=%s  intake=%s  app=%d files, %d KB' % (release_id, glabel, mlabel, ilabel, len(app_files), size // 1024))
    if tier2['available']: print('tier 2: on (model %s, download %.1f MB: library, runtime, model and vectors)' % (tier2['model'], tier2['total_bytes'] / 1e6))


if __name__ == '__main__':
    main()
