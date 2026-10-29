"""Exports (TEST_PLAN layer 1): slices validate and stay under 60 KB, targets carry needs, ids exist, skills_index is small and has no clashing terms."""
import json, os, shutil, sqlite3, tempfile, unittest
from common import graph_paths, GRAPH_DIR
import validate_graph as vg


def nodes_of(path):
    db = sqlite3.connect(path); n = {r[0]: r for r in db.execute('SELECT id, kind FROM node')}; db.close(); return n


@unittest.skipUnless(os.path.isdir(os.path.join(GRAPH_DIR, 'slices')), 'no exports yet (run data/graph/export.py)')
class RealExports(unittest.TestCase):
    def test_pass(self):
        rep = vg.Report(); n, t, gz, ni, nt = vg.check_exports(nodes_of(graph_paths()[0]), GRAPH_DIR, rep)
        self.assertEqual(dict(rep.fails), {})
        self.assertGreater(n, 900); self.assertLess(gz, vg.INDEX_MAX_GZ)

    def test_every_slice_has_ten_or_more_needs_and_a_source(self):
        d = os.path.join(GRAPH_DIR, 'slices')
        for f in sorted(os.listdir(d))[::25]:
            s = json.load(open(os.path.join(d, f), encoding='utf8'))
            self.assertEqual(len(s['needs']), 40, f)
            self.assertTrue(s['sources'])
            self.assertTrue(all(tg['needs'] for tg in s['targets']))

    def test_known_slice_content(self):
        s = json.load(open(os.path.join(GRAPH_DIR, 'slices', '15-1252.00.json'), encoding='utf8'))
        self.assertEqual(s['occ']['id'], 'occ:15-1252.00'); self.assertEqual(s['occ']['job_zone'], 4)
        self.assertEqual(s['occ']['ratings'], {'oldest': '2025-08', 'newest': '2025-08'})
        self.assertIn('skl:2.B.3.e', [n['id'] for n in s['needs']])
        self.assertIn('occ:15-1253.00', [t['occ']['id'] for t in s['targets']] + ['occ:15-1253.00'])   # kept in the list even when the slice is trimmed
        self.assertTrue(all(n['ai'] in ('ai_does_much', 'mixed', 'people_do', 'unknown') for n in s['needs']))
        self.assertTrue(any(n['kind'] == 'technology' for n in s['needs']))

    def test_no_slice_for_an_occupation_without_skill_ratings(self):
        self.assertFalse(os.path.exists(os.path.join(GRAPH_DIR, 'slices', '13-2051.00.json')))


@unittest.skipUnless(os.path.isdir(os.path.join(GRAPH_DIR, 'slices')), 'no exports yet')
class BrokenExports(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='expchk_'); os.makedirs(os.path.join(self.tmp, 'slices'))
        for f in ('15-1252.00.json', '13-2011.00.json'): shutil.copy(os.path.join(GRAPH_DIR, 'slices', f), os.path.join(self.tmp, 'slices', f))
        shutil.copy(os.path.join(GRAPH_DIR, 'skills_index.json'), self.tmp); json.dump({}, open(os.path.join(self.tmp, 'titles.json'), 'w'))
        self.nodes = nodes_of(graph_paths()[0])

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def fails(self):
        rep = vg.Report(); vg.check_exports(self.nodes, self.tmp, rep); return rep.fails

    def test_oversize_slice(self):
        p = os.path.join(self.tmp, 'slices', '15-1252.00.json'); s = json.load(open(p)); s['occ']['description'] = 'x' * 1000
        s['signals'] = []; json.dump(s, open(p, 'w'), indent=4)     # pretty-printed, so over the limit
        self.assertIn('slice under 60 KB', self.fails())

    def test_target_without_needs(self):
        p = os.path.join(self.tmp, 'slices', '15-1252.00.json'); s = json.load(open(p)); s['targets'][0]['needs'] = []; json.dump(s, open(p, 'w'), separators=(',', ':'))
        self.assertIn('every road target carries its needs', self.fails())

    def test_unknown_id(self):
        p = os.path.join(self.tmp, 'slices', '15-1252.00.json'); s = json.load(open(p)); s['needs'][0]['id'] = 'skl:9.9.9'; json.dump(s, open(p, 'w'), separators=(',', ':'))
        self.assertIn('every id in a slice exists in the graph', self.fails())

    def test_clashing_term(self):
        p = os.path.join(self.tmp, 'skills_index.json'); idx = json.load(open(p))
        idx[0]['alt'] = ['dup term']; idx[1]['alt'] = ['dup term']; json.dump(idx, open(p, 'w'))
        self.assertIn('no term points at two ids unless it is marked ambiguous', self.fails())
        idx[1]['ambiguous'] = ['dup term']; json.dump(idx, open(p, 'w'))
        self.assertNotIn('no term points at two ids unless it is marked ambiguous', self.fails())

    def test_title_pointing_nowhere(self):
        json.dump({'ghost': ['occ:11-1011.00']}, open(os.path.join(self.tmp, 'titles.json'), 'w'))
        self.assertIn('titles point at occupations that have a slice', self.fails())


if __name__ == '__main__':
    unittest.main()
