// Source-level rules for the app (BACKEND ADR-13, CLAUDE.md): no HTML-from-strings, no inline scripts or styles, no CDNs, nothing stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const js = [...readdirSync(root).filter(f => f.endsWith('.js')).map(f => f), ...readdirSync(new URL('screens/', root)).map(f => 'screens/' + f)];
const src = f => readFileSync(new URL(f, root), 'utf8');

test('no innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or Function()', () => {
  for (const f of js) {
    const code = src(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const bad of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'setTimeout("', "setAttribute('style'", 'setAttribute("style"'])
      assert.ok(!code.includes(bad), f + ' uses ' + bad);
  }
});

test('nothing is stored in the browser or sent anywhere in S1', () => {
  for (const f of js) {
    const code = src(f);
    for (const bad of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'sendBeacon', 'XMLHttpRequest', "method: 'POST'", 'WebSocket'])
      assert.ok(!code.includes(bad), f + ' uses ' + bad);
  }
});

test('index.html has no inline script, no inline style, no event attributes and loads nothing from another origin', () => {
  const html = src('index.html');
  assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html), 'inline script');
  assert.ok(!/<style/i.test(html) && !/\sstyle=/i.test(html), 'inline style');
  assert.ok(!/\son[a-z]+=/i.test(html), 'event attribute');
  assert.ok(!/(src|href)=["']https?:/i.test(html), 'external URL');
});

test('styles.css and the JS modules load nothing from another origin', () => {
  assert.ok(!/url\(\s*["']?https?:/i.test(src('styles.css')));
  assert.ok(!/@import/.test(src('styles.css')));
  for (const f of js) assert.ok(!/(from|import)\s*\(?\s*['"]https?:/.test(src(f)), f);
});
