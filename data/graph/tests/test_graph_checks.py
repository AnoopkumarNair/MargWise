"""The graph checks (SPEC 5.3) pass on the real graph, and each one fails when its rule is broken."""
import os, shutil, sqlite3, tempfile, unittest
from common import graph_paths, GRAPH_DIR, ROOT
import validate_graph as vg

DATA = os.path.join(ROOT, 'data')


class RealGraph(unittest.TestCase):
    def test_passes(self):
        db = sqlite3.connect(graph_paths()[0]); rep = vg.Report()
        nc, ec, sc, n_careers, _ = vg.check_graph(db, DATA, rep, raw=True)
        db.close()
        self.assertEqual(dict(rep.fails), {})
        self.assertEqual(n_careers, 83)
        self.assertIn('occupation', nc)


class Broken(unittest.TestCase):
    """Each test copies the graph, breaks one rule, and expects that check (and no crash) to fail."""
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='graphchk_'); cls.src = graph_paths()[0]

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def broken(self, name, sql, raw=False):
        p = os.path.join(self.tmp, name + '.sqlite'); shutil.copy(self.src, p)
        db = sqlite3.connect(p)
        for s in ([sql] if isinstance(sql, str) else sql): db.execute(s)
        db.commit(); rep = vg.Report(); vg.check_graph(db, DATA, rep, raw=raw); db.close()
        return rep.fails

    def test_dangling_edge(self):
        f = self.broken('dangle', "DELETE FROM node WHERE id='skl:2.B.3.e'")
        self.assertIn('edge endpoint exists', f)

    def test_few_needs(self):
        f = self.broken('few', "DELETE FROM edge WHERE kind='needs' AND src='occ:15-1252.00' AND rowid NOT IN (SELECT rowid FROM edge WHERE kind='needs' AND src='occ:15-1252.00' LIMIT 5)")
        self.assertIn('occupation has 10 or more needs', f)

    def test_empty_source(self):
        f = self.broken('src', "UPDATE edge SET source='' WHERE kind='close_to' AND src='occ:15-1252.00'")
        self.assertIn('empty source', f)

    def test_unregistered_source(self):
        f = self.broken('src2', "UPDATE node SET source='made_up' WHERE id='occ:15-1252.00'")
        self.assertIn('source not in data/sources.yaml', f)

    def test_bad_trust(self):
        f = self.broken('trust', "UPDATE signal SET trust='great' WHERE kind='ai_tier'")
        self.assertIn('trust', f)

    def test_empty_as_of(self):
        f = self.broken('asof', "UPDATE node SET as_of='' WHERE id='occ:15-1252.00'")
        self.assertIn('as_of', f)

    def test_missing_career(self):
        f = self.broken('career', ["DELETE FROM edge WHERE src='occ:29-1215.00' OR dst='occ:29-1215.00'", "DELETE FROM node WHERE id='occ:29-1215.00'"])
        self.assertIn('every student career has its SOC code as an occupation', f)

    def test_download_date_instead_of_rating_date(self):
        f = self.broken('date', "UPDATE edge SET as_of='2026-10' WHERE kind='needs' AND src='occ:11-1011.00' AND dst='skl:2.C.1.a'", raw=True)
        self.assertIn('needs edge has an O*NET rating date', f)

    def test_weight_out_of_range(self):
        f = self.broken('w', "UPDATE edge SET weight=1.5 WHERE kind='needs' AND src='occ:11-1011.00' AND dst='skl:2.C.1.a'")
        self.assertIn('edge weight in 0..1', f)


if __name__ == '__main__':
    unittest.main()
