#!/usr/bin/env python3
"""Downloads the on-device reading model (BUILD_PLAN T4.5) into a git-ignored cache and checks every file. Standard library only.

  python3 app/adult/tools/fetch_model.py          download what is missing into app/adult/tools/model_cache/, check the SHA-256 of each file
  python3 app/adult/tools/fetch_model.py --check  check the cache only (offline); exit 1 if a file is missing or differs

The model and its exact revision are pinned in tier2_model.json (the file list, sizes and SHA-256 of each file, the licence, the source).
The files are NOT committed to git: `python3 app/adult/build.py` copies them from this cache into hosting/public/work/models/ (a build
output). If the cache is missing, the build still works and the app simply does not offer the tier 2 reading.
Nothing here sends anything about a person: it is a plain GET of public files from huggingface.co at a fixed revision.
"""
import hashlib, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, 'tier2_model.json')
CACHE = os.path.join(HERE, 'model_cache')


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()


def load_manifest():
    with open(MANIFEST, encoding='utf8') as f: return json.load(f)


def verify(m, cache=CACHE):
    """Returns (problems, missing): a list of what is wrong. Empty means every pinned file is there and matches."""
    problems = []
    for e in m['files']:
        p = os.path.join(cache, m['model_id'], *e['path'].split('/'))
        if not os.path.exists(p): problems.append('missing: ' + e['path']); continue
        if os.path.getsize(p) != e['bytes']: problems.append('%s is %d bytes, expected %d' % (e['path'], os.path.getsize(p), e['bytes']))
        elif sha(p) != e['sha256']: problems.append('%s has a different SHA-256 than the pinned one' % e['path'])
    return problems


def main():
    m = load_manifest()
    if '--check' in sys.argv:
        pr = verify(m)
        for x in pr: print('FAIL ' + x)
        if pr: return 1
        print('ok   model cache matches tier2_model.json (%d files, revision %s)' % (len(m['files']), m['revision'][:12])); return 0
    for e in m['files']:
        dst = os.path.join(CACHE, m['model_id'], *e['path'].split('/'))
        if os.path.exists(dst) and os.path.getsize(dst) == e['bytes'] and sha(dst) == e['sha256']:
            print('have ', e['path']); continue
        url = '%s/resolve/%s/%s' % (m['source'], m['revision'], e['path'])
        print('fetch', url)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        tmp = dst + '.part'
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'margwise-model-fetch/1'}), timeout=300) as r, open(tmp, 'wb') as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk: break
                f.write(chunk)
        if sha(tmp) != e['sha256'] or os.path.getsize(tmp) != e['bytes']:
            os.remove(tmp); print('FAIL %s does not match the pinned hash' % e['path']); return 1
        os.replace(tmp, dst)
    pr = verify(m)
    for x in pr: print('FAIL ' + x)
    if pr: return 1
    print('ok   %d files in %s' % (len(m['files']), os.path.relpath(CACHE, os.getcwd())))
    return 0


if __name__ == '__main__':
    sys.exit(main())
