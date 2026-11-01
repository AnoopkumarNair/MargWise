// Sample resume files for the S3 tests, made fresh on every run into tests/out/samples/ (git-ignored). The people are invented, and every
// personal detail is a canary (a unique fake value) so the privacy tests can look for it. The richer fixture corpus is app/adult/tests/fixtures/
// (written by the intake lane); the tests use it too when it exists (see fixtures()).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const CANARIES = {
  email: 'canary.mail.7731@example.com', phone: '+91 98765 43210', pan: 'ABCDE1234F', aadhaar: '2345 6789 0123',
  name: 'Ravindran Canarypally', employer: 'Canaryworks Pvt Ltd', college: 'Canary Institute of Technology',
};

export const PAGE1 = [
  CANARIES.name,
  'Email: ' + CANARIES.email + ' | Phone: ' + CANARIES.phone,
  'PAN: ' + CANARIES.pan + ' | Aadhaar: ' + CANARIES.aadhaar,
  'Professional Summary',
  'Accountant with eight years of experience in finance operations. Good at Critical Thinking and Writing.',
  'Experience',
  'Accountant, ' + CANARIES.employer,
  'Jan 2019 - Present',
  '- Prepared the monthly books in Microsoft Excel and Tally accounting software.',
  '- Reconciled ledgers and reported on Economics and Accounting matters, and used Mathematics every day.',
  '- Worked in SAP enterprise software for the month-end close.',
  'Staff Accountant, Northwind Traders',
  '2014 - 2018',
  '- Kept the records in Tally accounting software and Microsoft Excel.',
  '- Reading Comprehension of contracts and Active Listening with the auditors.',
];
export const PAGE2 = [
  'Education',
  'B.Com, ' + CANARIES.college + ', 2014',
  'Skills',
  'Microsoft Excel, Tally accounting software, SAP enterprise software, Critical Thinking, Writing, Mathematics, Analyzing Data or Information',
  'Languages',
  'English, Hindi',
];
export const RESUME_LINES = PAGE1.concat(PAGE2);
export const RESUME_TEXT = RESUME_LINES.join('\n');

const NOT_RESUME = ['Tomato soup for four', 'Ingredients: six ripe tomatoes, one onion, two cloves of garlic, a spoon of butter, salt and pepper.',
  'Method: chop the onion and garlic and soften them in the butter. Add the tomatoes and a cup of water. Simmer for twenty minutes, then blend.',
  'Serve hot with bread. The soup keeps for two days in a cold place and can be warmed again on a low flame.',
  'A note on salt: add a little at the start and taste again at the end, because the soup grows saltier as it thickens.'];

const html = (body, css = '') => `<!doctype html><meta charset="utf-8"><style>body{font:12pt/1.5 Arial,Helvetica,sans-serif;margin:24px}p{margin:0 0 6px}.pb{page-break-before:always}${css}</style>${body}`;
const paras = ls => ls.map(l => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('');

export async function makeSamples(browser, outDir) {
  mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage();
  const pdf = async (name, body, css) => { await page.setContent(html(body, css)); const p = join(outDir, name); writeFileSync(p, await page.pdf({ format: 'A4', printBackground: true })); return p; };
  const out = {};
  out.pdf = await pdf('resume_two_page.pdf', paras(PAGE1) + '<div class="pb"></div>' + paras(PAGE2));
  out.notResume = await pdf('not_a_resume.pdf', paras(NOT_RESUME));
  // a scan: the text is drawn into a picture, so the PDF has no text layer
  await page.setContent('<canvas id="c" width="900" height="700"></canvas>');
  const png = await page.evaluate(lines => {
    const c = document.getElementById('c'), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 700); g.fillStyle = '#000'; g.font = '22px sans-serif';
    lines.forEach((l, i) => g.fillText(l, 20, 40 + i * 32)); return c.toDataURL('image/png');
  }, PAGE1.slice(0, 15));
  out.scanned = await pdf('scanned.pdf', `<img src="${png}" width="700">`);
  out.long = await pdf('eleven_pages.pdf', Array.from({ length: 11 }, (_, i) => `<div class="${i ? 'pb' : ''}">${paras(['Page ' + (i + 1) + ' of a very long document', ...NOT_RESUME])}</div>`).join(''));
  await page.close();
  const lj = join(outDir, 'lines.json'); writeFileSync(lj, JSON.stringify(RESUME_LINES));
  out.docx = join(outDir, 'resume.docx');
  const r = spawnSync('python3', [join(here, 'make_docx.py'), lj, out.docx], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('make_docx.py failed');
  out.txt = join(outDir, 'resume.txt'); writeFileSync(out.txt, RESUME_TEXT);
  out.tooBig = join(outDir, 'too_big.pdf'); writeFileSync(out.tooBig, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10, 32)]));
  out.legacy = join(outDir, 'old.doc'); writeFileSync(out.legacy, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]));
  return out;
}

// The intake lane's fixture corpus (app/adult/tests/fixtures/<name>/{resume.pdf|resume.docx, resume.txt, expected.json}), when it exists.
// Each item: { name, binary (the PDF or DOCX, or null), text (resume.txt, the text the file holds) }. A fixture without a binary is read as pasted text.
// canaries: every fake personal value in canaries.json (the base values and each fixture's own).
export function fixtures() {
  const dir = join(here, '..', 'fixtures');
  const items = [];
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).sort()) {
      const d = join(dir, name);
      if (name === 'gen' || !statSync(d).isDirectory()) continue;
      const bin = ['resume.pdf', 'resume.docx'].map(f => join(d, f)).find(existsSync) || null;
      const txt = join(d, 'resume.txt');
      const text = existsSync(txt) ? readFileSync(txt, 'utf8') : '';
      if (bin || text.trim()) items.push({ name, binary: bin, text });
    }
  }
  const canaries = [];
  const cj = join(dir, 'canaries.json');
  if (existsSync(cj)) {
    const j = JSON.parse(readFileSync(cj, 'utf8'));
    const walk = v => { if (typeof v === 'string') canaries.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(j.base); for (const f of Object.values(j.fixtures || {})) for (const [k, v] of Object.entries(f)) if (k !== 'in') walk(v);
  }
  return { dir, items, canaries: [...new Set(canaries)] };
}

// Gives one fixture to the intake screen (upload, or paste when it has no file) and waits for the confirm screen or a message.
// Returns 'confirm' or the message text.
export async function giveFixture(page, base, item) {
  await page.goto(base + '/work/#/intake');
  await page.locator('#resume-file').waitFor();
  if (item.binary) await page.locator('#resume-file').setInputFiles(item.binary);
  else {
    if (!(await page.locator('#paste-box').isVisible())) await page.locator('#show-paste').click();
    await page.locator('#resume-text').fill(item.text); await page.locator('#read-pasted').click();
  }
  await page.locator('h1:has-text("Check what we found"), #intake-error:not(:empty)').first().waitFor({ timeout: 60000 });
  if (await page.locator('h1:has-text("Check what we found")').count()) return 'confirm';
  return await page.locator('#intake-error').innerText();
}
