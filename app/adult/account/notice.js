// The sign-up notice. The words live in app/adult/notice.md (the owner approves that file); this reads and shows it.
// Format: "# title", "## heading", "- bullet", plain paragraphs, and under "The two ticks" the lines "[required] ..." and "[optional] ...".
// A line with [[...]] is a blank the owner still has to fill in. In a real build the page refuses to take consent while one is left.
import { h } from '../dom.js';

export function parseNotice(md) {
  const out = { title: '', blocks: [], consent: '', research: '', blanks: /\[\[[^\]]+\]\]/.test(md) };
  let list = null;
  for (const raw of String(md).split('\n')) {
    const line = raw.trim();
    if (!line || /^<!--.*-->$/.test(line)) { list = null; continue; }
    let m;
    if ((m = /^\[required\]\s+(.+)$/.exec(line))) { out.consent = m[1]; list = null; }
    else if ((m = /^\[optional\]\s+(.+)$/.exec(line))) { out.research = m[1]; list = null; }
    else if ((m = /^#\s+(.+)$/.exec(line))) { out.title = m[1]; list = null; }
    else if ((m = /^##\s+(.+)$/.exec(line))) { if (!/^the two ticks$/i.test(m[1])) out.blocks.push({ t: 'h', text: m[1] }); list = null; }
    else if ((m = /^-\s+(.+)$/.exec(line))) { if (!list) { list = { t: 'ul', items: [] }; out.blocks.push(list); } list.items.push(m[1]); }
    else { out.blocks.push({ t: 'p', text: line }); list = null; }
  }
  return out;
}
export const noticeComplete = n => !!(n && n.title && n.blocks.length && n.consent && n.research);

let cached = null;
export function loadNotice() { return cached || (cached = import('../data.js').then(d => d.loadText('notice.md')).then(parseNotice).catch(e => { cached = null; throw e; })); }

export function renderNotice(n) {
  return h('div', { class: 'notice', id: 'notice' }, n.blocks.map(b => b.t === 'h' ? h('h3', null, b.text) : b.t === 'ul' ? h('ul', { class: 'plain' }, b.items.map(i => h('li', null, i))) : h('p', null, b.text)));
}
