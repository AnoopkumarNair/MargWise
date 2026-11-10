// Reads text out of a resume file in Node, the way app/adult/intake_file.js does in the browser (same limits, same line joining).
// Used by the evaluation harness (eval_intake.mjs) only. The app never loads this file.
//   .txt  : UTF-8
//   .pdf  : the vendored pdf.js (hosting/public/vendor/pdfjs), page text joined with pageText() imported from intake_file.js
//   .docx : the vendored mammoth (hosting/public/vendor/mammoth), run in a vm context that looks enough like a browser window
// readFileNode(path) -> { text, kind } or throws an Error with a `code` (too_big | too_many_pages | unsupported | scanned | empty | unreadable).
// The messages never contain a path or a file name.
// If intake_file.js changes how it joins or checks text, change this file too: unit/eval_harness drift test compares the two sources.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { MAX_BYTES, MAX_PAGES, pageText } from '../../intake_file.js';

const VENDOR = fileURLToPath(new URL('../../../../hosting/public/vendor/', import.meta.url));
const MIN_CHARS_PER_PAGE = 40, MIN_CHARS_TOTAL = 120;   // same numbers as intake_file.js
const fail = code => Object.assign(new Error('could not read the file: ' + code), { code });

// The libraries print warnings (a missing canvas package) that have nothing to do with resumes: keep the console quiet while they load.
async function quiet(fn) {
  const keep = { warn: console.warn, log: console.log, error: console.error };
  console.warn = console.log = console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, keep); }
}

let pdfjs = null, mammoth = null;
async function loadPdfjs() {
  if (!pdfjs) pdfjs = await quiet(async () => {
    const m = await import(pathToFileURL(VENDOR + 'pdfjs/pdf.min.mjs').href);
    m.GlobalWorkerOptions.workerSrc = pathToFileURL(VENDOR + 'pdfjs/pdf.worker.min.mjs').href;
    return m;
  });
  return pdfjs;
}
function loadMammoth() {
  if (!mammoth) {
    const sb = { console, TextDecoder, TextEncoder, setTimeout, clearTimeout, Promise, Uint8Array, ArrayBuffer };
    sb.window = sb; sb.self = sb;
    vm.createContext(sb);
    vm.runInContext(readFileSync(VENDOR + 'mammoth/mammoth.browser.min.js', 'utf8'), sb);
    mammoth = sb.mammoth;
  }
  return mammoth;
}

function kindOf(name, head) {
  const n = String(name || '').toLowerCase();
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  if (head[0] === 0x50 && head[1] === 0x4b && n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.txt')) return 'txt';
  return null;
}

async function readPdf(buf) {
  const lib = await loadPdfjs();
  const task = lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useWorkerFetch: false, useSystemFonts: false, verbosity: 0 });
  let doc;
  try { doc = await quiet(() => task.promise); } catch (e) { try { task.destroy(); } catch (_) { /* nothing to free */ } throw fail('unreadable'); }
  try {
    if (doc.numPages > MAX_PAGES) throw fail('too_many_pages');
    const parts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      parts.push(pageText((await page.getTextContent()).items));
      page.cleanup();
    }
    const text = parts.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
    const compact = text.replace(/\s+/g, '');
    if (compact.length < MIN_CHARS_TOTAL && compact.length < MIN_CHARS_PER_PAGE * doc.numPages) throw fail('scanned');
    return { text };
  } catch (e) {
    if (e && e.code) throw e;
    throw fail('unreadable');
  } finally { try { await task.destroy(); } catch (_) { /* nothing to free */ } }
}

async function readDocx(buf) {
  try {
    const r = await loadMammoth().extractRawText({ arrayBuffer: buf });
    return { text: String(r.value || '').replace(/\n{2,}/g, '\n').trim() };
  } catch (e) { throw fail('unreadable'); }
}

export async function readFileNode(path) {
  let st; try { st = statSync(path); } catch (e) { throw fail('unreadable'); }
  if (st.size > MAX_BYTES) throw fail('too_big');
  let bytes; try { bytes = readFileSync(path); } catch (e) { throw fail('unreadable'); }
  const kind = kindOf(path, bytes.subarray(0, 8));
  if (!kind) throw fail('unsupported');
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const r = kind === 'pdf' ? await readPdf(buf) : kind === 'docx' ? await readDocx(buf) : { text: new TextDecoder('utf-8').decode(buf).trim() };
  if (r.text.replace(/\s+/g, '').length < 20) throw fail('empty');
  return { text: r.text, kind };
}
