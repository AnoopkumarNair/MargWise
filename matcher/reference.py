#!/usr/bin/env python3
"""Independent reference for the adult matcher, written from docs/adult/SPEC.md section 7 (and 5.8), not from match.js.

Run:
  python3 matcher/reference.py            check every case in matcher/tests/golden.json (exit 1 on any difference)
  python3 matcher/reference.py --jsonl    read one {"profile", "slice", "opts"} JSON object per line on stdin and
                                          write one summary per line: person level, and per road the id, reach,
                                          coverage, score and gap ids, in order

Version 1.1.0 covers what slice S1 needs: coverage, gap, reach and order, with the owner decisions of 2026-10-29: used counts
0.85 (O1), a near skill counts only if it is one of the 3 closest neighbours of the skill it credits and at least 0.90 similar
(O2), and the default sliders are short move 3, pay 1, AI safety 1, demand 1, enjoy 0 (O4). Road kind, target level, bridges,
pay, demand and flags are stubs in both implementations (see matcher/README.md).
"""
import json, math, os, sys

VERSION = '1.1.0'
HERE = os.path.dirname(os.path.abspath(__file__))

STRENGTH_VALUE = {'strong': 1.0, 'used': 0.85, 'rusty': 0.4}
DEFAULT_PRIORITIES = {'pay': 1, 'ai_safe': 1, 'short_move': 3, 'demand': 1, 'enjoy': 0}
YEAR_BAND_START = {'0-2': 0, '2-5': 2, '5-8': 5, '8-12': 8, '12-18': 12, '18+': 18}
SLIDERS = (('pay', 'pay'), ('ai_safe', 'ai_safe'), ('short', 'short_move'), ('demand', 'demand'), ('enjoy', 'enjoy'))


def half_up(x, places):
    scale = 10 ** places
    return math.floor(x * scale + 0.5) / scale


def is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def person_level(profile):
    """SPEC 7.2: total years (lower bound of each band, added up) to a level, plus one for leading 6+ or a budget."""
    starts = [YEAR_BAND_START[r.get('years')] for r in profile.get('roles') or [] if r.get('years') in YEAR_BAND_START]
    if not starts:
        return {'level': None, 'years_total': None, 'years_level': None, 'lead_bonus': 0, 'title_override': None}
    total = sum(starts)
    if total < 2: lvl = 1
    elif total < 5: lvl = 2
    elif total < 8: lvl = 3
    elif total < 12: lvl = 4
    elif total < 18: lvl = 5
    else: lvl = 6
    lead = profile.get('lead') or {}
    bonus = 1 if lead.get('people') in ('6-20', '21+') or lead.get('budget') is True else 0
    return {'level': min(6, lvl + bonus), 'years_total': total, 'years_level': lvl, 'lead_bonus': bonus, 'title_override': None}


def skill_values(profile, now, teaches):
    """have(s) for every skill the person has, by rating or by credential (their own rating always wins)."""
    rated = {}
    for s in profile.get('skills') or []:
        base = STRENGTH_VALUE.get(s.get('strength'))
        if base is None:
            continue
        last = s.get('last')
        if s['strength'] != 'strong' and is_number(now) and is_number(last) and now - last > 3:
            base = 0.4
        rated[s['id']] = max(rated.get(s['id'], 0.0), base)
    credited = {}
    for c in profile.get('creds') or []:
        taught = (teaches or {}).get(c.get('id'))
        if not isinstance(taught, list):
            continue
        expires = c.get('expires')
        value = STRENGTH_VALUE['rusty'] if (is_number(now) and is_number(expires) and expires < now) else STRENGTH_VALUE['used']
        for sid in taught:
            if sid not in rated:
                credited[sid] = max(credited.get(sid, 0.0), value)
    merged = dict(credited)
    merged.update(rated)
    return merged


def neighbours(near, skill):
    """Every skill paired with `skill` in the near data, with the similarity (both directions, the larger, capped at 1)."""
    found = {}
    for x, row in (near or {}).items():
        if not isinstance(row, dict):
            continue
        for y, v in row.items():
            if not is_number(v) or x == y or skill not in (x, y):
                continue
            other = y if x == skill else x
            found[other] = max(found.get(other, float('-inf')), min(v, 1.0))
    return found


def allowed_near(near, skill):
    """Owner decision O2: the 3 closest neighbours of `skill` (similarity high to low, then id), and only those at 0.90 or more."""
    ranked = sorted(neighbours(near, skill).items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    return {k: v for k, v in ranked if v >= 0.9}


def cover_needs(values, needs, near):
    """SPEC 7.1 coverage and gap for one list of needs."""
    weighted = total = 0.0
    gap = []
    for need in needs:
        w = need.get('w') if is_number(need.get('w')) else 0.0
        w = max(0.0, w)
        direct = values.get(need['id'], 0.0)
        candidates = [0.5 * sim * values[k] for k, sim in allowed_near(near, need['id']).items() if k in values]
        nearby = max(candidates) if candidates else 0.0
        cover = max(direct, nearby)
        total += w
        weighted += w * cover
        if cover < 0.7:
            boost = 1.5 if need.get('ai') == 'people_do' else 1.0
            gap.append((w * boost, need['id']))
    gap.sort(key=lambda g: (-g[0], g[1]))
    return (half_up(weighted / total, 4) if total > 0 else 0), [g[1] for g in gap]


def latest_ai_obs(signals):
    found = None
    for s in signals or []:
        if s.get('kind') == 'ai_obs' and is_number(s.get('value')):
            if found is None or s['period'] > found['period']:
                found = s
    return None if found is None else min(1.0, max(0.0, found['value']))


def slice_near(slice_):
    """The slice's own skill_near pairs (slice contract amendment A1) as {a: {b: sim}}, or None."""
    block = slice_.get('near')
    if not isinstance(block, dict) or not isinstance(block.get('pairs'), list):
        return None
    near = {}
    for p in block['pairs']:
        if isinstance(p, list) and len(p) == 3 and isinstance(p[0], str) and isinstance(p[1], str) and is_number(p[2]):
            row = near.setdefault(p[0], {})
            row[p[1]] = max(p[2], row.get(p[1], -1))
    return near


def run(profile, slice_, opts):
    opts = opts or {}
    now, teaches = opts.get('now'), opts.get('teaches')
    near = opts['near'] if isinstance(opts.get('near'), dict) else slice_near(slice_)   # the caller's near data wins
    values = skill_values(profile, now, teaches)
    pri = profile.get('priorities') or DEFAULT_PRIORITIES
    weight = {}
    for comp, key in SLIDERS:
        v = pri.get(key)
        weight[comp] = v if is_number(v) and v >= 0 else 0
    if opts.get('walk') is not True:
        weight['enjoy'] = 0

    roads, used_ids = [], {slice_['occ']['id']}
    for t in slice_.get('targets') or []:
        oid = t['occ']['id']
        if oid in used_ids:
            continue
        used_ids.add(oid)
        cov, gap = cover_needs(values, t.get('needs') or [], near)
        ai = latest_ai_obs(t.get('signals'))
        raw = {'pay': 0.5, 'ai_safe': 0.5 if ai is None else half_up(1 - ai, 4), 'short': cov, 'demand': 0.5, 'enjoy': 0.5}
        reach = 'adjacent' if cov >= 0.7 else ('stretch' if cov >= 0.4 else 'leap')
        roads.append({'id': oid, 'reach': reach, 'coverage': cov, 'raw': raw, 'gap': gap, 'flags': []})

    # Min-max normalise each component over the candidate roads; a flat component keeps its own value.
    for comp, _ in SLIDERS:
        column = [r['raw'][comp] for r in roads]
        lo, hi = (min(column), max(column)) if column else (0, 0)
        for r in roads:
            r.setdefault('norm', {})[comp] = (r['raw'][comp] - lo) / (hi - lo) if hi - lo > 1e-12 else r['raw'][comp]
    wsum = sum(weight[c] for c, _ in SLIDERS)
    for r in roads:
        s = 0.0
        for c, _ in SLIDERS:
            s += weight[c] * r['norm'][c]
        r['score'] = half_up(s / wsum, 6) if wsum > 0 else 0
    roads.sort(key=lambda r: (-r['score'], -r['coverage'], r['id']))
    return {
        'version': VERSION,
        'person_level': person_level(profile)['level'],
        'roads': [{'id': r['id'], 'reach': r['reach'], 'coverage': r['coverage'], 'score': r['score'],
                   'gap': r['gap'], 'flags': r['flags']} for r in roads],
    }


def load_case_inputs(case, base):
    """Golden cases name fixture files by path (relative to matcher/tests/); opts.near and opts.teaches may too."""
    def load(v):
        if isinstance(v, str):
            with open(os.path.join(base, v), encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict):
                data.pop('_doc', None)
            return data
        return v
    opts = dict(case.get('opts') or {})
    for k in ('near', 'teaches'):
        if k in opts:
            opts[k] = load(opts[k])
    return case['profile'], load(case['slice']), opts


def check_golden():
    base = os.path.join(HERE, 'tests')
    with open(os.path.join(base, 'golden.json'), encoding='utf-8') as f:
        golden = json.load(f)
    bad = 0
    for case in golden['cases']:
        got = run(*load_case_inputs(case, base))
        exp = case['expect']
        problems = []
        if got['person_level'] != exp['person_level']:
            problems.append('person level %s, expected %s' % (got['person_level'], exp['person_level']))
        if [r['id'] for r in got['roads']] != [r['id'] for r in exp['roads']]:
            problems.append('road order %s' % [r['id'] for r in got['roads']])
        else:
            for g, e in zip(got['roads'], exp['roads']):
                if g['reach'] != e['reach'] or half_up(g['coverage'], 2) != e['coverage'] or g['flags'] != e['flags']:
                    problems.append('%s: %s %.4f %s, expected %s %.2f %s' % (g['id'], g['reach'], g['coverage'], g['flags'],
                                                                         e['reach'], e['coverage'], e['flags']))
        print(('ok   ' if not problems else 'FAIL ') + case['id'])
        for p in problems:
            print('     ' + p)
        bad += bool(problems)
    print('%d of %d golden cases agree' % (len(golden['cases']) - bad, len(golden['cases'])))
    return 1 if bad else 0


def main(argv):
    if argv[1:] == ['--jsonl']:
        for line in sys.stdin:
            if line.strip():
                item = json.loads(line)
                sys.stdout.write(json.dumps(run(item['profile'], item['slice'], item.get('opts'))) + '\n')
        return 0
    if argv[1:]:
        sys.stderr.write(__doc__)
        return 2
    return check_golden()


if __name__ == '__main__':
    sys.exit(main(sys.argv))
