// Writes fixtures/canaries.json: the canary values (TEST_PLAN layer 4) as they appear in each fixture, found by pattern in the text twin.
//   node app/adult/tests/fixtures/gen/make_canaries.mjs
// The privacy tests use this file to look for these exact strings. Each fixture must hold every kind (the intake tests check that).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../', import.meta.url));
const BASE = {
  email: 'canary.mail.7731@example.com',
  phone: '+91 98765 43210',
  pan: 'ABCDE1234F',
  aadhaar: '2345 6789 0123',
  name: 'Ravindran Canarypally',
  employer: 'Canaryworks Pvt Ltd',
  college: 'Canary Institute of Technology',
};
// How each value may be written. The fixtures vary the spelling on purpose (case, dashes, spaces).
const PATTERNS = {
  email: 'canary\\.mail\\.7731@example\\.com',
  phone: '(?:\\+?91[\\s-]?)?98765[\\s-]?43210',
  pan: 'ABCDE1234F',
  aadhaar: '2345[\\s-]?6789[\\s-]?0123',
  name: 'ravindran canarypally|रविन्द्रन कैनरीपल्ली',
  employer: 'canaryworks pvt ltd',
  college: 'canary institute of technology',
};

const out = { note: 'Fake values for the privacy tests. Nothing here belongs to a real person.', base: BASE, patterns: PATTERNS, fixtures: {} };
for (const id of readdirSync(DIR).sort()) {
  if (!existsSync(DIR + id + '/expected.json')) continue;
  // a scanned page has its canaries in the picture; visible.txt is the text that was drawn
  const file = existsSync(DIR + id + '/visible.txt') ? 'visible.txt' : 'resume.txt';
  const text = readFileSync(DIR + id + '/' + file, 'utf8');
  const entry = { in: file === 'visible.txt' ? 'image' : 'text' };
  for (const [kind, src] of Object.entries(PATTERNS)) {
    const found = [...new Set([...text.matchAll(new RegExp(src, 'gi'))].map(m => m[0]))].sort();
    entry[kind] = found;
  }
  out.fixtures[id] = entry;
}
writeFileSync(DIR + 'canaries.json', JSON.stringify(out, null, 2) + '\n');
console.log('canaries.json:', Object.keys(out.fixtures).length, 'fixtures');
