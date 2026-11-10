"""The tier 2 vectors (BUILD_PLAN T4.5) are never recomputed offline, so these tests make sure a stale file is caught and a release carries only current ones."""
import json, os, shutil, tempfile, unittest
from common import ROOT
import graph_release, vec_texts

G = os.path.join(ROOT, 'data', 'graph')


class SkillVecs(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix='vecs_')
        for n in ('skills_index.json', 'skill_vecs.json', 'skill_vecs.bin'): shutil.copy(os.path.join(G, n), self.d)

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def meta(self): return json.load(open(os.path.join(self.d, 'skill_vecs.json'), encoding='utf8'))

    def save(self, m): json.dump(m, open(os.path.join(self.d, 'skill_vecs.json'), 'w', encoding='utf8'))

    def test_the_committed_vectors_are_current(self):
        self.assertEqual(vec_texts.check(G), [])

    def test_every_text_is_real_source_text(self):
        rows = vec_texts.skill_texts()
        self.assertEqual(len(rows), 109)   # the skills, knowledge and work activities of the graph; technologies are not embedded
        self.assertTrue(all(i.startswith('skl:') for i, _ in rows))
        self.assertTrue(all(': ' in t and len(t) > 30 for _, t in rows))

    def test_a_dead_id_is_caught(self):
        m = self.meta(); m['ids'][0] = 'skl:9.Z.9.z'; self.save(m)
        self.assertTrue(any('not in skills_index.json' in p for p in vec_texts.check(self.d)))

    def test_a_wrong_length_is_caught(self):
        with open(os.path.join(self.d, 'skill_vecs.bin'), 'ab') as f: f.write(b'\x00')
        self.assertTrue(any('bytes but' in p for p in vec_texts.check(self.d)))

    def test_a_bin_altered_at_the_same_length_is_caught(self):
        bp = os.path.join(self.d, 'skill_vecs.bin'); b = bytearray(open(bp, 'rb').read()); b[100] = (b[100] + 1) % 256; open(bp, 'wb').write(bytes(b))
        self.assertEqual(os.path.getsize(bp), 109 * 384)   # same length: only the hash can tell
        self.assertTrue(any('bin_sha256' in p for p in vec_texts.check(self.d)))

    def test_a_missing_bin_hash_is_caught(self):
        m = self.meta(); del m['bin_sha256']; self.save(m)
        self.assertTrue(any('no bin_sha256' in p for p in vec_texts.check(self.d)))

    def test_the_hash_in_the_json_is_the_hash_of_the_committed_bin(self):
        self.assertEqual(self.meta()['bin_sha256'], vec_texts.bin_sha256(os.path.join(G, 'skill_vecs.bin')))

    def test_a_model_or_revision_that_differs_from_the_pin_is_caught(self):
        pin = json.load(open(vec_texts.MODEL_PIN, encoding='utf8')); pf = os.path.join(self.d, 'pin.json')
        for key, val in (('revision', '0' * 40), ('model_id', 'Other/model')):
            p2 = dict(pin); p2[key] = val; json.dump(p2, open(pf, 'w'))
            self.assertTrue(any('pinned model' in p for p in vec_texts.check(self.d, model_pin=pf)), key)
        json.dump(pin, open(pf, 'w')); self.assertEqual(vec_texts.check(self.d, model_pin=pf), [])

    def test_changed_texts_are_caught(self):
        m = self.meta(); m['texts_sha256'] = '0' * 64; self.save(m)
        self.assertTrue(any('texts changed' in p for p in vec_texts.check(self.d)))

    def test_a_new_skill_in_the_index_makes_the_vectors_stale(self):
        idx = json.load(open(os.path.join(self.d, 'skills_index.json'), encoding='utf8'))
        idx = [e for e in idx if e['id'] != 'skl:2.A.1.a']   # a skill disappears from the index
        json.dump(idx, open(os.path.join(self.d, 'skills_index.json'), 'w', encoding='utf8'))
        self.assertTrue(vec_texts.check(self.d))

    def test_missing_files_are_reported_not_ignored(self):
        os.remove(os.path.join(self.d, 'skill_vecs.bin'))
        self.assertTrue(any('both exist' in p for p in vec_texts.check(self.d)))


class Release(unittest.TestCase):
    """accept_graph on a throwaway repository folder: it carries current vectors and refuses stale ones."""
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='relv_'); g = os.path.join(self.root, 'data', 'graph'); os.makedirs(os.path.join(g, 'slices'))
        json.dump({'occ': {'id': 'occ:15-1252.00'}}, open(os.path.join(g, 'slices', '15-1252.00.json'), 'w'))
        shutil.copy(os.path.join(G, 'skills_index.json'), g)
        json.dump({}, open(os.path.join(g, 'titles.json'), 'w'))
        json.dump({'release': 'onet-31-0-abcd1234', 'graph_hash': 'h1'}, open(os.path.join(g, 'export_report.json'), 'w'))
        json.dump({'onet_version': '31.0', 'onet_release': '2026-08', 'graph_hash': 'h1'}, open(os.path.join(g, 'build_report.json'), 'w'))
        idx = json.load(open(os.path.join(g, 'skills_index.json'), encoding='utf8'))
        ents = [{'id': i, 'kind': 'skill', 'label': i, 'first_release': 'onet-31-0-abcd1234', 'status': 'live', 'replaced_by': None, 'note': None} for i in ['occ:15-1252.00'] + [e['id'] for e in idx]]
        json.dump({'registry_version': 1, 'entries': ents}, open(os.path.join(g, 'id_registry.json'), 'w'))
        self.g = g

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_current_vectors_go_into_the_release(self):
        for n in graph_release.VECS: shutil.copy(os.path.join(G, n), self.g)
        man = {}; rid = graph_release.accept_graph(self.root, man)
        dest = os.path.join(self.root, 'data', 'releases', 'graph', rid)
        for n in graph_release.VECS: self.assertEqual(open(os.path.join(dest, n), 'rb').read(), open(os.path.join(G, n), 'rb').read())
        self.assertIn('skill_vecs.bin', man['graph']['files']); self.assertIn('skill_vecs.json', json.load(open(os.path.join(dest, 'manifest.json')))['files'])

    def test_stale_vectors_stop_the_release(self):
        for n in graph_release.VECS: shutil.copy(os.path.join(G, n), self.g)
        m = json.load(open(os.path.join(self.g, 'skill_vecs.json'), encoding='utf8')); m['texts_sha256'] = '1' * 64
        json.dump(m, open(os.path.join(self.g, 'skill_vecs.json'), 'w', encoding='utf8'))
        with self.assertRaises(SystemExit) as cm: graph_release.accept_graph(self.root, {})
        self.assertIn('stale', str(cm.exception))

    def test_no_vectors_is_fine(self):
        man = {}; graph_release.accept_graph(self.root, man)
        self.assertNotIn('skill_vecs.bin', man['graph']['files'])


if __name__ == '__main__':
    unittest.main()
