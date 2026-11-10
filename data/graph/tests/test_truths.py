"""Known truths (TEST_PLAN layer 1): facts checked by hand, run as assertions against graph.sqlite."""
import json, os, sqlite3, unittest
from common import graph_paths, TESTS, ROOT

with open(os.path.join(TESTS, 'truths.json'), encoding='utf8') as _f: TRUTHS = json.load(_f)['truths']


class Truths(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = sqlite3.connect(graph_paths()[0])
        with open(os.path.join(ROOT, 'data', 'content.json'), encoding='utf8') as f: cls.content = json.load(f)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def one(self, sql, *a):
        return self.db.execute(sql, a).fetchone()

    def run_truth(self, t):
        k = t['type']
        if k == 'label':
            self.assertEqual(self.one('SELECT label FROM node WHERE id=?', t['node']), (t['equals'],))
        elif k == 'attr':
            r = self.one('SELECT attrs FROM node WHERE id=?', t['node']); self.assertIsNotNone(r, t['node'])
            self.assertEqual(json.loads(r[0]).get(t['key']), t['equals'])
        elif k == 'need' or k == 'edge':
            if k == 'need': src, dst, kind = t['occ'], t['skill'], 'needs'
            else: src, dst, kind = t['src'], t['dst'], t['kind']
            r = self.one('SELECT weight, as_of FROM edge WHERE src=? AND dst=? AND kind=?', src, dst, kind)
            self.assertIsNotNone(r, '%s -%s-> %s is missing' % (src, kind, dst))
            w, ao = r
            if 'w' in t or 'weight' in t: self.assertAlmostEqual(w, t.get('w', t.get('weight')), places=4)
            if 'min_w' in t or 'min_weight' in t: self.assertGreaterEqual(w, t.get('min_w', t.get('min_weight')))
            if 'max_w' in t: self.assertLessEqual(w, t['max_w'])
            if 'as_of' in t: self.assertEqual(ao, t['as_of'])
        elif k == 'signal':
            self.assertEqual(self.one("SELECT value FROM signal WHERE node=? AND kind=?", t['node'], t['kind']), (t['equals'],))
        elif k == 'every_in_cluster_has_edge':
            occs = [r[0] for r in self.db.execute("SELECT src FROM edge WHERE kind='in_cluster' AND dst=?", (t['cluster'],))]
            self.assertTrue(occs, 'no occupations in ' + t['cluster'])
            for o in occs: self.assertIsNotNone(self.one('SELECT 1 FROM edge WHERE src=? AND kind=? LIMIT 1', o, t['edge']), '%s has no %s' % (o, t['edge']))
        elif k == 'count_edges':
            self.assertEqual(self.one('SELECT COUNT(*) FROM edge WHERE kind=?', t['kind'])[0], t['equals'])
        elif k == 'count_nodes':
            n = self.one('SELECT COUNT(*) FROM node WHERE id LIKE ?', t['prefix'] + '%')[0]
            if 'equals' in t: self.assertEqual(n, t['equals'])
            if 'min' in t: self.assertGreaterEqual(n, t['min'])
        elif k == 'ai_obs_matches_content':
            n = 0
            for c in self.content['careers']:
                r = self.one("SELECT value FROM signal WHERE node=? AND kind='ai_obs'", 'occ:' + c['soc'])
                if r is None or c['ai']['obs'] is None: continue
                n += 1; self.assertAlmostEqual(float(r[0]), c['ai']['obs'], places=3, msg=c['id'])
            self.assertGreater(n, 60)
        else:
            self.fail('unknown truth type ' + k)


def _add(t):
    def f(self): self.run_truth(t)
    return f


for _t in TRUTHS: setattr(Truths, 'test_' + _t['id'].replace('-', '_'), _add(_t))

if __name__ == '__main__':
    unittest.main()
