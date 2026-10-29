// STAND-IN RESUME READER, TESTS ONLY. Used by `build.py --dev` only when app/adult/intake/read.js does not exist. Never copied by a release build.
// It is far simpler than the real reader (tier 1 in app/adult/intake/): one role per line that holds a year range, skills found by whole-word
// label match. It follows the same API, so the screens can be tested before the real reader lands. If it disagrees with the real one, the real one wins.
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9+# ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function readResume(text, { skillsIndex, titles, now }) {
  const lines = String(text).split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
  const looksLikeResume = lines.length >= 6 && /experience|skills|education|employment/i.test(text);
  const roles = [];
  const re = /(?:^|\D)((?:19|20)\d\d)\s*(?:-|–|to|till)\s*((?:19|20)\d\d|present|till date|now|current)/i;
  lines.forEach((l, i) => {
    const m = l.match(re); if (!m) return;
    const titleText = l.replace(re, ' ').replace(/[|,()-]+/g, ' ').replace(/\s+/g, ' ').trim() || (lines[i - 1] || '');
    const n = norm(titleText), hit = new Set();
    for (const t in titles) if (n && (n === t || n.includes(t))) for (const o of titles[t]) hit.add(o);
    const cur = /present|till date|now|current/i.test(m[2]);
    roles.push({ titleText, occCandidates: [...hit].slice(0, 4).map(o => ({ occ: o, label: o })), startYear: +m[1], endYear: cur ? null : +m[2], current: cur, lines: lines.slice(i + 1, i + 5) });
  });
  const skills = [];
  const low = ' ' + norm(text) + ' ';
  for (const s of skillsIndex) {
    const names = [s.label].concat(s.alt || []).map(norm).filter(x => x.length > 3);
    if (names.some(x => low.includes(' ' + x + ' '))) {
      const name = names.find(x => low.includes(' ' + x + ' '));
      const line = lines.find(l => (' ' + norm(l) + ' ').includes(' ' + name + ' ')) || '';
      const li = lines.indexOf(line);
      let roleIndex = -1;
      roles.forEach((r, ri) => { const ri0 = lines.findIndex(x => x.includes(r.titleText)); if (ri0 <= li) roleIndex = ri; });
      skills.push({ id: s.id, label: s.label, sourceLine: line, roleIndex, lastYear: roleIndex >= 0 ? (roles[roleIndex].endYear || now) : null, count: 1 });
    }
  }
  return { looksLikeResume, roles, skills, creds: [], warnings: [] };
}
export function suggestChips(slice, present) {
  const have = new Set(present);
  return slice.needs.slice().sort((a, b) => b.w - a.w).filter(n => !have.has(n.id)).slice(0, 12).map(n => ({ id: n.id, label: n.label }));
}
