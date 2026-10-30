"""Determinism (TEST_PLAN layer 1): build twice from the same raw files, and the graph hash, the counts and every export hash must match."""
import hashlib, json, os, shutil, subprocess, sys, tempfile, time, unittest
from common import GRAPH_DIR


def tree_hash(d):
    out = {}
    for root, _, files in os.walk(d):
        for f in sorted(files):
            p = os.path.join(root, f); out[os.path.relpath(p, d)] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    return out


class Determinism(unittest.TestCase):
    def test_two_builds_and_two_exports_are_identical(self):
        tmp = tempfile.mkdtemp(prefix='graphdet_')
        try:
            runs = []
            for i in (1, 2):
                d = os.path.join(tmp, 'r%d' % i); os.makedirs(d)
                t = time.time()
                subprocess.run([sys.executable, os.path.join(GRAPH_DIR, 'build_graph.py'), '--out', os.path.join(d, 'graph.sqlite'), '--report', os.path.join(d, 'build_report.json')], check=True, capture_output=True)
                self.assertLess(time.time() - t, 120, 'the build must run in under 2 minutes')
                # export reads build_report.json next to its own folder, so give it a copy of the layout it expects
                exp = os.path.join(d, 'out'); os.makedirs(exp)
                subprocess.run([sys.executable, os.path.join(GRAPH_DIR, 'export.py'), '--graph', os.path.join(d, 'graph.sqlite'), '--report', os.path.join(d, 'build_report.json'), '--out', exp], check=True, capture_output=True)
                rep = json.load(open(os.path.join(d, 'build_report.json')))
                runs.append((rep, tree_hash(exp)))
            (r1, h1), (r2, h2) = runs
            self.assertEqual(r1['graph_hash'], r2['graph_hash'])
            for k in ('nodes', 'edges', 'signals'): self.assertEqual(r1[k], r2[k])
            self.assertEqual(h1, h2)
            self.assertGreater(len(h1), 900)
            # and it is the same graph as the one in the repository folder (the committed report)
            committed = os.path.join(GRAPH_DIR, 'build_report.json')
            if os.path.exists(committed): self.assertEqual(json.load(open(committed))['graph_hash'], r1['graph_hash'], 'build_report.json is out of date: run the pipeline')
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()
