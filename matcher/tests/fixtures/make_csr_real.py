#!/usr/bin/env python3
"""Rewrite the real-shape golden fixtures from the exported O*NET slices. Offline.

  python3 data/graph/export.py && python3 matcher/tests/fixtures/make_csr_real.py

  slice_csr_real.json  from 43-4051.00 (Customer Service Representatives), golden case csr-real-near
  slice_acc_real.json  from 13-2011.00 (Accountants and Auditors), golden case acc-real-tools (matcher 1.1.0)

Each keeps the occupation, its 40 needs, its signals and sources as exported; the first 5 tasks; the 5 road targets named below (in
the slice's own order); and the near pairs between the skills that remain. A change to a file changes a golden output, so the
version guard then needs a MATCHER_VERSION bump (matcher/README.md).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
EXTRACTS = {
    'slice_csr_real.json': ('43-4051.00', 'csr-real-near', 'Customer Service Representatives',
                            ['occ:43-4041.00', 'occ:41-3091.00', 'occ:41-9041.00', 'occ:43-4081.00', 'occ:43-1011.00']),
    'slice_acc_real.json': ('13-2011.00', 'acc-real-tools', 'Accountants and Auditors',
                            ['occ:11-3031.01', 'occ:13-2082.00', 'occ:13-2061.00', 'occ:43-3031.00', 'occ:13-2031.00']),
}
TASKS = 5


def extract(soc, case, targets):
    src = os.path.join(ROOT, 'data', 'graph', 'slices', soc + '.json')
    s = json.load(open(src, encoding='utf8'))
    have = [t['occ']['id'] for t in s['targets']]
    missing = [t for t in targets if t not in have]
    if missing: sys.exit('targets not in the exported slice %s: %s' % (soc, missing))
    out = {'_doc': 'A real-shape slice for the golden case %s: an extract of data/graph/slices/%s.json from the O*NET 31.0 graph '
                   '(export.py, graph %s), cut to 5 road targets and 5 tasks, with the near pairs between the skills that remain. Real O*NET data '
                   '(CC BY 4.0), frozen here so the golden case does not move when the graph is rebuilt. Tool weights are as exported: capped at the '
                   'median of the other needs in each list (owner decision O3). Rewritten by make_csr_real.py.' % (case, soc, s['release'])}
    for k, v in s.items():
        if k == 'tasks': v = v[:TASKS]
        elif k == 'targets': v = [t for t in v if t['occ']['id'] in targets]
        elif k == 'near': continue
        out[k] = v
        if k == 'targets':
            ids = {n['id'] for n in out['needs']} | {n['id'] for t in out['targets'] for n in t['needs']}
            out['near'] = dict(s['near'], pairs=[p for p in s['near']['pairs'] if p[0] in ids and p[1] in ids])
    return out


def main():
    for name, (soc, case, _label, targets) in sorted(EXTRACTS.items()):
        path = os.path.join(HERE, name)
        open(path, 'w', encoding='utf8').write(json.dumps(extract(soc, case, targets), ensure_ascii=False, separators=(',', ':')) + '\n')
        print('wrote', os.path.relpath(path, ROOT))


if __name__ == '__main__':
    main()
