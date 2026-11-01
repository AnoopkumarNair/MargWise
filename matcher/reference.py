#!/usr/bin/env python3
"""Independent reference for the adult matcher, written from docs/adult/SPEC.md section 7 (and 5.8), not from match.js.

Run:
  python3 matcher/reference.py            check every case in matcher/tests/golden.json (exit 1 on any difference)
  python3 matcher/reference.py --jsonl    read one {"profile", "slice", "opts"} JSON object per line on stdin and
                                          write one summary per line: person level, and per road the id, reach,
                                          coverage, score and gap ids, in order

  python3 matcher/reference.py --expect  print the expect block of every golden case as JSON (how golden.json is written: this
                                          file first, then match.js is checked against it)

Version 1.1.0 covered what slice S1 needs: coverage, gap, reach and order, with the owner decisions of 2026-10-29: used counts
0.85 (O1), a near skill counts only if it is one of the 3 closest neighbours of the skill it credits and at least 0.90 similar
(O2), and the default sliders are short move 3, pay 1, AI safety 1, demand 1, enjoy 0 (O4).
Version 1.2.0 (slice S2) adds SPEC 7.2 to 7.4: the target's typical level and the experience fit, the road kind, the pay change
from a numeric pay_band_in signal, the three constraint flags where their inputs exist, bridges from a reviewed credential
catalogue (opts.credentials), and "renew?" for expired credentials. The specialist steps for "fork" are read from matcher/ladder.json.
Demand and interest fit stay stubs (see matcher/README.md).
"""
import json, math, os, sys

VERSION = '1.2.0'
HERE = os.path.dirname(os.path.abspath(__file__))

STRENGTH_VALUE = {'strong': 1.0, 'used': 0.85, 'rusty': 0.4}
DEFAULT_PRIORITIES = {'pay': 1, 'ai_safe': 1, 'short_move': 3, 'demand': 1, 'enjoy': 0}
YEAR_BAND_START = {'0-2': 0, '2-5': 2, '5-8': 5, '8-12': 8, '12-18': 12, '18+': 18}
SLIDERS = (('pay', 'pay'), ('ai_safe', 'ai_safe'), ('short', 'short_move'), ('demand', 'demand'), ('enjoy', 'enjoy'))
JOB_ZONE_LEVELS = {1: (1, 2), 2: (1, 2), 3: (2, 3), 4: (3, 4), 5: (4, 5)}      # SPEC 7.2
LEVEL_START_YEARS = [None, 0, 2, 5, 8, 12, 18]                                  # level n starts at LEVEL_START_YEARS[n] years
STUDY_HOURS_TOP = {'0-5': 5, '5-10': 10, '10-20': 20, '20-40': 40}               # '40+' has no top, so it never raises outside_time
FLAG_ORDER = ('outside_time', 'below_pay_floor', 'needs_relocation')


def load_ladder():
    """The known specialist steps (SPEC 7.2 fork) from matcher/ladder.json, as a set of (from, to)."""
    with open(os.path.join(HERE, 'ladder.json'), encoding='utf-8') as f:
        return {(st['from'], st['to']) for st in json.load(f)['steps']}


LADDER_STEPS = load_ladder()


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
    """SPEC 7.1 coverage and gap for one list of needs. The gap is a list of (id, weight to 4 decimals), most important first."""
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
            gap.append((w * boost, need['id'], half_up(w, 4)))
    gap.sort(key=lambda g: (-g[0], g[1]))
    return (half_up(weighted / total, 4) if total > 0 else 0), [(g[1], g[2]) for g in gap]


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


def latest_signal(signals, kind, accept):
    """The signal of this kind with the largest period among those whose value passes accept(); the earlier one on a tie."""
    found = None
    for s in signals or []:
        if isinstance(s, dict) and s.get('kind') == kind and accept(s.get('value')):
            if found is None or s['period'] > found['period']:
                found = s
    return found


def pay_value(signals):
    """A numeric pay_band_in above zero, or None (a band given as text cannot be compared)."""
    s = latest_signal(signals, 'pay_band_in', lambda v: is_number(v) and v > 0)
    return None if s is None else s['value']


def soc_code(occ):
    """'13-2011' from occ.soc or from an O*NET id; None for a new role without one."""
    soc = occ.get('soc')
    if isinstance(soc, str) and len(soc) >= 7 and soc[2] == '-' and soc[:2].isdigit() and soc[3:7].isdigit():
        return soc[:7]
    oid = occ.get('id', '')
    rest = oid[4:] if oid.startswith('occ:') else ''
    if len(rest) >= 8 and rest[2] == '-' and rest[7] == '.' and rest[:2].isdigit() and rest[3:7].isdigit():
        return rest[:7]
    return None


def target_levels(occ):
    """SPEC 7.2 and 5.7: (low, high) typical levels, from typical_level when present, else from the job zone; None if neither."""
    tl = occ.get('typical_level')
    if (isinstance(tl, list) and len(tl) == 2 and all(isinstance(x, int) and not isinstance(x, bool) for x in tl)
            and 1 <= tl[0] <= tl[1] <= 6):
        return (tl[0], tl[1])
    zone = occ.get('job_zone')
    if isinstance(zone, int) and not isinstance(zone, bool) and zone in JOB_ZONE_LEVELS:
        return JOB_ZONE_LEVELS[zone]
    return None


def experience_fit(years, levels):
    if years is None or levels is None:
        return None
    low, high = levels
    if years < LEVEL_START_YEARS[low]:
        return 'below'
    if high < 6 and years >= LEVEL_START_YEARS[high + 1]:
        return 'above'
    return 'in'


def road_kind(from_occ, to_occ, plevel, levels, cov):
    """SPEC 7.2 kinds, checked in this order: reset, fork, up, diagonal, across (see matcher/README.md for the gaps in the table)."""
    a, b = soc_code(from_occ), soc_code(to_occ)
    if plevel is not None and levels is not None and plevel - levels[0] >= 2 and cov < 0.5:
        return 'reset'
    same_group = a is not None and b is not None and a[:5] == b[:5]
    a_mgmt = a is not None and a.startswith('11-')
    b_mgmt = b is not None and b.startswith('11-')
    if b_mgmt and not a_mgmt:
        return 'fork'
    if same_group and (from_occ['id'], to_occ['id']) in LADDER_STEPS:
        return 'fork'
    if plevel is None or levels is None:
        return None
    if levels[0] > plevel:
        return 'up' if same_group else 'diagonal'
    return 'across'


def read_catalogue(entries):
    """opts.credentials -> {id: (entry, [taught skill ids, once each, in order])}; the first entry wins a repeated id."""
    out = {}
    for e in entries or []:
        if not isinstance(e, dict) or not isinstance(e.get('id'), str) or e['id'] in out:
            continue
        taught = []
        for t in e.get('teaches') or []:
            sid = t if isinstance(t, str) else (t.get('id') if isinstance(t, dict) and isinstance(t.get('id'), str) else None)
            if sid is not None and sid not in taught:
                taught.append(sid)
        out[e['id']] = (e, taught)
    return out


def pick_bridges(gap, catalogue, held):
    """SPEC 7.4 greedy cover: up to 3 rounds, each taking the credential that covers the most uncovered gap weight
    (ties: smaller id). Held credentials that are still valid are skipped; held expired ones may return as 'renew'."""
    weight = dict(gap)
    order = [sid for sid, _ in gap]
    if catalogue is None:
        return None, [], order
    pool = sorted(cid for cid in catalogue if not (cid in held and not held[cid]))
    done, picked = set(), []
    for _ in range(3):
        best = None
        for cid in pool:
            if any(p[0] == cid for p in picked):
                continue
            new = [sid for sid in catalogue[cid][1] if sid in weight and sid not in done]
            gain = half_up(sum(weight[sid] for sid in new), 6)
            if gain > 0 and (best is None or gain > best[1]):
                best = (cid, gain, new)
        if best is None:
            break
        done.update(best[2])
        picked.append(best)
    detail = []
    for cid, gain, new in picked:
        e = catalogue[cid][0]
        detail.append({'id': cid, 'covers': [sid for sid in order if sid in new], 'gain': half_up(gain, 4),
                       'hours': e.get('hours') if is_number(e.get('hours')) else None,
                       'renew': cid in held and held[cid]})
    return [d['id'] for d in detail], detail, [sid for sid in order if sid not in done]


def accepted_share(signals, constraints):
    """Share of openings in places the person accepts, from a 'city:x=0.4,...' city_share and a numeric remote_share
    (PROVISIONAL encoding, see matcher/README.md). None when it cannot be judged."""
    open_to = [x for x in constraints.get('open_to') or [] if isinstance(x, str)]
    if 'open:india' in open_to:
        return None
    places = {x for x in open_to if x.startswith('city:')}
    if isinstance(constraints.get('city'), str):
        places.add(constraints['city'])
    if not places and 'open:remote' not in open_to:
        return None
    cs = latest_signal(signals, 'city_share', lambda v: isinstance(v, str) and '=' in v)
    if cs is None:
        return None
    total = 0.0
    for item in cs['value'].split(','):
        name, _, val = item.partition('=')
        try:
            x = float(val)
        except ValueError:
            continue
        if name.strip() in places and math.isfinite(x) and x > 0:
            total += x
    rs = latest_signal(signals, 'remote_share', lambda v: is_number(v) and 0 <= v <= 1)
    return total + (rs['value'] if rs is not None else 0)


def run(profile, slice_, opts):
    opts = opts or {}
    now = opts.get('now') if is_number(opts.get('now')) else None
    catalogue = read_catalogue(opts['credentials']) if isinstance(opts.get('credentials'), list) else None
    teaches = opts.get('teaches') if isinstance(opts.get('teaches'), dict) else \
        {cid: taught for cid, (_, taught) in (catalogue or {}).items()}
    near = opts['near'] if isinstance(opts.get('near'), dict) else slice_near(slice_)   # the caller's near data wins
    values = skill_values(profile, now, teaches)
    pri = profile.get('priorities') or DEFAULT_PRIORITIES
    weight = {}
    for comp, key in SLIDERS:
        v = pri.get(key)
        weight[comp] = v if is_number(v) and v >= 0 else 0
    if opts.get('walk') is not True:
        weight['enjoy'] = 0

    who = person_level(profile)
    held = {}   # cred id -> expired? (expired only when every entry for it has expired)
    for c in profile.get('creds') or []:
        exp = c.get('expires')
        expired = now is not None and is_number(exp) and exp < now
        held[c['id']] = expired and held.get(c['id'], True)
    cons = profile.get('constraints') or {}
    floor = cons.get('pay_floor_pct') if is_number(cons.get('pay_floor_pct')) else None
    top = STUDY_HOURS_TOP.get(cons.get('hours_month'))
    pay_here = pay_value(slice_.get('signals'))

    roads, used_ids = [], {slice_['occ']['id']}
    for t in slice_.get('targets') or []:
        oid = t['occ']['id']
        if oid in used_ids:
            continue
        used_ids.add(oid)
        cov, gap = cover_needs(values, t.get('needs') or [], near)
        ai = latest_ai_obs(t.get('signals'))
        pay_there = pay_value(t.get('signals'))
        change = None if pay_here is None or pay_there is None else pay_there / pay_here - 1
        pct = None if change is None else half_up(change * 100, 2)
        pay = 0.5 if change is None else half_up(min(1.0, max(0.0, 0.5 + change / 2)), 4)
        raw = {'pay': pay, 'ai_safe': 0.5 if ai is None else half_up(1 - ai, 4), 'short': cov, 'demand': 0.5, 'enjoy': 0.5}
        reach = 'adjacent' if cov >= 0.7 else ('stretch' if cov >= 0.4 else 'leap')
        levels = target_levels(t['occ'])
        bridges, detail, left = pick_bridges(gap, catalogue, held)
        flags = set()
        if detail and top is not None and sum(d['hours'] for d in detail if d['hours'] is not None) > 12 * top:
            flags.add('outside_time')
        if pct is not None and floor is not None and pct < floor:
            flags.add('below_pay_floor')
        share = accepted_share(t.get('signals'), cons)
        if share is not None and share < 0.5:
            flags.add('needs_relocation')
        roads.append({'id': oid, 'reach': reach, 'coverage': cov, 'raw': raw, 'gap': [g[0] for g in gap],
                      'kind': road_kind(slice_['occ'], t['occ'], who['level'], levels, cov),
                      'target': None if levels is None else levels[0],
                      'fit': experience_fit(who['years_total'], levels),
                      'flags': [f for f in FLAG_ORDER if f in flags],
                      'bridges': bridges, 'bridge_detail': detail, 'bridge_left': left, 'pay_change_pct': pct})

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
    keys = ('id', 'reach', 'coverage', 'score', 'gap', 'kind', 'target', 'fit', 'flags', 'bridges', 'bridge_detail',
            'bridge_left', 'pay_change_pct')
    return {
        'version': VERSION,
        'person_level': who['level'],
        'credentials': [{'id': cid, 'status': 'expired' if held[cid] else 'valid'} for cid in sorted(held)],
        'roads': [{k: r[k] for k in keys} for r in roads],
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
    for k in ('near', 'teaches', 'credentials'):
        if k in opts:
            opts[k] = load(opts[k])
    if isinstance(opts.get('credentials'), dict):   # credentials.json holds {"_doc", "credentials": [...]}
        opts['credentials'] = opts['credentials'].get('credentials')
    return case['profile'], load(case['slice']), opts


def expect_of(got):
    """The expect block of a golden case: person level, and per road in order its reach, coverage to 2 decimals, kind,
    target level, experience fit, flags and bridges."""
    return {'person_level': got['person_level'],
            'roads': [{'id': r['id'], 'reach': r['reach'], 'coverage': half_up(r['coverage'], 2), 'kind': r['kind'],
                       'target': r['target'], 'fit': r['fit'], 'flags': r['flags'], 'bridges': r['bridges']}
                      for r in got['roads']]}


def check_golden():
    base = os.path.join(HERE, 'tests')
    with open(os.path.join(base, 'golden.json'), encoding='utf-8') as f:
        golden = json.load(f)
    bad = 0
    for case in golden['cases']:
        got = expect_of(run(*load_case_inputs(case, base)))
        exp = case['expect']
        problems = []
        if got['person_level'] != exp['person_level']:
            problems.append('person level %s, expected %s' % (got['person_level'], exp['person_level']))
        if [r['id'] for r in got['roads']] != [r['id'] for r in exp['roads']]:
            problems.append('road order %s' % [r['id'] for r in got['roads']])
        else:
            for g, e in zip(got['roads'], exp['roads']):
                for k in ('reach', 'coverage', 'kind', 'target', 'fit', 'flags', 'bridges'):
                    if g[k] != e.get(k):
                        problems.append('%s %s: %s, expected %s' % (g['id'], k, g[k], e.get(k)))
        print(('ok   ' if not problems else 'FAIL ') + case['id'])
        for p in problems:
            print('     ' + p)
        bad += bool(problems)
    print('%d of %d golden cases agree' % (len(golden['cases']) - bad, len(golden['cases'])))
    return 1 if bad else 0


def print_expect():
    base = os.path.join(HERE, 'tests')
    with open(os.path.join(base, 'golden.json'), encoding='utf-8') as f:
        golden = json.load(f)
    out = {case['id']: expect_of(run(*load_case_inputs(case, base))) for case in golden['cases']}
    sys.stdout.write(json.dumps(out, indent=1) + '\n')
    return 0


def main(argv):
    if argv[1:] == ['--jsonl']:
        for line in sys.stdin:
            if line.strip():
                item = json.loads(line)
                sys.stdout.write(json.dumps(run(item['profile'], item['slice'], item.get('opts'))) + '\n')
        return 0
    if argv[1:] == ['--expect']:
        return print_expect()
    if argv[1:]:
        sys.stderr.write(__doc__)
        return 2
    return check_golden()


if __name__ == '__main__':
    sys.exit(main(sys.argv))
