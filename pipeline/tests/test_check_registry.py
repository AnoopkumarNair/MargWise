import json, os, sys, tempfile, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import check_registry as c

def E(i, status='live', **kw):
    d = {'id': i, 'kind': 'skill', 'label': 'L ' + i, 'first_release': 'r1', 'status': status, 'replaced_by': None, 'note': ''}; d.update(kw); return d
def R(*e): return {'registry_version': 1, 'entries': list(e)}

class AppendOnly(unittest.TestCase):
    def test_empty_ok(self): self.assertEqual(c.check_append_only(R(), R()), [])
    def test_add_ok(self): self.assertEqual(c.check_append_only(R(E('a')), R(E('a'), E('b'))), [])
    def test_delete_fails(self): self.assertTrue(c.check_append_only(R(E('a')), R()))
    def test_relabel_fails(self): self.assertTrue(c.check_append_only(R(E('a')), R(E('a', label='new'))))
    def test_live_to_tombstone_ok(self): self.assertEqual(c.check_append_only(R(E('a')), R(E('a', 'tombstone', replaced_by=['b']), E('b'))), [])
    def test_tombstone_needs_reason(self): self.assertTrue(c.check_append_only(R(E('a')), R(E('a', 'tombstone'))))
    def test_tombstone_with_note_ok(self): self.assertEqual(c.check_append_only(R(E('a')), R(E('a', 'tombstone', note='retired'))), [])
    def test_tombstone_back_to_live_fails(self): self.assertTrue(c.check_append_only(R(E('a', 'tombstone', note='x')), R(E('a'))))
    def test_tombstone_edit_fails(self): self.assertTrue(c.check_append_only(R(E('a', 'tombstone', note='x')), R(E('a', 'tombstone', note='y'))))
    def test_live_note_edit_fails(self): self.assertTrue(c.check_append_only(R(E('a')), R(E('a', note='changed'))))
    def test_duplicate_fails(self): self.assertTrue(c.check_append_only(R(), R(E('a'), E('a'))))
    def test_bad_status_fails(self): self.assertTrue(c.check_append_only(R(), R(E('a', 'gone'))))

class Releases(unittest.TestCase):
    def mk(self, manifests, latest=None):
        d = tempfile.mkdtemp()
        for rid, m in manifests.items():
            p = os.path.join(d, 'data', 'releases', 'graph', rid); os.makedirs(p)
            json.dump(m, open(os.path.join(p, 'manifest.json'), 'w'))
        if latest:
            json.dump({'release_id': latest}, open(os.path.join(d, 'data', 'releases', 'graph', 'latest.json'), 'w'))
        return d
    def test_no_release_passes(self): self.assertEqual(c.check_releases(R(), tempfile.mkdtemp()), ([], 0))
    def test_missing_id_fails(self):
        d = self.mk({'r1': {'release_id': 'r1', 'ids': ['a', 'zz']}})
        self.assertTrue(any('zz' in e for e in c.check_releases(R(E('a')), d)[0]))
    def test_all_present_ok(self):
        d = self.mk({'r1': {'release_id': 'r1', 'ids': ['a']}}); self.assertEqual(c.check_releases(R(E('a')), d)[0], [])
    def test_old_release_may_use_tombstone(self):
        d = self.mk({'r1': {'release_id': 'r1', 'ids': ['a']}, 'r2': {'release_id': 'r2', 'ids': ['b']}}, latest='r2')
        self.assertEqual(c.check_releases(R(E('a', 'tombstone', replaced_by=['b']), E('b')), d)[0], [])
    def test_current_tombstone_fails(self):
        d = self.mk({'r1': {'release_id': 'r1', 'ids': ['a']}}, latest='r1')
        self.assertTrue(c.check_releases(R(E('a', 'tombstone', note='x')), d)[0])
    def test_object_ids(self):
        d = self.mk({'r1': {'release_id': 'r1', 'ids': [{'id': 'a'}]}}); self.assertEqual(c.check_releases(R(E('a')), d)[0], [])

class Main(unittest.TestCase):
    def test_repo_passes(self): self.assertEqual(c.main(), 0)
    def test_missing_file_fails(self): self.assertEqual(c.main(tempfile.mkdtemp()), 1)

if __name__ == '__main__': unittest.main()
