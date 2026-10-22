#!/usr/bin/env python3
"""Margwise data pipeline: raw sources -> curated content -> validated, diffed, review-ready build.

  python3 pipeline/run.py                 offline rebuild from the committed raw snapshots (no network)
  python3 pipeline/run.py --fetch         also re-read O*NET and the AI exposure sources first (network)
  python3 pipeline/run.py --accept        after review, promote the build to data/releases/latest.json

Stages run inside data/ so each script reads and writes plain files there.
"""
import argparse, os, subprocess, sys, time, shutil, json, hashlib, datetime, platform
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); DATA = os.path.join(ROOT, 'data')
ap = argparse.ArgumentParser(); ap.add_argument('--fetch', action='store_true'); ap.add_argument('--accept', action='store_true'); a = ap.parse_args()
def run(label, args, cwd=DATA, env=None):
    t = time.time(); e = dict(os.environ); e.update(env or {})
    r = subprocess.run([sys.executable] + args, cwd=cwd, env=e, capture_output=True, text=True)
    tail = (r.stdout.strip().splitlines() or [''])[-1][:110]
    print('%-34s %s  (%.1fs)  %s' % (label, 'ok  ' if r.returncode == 0 else 'FAIL', time.time() - t, tail))
    if r.returncode: print(r.stdout[-1500:], r.stderr[-1500:]); sys.exit(1)
prev = os.path.join(DATA, 'releases', 'latest.json')
if a.fetch:
    run('1a fetch O*NET interests', ['scrape.py'], cwd=os.path.join(DATA, 'onet'))
    run('1b fetch O*NET wages', ['wages.py'], cwd=os.path.join(DATA, 'onet'))
run('2  build fields and careers', ['content.py'])
run('3  attach India pay (PLFS)', ['plfs.py'])
run('4  plan B, colleges, field refs', ['extras.py'])
run('5  attach AI exposure', ['ai_exposure.py', '--content', 'content.json', '--cache', 'ai'] + (['--refresh'] if a.fetch else []))
run('6  validate (quality gate)', [os.path.join(ROOT, 'pipeline', 'validate.py'), DATA], cwd=ROOT)
run('7  build reviewer fact checks', ['claims_json.py'], env={'CLAIMS_OUT': os.path.join(ROOT, 'hosting', 'public', 'admin', 'claims.json')})
if os.path.exists(prev):
    out = subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'diff.py'), prev, os.path.join(DATA, 'content.json')], capture_output=True, text=True).stdout
    open(os.path.join(DATA, 'releases', 'CHANGES.md'), 'w', encoding='utf8').write(out); print('8  change report                    ok    ', out.count('\n- '), 'changes -> data/releases/CHANGES.md')
else: print('8  change report                    skipped (no previous release)')
if a.accept:
    rel = os.path.join(DATA, 'releases'); os.makedirs(rel, exist_ok=True)
    files = {'content.json': 'latest.json', 'abroad.json': 'abroad.json', 'story2.json': 'story2.json'}
    man = {'accepted_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'python': platform.python_version(), 'files': {}}
    for src, dst in files.items():
        shutil.copy(os.path.join(DATA, src), os.path.join(rel, dst)); man['files'][dst] = hashlib.sha256(open(os.path.join(rel, dst), 'rb').read()).hexdigest()
    man['release_id'] = hashlib.sha256(json.dumps(man['files'], sort_keys=True).encode()).hexdigest()[:12]
    json.dump(man, open(os.path.join(rel, 'manifest.json'), 'w'), indent=1); print('accepted: release', man['release_id'], 'written to data/releases/')
print('done. Next: review data/releases/CHANGES.md and the fact-check batches, then run with --accept and rebuild the game (see docs/ARCHITECTURE.md).')
