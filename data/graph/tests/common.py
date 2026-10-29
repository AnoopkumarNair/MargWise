"""Shared by the graph tests: paths, and a graph to test against.

If data/graph/graph.sqlite exists (the pipeline built it) it is used. Otherwise the graph is built once into a temp folder.
"""
import os, subprocess, sys, tempfile, warnings

warnings.simplefilter('ignore', ResourceWarning)   # the tests read small JSON files with a bare open()

TESTS = os.path.dirname(os.path.abspath(__file__))
GRAPH_DIR = os.path.abspath(os.path.join(TESTS, '..'))
ROOT = os.path.abspath(os.path.join(GRAPH_DIR, '..', '..'))
sys.path.insert(0, GRAPH_DIR)
sys.path.insert(0, os.path.join(ROOT, 'pipeline'))
_built = {}


def graph_paths():
    """(graph.sqlite, build_report.json, exports dir)"""
    real = os.path.join(GRAPH_DIR, 'graph.sqlite')
    if os.path.exists(real): return real, os.path.join(GRAPH_DIR, 'build_report.json'), GRAPH_DIR
    if 'p' not in _built:
        d = tempfile.mkdtemp(prefix='graphtest_')
        subprocess.run([sys.executable, os.path.join(GRAPH_DIR, 'build_graph.py'), '--out', os.path.join(d, 'graph.sqlite'), '--report', os.path.join(d, 'build_report.json')], check=True, capture_output=True)
        _built['p'] = (os.path.join(d, 'graph.sqlite'), os.path.join(d, 'build_report.json'), None)
    return _built['p']
