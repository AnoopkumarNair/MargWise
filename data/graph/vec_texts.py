#!/usr/bin/env python3
"""The text that is embedded for each skill (BUILD_PLAN T4.5, tier 2 reading on the device). Standard library only. Offline.

  python3 data/graph/vec_texts.py             print the recipe, the number of texts and their hash
  python3 data/graph/vec_texts.py --json F    write {recipe, texts_sha256, texts: [{id, text}]} to F (the embed tool reads this)
  python3 data/graph/vec_texts.py --check     fail if data/graph/skill_vecs.json is stale (what pipeline/validate_graph.py checks too)

Recipe 'v1-label-onet-description': for each entry of skills_index.json that is a skill, knowledge or work activity (not a technology),
the text is "<label>: <O*NET description of that element>". The description is the `Description` column of O*NET's
`Content Model Reference.txt` (data/graph/raw/onet/<version>/), for the element id after the colon in the graph id (skl:2.B.1.d -> 2.B.1.d).
Nothing is invented: a missing description stops the build. Technology names are not embedded: the dictionary (tier 1) already finds
them by name, and embedding product names gave unrelated products for everyday sentences (docs/adult/deviations.md D44).

The vectors themselves (data/graph/skill_vecs.bin and skill_vecs.json) are made by app/adult/tools/embed/embed_skills.mjs, which needs the
model and the network once. The offline pipeline never recomputes them: it only checks that they still match these texts.
"""
import csv, hashlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RECIPE = 'v1-label-onet-description'
ONET_DIR = os.path.join(HERE, 'raw', 'onet', '31.0')   # the pinned O*NET version (fetch_onet.py ONET_VERSION)


def texts_sha(rows):
    """Hash of the ordered (id, text) pairs: one line 'id<TAB>text' each."""
    return hashlib.sha256('\n'.join('%s\t%s' % (i, t) for i, t in rows).encode('utf8')).hexdigest()


def skill_texts(graph_dir=HERE, onet_dir=ONET_DIR):
    """[(id, text)] in the order of skills_index.json, for the non-technology entries."""
    with open(os.path.join(graph_dir, 'skills_index.json'), encoding='utf8') as f: index = json.load(f)
    desc = {}
    with open(os.path.join(onet_dir, 'Content Model Reference.txt'), encoding='utf8', newline='') as f:
        for r in csv.DictReader(f, delimiter='\t'): desc[r['Element ID']] = r['Description'].strip()
    rows = []
    for e in index:
        if e['kind'] == 'technology': continue
        eid = e['id'].split(':', 1)[1]
        if not desc.get(eid): raise SystemExit('no O*NET description for %s (%s): add it before embedding' % (e['id'], e['label']))
        rows.append((e['id'], '%s: %s' % (e['label'], desc[eid])))
    return rows


def check(graph_dir=HERE):
    """Returns a list of problems with skill_vecs.json / skill_vecs.bin (empty when they are current). Never recomputes a vector."""
    jp, bp = os.path.join(graph_dir, 'skill_vecs.json'), os.path.join(graph_dir, 'skill_vecs.bin')
    if not os.path.exists(jp) and not os.path.exists(bp): return ['skill_vecs.json and skill_vecs.bin are missing: run app/adult/tools/embed/embed_skills.mjs (needs the model)']
    if not os.path.exists(jp) or not os.path.exists(bp): return ['skill_vecs.json and skill_vecs.bin must both exist']
    with open(jp, encoding='utf8') as f: meta = json.load(f)
    problems = []
    with open(os.path.join(graph_dir, 'skills_index.json'), encoding='utf8') as f: live = {e['id'] for e in json.load(f)}
    ids = meta.get('ids') or []
    dead = [i for i in ids if i not in live]
    if dead: problems.append('%d ids in skill_vecs.json are not in skills_index.json (for example %s)' % (len(dead), ', '.join(dead[:3])))
    if len(set(ids)) != len(ids): problems.append('skill_vecs.json lists an id twice')
    dims = meta.get('dims')
    if not isinstance(dims, int) or dims < 1: problems.append('skill_vecs.json has no valid dims')
    elif os.path.getsize(bp) != len(ids) * dims: problems.append('skill_vecs.bin is %d bytes but %d ids x %d dims need %d' % (os.path.getsize(bp), len(ids), dims, len(ids) * dims))
    if meta.get('recipe') != RECIPE: problems.append('skill_vecs.json was made with recipe %r, the current recipe is %r' % (meta.get('recipe'), RECIPE))
    else:
        rows = skill_texts(graph_dir)
        if [i for i, _ in rows] != ids: problems.append('the ids in skill_vecs.json are not the skill ids of skills_index.json now (re-run the embed tool)')
        if texts_sha(rows) != meta.get('texts_sha256'): problems.append('the skill texts changed since skill_vecs.bin was made (re-run the embed tool)')
    return problems


def main():
    a = sys.argv[1:]
    if '--check' in a:
        p = check()
        for x in p: print('FAIL ' + x)
        if p: return 1
        print('ok   skill_vecs are current'); return 0
    rows = skill_texts()
    if '--json' in a:
        out = a[a.index('--json') + 1]
        with open(out, 'w', encoding='utf8') as f: json.dump({'recipe': RECIPE, 'texts_sha256': texts_sha(rows), 'texts': [{'id': i, 'text': t} for i, t in rows]}, f, ensure_ascii=False)
        print('wrote', out)
    print('recipe %s: %d texts, sha256 %s' % (RECIPE, len(rows), texts_sha(rows)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
