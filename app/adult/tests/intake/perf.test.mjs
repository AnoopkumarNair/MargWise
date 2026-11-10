// TEST_PLAN layer 8 budget: tier 1 on the 2-page fixture takes at most 2 s on a desktop, from a cold start
// (the dictionary build is part of the time). This file runs in its own process, so nothing is warm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readResume } from '../../intake/read.js';
import { loadGraph } from '../lib/graph.mjs';
import { loadFixture, NOW } from '../lib/fixtures.mjs';

test('cold tier 1 on the 2-page fixture is under 2 s; warm runs are far faster', () => {
  const g = loadGraph(); // the files are loaded before the clock starts: reading them is the network's job in the browser
  const f = loadFixture('single_col');
  assert.ok(f.text.length > 4000, 'the fixture is a real 2-page resume: ' + f.text.length + ' characters');
  const t0 = performance.now();
  const r = readResume(f.text, { ...g, now: NOW });
  const cold = performance.now() - t0;
  const t1 = performance.now();
  for (let i = 0; i < 20; i++) readResume(f.text, { ...g, now: NOW });
  const warm = (performance.now() - t1) / 20;
  console.log(`cold ${Math.round(cold)} ms (includes building the dictionary), warm ${warm.toFixed(1)} ms per read, ${r.skills.length} skills`);
  assert.ok(cold < 2000, 'cold ' + cold);
  assert.ok(warm < 200, 'warm ' + warm);
});

test('the 10-page fixture is also fast', () => {
  const g = loadGraph();
  const f = loadFixture('ten_page');
  const t0 = performance.now();
  readResume(f.text, { ...g, now: NOW });
  assert.ok(performance.now() - t0 < 2000);
});

test('a very long paste is cut, not slow', () => {
  const g = loadGraph();
  const big = 'Python and SQL and Tableau. '.repeat(50000);
  const t0 = performance.now();
  const r = readResume(big, { ...g, now: NOW });
  assert.ok(performance.now() - t0 < 3000);
  assert.ok(r.warnings.some(w => w.code === 'truncated'));
});
