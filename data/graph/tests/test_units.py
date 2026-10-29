"""Small pure functions: title normal form (same as the browser), ids, weights, AI labels, coverage, freshness."""
import datetime, json, os, shutil, subprocess, unittest
from common import ROOT
from build_graph import norm_title, slug, mmyyyy, need_weight, cosine
import collections
from export import ai_share_label, ai_labels, coverage, need_rows, tec_scores
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
