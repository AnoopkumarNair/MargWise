#!/usr/bin/env python3
"""Build the game from its parts.

  python3 app/build.py            writes app/dist/index.html (standalone, no tester gate) and hosting/public/index.html + art/ (hosted test build)

Inputs : app/night-of-lamps.html (the page), app/art/*.jpg, data/content.json, data/abroad.json, data/story2.json
The three data files are embedded into the page at build time, so the game needs no database and works on a slow network.
Needs Pillow (pip install pillow).
"""
import argparse, glob, hashlib, json, os, re, shutil, sys, datetime
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); A = os.path.join(ROOT, 'app'); D = os.path.join(ROOT, 'data'); H = os.path.join(ROOT, 'hosting', 'public')
ap = argparse.ArgumentParser(); ap.add_argument('--dev', action='store_true', help='build from the working data files instead of the accepted release (never deploy this)'); args = ap.parse_args()
REL = os.path.join(D, 'releases'); SRC = {'content.json': 'latest.json', 'abroad.json': 'abroad.json', 'story2.json': 'story2.json'}
release_id = 'dev-unaccepted'
if not args.dev:
    mp = os.path.join(REL, 'manifest.json')
    if not os.path.exists(mp): sys.exit('No accepted release. Run: python3 pipeline/run.py --accept  (or use --dev for a local test build)')
    man = json.load(open(mp))
    for name, f in SRC.items():
        h = hashlib.sha256(open(os.path.join(REL, f), 'rb').read()).hexdigest()
        if h != man['files'][f]: sys.exit('Release file %s does not match its recorded hash. Re-accept the release.' % f)
    release_id = man['release_id']
def j(p):
    path = os.path.join(D, p) if args.dev else os.path.join(REL, SRC[p])
    return json.dumps(json.load(open(path, encoding='utf8')), separators=(',', ':'), ensure_ascii=False)
s = open(os.path.join(A, 'night-of-lamps.html'), encoding='utf8').read()
# 1. embed data
blob = '<script>window.MW_CONTENT = ' + j('content.json') + ';window.MW_STORY = ' + j('story2.json') + ';window.MW_ABROAD = ' + j('abroad.json') + ';</script>'
i = s.index('<script>window.MW_CONTENT = '); k = s.index('</script>', i) + 9; s = s[:i] + blob + s[k:]
# 1b. engine: the versioned bundle in engine/ is the only copy
eng = open(os.path.join(ROOT, 'engine', 'margwise-engine.js'), encoding='utf8').read(); assert s.count('<script>/*ENGINE*/</script>') == 1, 'engine marker missing'
s = s.replace('<script>/*ENGINE*/</script>', '<script>' + eng + '</script>')
engine_sha = hashlib.sha256(eng.encode()).hexdigest()
# 2. art: 2:3 crop, 540x810 webp
dist = os.path.join(A, 'dist'); shutil.rmtree(dist, ignore_errors=True); os.makedirs(os.path.join(dist, 'art'))
art = {'bg': {}, 'obj': {}, 'char': {}}; total = 0
for f in sorted(glob.glob(os.path.join(A, 'art', 'bg-*.jpg'))):
    key = os.path.basename(f)[3:-4]; im = Image.open(f).convert('RGB'); w, h = im.size; cw = int(h * 2 / 3); x = (w - cw) // 2
    im = im.crop((x, 0, x + cw, h)).resize((540, 810), Image.LANCZOS); p = os.path.join(dist, 'art', 'bg-%s.webp' % key); im.save(p, 'WEBP', quality=80, method=6)
    art['bg'][key] = 'art/bg-%s.webp' % key; total += os.path.getsize(p)
new = '<script>window.LAMP_ART = ' + json.dumps(art, separators=(',', ':')) + ';</script>'
s, n = re.subn(r'<script>window\.LAMP_ART = \{[^\n]*?\};</script>', lambda m: new, s, count=1); assert n == 1, 'LAMP_ART marker not found'
body = s[s.index('<body>') + 6: s.rindex('</body>')].lstrip('\n')
head = s[:s.index('<body>')]
open(os.path.join(dist, 'index.html'), 'w', encoding='utf8').write(s)
# 3. hosted wrapper: tester gate config and noindex
SHELL = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><style>:root{color-scheme:dark}html,body{margin:0;padding:0;background:#141a3a;color:#fff3d6;font:14px -apple-system,BlinkMacSystemFont,sans-serif}[hidden]{display:none!important}</style><script>window.MW_CONFIG={api:"/api"};</script>'
doc = SHELL + body.replace('<title>', '</head><body><title>', 1) + '</body></html>'
doc = doc.replace('</head><body><title>The Night of Lamps</title>', '<title>The Night of Lamps</title></head><body>', 1)
# brand icons: favicon and home-screen icons, only when app/art/brand/app-icon.png has been supplied
icon = os.path.join(A, 'art', 'brand', 'app-icon.png')
if os.path.exists(icon):
    im = Image.open(icon).convert('RGBA'); os.makedirs(os.path.join(H, 'art'), exist_ok=True)
    for nm, px in (('icon-32.png', 32), ('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)): im.resize((px, px), Image.LANCZOS).save(os.path.join(H, 'art', nm), 'PNG', optimize=True)
    links = '<link rel="icon" type="image/png" sizes="32x32" href="/art/icon-32.png"><link rel="apple-touch-icon" href="/art/apple-touch-icon.png"><meta name="theme-color" content="#141a3a">'
    doc = doc.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex">' + links, 1)
# link preview card (WhatsApp, messaging apps): only when app/art/share.jpg has been supplied
share = os.path.join(A, 'art', 'share.jpg')
if os.path.exists(share):
    os.makedirs(os.path.join(H, 'art'), exist_ok=True); shutil.copy(share, os.path.join(H, 'art', 'share.jpg'))
    og = '<meta property="og:title" content="Margwise: The Night of Lamps"><meta property="og:description" content="A story game that helps you find the work that fits you."><meta property="og:image" content="https://margwise.byteheaven.in/art/share.jpg"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">'
    doc = doc.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex">' + og, 1)
os.makedirs(H, exist_ok=True); open(os.path.join(H, 'index.html'), 'w', encoding='utf8').write(doc)
for tgt in (dist, H):
    shutil.rmtree(os.path.join(tgt, 'vendor'), ignore_errors=True); shutil.copytree(os.path.join(A, 'vendor'), os.path.join(tgt, 'vendor'))
shutil.rmtree(os.path.join(H, 'art'), ignore_errors=True); shutil.copytree(os.path.join(dist, 'art'), os.path.join(H, 'art'))
os.makedirs(os.path.join(H, 'counsellor'), exist_ok=True)
_c = json.load(open(os.path.join(D, 'content.json') if args.dev else os.path.join(REL, 'latest.json'), encoding='utf8'))
json.dump([{'id': f['id'], 'name': f['name']} for f in _c['fields']], open(os.path.join(H, 'counsellor', 'fields.json'), 'w'), ensure_ascii=False)
json.dump({'release_id': release_id, 'built_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'page_sha256': hashlib.sha256(doc.encode()).hexdigest(), 'engine_sha256': engine_sha, 'dev_build': args.dev}, open(os.path.join(H, 'manifest.json'), 'w'), indent=1)
print('release', release_id)
print('built: %d background images (%.2f MB), standalone %d KB, hosted %d KB' % (len(art['bg']), total / 1e6, len(s) // 1000, len(doc) // 1000))
