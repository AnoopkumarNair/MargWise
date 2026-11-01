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

// S4: accounts. Exactly two files may send or store anything: account/api.js (the only code that calls the server) and account/session.js
// (the only code that touches storage: the session token and the invite code). The resume and what was read from it never reach either.
const ACCOUNT_FILES = ['account/api.js', 'account/session.js', 'account/sync.js', 'account/flow.js', 'account/save_box.js', 'account/nav.js', 'account/link.js', 'account/notice.js',
  'account/turnstile.js', 'account/age.js', 'screens/account.js', 'screens/signup.js', 'screens/login.js', 'screens/link.js', 'screens/saved.js', 'screens/welcome.js', 'screens/roads.js', 'app.js'];

test('nothing in the app writes to browser storage or keeps data in a cookie, cache or service worker, except the session token (account/session.js)', () => {
  const bad = /\b(localStorage|sessionStorage|indexedDB|openDatabase|document\.cookie|caches\.|serviceWorker|StorageManager|cookieStore|FileSystemFileHandle|showSaveFilePicker)\b/;
  for (const [f, s] of src) if (f !== 'account/session.js') assert.doesNotMatch(s, bad, f + ' touches storage');
  const sess = src.get('account/session.js');
  assert.deepEqual([...new Set(sess.match(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/g))], ['localStorage'], 'session.js uses localStorage only');
  assert.deepEqual([...sess.matchAll(/_KEY = '([a-z_]+)'/g)].map(m => m[1]).sort(), ['mw_adult_invite', 'mw_adult_token'], 'the only two keys');
});

test('the only network calls: a GET for a static file in data.js, and the account calls in account/api.js; nothing else can send', () => {
  for (const [f, s] of src) {
    assert.doesNotMatch(s, /\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|importScripts)\b/, f + ' can send');
    assert.doesNotMatch(s, /navigator\.share|new Request\(|FormData|\.postMessage\(/, f + ' can send or post');
    if (f !== 'data.js' && f !== 'account/api.js') assert.doesNotMatch(s, /\bfetch\s*\(/, f + ' calls fetch');
  }
  const a = src.get('account/api.js');
  assert.equal((a.match(/\bfetch\b/g) || []).length, 1, 'api.js has one fetch');
  assert.match(a, /'\/api\/v1' \+ path/); assert.match(a, /credentials: 'omit'/);
  // who may call the API: the account code, and nothing that touches the resume
  const callers = [...src].filter(([f, s]) => /from '(\.\.?\/)(account\/)?(api|sync)\.js'|from '\.\/(api|sync)\.js'/.test(s)).map(([f]) => f).sort();
  for (const f of callers) assert.ok(ACCOUNT_FILES.includes(f), f + ' calls the account code but is not on the list');
  for (const f of ACCOUNT_FILES.filter(x => x !== 'app.js')) assert.doesNotMatch(src.get(f), /state\.reading|sourceLine|titleText|readResume|readFileText|\.files\b|arrayBuffer/, f + ' must not touch the resume');
  for (const f of ['intake_file.js', 'intake_read.js', 'intake_profile.js', 'screens/intake.js', 'screens/confirm.js', 'screens/title.js', 'screens/skills.js']) assert.ok(!callers.includes(f), f + ' must not reach the account code');
  const d = src.get('data.js');
  assert.equal((d.match(/\bfetch\s*\(/g) || []).length, 1, 'data.js has one fetch');
  assert.doesNotMatch(d, /\b(method|body)\s*:/, 'the fetch has no method or body');
  assert.match(d, /credentials: 'omit'/);
});

test('imports and script loads are same-origin: no CDN, no remote URL, no eval', () => {
  for (const [f, s] of src) {
    if (f === 'account/turnstile.js') assert.deepEqual(s.match(/https?:\/\/[^'" ]+/g), ['https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'], 'only Turnstile');
    else assert.doesNotMatch(s, /https?:\/\//, f + ' names a remote URL');
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
