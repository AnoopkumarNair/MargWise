// Tiny DOM helper. Strings become text nodes. There is no innerHTML anywhere in the app (BACKEND ADR-13):
// graph labels, typed titles and other data are only ever shown as text.
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v === false || v == null) continue;
    if (k === 'style' || k.slice(0, 2) === 'on') throw new Error('Use classes and addEventListener, not ' + k);
    if (k === 'class') e.className = v;
    else if (k in e && k !== 'list' && k !== 'form') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  add(e, kids);
  return e;
}
function add(e, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(e, c);
    else e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
export function mount(root, ...kids) { clear(root); add(root, kids); }
