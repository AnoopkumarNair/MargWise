// Privacy, static part (TEST_PLAN layer 4; runs without a browser): the app's own code cannot store or send a resume.
//   node --test app/adult/tests/privacy/static.test.mjs
// The network and storage checks on a real journey are in journey.e2e.mjs (they need Playwright).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? (['tests', 'dev', 'node_modules'].includes(n) ? [] : walk(p)) : (p.endsWith('.js') ? [p] : []); });
const files = walk(APP);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');   // comments may mention these words
const src = new Map(files.map(f => [relative(APP, f), strip(readFileSync(f, 'utf8'))]));

test('the app code finds files to check', () => { assert.ok(files.length >= 20, 'files: ' + files.length); assert.ok(src.has('intake_file.js')); assert.ok(src.has('screens/confirm.js')); });

test('nothing in the app writes to browser storage or keeps data in a cookie, cache or service worker', () => {
  const bad = /\b(localStorage|sessionStorage|indexedDB|openDatabase|document\.cookie|caches\.|serviceWorker|StorageManager|cookieStore|FileSystemFileHandle|showSaveFilePicker)\b/;
  for (const [f, s] of src) assert.doesNotMatch(s, bad, f + ' touches storage');
});

test('the only network call is a GET for a static file, in data.js; nothing else can send', () => {
  for (const [f, s] of src) {
    assert.doesNotMatch(s, /\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|importScripts)\b/, f + ' can send');
    assert.doesNotMatch(s, /navigator\.share|new Request\(|FormData|\.postMessage\(/, f + ' can send or post');
    if (f !== 'data.js') assert.doesNotMatch(s, /\bfetch\s*\(/, f + ' calls fetch');
  }
  const d = src.get('data.js');
  assert.equal((d.match(/\bfetch\s*\(/g) || []).length, 1, 'data.js has one fetch');
  assert.doesNotMatch(d, /\b(method|body)\s*:/, 'the fetch has no method or body');
  assert.match(d, /credentials: 'omit'/);
});

test('imports and script loads are same-origin: no CDN, no remote URL, no eval', () => {
  for (const [f, s] of src) {
    assert.doesNotMatch(s, /https?:\/\//, f + ' names a remote URL');
    assert.doesNotMatch(s, /\beval\s*\(|new Function\s*\(|\.innerHTML\s*=|insertAdjacentHTML|document\.write/, f + ' runs or inserts code');
  }
  const file = src.get('intake_file.js');
  assert.match(file, /'\/vendor\/pdfjs\/pdf\.min\.mjs'/); assert.match(file, /'\/vendor\/mammoth\/mammoth\.browser\.min\.js'/);
});

test('the resume text is passed only to the reader, and the file only to intake_file.js', () => {
  const readers = [...src].filter(([, s]) => /readResume\s*\(/.test(s)).map(([f]) => f).filter(f => !f.startsWith('intake/'));
  assert.deepEqual(readers, ['intake_read.js']);
  const arr = [...src].filter(([, s]) => /arrayBuffer\s*\(|FileReader|\.files\b/.test(s)).map(([f]) => f).sort();
  assert.deepEqual(arr, ['intake_file.js', 'screens/intake.js']);
});

test('the profile is built from ids and bands: buildProfile never reads titles or source lines', () => {
  const s = src.get('state.js');
  const body = s.slice(s.indexOf('export function buildProfile'), s.indexOf('export function checkProfile'));
  assert.doesNotMatch(body, /titleText|sourceLine|\.lines|reading\./);
});
