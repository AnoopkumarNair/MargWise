"""The offline AI-exposure stage is byte-stable: aiMeta.retrieved comes from data/ai/retrieved.json, never from today's date."""
import json, os, shutil, subprocess, sys, tempfile, unittest
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCRIPT = os.path.join(ROOT, 'data', 'ai_exposure.py')

class OfflineStable(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(); self.cache = os.path.join(self.d, 'ai')
        shutil.copytree(os.path.join(ROOT, 'data', 'ai'), self.cache)
        self.content = os.path.join(self.d, 'content.json'); shutil.copy(os.path.join(ROOT, 'data', 'content.json'), self.content)
    def tearDown(self): shutil.rmtree(self.d, ignore_errors=True)
    def run_stage(self):
        return subprocess.run([sys.executable, SCRIPT, '--content', self.content, '--cache', self.cache], capture_output=True, text=True, cwd=self.d)
    def test_keeps_recorded_date_and_bytes(self):
        want = json.load(open(os.path.join(self.cache, 'retrieved.json')))['retrieved']
        r = self.run_stage(); self.assertEqual(r.returncode, 0, r.stderr)
        first = open(self.content, 'rb').read()
        self.assertEqual(json.loads(first)['aiMeta']['retrieved'], want)
        r = self.run_stage(); self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(open(self.content, 'rb').read(), first)
    def test_committed_content_matches_recorded_date(self):
        self.assertEqual(json.load(open(os.path.join(ROOT, 'data', 'content.json')))['aiMeta']['retrieved'],
                         json.load(open(os.path.join(ROOT, 'data', 'ai', 'retrieved.json')))['retrieved'])
    def test_missing_date_file_fails_loudly(self):
        os.remove(os.path.join(self.cache, 'retrieved.json'))
        r = self.run_stage(); self.assertNotEqual(r.returncode, 0); self.assertIn('--refresh', r.stdout + r.stderr)

if __name__ == '__main__': unittest.main()
