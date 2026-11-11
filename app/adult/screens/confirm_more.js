// "Look for more skills" on the confirm screen (T4.5, tier 2). Nothing is downloaded until the person presses it; the label says how much.
// It adds "You may also have": skills that are NOT ticked, each with its resume line. Unused or failed, the screen is what tier 1 gave. Nothing is stored.
import { h, mount, clear } from '../dom.js';
import { megabytes, startScan, currentScan, currentLoad, isLoaded } from '../intake_embed.js';
import { strengthFromYear } from '../intake_profile.js';
import { makeAnnouncer } from '../announce.js';

// deps: { m (the confirm model), info (from tier2Info), index (skills index), skillRow(s) -> li, updateCount(), refreshChips(), nowYear }
export function moreSkillsBox(deps) {
  const { m, info, index, skillRow, updateCount, refreshChips, nowYear } = deps;
  const label = new Map(index.map(e => [e.id, e.label]));
  const size = megabytes(info.totalBytes);
  const lines = m.achievements || [];
  const WORDS_HERE = 'Look for more skills in your resume (runs on this device)';
  const btn = h('button', { type: 'button', class: 'btn', id: 'more-go' }, isLoaded() ? WORDS_HERE : 'Look for more skills in your resume (downloads about ' + size + ', runs on this device)');
  const keep = h('p', { class: 'hint', id: 'more-keep', hidden: isLoaded() }, 'Your browser usually keeps these files, so next time is quicker. It may remove them to save space.');
  const cancel = h('button', { type: 'button', class: 'btn small', id: 'more-cancel', hidden: true }, 'Cancel');
  const bar = h('progress', { id: 'more-progress', max: 100, value: 0, hidden: true, 'aria-label': 'Download progress' });
  // The visible text is NOT a live region (it changes too often). `live` speaks at the start, each 10 percent and the end (announce.js).
  const status = h('p', { id: 'more-status', class: 'status', tabindex: '-1' });
  const live = h('p', { id: 'more-live', class: 'sr', role: 'status', 'aria-live': 'polite' });
  const say = makeAnnouncer(t => { live.textContent = t; });
  const head = h('h3', { id: 'more-head', tabindex: '-1', hidden: true }, 'You may also have');
  const note = h('p', { class: 'hint', hidden: true }, 'These are only suggestions from the lines of your resume. Tick the skills you really have.');
  const list = h('ul', { class: 'skills', id: 'more-list' });

  function show() {
    const mine = m.skills.filter(s => s.suggested);
    mount(list, mine.map(skillRow));
    head.hidden = note.hidden = !mine.length;
  }
  const idle = () => { cancel.hidden = true; bar.hidden = true; };
  const ready = () => { btn.hidden = false; idle(); };

  // The answer goes into the model whether or not this screen is still on show (the person may have gone Back and Forward meanwhile).
  function apply(found) {
    for (const f of found) {
      if (!label.has(f.id) || m.skills.some(s => s.id === f.id)) continue;
      const src = lines.find(l => l.line === f.line);
      const role = src && src.roleIndex >= 0 ? m.roles[src.roleIndex] : null;
      const ly = role ? (role.current ? nowYear : role.endYear) : null;
      m.skills.push({ id: f.id, label: label.get(f.id), sourceLine: f.sourceLine, roleKey: role ? role.key : null, lastYear: Number.isInteger(ly) ? ly : null,
        strength: strengthFromYear(ly, nowYear), include: false, added: false, suggested: true, score: f.score });
    }
    m.suggestionsDone = true;
  }

  const downloadText = ev => ev.text === 'Downloading…' ? 'Downloading… ' + megabytes(ev.doneBytes) + ' of ' + size : ev.text;
  const downloadEvent = ev => {
    bar.setAttribute('aria-label', 'Download progress'); bar.value = Math.round(100 * ev.doneBytes / ev.totalBytes);
    const t = downloadText(ev); status.textContent = t; say.update(ev.text === 'Downloading…' ? 'download' : 'start', ev.doneBytes / ev.totalBytes, t);
  };

  // Follows a download already running without a scan of this screen (Back, then here again): no second button or download.
  function followLoad(l) {
    btn.hidden = true; cancel.hidden = false; bar.hidden = false;
    let on = true;
    const off = l.subscribe(ev => { if (on) downloadEvent(ev); });
    if (!l.last) { status.textContent = 'Getting ready…'; say.update('start', 0, 'Getting ready…'); }
    const back = text => {
      on = false; off(); if (!root.isConnected) return;
      status.textContent = text; say.finish(text); ready();
      if (isLoaded()) { btn.textContent = WORDS_HERE; keep.hidden = true; }
      if (document.activeElement === cancel || document.activeElement === document.body) btn.focus();
    };
    l.promise.then(() => back('The files are here. Press the button to look for more skills.'),
      () => back(l.cancelled ? 'Stopped. Your list is as it was. You can start again.' : 'We could not look for more skills. Your list is as it was. You can try again.'));
  }

  // Follows a scan (the one this button started, or one that was already running when the screen was drawn).
  function follow(sc) {
    btn.hidden = true; cancel.hidden = false; bar.hidden = false;
    let live_ = true;   // events after the answer must not overwrite it
    const off = sc.subscribe(ev => {
      if (!live_) return;
      if (ev.kind === 'download') downloadEvent(ev);
      else {
        bar.setAttribute('aria-label', 'Reading progress'); bar.value = Math.round(100 * ev.done / ev.total);
        const t = 'Reading your resume… ' + ev.done + ' of ' + ev.total + ' lines';
        status.textContent = t; say.update('read', ev.done / ev.total, t);
      }
    });
    if (!sc.last) { status.textContent = 'Getting ready…'; say.update('start', 0, 'Getting ready…'); }
    sc.promise.then(found => {
      live_ = false; off(); apply(found);
      if (!root.isConnected) return;
      show(); updateCount(); refreshChips();
      const n = m.skills.filter(s => s.suggested).length;
      const t = n ? 'We found ' + n + (n === 1 ? ' skill' : ' skills') + ' you may also have. None is ticked yet.' : 'We found nothing more. Your list is as it was.';
      status.textContent = t; say.finish(t);
      idle(); btn.hidden = true;
      (n ? head : status).focus();   // the button is gone, so keyboard focus goes to the answer
    }, () => {
      live_ = false; off();
      if (!root.isConnected) return;
      const t = sc.cancelled ? 'Stopped. Your list is as it was. You can start again.' : 'We could not look for more skills. Your list is as it was. You can try again.';
      status.textContent = t; say.finish(t);
      ready(); btn.focus();
    });
  }

  btn.addEventListener('click', () => {
    if (currentScan()) return;
    status.textContent = ''; follow(startScan(lines, { exclude: new Set(m.skills.map(s => s.id)), owner: m }));
    cancel.focus();   // the button is hidden now, so focus goes to the next control
  });
  cancel.addEventListener('click', () => { const sc = currentScan(), l = currentLoad(); if (sc) sc.cancel(); else if (l) l.cancel(); });

  const root = h('section', { id: 'more-skills', class: 'more', 'aria-labelledby': 'more-title' },
    h('h2', { id: 'more-title' }, 'Look for more skills'),
    h('p', null, 'Your resume may hint at skills it does not name. We can look for them.'),
    h('p', null, btn, ' ', cancel), keep, bar, status, live, head, note, list);
  const running = currentScan();
  if (m.suggestionsDone) { btn.hidden = true; show(); const n = m.skills.filter(s => s.suggested).length; status.textContent = n ? '' : 'We found nothing more. Your list is as it was.'; }
  else {
    if (running && running.owner === m) follow(running);   // the screen was drawn again while the scan runs: show where it is, with no second button
    else {
      if (running) running.orphan();                       // a scan for a resume that is gone: stop reading it, but let the download go on
      const l = currentLoad(); if (l) followLoad(l);
    }
  }
  return root;
}
