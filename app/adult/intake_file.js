// Reads text out of a resume file on the device (BUILD_PLAN T4.3). The file is never uploaded: there is no request here that carries it.
// The only network use is a same-origin GET for the two libraries, and only after the person has chosen a file:
//   PDF  : /vendor/pdfjs/pdf.min.mjs + pdf.worker.min.mjs (pdfjs-dist, legacy browser build; the worker is a same-origin file, CSP worker-src 'self')
//   DOCX : /vendor/mammoth/mammoth.browser.min.js
// The text goes back to the caller and is kept in memory only. Nothing is written to storage.
//
// readFileText(file) -> { text, pages, kind } or throws FileProblem with a plain `message` and a `code`:
//   too_big | too_many_pages | unsupported | scanned | empty | unreadable

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PAGES = 10;
const MIN_CHARS_PER_PAGE = 40;   // fewer than this on average (and under MIN_CHARS_TOTAL) means a scan: pictures of text
const MIN_CHARS_TOTAL = 120;
export const PDFJS = '/vendor/pdfjs/pdf.min.mjs';
export const PDFJS_WORKER = '/vendor/pdfjs/pdf.worker.min.mjs';
export const MAMMOTH = '/vendor/mammoth/mammoth.browser.min.js';

export class FileProblem extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const PASTE = ' You can paste the text of your resume instead, or type your job title.';
export const MESSAGES = {
  too_big: 'That file is larger than 5 MB.' + PASTE,
  too_many_pages: 'That file has more than 10 pages, and we read up to 10.' + PASTE,
  unsupported: 'We can read PDF and Word (DOCX) files. Save your resume as one of those,' + PASTE.toLowerCase(),
  scanned: 'This PDF looks like a scan: it is a picture of text, so there is no text to read on your device. Paste the text of your resume instead, or type your job title.',
  empty: 'We found no text in that file.' + PASTE,
  unreadable: 'We could not open that file. It may be damaged or locked with a password.' + PASTE,
};
const fail = code => new FileProblem(code, MESSAGES[code]);

function kindOf(file, head) {
  const name = String(file.name || '').toLowerCase();
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;   // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b;                                              // PK (DOCX is a zip)
  if (isPdf) return 'pdf';
  if (isZip && name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  return null;
}

function loadScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => ok(); s.onerror = () => no(new Error('could not load ' + src));
    document.head.appendChild(s);
  });
}

// Joins the pieces of one PDF page into lines. pdf.js marks the end of a line (hasEOL); a jump in the vertical position also starts a new line.
export function pageText(items) {
  let out = '', lastY = null;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const y = it.transform ? it.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    out += it.str;
    if (it.hasEOL) out += '\n';
    if (y !== null) lastY = y;
  }
  return out;
}

async function readPdf(buf) {
  let pdfjs;
  try {
    pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  } catch (e) { throw fail('unreadable'); }
  // No eval, no font loading, no remote fetches: this only asks for the text.
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useWorkerFetch: false, useSystemFonts: false, verbosity: 0 });
  let doc;
  try { doc = await task.promise; } catch (e) { try { task.destroy(); } catch (_) { /* nothing to free */ } throw fail('unreadable'); }
  try {
    if (doc.numPages > MAX_PAGES) throw fail('too_many_pages');
    const parts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      parts.push(pageText(tc.items));
      page.cleanup();
    }
    const text = parts.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
    const compact = text.replace(/\s+/g, '');
    if (compact.length < MIN_CHARS_TOTAL && compact.length < MIN_CHARS_PER_PAGE * doc.numPages) throw fail('scanned');
    return { text, pages: doc.numPages };
  } catch (e) {
    if (e instanceof FileProblem) throw e;
    throw fail('unreadable');
  } finally { try { await task.destroy(); } catch (_) { /* nothing to free */ } }
}

async function readDocx(buf) {
  try {
    if (!window.mammoth) await loadScript(MAMMOTH);
    const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
    // mammoth puts a blank line between paragraphs; a resume line is one paragraph, so a single line break is closer to how a PDF reads
    return { text: String(r.value || '').replace(/\n{2,}/g, '\n').trim(), pages: null };
  } catch (e) { throw fail('unreadable'); }
}

export async function readFileText(file) {
  if (!file) throw fail('unsupported');
  if (file.size > MAX_BYTES) throw fail('too_big');
  let buf;
  try { buf = await file.arrayBuffer(); } catch (e) { throw fail('unreadable'); }
  const kind = kindOf(file, new Uint8Array(buf, 0, Math.min(8, buf.byteLength)));
  if (!kind) throw fail('unsupported');
  let r;
  if (kind === 'pdf') r = await readPdf(buf);
  else if (kind === 'docx') r = await readDocx(buf);
  else r = { text: new TextDecoder('utf-8').decode(buf).trim(), pages: null };
  if (r.text.replace(/\s+/g, '').length < 20) throw fail('empty');
  return { text: r.text, pages: r.pages, kind };
}
