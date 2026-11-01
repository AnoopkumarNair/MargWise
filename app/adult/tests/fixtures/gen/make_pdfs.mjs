// Makes the PDF fixtures by printing HTML with Playwright's page.pdf(). Chromium only; no other dependency.
//   node app/adult/tests/fixtures/gen/make_pdfs.mjs [id ...]
// Input: fixtures/<id>/resume.txt (the text twin) and gen/layouts.json. Output: fixtures/<id>/resume.pdf.
// The twin is the text a correct extractor should see. The HTML only adds layout (columns, tables, a hidden paragraph, a picture).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = fileURLToPath(new URL('../', import.meta.url));
const layouts = JSON.parse(readFileSync(DIR + 'gen/layouts.json', 'utf8'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HEADING = /^(?:[A-Z][A-Z &/,'()-]{2,38}|Summary|Experience|Education|Skills|Contact|Top Skills|Languages|Certifications|सारांश.*|अनुभव.*|शिक्षा.*|कौशल.*|भाषाएँ)$/;

function body(lines, opt) {
  let out = ''; let list = false; let table = false; let first = true;
  const closeList = () => { if (list) { out += '</ul>'; list = false; } };
  const closeTable = () => { if (table) { out += '</table>'; table = false; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (opt.hiddenStartsWith && line.startsWith(opt.hiddenStartsWith)) { closeList(); closeTable(); out += `<p class="hid">${esc(line)}</p>`; continue; }
    if (opt.table && line.includes('\t')) {
      closeList();
      if (!table) { out += '<table>'; table = true; }
      out += '<tr>' + line.split('\t').map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
      continue;
    }
    closeTable();
    if (!line.trim()) { closeList(); out += '<div class="gap"></div>'; continue; }
    if (/^- /.test(line)) { if (!list) { out += '<ul>'; list = true; } out += `<li>${esc(line.slice(2))}</li>`; continue; }
    closeList();
    if (first) { out += `<h1>${esc(line)}</h1>`; first = false; continue; }
    if (HEADING.test(line.trim()) && line.trim().length < 40) { out += `<h2>${esc(line)}</h2>`; continue; }
    out += `<p>${esc(line)}</p>`;
  }
  closeList(); closeTable();
  return out;
}

function page(lines, cfg) {
  const font = cfg.devanagari ? "'FreeSans','DejaVu Sans',sans-serif" : cfg.serif ? "'DejaVu Serif',serif" : "'DejaVu Sans',Arial,sans-serif";
  const size = cfg.small ? 8.6 : 10;
  const css = `
    @page { size: A4; margin: 14mm 15mm; }
    body { font-family: ${font}; font-size: ${size}pt; line-height: 1.32; color: #111; margin: 0; }
    h1 { font-size: ${size + 8}pt; margin: 0 0 4px; } h2 { font-size: ${size + 1.5}pt; margin: 12px 0 4px; border-bottom: 1px solid #999; padding-bottom: 2px; }
    p { margin: 1px 0; } ul { margin: 2px 0 4px 16px; padding: 0; } li { margin: 1px 0; }
    .gap { height: 5px; } table { border-collapse: collapse; width: 100%; margin: 4px 0; } td { border: 1px solid #999; padding: 3px 6px; vertical-align: top; }
    .cols { display: grid; grid-template-columns: 31% 66%; gap: 3%; } .left { background: #f1efe9; padding: 8px; }
    .hid { color: #fff; font-size: 1px; line-height: 1px; margin: 0; }`;
  let inner;
  if (cfg.layout === 'two-column') {
    const at = lines.findIndex(l => l.trim() === cfg.splitBefore);
    if (at < 0) throw new Error('splitBefore not found: ' + cfg.splitBefore);
    inner = `<div class="cols"><div class="left">${body(lines.slice(0, at), { ...cfg, firstIsH2: true })}</div><div>${body(lines.slice(at), cfg)}</div></div>`;
  } else inner = body(lines, { ...cfg, table: cfg.layout === 'table' });
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${inner}</body></html>`;
}

const only = process.argv.slice(2);
const browser = await chromium.launch();
try {
  for (const id of Object.keys(layouts)) {
    const cfg = layouts[id];
    if (only.length && !only.includes(id)) continue;
    if (cfg.layout === 'docx' || cfg.layout === 'none') continue;
    const src = cfg.layout === 'scanned' ? cfg.source : 'resume.txt';
    const lines = readFileSync(DIR + id + '/' + src, 'utf8').replace(/\n$/, '').split('\n');
    const pg = await browser.newPage();
    if (cfg.layout === 'scanned') {
      // a picture of the page, no text layer: this is what a scanner makes
      await pg.setViewportSize({ width: 794, height: 1123 });
      await pg.setContent(page(lines, { ...cfg, layout: 'single' }));
      const jpg = await pg.screenshot({ type: 'jpeg', quality: 40, fullPage: false });
      await pg.setContent(`<!doctype html><html><body style="margin:0"><img src="data:image/jpeg;base64,${jpg.toString('base64')}" style="width:210mm;height:297mm;display:block"></body></html>`);
      await pg.pdf({ path: DIR + id + '/resume.pdf', format: 'A4', margin: { top: '0', bottom: '0', left: '0', right: '0' }, printBackground: true });
    } else {
      await pg.setContent(page(lines, cfg));
      await pg.pdf({ path: DIR + id + '/resume.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
    }
    await pg.close();
    console.log(id + '/resume.pdf', statSync(DIR + id + '/resume.pdf').size, 'bytes');
  }
} finally { await browser.close(); }
