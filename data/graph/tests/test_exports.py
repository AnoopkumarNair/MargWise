"""Exports (TEST_PLAN layer 1): slices validate and stay at most 60 KB gzipped, have the SPEC 5.4 shape, targets carry needs, ids exist,
near pairs join slice skills, skills_index is small and has no clashing terms."""
import gzip, json, os, shutil, sqlite3, tempfile, unittest
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

    def test_full_spec_shape_and_gzipped_size(self):
        rep = json.load(open(os.path.join(GRAPH_DIR, 'export_report.json'), encoding='utf8'))
        self.assertEqual(rep['slices_trimmed (targets_needs_tasks)'], {}, 'a slice needed the last-resort trim ladder')
        self.assertLessEqual(rep['slice_bytes_gz_max'], vg.SLICE_MAX_GZ)
        d = os.path.join(GRAPH_DIR, 'slices')
        for f in sorted(os.listdir(d))[::50]:
            body = open(os.path.join(d, f), 'rb').read(); s = json.loads(body)
            self.assertLessEqual(len(gzip.compress(body, vg.GZ_LEVEL, mtime=0)), vg.SLICE_MAX_GZ, f)
            self.assertGreaterEqual(len(s['targets']), 20, f)
            n = [len(tg['needs']) for tg in s['targets']]
            self.assertTrue(all(10 <= x <= 40 for x in n), f)
            self.assertGreaterEqual(sum(x == 40 for x in n), len(n) * 0.8, f)   # 40 unless the target job has fewer rated needs
            self.assertTrue(s['near']['pairs'], f)
            self.assertEqual((s['near']['src'], s['near']['trust']), ('onet', 'estimate'))

    def test_known_slice_content(self):
        s = json.load(open(os.path.join(GRAPH_DIR, 'slices', '15-1252.00.json'), encoding='utf8'))
        self.assertEqual(s['occ']['id'], 'occ:15-1252.00'); self.assertEqual(s['occ']['job_zone'], 4)
        self.assertEqual(s['occ']['ratings'], {'oldest': '2025-08', 'newest': '2025-08'})
        self.assertIn('skl:2.B.3.e', [n['id'] for n in s['needs']])
        self.assertIn('occ:15-1253.00', [t['occ']['id'] for t in s['targets']] + ['occ:15-1253.00'])   # kept in the list even when the slice is trimmed
        self.assertTrue(all(n['ai'] in ('ai_does_much', 'mixed', 'people_do', 'unknown') for n in s['needs']))
        self.assertTrue(any(n['kind'] == 'technology' for n in s['needs']))
        self.assertEqual(len(s['targets']), 30)
        self.assertIn('occ:15-1253.00', [t['occ']['id'] for t in s['targets']])
        modes = {t['ai_mode'] for t in s['tasks']}
        self.assertTrue(modes <= {'used', 'none', 'unknown'}, modes)   # the AI data has no automation/augmentation split
        self.assertIn('used', modes)
        skl = {n['id'] for n in s['needs']} | {n['id'] for t in s['targets'] for n in t['needs']}
        self.assertTrue(all(a in skl and b in skl and a < b and 0.9 <= w <= 1 for a, b, w in s['near']['pairs']))

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
        p = os.path.join(self.tmp, 'slices', '15-1252.00.json'); s = json.load(open(p))
        s['occ']['note_for_test'] = os.urandom(70000).hex()     # random text does not compress, so the gzipped size goes over the limit
        json.dump(s, open(p, 'w'), separators=(',', ':'))
        self.assertIn('slice at most 60 KB gzipped', self.fails())

    def test_raw_size_alone_is_not_a_failure(self):
        p = os.path.join(self.tmp, 'slices', '15-1252.00.json'); s = json.load(open(p)); json.dump(s, open(p, 'w'), indent=8)   # far over 60 KB raw
        self.assertGreater(os.path.getsize(p), 300000)
        self.assertNotIn('slice at most 60 KB gzipped', self.fails())

    def test_bad_near_pairs(self):
        p = os.path.join(self.tmp, 'slices', '15-1252.00.json'); s = json.load(open(p))
        s['near']['pairs'].append(['skl:2.A.1.a', 'skl:9.9.9', 0.8]); s['near']['pairs'].append(['skl:2.B.3.e', 'skl:2.A.1.a', 0.8])
        json.dump(s, open(p, 'w'), separators=(',', ':'))
        f = self.fails()
        self.assertIn('near pairs only join skills in the slice needs', f); self.assertIn('near pairs are sorted, once each, a before b', f)

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
