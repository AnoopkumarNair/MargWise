"""The graph part of --accept, run on a small fake repository folder (the real data/releases/ is never touched)."""
import json, os, shutil, tempfile, unittest
from common import ROOT
import graph_release, check_registry


class Accept(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='rel_'); g = os.path.join(self.root, 'data', 'graph'); os.makedirs(os.path.join(g, 'slices'))
        for soc in ('15-1252.00', '13-2011.00'): json.dump({'occ': {'id': 'occ:' + soc}}, open(os.path.join(g, 'slices', soc + '.json'), 'w'))
        json.dump([{'id': 'skl:2.B.3.e', 'label': 'Programming', 'alt': [], 'kind': 'skill'}], open(os.path.join(g, 'skills_index.json'), 'w'))
        json.dump({}, open(os.path.join(g, 'titles.json'), 'w'))
        json.dump({'release': 'onet-31-0-abcd1234', 'graph_hash': 'h1'}, open(os.path.join(g, 'export_report.json'), 'w'))
        json.dump({'onet_version': '31.0', 'onet_release': '2026-08', 'graph_hash': 'h1'}, open(os.path.join(g, 'build_report.json'), 'w'))
        self.reg_path = os.path.join(g, 'id_registry.json')
        self.entries = [{'id': i, 'kind': k, 'label': i, 'first_release': 'onet-31-0-abcd1234', 'status': 'live', 'replaced_by': None, 'note': None} for i, k in (('occ:15-1252.00', 'occupation'), ('occ:13-2011.00', 'occupation'), ('skl:2.B.3.e', 'skill'))]
        json.dump({'registry_version': 1, 'entries': self.entries}, open(self.reg_path, 'w'))

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_accept_writes_a_release_the_registry_check_accepts(self):
        man = {}
        rid = graph_release.accept_graph(self.root, man)
        self.assertEqual(rid, 'onet-31-0-abcd1234')
        base = os.path.join(self.root, 'data', 'releases', 'graph')
        self.assertTrue(os.path.exists(os.path.join(base, rid, 'slices', '15-1252.00.json')))
        m = json.load(open(os.path.join(base, rid, 'manifest.json')))
        self.assertEqual(m['ids'], ['occ:13-2011.00', 'occ:15-1252.00', 'skl:2.B.3.e'])
        self.assertEqual(json.load(open(os.path.join(base, 'latest.json'))), {'release_id': rid})
        self.assertEqual(man['graph']['release_id'], rid); self.assertIn('skills_index.json', man['graph']['files'])
        errs, n = check_registry.check_releases(json.load(open(self.reg_path)), self.root)
        self.assertEqual(errs, []); self.assertEqual(n, 1)

    def test_refuses_when_registry_is_missing_an_id(self):
        json.dump({'registry_version': 1, 'entries': self.entries[:2]}, open(self.reg_path, 'w'))
        with self.assertRaises(SystemExit) as cm: graph_release.accept_graph(self.root, {})
        self.assertIn('registry_fill.py', str(cm.exception))
        self.assertFalse(os.path.exists(os.path.join(self.root, 'data', 'releases')))

    def test_refuses_stale_exports(self):
        json.dump({'onet_version': '31.0', 'onet_release': '2026-08', 'graph_hash': 'other'}, open(os.path.join(self.root, 'data', 'graph', 'build_report.json'), 'w'))
        with self.assertRaises(SystemExit): graph_release.accept_graph(self.root, {})


if __name__ == '__main__':
    unittest.main()
