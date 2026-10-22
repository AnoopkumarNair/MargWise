#!/usr/bin/env python3
"""Places the images dropped in app/art-incoming/ where the build expects them.
  ila -> app/art/bg-ila.jpg (shown on Ila's story cards)
  hero-cover -> app/art/bg-gate.jpg        intro1..4 -> app/art/bg-intro1..4.jpg   (2:3, 1024x1536 max)
  share-card -> app/art/share.jpg (1200x630, cropped to fit)
  logo-colour, logo-light, app-icon, jyo-hover, jyo-fly, jyo-sleepy -> app/art/brand/<name>.png (alpha kept, 1024 max)
Usage: pip install pillow; python3 app/tools/ingest_art.py"""
import os, re, sys
from PIL import Image
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); INC = os.path.join(A, 'art-incoming'); ART = os.path.join(A, 'art'); BR = os.path.join(ART, 'brand')
os.makedirs(BR, exist_ok=True)
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
WANT = {norm(k): k for k in ['hero-cover', 'intro1', 'intro2', 'intro3', 'intro4', 'share-card', 'logo-colour', 'logo-light', 'app-icon', 'jyo-hover', 'jyo-fly', 'jyo-sleepy', 'ila']}
done, seen = [], set()
for f in sorted(os.listdir(INC)):
    stem, ext = os.path.splitext(f)
    if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
    # tolerate names such as "hero-cover (1)" or "intro2_final"
    key = next((WANT[n] for n in WANT if norm(stem).startswith(n)), None)
    if not key: print('skipped (name not recognised):', f); continue
    if key in seen: print('skipped (second file for %s): %s' % (key, f)); continue
    seen.add(key); im = Image.open(os.path.join(INC, f))
    if key == 'hero-cover': out = os.path.join(ART, 'bg-gate.jpg'); im.convert('RGB').save(out, 'JPEG', quality=88)
    elif key == 'ila': out = os.path.join(ART, 'bg-ila.jpg'); im.convert('RGB').save(out, 'JPEG', quality=88)
    elif key.startswith('intro'): out = os.path.join(ART, 'bg-%s.jpg' % key); im.convert('RGB').save(out, 'JPEG', quality=88)
    elif key == 'share-card':
        im = im.convert('RGB'); w, h = im.size; r = 1200 / 630
        cw, ch = (int(h * r), h) if w / h > r else (w, int(w / r)); x, y = (w - cw) // 2, (h - ch) // 2
        out = os.path.join(ART, 'share.jpg'); im.crop((x, y, x + cw, y + ch)).resize((1200, 630), Image.LANCZOS).save(out, 'JPEG', quality=88)
    else:
        im = im.convert('RGBA'); im.thumbnail((1024, 1024), Image.LANCZOS); out = os.path.join(BR, key + '.png'); im.save(out, 'PNG', optimize=True)
    done.append((key, os.path.relpath(out, A)))
for k, o in done: print('%-12s -> app/%s' % (k, o))
missing = [k for k in WANT.values() if k not in seen]
print('missing:', ', '.join(missing) if missing else 'none')
