// What a screen reader hears while tier 2 works (S5 review S2): a few spoken updates, not one for every network chunk or sentence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAnnouncer } from '../../announce.js';

test('a phase speaks when it starts and each time it passes another 10 percent, and says nothing in between', () => {
  const said = []; const a = makeAnnouncer(t => said.push(t));
  let calls = 0;
  for (let i = 0; i <= 1000; i++) { calls++; a.update('download', i / 1000, 'd ' + i); }
  assert.equal(calls, 1001);
  assert.ok(said.length <= 11 && said.length >= 10, 'download: ' + said.length + ' spoken of ' + calls);
  assert.equal(said[0], 'd 0');
  assert.equal(said[said.length - 1], 'd 1000');
});

test('the second phase starts again, and a repeat of the same text step is not spoken twice', () => {
  const said = []; const a = makeAnnouncer(t => said.push(t));
  a.update('download', 0.5, 'd'); a.update('download', 0.52, 'd2'); a.update('read', 0.01, 'r0'); a.update('read', 0.05, 'r5'); a.update('read', 0.11, 'r11');
  assert.deepEqual(said, ['d', 'r0', 'r11']);
});

test('finish always speaks, and a new run after it starts from the beginning', () => {
  const said = []; const a = makeAnnouncer(t => said.push(t));
  a.update('read', 0.99, 'almost'); a.finish('done'); a.update('read', 0.3, 'again');
  assert.deepEqual(said, ['almost', 'done', 'again']);
});

test('odd numbers do not break it', () => {
  const said = []; const a = makeAnnouncer(t => said.push(t));
  a.update('x', NaN, 'nan'); a.update('x', -1, 'neg'); a.update('x', 7, 'big');
  assert.deepEqual(said, ['nan', 'big']);
});
