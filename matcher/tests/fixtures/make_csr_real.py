#!/usr/bin/env python3
"""Rewrite slice_csr_real.json (golden case csr-real-near) from the exported O*NET slice 43-4051.00. Offline.

  python3 data/graph/export.py && python3 matcher/tests/fixtures/make_csr_real.py

Keeps the occupation, its 40 needs, its signals and sources as exported; the first 5 tasks; the 5 road targets named in TARGETS (in
the slice's own order); and the near pairs between the skills that remain. A change to the file changes the golden output, so the
version guard then needs a MATCHER_VERSION bump (matcher/README.md).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(ROOT, 'data', 'graph', 'slices', '43-4051.00.json')
OUT = os.path.join(HERE, 'slice_csr_real.json')
TARGETS = ['occ:43-4041.00', 'occ:41-3091.00', 'occ:41-9041.00', 'occ:43-4081.00', 'occ:43-1011.00']
TASKS = 5


def main():
    s = json.load(open(SRC, encoding='utf8'))
    have = [t['occ']['id'] for t in s['targets']]
    missing = [t for t in TARGETS if t not in have]
    if missing: sys.exit('targets not in the exported slice: %s' % missing)
    out = {'_doc': 'A real-shape slice for the golden case csr-real-near: an extract of data/graph/slices/43-4051.00.json from the O*NET 31.0 graph '
                   '(export.py, graph %s), cut to 5 road targets and 5 tasks, with the near pairs between the skills that remain. Real O*NET data '
                   '(CC BY 4.0), frozen here so the golden case does not move when the graph is rebuilt. Rewritten by make_csr_real.py.' % s['release']}
    for k, v in s.items():
        if k == 'tasks': v = v[:TASKS]
        elif k == 'targets': v = [t for t in v if t['occ']['id'] in TARGETS]
        elif k == 'near': continue
        out[k] = v
        if k == 'targets':
            ids = {n['id'] for n in out['needs']} | {n['id'] for t in out['targets'] for n in t['needs']}
            out['near'] = dict(s['near'], pairs=[p for p in s['near']['pairs'] if p[0] in ids and p[1] in ids])
    open(OUT, 'w', encoding='utf8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('wrote', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
