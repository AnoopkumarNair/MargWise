// Screen 4 (SPEC 8): how to start. Upload a resume (recommended), paste text, or type a job title.
// S3 reads on the device only. The file and the text go to the reader in this page and nowhere else; no request carries them.
import { h } from '../dom.js';
import { state, resetPick } from '../state.js';
import { readFileText, FileProblem, MAX_BYTES } from '../intake_file.js';
import { readResumeText, warmReader } from '../intake_read.js';

export function title() { return 'Start with your resume'; }

const MAX_PASTE = 60000;   // about ten pages of text
const NOT_RESUME = 'This does not look like a resume, so we did not read it. Check that you chose the right file, paste your resume text, or type your job title instead.';
const NOTHING_FOUND = 'We read the text but found no jobs or skills in it. Paste the text of your resume instead, or type your job title.';

export async function render() {
  resetPick(); state.path = null;   // arriving here starts a new pick: nothing from an earlier resume stays
  const status = h('p', { id: 'intake-status', class: 'status', role: 'status', 'aria-live': 'polite' });
  const err = h('p', { id: 'intake-error', class: 'error', role: 'alert' });
  const file = h('input', { type: 'file', id: 'resume-file', accept: '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain', 'aria-describedby': 'file-hint' });
  const area = h('textarea', { id: 'resume-text', rows: 10, maxLength: MAX_PASTE + 1, spellcheck: false, autocomplete: 'off', 'aria-describedby': 'paste-hint' });
  const readBtn = h('button', { type: 'button', class: 'btn primary', id: 'read-pasted' }, 'Read this text');
  const pasteBox = h('div', { id: 'paste-box', hidden: true },
    h('label', { for: 'resume-text', class: 'lbl' }, 'Paste the text of your resume'),
    h('p', { id: 'paste-hint', class: 'hint' }, 'Copy it from your resume and paste it here. It is not saved or sent anywhere.'),
    area, h('p', null, readBtn));
  const pasteBtn = h('button', { type: 'button', class: 'btn', id: 'show-paste', 'aria-expanded': 'false', 'aria-controls': 'paste-box' }, 'Paste text');
  const controls = [file, pasteBtn, readBtn];

  function busy(on) { for (const c of controls) c.disabled = on; root.setAttribute('aria-busy', String(on)); }
  function showPaste(focus) { pasteBox.hidden = false; pasteBtn.setAttribute('aria-expanded', 'true'); if (focus) area.focus(); }
  function problem(msg, openPaste) { err.textContent = msg; status.textContent = ''; busy(false); if (openPaste) showPaste(true); }

  // text -> reader -> confirm screen. The text is not kept: only what the reader found stays in memory.
  async function process(text, t0, extractMs) {
    err.textContent = '';
    status.textContent = 'Reading your resume on this device…';
    let model;
    try { model = await readResumeText(text); } catch (e) { problem('We could not read it. Check your connection and try again, or type your job title instead.', false); return; }
    area.value = '';
    if (!model.looksLikeResume) { problem(NOT_RESUME, false); return; }
    if (!model.roles.length && !model.skills.length) { problem(NOTHING_FOUND, true); return; }
    model.timing = { extractMs, totalMs: Math.round(performance.now() - t0) };
    state.reading = model; state.path = 'resume';
    location.hash = '#/confirm';
  }

  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    err.textContent = ''; busy(true);
    const t0 = performance.now();
    status.textContent = 'Opening your file on this device…';
    let r;
    try { r = await readFileText(f); } catch (e) {
      file.value = '';
      if (e instanceof FileProblem) problem(e.message, e.code === 'scanned' || e.code === 'unreadable' || e.code === 'empty' || e.code === 'too_many_pages' || e.code === 'too_big');
      else problem('We could not open that file. Paste the text of your resume instead, or type your job title.', true);
      return;
    }
    file.value = '';   // the file is not needed again
    await process(r.text, t0, Math.round(performance.now() - t0));
  });
  pasteBtn.addEventListener('click', () => { if (pasteBox.hidden) showPaste(true); else { pasteBox.hidden = true; pasteBtn.setAttribute('aria-expanded', 'false'); } });
  readBtn.addEventListener('click', async () => {
    const text = area.value;
    if (text.trim().length < 40) { err.textContent = 'Paste more of your resume. We need at least a few lines.'; return; }
    if (text.length > MAX_PASTE) { err.textContent = 'That is longer than we read (about 10 pages). Paste the most recent jobs only.'; return; }
    err.textContent = ''; busy(true);
    await process(text, performance.now(), 0);
  });

  const root = h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'Start with your resume'),
    h('p', { class: 'privacy' }, h('strong', null, 'Your resume is read in your browser. Nothing leaves your device.'),
      ' We do not upload it, store it or send it anywhere. Close the tab and it is gone.'),
    h('div', { class: 'choice rec' },
      h('h2', null, 'Upload your resume ', h('span', { class: 'tag rec-tag' }, 'Recommended')),
      h('label', { for: 'resume-file', class: 'lbl' }, 'Choose a PDF or Word (DOCX) file'),
      h('p', { id: 'file-hint', class: 'hint' }, 'Up to 5 MB and 10 pages. A scanned picture of a resume cannot be read; paste its text instead.'),
      file),
    h('div', { class: 'choice' },
      h('h2', null, 'Or paste the text'),
      h('p', null, pasteBtn), pasteBox),
    h('div', { class: 'choice' },
      h('h2', null, 'No resume'),
      h('p', null, h('a', { class: 'btn', href: '#/title', id: 'choose-title' }, 'No resume: type your job title'))),
    status, err,
    h('h2', { class: 'small' }, 'How we read it'),
    h('p', { class: 'hint' }, 'We match the words in your resume against a list of job skills. We do not use AI to read it. We can miss skills your resume only hints at, and you check and fix everything on the next screen.'),
    h('p', null, h('a', { href: '#/' }, 'Back')));
  // Once the screen is showing, get the dictionaries and the reader ready while the person picks a file.
  setTimeout(() => warmReader().then(() => { root.setAttribute('data-warm', 'done'); }), 150);
  return root;
}
