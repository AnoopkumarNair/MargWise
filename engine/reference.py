#!/usr/bin/env python3
"""Independent reference implementation of the Margwise engine, written from engine/SPEC.md.
Run `python3 engine/reference.py` to check it against engine/tests/golden.json (vectors produced by the shipped bundle)."""
import json, math, os, sys
TR = ['R', 'I', 'A', 'S', 'E', 'C']
CFG = dict(beta=1.5, keep=0.5, priorSd=1.0, draftAt=8, draftCover=4, stopZ=0.5, clearZ=0.7, broadRange=1.4, noneShare=0.5, scoreCentre=20, scoreScale=8, tieWithin=3)
M32 = 0xFFFFFFFF
def imul(a, b):
    a &= M32; b &= M32; r = (a * b) & M32
    return r
def vec(loads): return [float(loads.get(t, 0)) for t in TR]
def solve(A, b):
    n = len(b); m = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        if abs(m[p][c]) < 1e-12: raise ValueError('singular')
        m[c], m[p] = m[p], m[c]; d = m[c][c]; m[c] = [x / d for x in m[c]]
        for r in range(n):
            if r != c and m[r][c] != 0:
                f = m[r][c]; m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] for i in range(n)]
def inverse(A):
    n = len(A); cols = [solve(A, [1.0 if i == j else 0.0 for i in range(n)]) for j in range(n)]
    return [[cols[j][i] for j in range(n)] for i in range(n)]
def probs(scene, theta):
    u = [CFG['beta'] * sum(l * t for l, t in zip(vec(o['loads']), theta)) for o in scene['options']] + [CFG['keep']]
    m = max(u); e = [math.exp(x - m) for x in u]; s = sum(e); return [x / s for x in e]
def info(scene, theta):
    p = probs(scene, theta); L = [vec(o['loads']) for o in scene['options']]; b2 = CFG['beta'] ** 2
    mean = [sum(p[k] * L[k][t] for k in range(len(L))) for t in range(6)]
    return [[2 * b2 * (sum(p[k] * L[k][t] * L[k][u] for k in range(len(L))) - mean[t] * mean[u]) for u in range(6)] for t in range(6)]
def played(choices): return [c for c in choices if not c.get('echoOf')]   # entries from journey-v1 "second look" repeats are ignored
def scenes_of(bank, choices):
    ix = {s['id']: s for s in bank}; out = []
    for c in played(choices):
        sc = ix[c['sceneId']]; out.append((sc, [c['spent'].get(o['id'], 0) for o in sc['options']]))
    return out
def estimate(bank, choices):
    obs = scenes_of(bank, choices); r = 1 / CFG['priorSd'] ** 2; th = [0.0] * 6
    def H(t):
        h = [[r if i == j else 0.0 for j in range(6)] for i in range(6)]
        for sc, _ in obs:
            I = info(sc, t)
            for i in range(6):
                for j in range(6): h[i][j] += I[i][j]
        return h
    for _ in range(50):
        g = [-r * x for x in th]
        for sc, n in obs:
            p = probs(sc, th)
            for k, o in enumerate(sc['options']):
                l = vec(o['loads'])
                for t in range(6): g[t] += CFG['beta'] * (n[k] - 2 * p[k]) * l[t]
        d = solve(H(th), g); th = [a + b for a, b in zip(th, d)]
        if max(abs(x) for x in d) < 1e-9: break
    return th, inverse(H(th))
def min_z(th, cov):
    order = sorted(range(6), key=lambda i: (-th[i], i)); top, rest = order[:3], order[3:]
    def z(i, j): return (th[i] - th[j]) / math.sqrt(max(cov[i][i] + cov[j][j] - 2 * cov[i][j], 1e-12))
    return min(z(i, j) for i in top for j in rest)
def code_of(scores):
    order = sorted(range(6), key=lambda i: (-scores[TR[i]], i)); top = [TR[i] for i in order[:3]]; tw = CFG['tieWithin']
    third = scores[top[2]]; pool = [t for t in TR if scores[t] >= third - tw]; alts = []
    import itertools
    for tri in itertools.permutations(pool, 3):
        if all(scores[tri[j]] - scores[tri[i]] <= tw for i in range(3) for j in range(i + 1, 3)) and all(scores[o] - scores[t] <= tw for o in TR if o not in tri for t in tri): alts.append(list(tri))
    alts.sort(key=lambda a: [(-(scores[a[k]]), TR.index(a[k])) for k in range(3)])
    # the shipped engine orders by descending score then trait order, position by position
    alts.sort(key=lambda a: tuple((-scores[a[k]], TR.index(a[k])) for k in range(3)))
    return top, alts
def journey_result(bank, choices):
    choices = played(choices); th, cov = estimate(bank, choices); mu = sum(th) / 6; prof = {t: th[i] - mu for i, t in enumerate(TR)}
    scores = {t: max(0.0, min(40.0, CFG['scoreCentre'] + CFG['scoreScale'] * prof[t])) for t in TR}
    mz = 0 if not choices else min_z(th, cov); rng = max(th) - min(th)
    none = sum(1 for c in choices if all(v == 0 for v in c['spent'].values()))
    top, alts = code_of(scores)
    return {'profile': prof, 'scores': scores, 'code': top, 'alternatives': alts, 'confidence': 'broad' if rng < CFG['broadRange'] else 'clear' if mz >= CFG['clearZ'] else 'close',
            'lowEngagement': bool(choices) and none / len(choices) >= CFG['noneShare'], 'stopsPlayed': len(choices)}
def main_types(sc): return {max(TR, key=lambda t: (sc_load(o, t), -TR.index(t))) for o in sc['options']}
def sc_load(o, t): return float(o['loads'].get(t, 0))
def cover_possible(need, pool, picks):
    """Can `picks` scenes from `pool` (sets of main types) bring every type's remaining need to 0? Exhaustive search; the bank is small."""
    if all(n <= 0 for n in need.values()): return True
    if picks <= 0 or max(need.values()) > picks: return False
    import itertools
    for combo in itertools.combinations(range(len(pool)), min(picks, len(pool))):
        left = dict(need)
        for k in combo:
            for t in pool[k]: left[t] -= 1
        if all(n <= 0 for n in left.values()): return True
    return False
def draft_at(bank): return min(CFG['draftAt'], len(bank))
def is_done(bank, choices, est=None):
    k = len(played(choices))
    if k >= len(bank): return True
    if k < draft_at(bank): return False
    th, cov = est or estimate(bank, choices); return min_z(th, cov) >= CFG['stopZ']
def step(bank, choices):
    k = len(played(choices)); draft = k >= draft_at(bank)
    if k >= len(bank): return {'done': True, 'draft': draft, 'scene': None}
    th, cov = estimate(bank, choices)
    if is_done(bank, choices, (th, cov)): return {'done': True, 'draft': draft, 'scene': None}
    seen = {c['sceneId'] for c in played(choices)}; cand = [sc for sc in bank if sc['id'] not in seen]
    left = draft_at(bank) - k
    if left > 0:   # before the draft point: keep it possible for every type to be a main card in draftCover of the first draftAt stops
        have = {t: 0 for t in TR}
        for sc in bank:
            if sc['id'] in seen:
                for t in main_types(sc): have[t] += 1
        ok = []
        for sc in cand:
            mt = main_types(sc); need = {t: CFG['draftCover'] - have[t] - (1 if t in mt else 0) for t in TR}
            if cover_possible(need, [main_types(x) for x in cand if x is not sc], left - 1): ok.append(sc)
        if ok: cand = ok
    best, bs = None, -math.inf
    for sc in cand:
        I = info(sc, th); t = sum(cov[i][j] * I[j][i] for i in range(6) for j in range(6))
        if t > bs + 1e-12: best, bs = sc['id'], t
    return {'done': False, 'draft': draft, 'scene': best}
def walk_status(bank, choices):
    k = len(played(choices)); m = len(bank); ready = k >= draft_at(bank)
    z = min_z(*estimate(bank, choices)) if ready and k > 0 else None; done = k >= m or (z is not None and z >= CFG['stopZ'])
    return {'played': k, 'draftAt': draft_at(bank), 'maxStops': m, 'draftReady': ready, 'done': done, 'sharpness': None if z is None else min(1.0, z / CFG['stopZ']), 'sharpenLeft': 0 if done else m - k}
def career_fit(profile, careers):
    def z(v):
        x = [v[t] for t in TR]; m = sum(x) / 6; sd = math.sqrt(sum((a - m) ** 2 for a in x) / 6)
        return None if sd == 0 else [(a - m) / sd for a in x]
    zp = z(profile); out = []
    for c in careers:
        zc = z(c['values']); r = None if zp is None or zc is None else max(-1.0, min(1.0, sum(a * b for a, b in zip(zp, zc)) / 6)); out.append({'careerId': c['careerId'], 'r': r})
    out.sort(key=lambda x: (-(x['r'] if x['r'] is not None else math.inf * -1), x['careerId'])); return out
def display_order(scene_id, option_ids, seed):
    h = seed & M32
    for ch in scene_id: h = (imul(h ^ ord(ch), 16777619) + 2654435769) & M32
    t = [h]
    def rnd():
        t[0] = (t[0] + 1831565813) & M32; z = t[0]
        z = imul(z ^ (z >> 15), z | 1); z ^= (z + imul(z ^ (z >> 7), z | 61)) & M32; return (((z ^ (z >> 14)) & M32)) / 4294967296
    a = list(option_ids)
    for i in range(len(a) - 1, 0, -1):
        j = int(rnd() * (i + 1)); a[i], a[j] = a[j], a[i]
    return a
def main():
    g = json.load(open(os.path.join(os.path.dirname(__file__), 'tests', 'golden.json'))); bank = g['bank']; bad = 0; n = 0
    def chk(ok, msg):
        nonlocal bad, n; n += 1
        if not ok: bad += 1; print('MISMATCH', msg)
    for ji, j in enumerate(g['journeys']):
        for k, s in enumerate(j['steps']):
            r = step(bank, j['choices'][:k]); chk(r == {x: s[x] for x in ('done', 'draft', 'scene')}, 'journey %d step %d: %s vs %s' % (ji, k, r, s))
            w = walk_status(bank, j['choices'][:k]); e = s['status']
            chk(all(w[x] == e[x] for x in w if x != 'sharpness') and ((w['sharpness'] is None) == (e['sharpness'] is None)) and (w['sharpness'] is None or abs(w['sharpness'] - e['sharpness']) < 1e-9), 'journey %d status %d: %s vs %s' % (ji, k, w, e))
        r = journey_result(bank, j['choices']); e = j['result']
        for t in TR: chk(abs(r['profile'][t] - e['profile'][t]) < 1e-6 and abs(r['scores'][t] - e['scores'][t]) < 1e-5, 'journey %d profile %s' % (ji, t))
        chk(r['code'] == e['code'], 'journey %d code %s vs %s' % (ji, r['code'], e['code'])); chk(r['alternatives'] == e['alternatives'], 'journey %d alternatives' % ji)
        for k in ('confidence', 'lowEngagement', 'stopsPlayed'): chk(r[k] == e[k], 'journey %d %s' % (ji, k))
    for ci, c in enumerate(g['careers']):
        r = career_fit(c['profile'], c['careers']); chk([x['careerId'] for x in r] == [x['careerId'] for x in c['fit']] and all((a['r'] is None and b['r'] is None) or abs(a['r'] - b['r']) < 1e-9 for a, b in zip(r, c['fit'])), 'career set %d' % ci)
    ix = {s['id']: s for s in bank}
    for d in g['display']: chk(display_order(d['scene'], [o['id'] for o in ix[d['scene']]['options']], d['seed']) == d['order'], 'display %s %s' % (d['scene'], d['seed']))
    print('reference vs shipped engine: %d checks, %d mismatches' % (n, bad)); sys.exit(1 if bad else 0)
if __name__ == '__main__': main()
