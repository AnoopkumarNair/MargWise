"""Small pure functions: title normal form (same as the browser), ids, weights, AI labels, coverage, freshness."""
import datetime, json, os, shutil, subprocess, unittest
from common import ROOT
from build_graph import norm_title, slug, mmyyyy, need_weight, cosine
import collections
from export import ai_share_label, ai_labels, coverage, need_rows, tec_scores, cap_tool_weights, countable_pairs
import random
import freshness


class Normalise(unittest.TestCase):
    CASES = ['Software Engineer', 'Sr. QA  Engineer (L2)', 'C++ Developer', 'C# / .NET Dev', 'F&A Executive', 'Café Manager', "Nurse's Aide", '  Project   Manager ', 'AVP - Credit Risk', 'Dev-Ops', '']

    def test_rules(self):
        self.assertEqual(norm_title('Software Engineer'), 'software engineer')
        self.assertEqual(norm_title('Sr. QA  Engineer (L2)'), 'sr qa engineer l2')
        self.assertEqual(norm_title('C++ Developer'), 'c++ developer')
        self.assertEqual(norm_title('F&A Executive'), 'f and a executive')
        self.assertEqual(norm_title('Café Manager'), 'cafe manager')
        self.assertEqual(norm_title(''), '')

    @unittest.skipUnless(shutil.which('node'), 'node not installed')
    def test_same_as_the_browser(self):
        js = "import('%s').then(m => console.log(JSON.stringify(%s.map(m.normalise))))" % ('file://' + os.path.join(ROOT, 'app', 'adult', 'lookup.js'), json.dumps(self.CASES))
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True)
        if r.returncode: self.skipTest('lookup.js could not be loaded: ' + r.stderr[:200])
        self.assertEqual(json.loads(r.stdout), [norm_title(c) for c in self.CASES])


class Ids(unittest.TestCase):
    def test_slug(self):
        self.assertEqual(slug('Microsoft Excel'), 'microsoft-excel')
        self.assertEqual(slug('C++'), 'cpp')
        self.assertEqual(slug('C#'), 'csharp')
        self.assertEqual(slug('Node.js'), 'node-js')
        self.assertEqual(slug('ADO.NET'), 'adodotnet')

    def test_date(self):
        self.assertEqual(mmyyyy('08/2023'), '2023-08')
        with self.assertRaises(ValueError): mmyyyy('2023-08')


class Weights(unittest.TestCase):
    def test_formula(self):
        self.assertEqual(need_weight(4.78, 6.50), 0.8775)
        self.assertEqual(need_weight(1.0, 7.0), 0.0)
        self.assertEqual(need_weight(5.0, 7.0), 1.0)
        self.assertEqual(need_weight(5.0, 9.0), 1.0)      # clipped
        self.assertEqual(need_weight(0.0, 3.0), 0.0)      # clipped

    def test_cosine(self):
        self.assertAlmostEqual(cosine([1.0, 0.0], [1.0, 0.0], 1.0, 1.0), 1.0)
        self.assertAlmostEqual(cosine([1.0, 0.0], [0.0, 1.0], 1.0, 1.0), 0.0)
        self.assertEqual(cosine([0.0], [1.0], 0.0, 1.0), 0.0)


class AiLabels(unittest.TestCase):
    def test_thresholds(self):
        self.assertEqual(ai_share_label([0.9, 0.0]), 'unknown')                 # fewer than 3 tasks
        self.assertEqual(ai_share_label([0.9, 0.9, 0.0, 0.0]), 'ai_does_much')   # share 0.5
        self.assertEqual(ai_share_label([0.9, 0.0, 0.0, 0.0]), 'mixed')          # 0.25
        self.assertEqual(ai_share_label([0.9] + [0.0] * 6), 'people_do')         # 1/7 = 0.143, 0.15 or less
        self.assertEqual(ai_share_label([0.0, 0.0, 0.0]), 'people_do')
        self.assertEqual(ai_share_label([0.9] * 3), 'ai_does_much')

    def test_boundary_015(self):
        self.assertEqual(ai_share_label([0.9] * 3 + [0.0] * 17), 'people_do')      # exactly 0.15
        self.assertEqual(ai_share_label([0.9] * 4 + [0.0] * 16), 'mixed')

    def test_tasks_without_ai_data_are_left_out(self):
        # None = the task has no AI data. It is unknown, not 'no use' (review finding S4)
        self.assertEqual(ai_share_label([None] * 5 + [0.0, 0.0]), 'unknown')          # only 2 tasks with data
        self.assertEqual(ai_share_label([None] * 9 + [0.9, 0.0, 0.0]), 'mixed')        # 1 of 3, not 1 of 12 (people_do)
        self.assertEqual(ai_share_label([None, 0.9, 0.9, 0.0, 0.0]), 'ai_does_much')   # 2 of 4

    def test_graph_label_skips_tasks_without_pen(self):
        g = FakeGraph()
        g.node['skl:4.A.1'] = {'kind': 'skill', 'label': 'Act', 'attrs': {'skill_kind': 'activity'}}
        g.node['skl:2.A.1'] = {'kind': 'skill', 'label': 'Skill', 'attrs': {'skill_kind': 'skill', 'acts': ['4.A.1']}}
        g.out['occ:x']['has_task'] = [('tsk:%d' % i, None, {'gwa': ['4.A.1'], **({'pen': p} if p is not None else {})}, '2026-08')
                                      for i, p in enumerate([0.5, 0.0, 0.0, None, None, None, None, None, None, None])]
        lab = ai_labels(g, 'occ:x')
        self.assertEqual(lab('skl:4.A.1'), 'mixed')   # 1 of 3 tasks with data; counting the 7 without data as 'no use' gave people_do
        self.assertEqual(lab('skl:2.A.1'), 'mixed')


class FakeGraph:
    def __init__(self):
        self.node = {}
        self.out = collections.defaultdict(lambda: collections.defaultdict(list))

    def occ(self, soc):
        self.node['occ:' + soc] = {'kind': 'occupation', 'label': soc, 'attrs': {}}
        return 'occ:' + soc

    def tool(self, occ, tid, label, w=0.6, in_demand=False):
        self.node.setdefault(tid, {'kind': 'skill', 'label': label, 'attrs': {'skill_kind': 'technology'}})
        self.out[occ]['needs'].append((tid, w, {'in_demand': True} if in_demand else {}, '2026-08'))

    def skills(self, occ, k):
        for i in range(k):
            self.node.setdefault('skl:2.A.%d' % i, {'kind': 'skill', 'label': 'S%d' % i, 'attrs': {'skill_kind': 'skill'}})
            self.out[occ]['needs'].append(('skl:2.A.%d' % i, 0.5, {}, '2026-08'))


class ToolRanking(unittest.TestCase):
    """Review finding B1: tools are picked by In Demand, then how typical they are of the SOC minor group, then label; never by id alone."""
    def graph(self):
        g = FakeGraph()
        devs = [g.occ('15-1252.00'), g.occ('15-1253.00'), g.occ('15-1254.00')]
        others = [g.occ('43-4051.00'), g.occ('43-4171.00'), g.occ('29-1141.00')]
        for o in devs + others: g.tool(o, 'tec:office', 'Microsoft Office software', 0.8)   # every job lists it
        for o in devs: g.tool(o, 'tec:git', 'Git')                                          # the whole 15-12 group lists it
        g.tool(devs[0], 'tec:aardvark', 'Aardvark Paint', 0.8)                                 # only this job, sorts first by id
        g.tool(devs[1], 'tec:aardvark', 'Aardvark Paint', 0.8)
        g.tool(others[0], 'tec:aardvark', 'Aardvark Paint', 0.8)
        g.tool(devs[0], 'tec:zeta', 'Zeta CI', in_demand=True)
        return g, devs[0]

    def test_scores(self):
        g, o = self.graph(); sc = tec_scores(g)[o]
        self.assertEqual(sc['tec:office'], 0.0)                     # listed everywhere: log(6/6) = 0
        self.assertGreater(sc['tec:git'], sc['tec:aardvark'])        # 3 of 3 in the group and rarer elsewhere
        self.assertGreater(sc['tec:aardvark'], sc['tec:office'])

    def test_order_of_the_tool_slots(self):
        g, o = self.graph(); g.skills(o, 6); sc = tec_scores(g)
        picked = [n['id'] for n in need_rows(g, o, 8, lambda e: 'unknown', sc)]   # 8 // 4 = 2 tool slots, 6 skills
        tools = sorted(x for x in picked if x.startswith('tec:'))
        self.assertEqual(tools, ['tec:git', 'tec:zeta'])   # In Demand first, then the group tool; not Aardvark (first by id) or Office

    def test_ties_go_by_label(self):
        g = FakeGraph(); o = g.occ('11-1011.00'); g.occ('11-1021.00')
        g.tool(o, 'tec:b', 'Alpha'); g.tool(o, 'tec:a', 'Beta'); g.skills(o, 3)
        out = need_rows(g, o, 4, lambda e: 'unknown', tec_scores(g))   # one tool slot, both tools score the same
        self.assertEqual([n['id'] for n in out if n['id'].startswith('tec:')], ['tec:b'])


class ToolCap(unittest.TestCase):
    """Owner decision O3: in each needs list as written, a tool weighs at most the median of the non-tool needs in that list."""
    def n(self, i, w): return {'id': i, 'label': i, 'kind': 'technology' if i.startswith('tec:') else 'skill', 'w': w}

    def test_cap_is_the_median_of_the_other_needs(self):
        out = cap_tool_weights([self.n('tec:a', 0.8), self.n('skl:1', 0.9), self.n('tec:b', 0.6), self.n('skl:2', 0.5), self.n('skl:3', 0.3), self.n('tec:c', 0.2)])
        w = {x['id']: x['w'] for x in out}
        self.assertEqual((w['tec:a'], w['tec:b'], w['tec:c']), (0.5, 0.5, 0.2))     # median of 0.9, 0.5, 0.3; a lower tool keeps its weight
        self.assertEqual((w['skl:1'], w['skl:2'], w['skl:3']), (0.9, 0.5, 0.3))     # other needs never change
        self.assertEqual([x['id'] for x in out], ['skl:1', 'skl:2', 'tec:a', 'tec:b', 'skl:3', 'tec:c'])   # weight, then id

    def test_even_count_uses_the_mean_of_the_middle_two(self):
        out = cap_tool_weights([self.n('tec:a', 0.8), self.n('skl:1', 0.6), self.n('skl:2', 0.4)])
        self.assertEqual(out[1]['w'], 0.5)

    def test_tools_only_list_is_left_alone(self):
        self.assertEqual([x['w'] for x in cap_tool_weights([self.n('tec:a', 0.8), self.n('tec:b', 0.6)])], [0.8, 0.6])

    def test_real_slices_are_capped(self):
        d = os.path.join(ROOT, 'data', 'graph', 'slices')
        if not os.path.isdir(d): self.skipTest('no exports yet')
        for f in sorted(os.listdir(d))[::40]:
            s = json.load(open(os.path.join(d, f), encoding='utf8'))
            for lst in [s['needs']] + [t['needs'] for t in s['targets']]:
                other = sorted(x['w'] for x in lst if not x['id'].startswith('tec:')); k = len(other)
                cap = round(other[k // 2] if k % 2 else (other[k // 2 - 1] + other[k // 2]) / 2, 4)
                self.assertTrue(all(x['w'] <= cap for x in lst if x['id'].startswith('tec:')), f)


class NearPairs(unittest.TestCase):
    """Owner decision O2: the export keeps only the near pairs the matcher can count (3 closest of one of the skills, 0.90 or more)."""
    @staticmethod
    def allowed(pairs, s):
        nb = sorted([(-w, b if a == s else a) for a, b, w in pairs if s in (a, b)])[:3]
        return {(k, -w) for w, k in nb if -w >= 0.9}

    def test_examples(self):
        pairs = [['a', 't', 0.97], ['b', 't', 0.95], ['c', 't', 0.95], ['d', 't', 0.94], ['e', 'f', 0.89], ['g', 'h', 0.9]]
        kept = countable_pairs(pairs)
        self.assertIn(['d', 't', 0.94], kept)        # fourth for t, but t is d's only neighbour
        self.assertNotIn(['e', 'f', 0.89], kept)     # under the floor
        self.assertIn(['g', 'h', 0.9], kept)         # the floor counts

    def test_dropped_pair_changes_no_skill_top_three(self):
        rnd = random.Random(20261029)
        ids = ['skl:%02d' % i for i in range(30)]
        for _ in range(200):
            best = {}
            for _ in range(rnd.randint(5, 150)):
                a, b = sorted(rnd.sample(ids, 2)); best[(a, b)] = round(rnd.choice([rnd.uniform(0.5, 1.0), rnd.choice([0.9, 0.95, 0.97])]), 2)
            pairs = [[a, b, w] for (a, b), w in sorted(best.items())]
            kept = countable_pairs(pairs)
            self.assertTrue(all(w >= 0.9 for a, b, w in kept))
            for s in ids: self.assertEqual(self.allowed(pairs, s), self.allowed(kept, s), s)


class Coverage(unittest.TestCase):
    def test_overlap(self):
        t = [{'id': 'a', 'w': 0.8}, {'id': 'b', 'w': 0.2}]
        self.assertAlmostEqual(coverage({'a': 0.8, 'b': 0.2}, t), 1.0)
        self.assertAlmostEqual(coverage({'a': 0.4}, t), 0.4)
        self.assertAlmostEqual(coverage({}, t), 0.0)
        self.assertEqual(coverage({'a': 1}, []), 0.0)


class Freshness(unittest.TestCase):
    TODAY = datetime.date(2026, 10, 29)

    def test_weight_falls_with_age(self):
        self.assertEqual(freshness.rating_weight(0), 1.0)
        self.assertEqual(freshness.rating_weight(3), 1.0)
        self.assertAlmostEqual(freshness.rating_weight(5), 0.9)
        self.assertAlmostEqual(freshness.rating_weight(8), 0.75)
        self.assertEqual(freshness.rating_weight(20), 0.6)
        ages = [freshness.age_years(d, self.TODAY) for d in ('2026-08', '2023-08', '2019-08', '2010-01')]
        ws = [freshness.rating_weight(a) for a in ages]
        self.assertEqual(ws, sorted(ws, reverse=True))
        self.assertLess(ws[-1], ws[0])

    def test_age(self):
        self.assertAlmostEqual(freshness.age_years('2023-10-29', self.TODAY), 3.0, places=1)
        self.assertEqual(freshness.age_years('2027-01', self.TODAY), 0.0)

    def test_grey_and_hide(self):
        self.assertEqual(freshness.signal_state(1.9, 1), 'fresh')
        self.assertEqual(freshness.signal_state(2.0, 1), 'fresh')    # not more than twice
        self.assertEqual(freshness.signal_state(2.1, 1), 'grey')
        self.assertEqual(freshness.signal_state(3.0, 1), 'grey')
        self.assertEqual(freshness.signal_state(3.1, 1), 'hidden')
        self.assertEqual(freshness.signal_state(0.6, 0.25), 'grey')  # quarterly cadence


if __name__ == '__main__':
    unittest.main()
