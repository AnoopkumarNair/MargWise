#!/usr/bin/env python3
"""Proposes id registry entries for the ids in the current graph (BACKEND ADR-05). NOT run by the pipeline; the owner runs it at --accept.

  python3 data/graph/registry_fill.py --release <release id>                 print the proposal summary and write nothing
  python3 data/graph/registry_fill.py --release <release id> --out FILE      write the proposed full registry to FILE for review
  python3 data/graph/registry_fill.py --release <release id> --write         append the new live entries to data/graph/id_registry.json

Rules it follows (the registry only grows):
  - Which ids: occupations that have a slice, skills, knowledge, activities and technologies (kind 'skill'), and clusters. These are the ids a profile can
    store. Tasks and titles are not stored in profiles, so they are left out unless --all is given.
  - An id already in the registry is left alone, whatever the graph says.
  - A registry id that the graph no longer has is only reported ("needs a tombstone with replaced_by or a note"). The script never invents a replacement.
"""
import argparse, json, os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(HERE, 'id_registry.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--release', required=True, help='the release id that first publishes these ids (the one --accept will write)')
    ap.add_argument('--graph', default=os.path.join(HERE, 'graph.sqlite')); ap.add_argument('--out'); ap.add_argument('--write', action='store_true'); ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    with open(REG, encoding='utf8') as f: reg = json.load(f)
    have = {e['id']: e for e in reg['entries']}
    db = sqlite3.connect(a.graph)
    with_slice = {i for (i,) in db.execute("SELECT id FROM node WHERE kind='occupation' AND json_extract(attrs,'$.ratings') IS NOT NULL")}
    kinds = ['occupation', 'skill', 'cluster'] + (['task', 'title'] if a.all else [])
    new, graph_ids = [], set()
    for i, kind, label in db.execute('SELECT id, kind, label FROM node ORDER BY id'):
        if kind not in kinds or (kind == 'occupation' and i not in with_slice): continue
        graph_ids.add(i)
        if i not in have: new.append({'id': i, 'kind': kind, 'label': label, 'first_release': a.release, 'status': 'live', 'replaced_by': None, 'note': None})
    gone = sorted(i for i, e in have.items() if e.get('status') == 'live' and i not in graph_ids)
    print('registry has %d entries; the graph has %d registrable ids; %d would be added' % (len(have), len(graph_ids), len(new)))
    if gone: print('NEEDS A TOMBSTONE (live in the registry, not in the graph): %d, for example %s' % (len(gone), ', '.join(gone[:5])))
    merged = {'registry_version': reg['registry_version'], 'entries': reg['entries'] + new}
    if a.out:
        with open(a.out, 'w', encoding='utf8') as f: json.dump(merged, f, indent=1, ensure_ascii=False); f.write('\n')
        print('wrote', a.out)
    if a.write:
        if gone: sys.exit('refusing to write while live ids are missing from the graph: tombstone them first')
        with open(REG, 'w', encoding='utf8') as f: json.dump(merged, f, indent=1, ensure_ascii=False); f.write('\n')
        print('appended to', REG)


if __name__ == '__main__':
    main()
