#!/usr/bin/env python3
"""Checks the adult id registry (BACKEND ADR-05). Plain Python, no dependencies, safe offline.

  python3 pipeline/check_registry.py

Rules:
  1. data/graph/id_registry.json only grows. Entries may be added. An existing entry may change only
     from live to tombstone (with replaced_by and/or note). No id is deleted, reused or relabelled.
  2. Every id listed in any data/releases/graph/**/manifest*.json exists in the registry.
  3. Every id in the current release is live. The current release is named in
     data/releases/graph/latest.json ({"release_id": ...}); without it, the last manifest by path.
If no graph release exists yet, rules 2 and 3 pass. If main cannot be read from git, rule 1 is skipped with a warning.
"""
import glob, json, os, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REG = 'data/graph/id_registry.json'
ID_KEYS = ('ids', 'live_ids', 'all_ids', 'current_ids')
FIXED = ('kind', 'label', 'first_release')          # never change after the id is published
STATUSES = ('live', 'tombstone')

def entries_of(reg, errs, where):
    out = {}
    if not isinstance(reg, dict) or reg.get('registry_version') != 1 or not isinstance(reg.get('entries'), list):
        errs.append('%s: must be {"registry_version":1,"entries":[...]}' % where); return out
    for e in reg['entries']:
        if not isinstance(e, dict) or not isinstance(e.get('id'), str) or not e['id']:
            errs.append('%s: entry without a string id: %r' % (where, e)); continue
        if e['id'] in out: errs.append('%s: duplicate id %s' % (where, e['id'])); continue
        if e.get('status') not in STATUSES: errs.append('%s: %s has status %r, expected live or tombstone' % (where, e['id'], e.get('status')))
        rb = e.get('replaced_by')
        if rb is not None and not (isinstance(rb, list) and all(isinstance(x, str) for x in rb)):
            errs.append('%s: %s replaced_by must be a list of ids or null' % (where, e['id']))
        out[e['id']] = e
    return out

def check_append_only(old, new):
    """old and new are parsed registries. Returns a list of problems."""
    errs = []
    o = entries_of(old, errs, 'base'); n = entries_of(new, errs, 'current')
    for i, oe in o.items():
        ne = n.get(i)
        if ne is None: errs.append('id %s was deleted (ids are never removed; tombstone it instead)' % i); continue
        for k in FIXED:
            if oe.get(k) != ne.get(k): errs.append('id %s: %s changed from %r to %r' % (i, k, oe.get(k), ne.get(k)))
        if oe.get('status') == 'tombstone':
            if ne.get('status') != 'tombstone': errs.append('id %s: a tombstone cannot become live again (ids are never reused)' % i)
            for k in ('replaced_by', 'note'):
                if oe.get(k) != ne.get(k): errs.append('id %s: tombstone field %s changed' % (i, k))
        elif ne.get('status') == 'live':
            for k in ('replaced_by', 'note'):
                if oe.get(k) != ne.get(k): errs.append('id %s: %s changed on a live entry (only live to tombstone is allowed)' % (i, k))
        elif ne.get('status') == 'tombstone' and not (ne.get('replaced_by') or ne.get('note')):
            errs.append('id %s: a new tombstone needs replaced_by or a note' % i)
        extra = set(oe) - set(ne)
        if extra: errs.append('id %s: fields removed: %s' % (i, ', '.join(sorted(extra))))
    return errs

def manifest_ids(m):
    ids = []
    for k in ID_KEYS:
        v = m.get(k) if isinstance(m, dict) else None
        if isinstance(v, list): ids += [x['id'] if isinstance(x, dict) else x for x in v if (isinstance(x, dict) and 'id' in x) or isinstance(x, str)]
    return ids

def check_releases(reg, root):
    errs = []; table = entries_of(reg, [], 'registry')
    base = os.path.join(root, 'data', 'releases', 'graph')
    paths = sorted(glob.glob(os.path.join(base, '**', 'manifest*.json'), recursive=True))
    if not paths: return errs, 0
    cur = None
    lp = os.path.join(base, 'latest.json')
    if os.path.exists(lp):
        try: cur = json.load(open(lp)).get('release_id')
        except Exception as e: errs.append('latest.json unreadable: %s' % e)
    current_path = None
    for p in paths:
        try: m = json.load(open(p))
        except Exception as e: errs.append('%s unreadable: %s' % (p, e)); continue
        rid = m.get('release_id') if isinstance(m, dict) else None
        if cur is not None and rid == cur: current_path = p
        for i in manifest_ids(m):
            if i not in table: errs.append('%s: id %s is not in the registry' % (os.path.relpath(p, root), i))
    if current_path is None and cur is None: current_path = paths[-1]
    if current_path:
        try: m = json.load(open(current_path))
        except Exception: m = {}
        for i in manifest_ids(m):
            if i in table and table[i].get('status') != 'live':
                errs.append('current release %s: id %s is %s, not live' % (os.path.relpath(current_path, root), i, table[i].get('status')))
    return errs, len(paths)

def git_show(ref, root):
    r = subprocess.run(['git', 'show', '%s:%s' % (ref, REG)], cwd=root, capture_output=True, text=True)
    return r

def base_registry(root):
    """Returns (parsed, ref) or (None, reason)."""
    tried = []
    for ref in ('main', 'origin/main'):
        try: r = git_show(ref, root)
        except OSError: return None, 'git is not available'
        if r.returncode == 0:
            try: return json.loads(r.stdout), ref
            except ValueError: return None, '%s has an unreadable registry' % ref
        tried.append(ref)
        if 'exists on disk, but not in' in r.stderr or 'does not exist in' in r.stderr:
            return 'new', ref                              # the branch exists but the file is new: first introduction
    return None, 'no main branch found (tried %s)' % ', '.join(tried)

def main(root=ROOT):
    errs = []
    path = os.path.join(root, REG)
    if not os.path.exists(path): print('FAIL %s is missing' % REG); return 1
    try: reg = json.load(open(path))
    except ValueError as e: print('FAIL %s is not valid JSON: %s' % (REG, e)); return 1
    entries_of(reg, errs, 'current')
    old, ref = base_registry(root)
    if old == 'new': print('ok   registry is new on this branch (first introduction); append-only check passes')
    elif old is None: print('WARN append-only check skipped: %s' % ref)
    else:
        errs += check_append_only(old, reg); print('ok   compared with %s:%s' % (ref, REG) if not errs else 'compared with %s:%s' % (ref, REG))
    e2, n = check_releases(reg, root); errs += e2
    print('ok   no graph release yet' if n == 0 else '%s  %d graph manifest(s) checked' % ('FAIL' if e2 else 'ok  ', n))
    for e in errs: print('FAIL ' + e)
    return 1 if errs else 0

if __name__ == '__main__': sys.exit(main())
