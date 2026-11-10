"""Expected counts (TEST_PLAN layer 1): node and edge counts by kind may not move more than 2 percent unless the O*NET version changes.

When the pinned version changes, this test fails until expected_counts.json is rewritten (python3 data/graph/tests/test_expected_counts.py --write)
in the same commit, so the change and its size are visible in the review.
"""
import json, os, sys, unittest
from common import graph_paths, TESTS

EXPECTED = os.path.join(TESTS, 'expected_counts.json')
TOLERANCE = 0.02


def current():
    with open(graph_paths()[1], encoding='utf8') as f: r = json.load(f)
    return {'onet_version': r['onet_version'], 'nodes': r['nodes'], 'edges': r['edges'], 'signals': r['signals']}


class ExpectedCounts(unittest.TestCase):
    def test_counts_stay_put(self):
        with open(EXPECTED, encoding='utf8') as f: exp = json.load(f)
        cur = current()
        self.assertEqual(cur['onet_version'], exp['onet_version'], 'The pinned O*NET version changed: rewrite expected_counts.json in the same commit (--write) and review the counts')
        for group in ('nodes', 'edges', 'signals'):
            self.assertEqual(sorted(cur[group]), sorted(exp[group]), 'the kinds in %s changed' % group)
            for k, n in exp[group].items():
                self.assertLessEqual(abs(cur[group][k] - n), TOLERANCE * n, '%s %s: expected about %d, found %d' % (group, k, n, cur[group][k]))


if __name__ == '__main__':
    if '--write' in sys.argv:
        with open(EXPECTED, 'w', encoding='utf8') as f: json.dump(current(), f, indent=1, sort_keys=True); f.write('\n')
        print('wrote', EXPECTED)
    else:
        unittest.main()
