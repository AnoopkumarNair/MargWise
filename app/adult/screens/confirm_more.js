// "Look for more skills" on the confirm screen (T4.5, tier 2). One plain action. Nothing is downloaded until the person presses it, and its label
// says how much it downloads. It adds a group "You may also have" of skills that are NOT ticked: the person ticks the ones that are true.
// Each one shows the line of the resume it came from. If the person never presses it, or it fails, the screen is exactly what tier 1 gave.
// The choice is remembered for this visit only (the group stays while the confirm model is in memory); nothing is stored.
import { h, mount, clear } from '../dom.js';
import { megabytes, findMoreSkills } from '../intake_embed.js';
import { strengthFromYear } from '../intake_profile.js';

// deps: { m (the confirm model), info (from tier2Info), index (skills index), skillRow(s) -> li, updateCount(), refreshChips(), nowYear }
export function moreSkillsBox(deps) {
  const { m, info, index, skillRow, updateCount, refreshChips, nowYear } = deps;
  const label = new Map(index.map(e => [e.id, e.label]));
  const size = megabytes(info.totalBytes);
  const btn = h('button', { type: 'button', class: 'btn', id: 'more-go' }, 'Look for more skills in your resume (downloads ' + size + ' once, runs on this device)');
  const bar = h('progress', { id: 'more-progress', max: 100, value: 0, hidden: true, 'aria-label': 'Download progress' });
  const status = h('p', { id: 'more-status', class: 'status', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
  const head = h('h3', { id: 'more-head', tabindex: '-1', hidden: true }, 'You may also have');
  const note = h('p', { class: 'hint', hidden: true }, 'These are only suggestions from the lines of your resume. Tick the skills you really have.');
  const list = h('ul', { class: 'skills', id: 'more-list' });
  const done = m.suggestionsDone || false;

  function show() {
    const mine = m.skills.filter(s => s.suggested);
    mount(list, mine.map(skillRow));
    head.hidden = note.hidden = !mine.length;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true; bar.hidden = false; bar.value = 0; status.textContent = 'Getting ready…';
    let live = true;   // a download that is still ending must not overwrite the answer below
    try {
      const have = new Set(m.skills.map(s => s.id));
      const lines = m.achievements || [];
      const found = await findMoreSkills(lines, {
        exclude: have,
        onStatus: p => { if (!live) return; bar.value = Math.round(100 * p.doneBytes / p.totalBytes); status.textContent = p.text === 'Downloading…' ? 'Downloading… ' + megabytes(p.doneBytes) + ' of ' + size : p.text; },
        onProgress: (d, t) => { if (live) status.textContent = 'Reading your resume… ' + d + ' of ' + t + ' lines'; },
      });
      for (const f of found) {
        if (!label.has(f.id) || m.skills.some(s => s.id === f.id)) continue;
        const src = lines.find(l => l.line === f.line);
        const role = src && src.roleIndex >= 0 ? m.roles[src.roleIndex] : null;
        const ly = role ? (role.current ? nowYear : role.endYear) : null;
        m.skills.push({ id: f.id, label: label.get(f.id), sourceLine: f.sourceLine, roleKey: role ? role.key : null, lastYear: Number.isInteger(ly) ? ly : null,
          strength: strengthFromYear(ly, nowYear), include: false, added: false, suggested: true, score: f.score });
      }
      live = false; m.suggestionsDone = true;
      show(); updateCount(); refreshChips();
      const n = m.skills.filter(s => s.suggested).length;
      status.textContent = n ? 'We found ' + n + (n === 1 ? ' skill' : ' skills') + ' you may also have. None is ticked yet.' : 'We found nothing more. Your list is as it was.';
      bar.hidden = true; btn.hidden = true;
      (n ? head : status).focus();   // the button is gone, so keyboard focus goes to the answer
    } catch (e) {
      live = false;
      status.textContent = 'We could not look for more skills. Your list is as it was. You can try again.';
      bar.hidden = true; btn.disabled = false; btn.focus();
    }
  });

  const root = h('section', { id: 'more-skills', class: 'more', 'aria-labelledby': 'more-title' },
    h('h2', { id: 'more-title' }, 'Look for more skills'),
    h('p', null, 'Your resume may hint at skills it does not name. We can look for them.'),
    h('p', null, btn), bar, status, head, note, list);
  if (done) { btn.hidden = true; show(); const n = m.skills.filter(s => s.suggested).length; status.textContent = n ? '' : 'We found nothing more. Your list is as it was.'; }
  return root;
}
