#!/usr/bin/env python3
"""Fetch the pinned O*NET database (text format) and extract only the files the career graph reads (SPEC 5.1).

  python3 data/graph/fetch_onet.py            download (if needed), extract, write SOURCE.md   (network)
  python3 data/graph/fetch_onet.py --check    only look at onetcenter.org/database.html and say if a newer version exists

The zip is kept in raw/onet/<version>/zip/ (git-ignored). The extracted files are committed.
O*NET is CC BY 4.0, published by the US Department of Labor, Employment and Training Administration.
"""
import argparse, datetime, hashlib, os, re, sys, urllib.request, zipfile

ONET_VERSION = '31.0'            # pinned: the version listed on https://www.onetcenter.org/database.html on 2026-10-29
ONET_RELEASE = '2026-08'         # "August 2026 Release" (from the zip's Read Me.txt)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'raw', 'onet', ONET_VERSION)
BASE = 'https://www.onetcenter.org/'
ZIP_NAME = 'db_%s_text.zip' % ONET_VERSION.replace('.', '_')
ZIP_URL = BASE + 'dl_files/database/' + ZIP_NAME
# SPEC 5.1 file -> the names it has had in the zip (first one found wins). O*NET 31.0 renamed three of them and split Skills in two:
#   Skills.txt            -> Essential Skills.txt + Transferable Skills.txt  (element ids 2.A.* and 2.B.*, same IM/LV scales)
#   Technology Skills.txt -> Software Skills.txt
#   Alternate Titles.txt  -> Job Titles.txt
#   Interests.txt         -> Career Interest Types.txt
WANTED = [
    ['Occupation Data.txt'], ['Knowledge.txt'], ['Work Activities.txt'], ['Task Statements.txt'], ['Related Occupations.txt'],
    ['Job Zones.txt'], ['Essential Skills.txt', 'Skills.txt'], ['Transferable Skills.txt'],
    ['Software Skills.txt', 'Technology Skills.txt'], ['Job Titles.txt', 'Alternate Titles.txt'],
    ['Career Interest Types.txt', 'Interests.txt'], ['Read Me.txt'],
    # Not in the SPEC 5.1 list, added for the skill AI labels (SPEC 5.5): they link a task to a work activity and a skill to the same work activities.
    ['Tasks to DWAs.txt'], ['Essential Skills to Work Activities.txt'], ['Transferable Skills to Work Activities.txt'],
]
LIMIT_BYTES = 40 * 1024 * 1024
UA = {'User-Agent': 'MargwiseDataPipeline/1.0 (+https://github.com/; contact: owner)'}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def listed_version():
    html = get(BASE + 'database.html').decode('utf8', 'ignore')
    return sorted(set(re.findall(r'O\*NET (\d+\.\d+) Database', html)), key=lambda v: tuple(int(x) for x in v.split('.')))[-1]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--check', action='store_true'); a = ap.parse_args()
    cur = listed_version()
    if cur != ONET_VERSION:
        print('NOTE: onetcenter.org lists O*NET %s; this pipeline is pinned to %s. Change ONET_VERSION deliberately (and the expected counts).' % (cur, ONET_VERSION))
    elif a.check:
        print('pinned version %s is the current version' % cur)
    if a.check: return 0
    zdir = os.path.join(OUT, 'zip'); os.makedirs(zdir, exist_ok=True)
    zpath = os.path.join(zdir, ZIP_NAME)
    if not os.path.exists(zpath):
        print('downloading', ZIP_URL); open(zpath, 'wb').write(get(ZIP_URL))
    zbytes = open(zpath, 'rb').read()
    z = zipfile.ZipFile(zpath); names = {os.path.basename(i.filename): i for i in z.infolist() if not i.is_dir()}
    rows = []; total = 0
    for cands in WANTED:
        name = next((c for c in cands if c in names), None)
        if name is None: sys.exit('missing in zip: ' + ' / '.join(cands))
        data = z.read(names[name]); total += len(data)
        open(os.path.join(OUT, name), 'wb').write(data)      # fixed file names only; nothing from the zip decides the path
        rows.append((name, len(data), sha(data)))
    print('extracted %d files, %.1f MB' % (len(rows), total / 1e6))
    if total > LIMIT_BYTES:
        sys.exit('extracted files are %.1f MB (over 40 MB): write filtered copies with only the needed columns before committing' % (total / 1e6))
    lines = [
        '# O*NET database %s (text format)' % ONET_VERSION, '',
        '- Source: US Department of Labor, Employment and Training Administration, O*NET Resource Center.',
        '- URL: ' + ZIP_URL,
        '- Version: O*NET %s Database, released %s (August 2026 Release, per the zip\'s Read Me.txt).' % (ONET_VERSION, ONET_RELEASE),
        '- Database page: ' + BASE + 'database.html',
        '- Retrieved: %s. The zip has SHA-256 %s.' % (datetime.date.today().isoformat(), sha(zbytes)),
        '- Licence: Creative Commons Attribution 4.0 International (https://www.onetcenter.org/license_db.html). The attribution text is in README.md and the app footer.',
        '- Pinned by `ONET_VERSION` in `data/graph/fetch_onet.py`. The zip stays in `zip/` (git-ignored).', '',
        '## What was kept',
        '',
        'Only the files the graph reads (SPEC 5.1). Total %.1f MB, under the 40 MB limit, so the files are committed **unfiltered**: every column and every row is as O*NET published it.' % (total / 1e6), '',
        '| File | Bytes | SHA-256 |', '| --- | ---: | --- |',
    ] + ['| %s | %d | %s |' % r for r in rows] + [
        '', '## Differences from the file names in SPEC 5.1', '',
        'O*NET 31.0 renamed some files. The content model is the same.', '',
        '- `Skills.txt` is now two files: `Essential Skills.txt` (element ids `2.A.*`) and `Transferable Skills.txt` (`2.B.*`). Both use the importance (IM) and level (LV) scales. The graph reads both.',
        '- `Technology Skills.txt` is now `Software Skills.txt` (columns: O*NET-SOC Code, Workplace Example, Element ID, Element Name, Hot Technology, In Demand). The old commodity code is gone; `Element Name` is the product category and `Workplace Example` is the product name.',
        '- `Alternate Titles.txt` is now `Job Titles.txt` (Job Title, Short Title, Source(s)).',
        '- `Interests.txt` is now `Career Interest Types.txt`. The graph does not use it yet; it is kept because SPEC 5.1 lists it.', '',
        '- Three files are **added to the SPEC 5.1 list**: `Tasks to DWAs.txt`, `Essential Skills to Work Activities.txt` and `Transferable Skills to Work Activities.txt`. SPEC 5.5 asks for the share of a skill\'s tasks that have AI use, and these files are the only link from tasks to skills (task, to detailed work activity, to general work activity, to skill). Together they are 1.2 MB.', '',
        '## Data age',
        '',
        'The `Date` column (MM/YYYY) on each rating row is when O*NET collected that rating. The graph stores it as the edge date. The release date above is when the file was published, which is a different thing.', '',
        '## Not fetched this round',
        '',
        'SOC to ISCO and NCO to ISCO crosswalks (T1.2): see `../../crosswalk/README.md`.', '',
    ]
    open(os.path.join(OUT, 'SOURCE.md'), 'w', encoding='utf8').write('\n'.join(lines))
    print('wrote', os.path.join(OUT, 'SOURCE.md'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
