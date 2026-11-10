// Line and section helpers for reading a resume (BUILD_PLAN T4.4). Pure functions: no DOM, no Date, no network.
// Text stays in memory only. Nothing here stores or sends it.

export function splitLines(text) {
  return String(text == null ? '' : text).replace(/\n?\f\n?/g, '\n').split(/\r\n|\r|\n|\u2028|\u2029|\v/);
}

// Section headings. Each kind lists the phrases (lower case, letters and spaces only) that name it.
const HEADINGS = {
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history',
    'professional background', 'relevant experience', 'experience summary', 'internships', 'internship', 'अनुभव', 'कार्य अनुभव'],
  education: ['education', 'academic', 'academics', 'qualifications', 'educational qualification', 'educational qualifications',
    'academic qualification', 'academic qualifications', 'academic background', 'education and training', 'शिक्षा'],
  skills: ['skills', 'skill', 'technical skills', 'key skills', 'core skills', 'core competencies', 'competencies', 'technologies', 'tools',
    'tools and technologies', 'technical proficiency', 'areas of expertise', 'expertise', 'skills and tools', 'software skills', 'it skills',
    'skill set', 'technical expertise', 'top skills', 'tech stack', 'कौशल'],
  projects: ['projects', 'academic projects', 'key projects', 'personal projects', 'project work'],
  certs: ['certifications', 'certification', 'certificates', 'licenses', 'licenses and certifications', 'courses', 'training', 'trainings',
    'professional certifications', 'courses and certifications'],
  summary: ['summary', 'professional summary', 'profile', 'career objective', 'objective', 'about', 'about me', 'career summary', 'executive summary'],
  personal: ['personal details', 'personal information', 'personal profile', 'personal data', 'declaration', 'contact', 'contact information', 'details'],
  other: ['achievements', 'awards', 'languages', 'languages known', 'interests', 'hobbies', 'references', 'publications',
    'extra curricular activities', 'strengths', 'activities', 'honors and awards', 'volunteering', 'भाषा', 'भाषाएँ', 'भाषाएं'],
};
const HEADING_LOOKUP = new Map();
for (const kind in HEADINGS) for (const p of HEADINGS[kind]) HEADING_LOOKUP.set(p, kind);

// "WORK EXPERIENCE", "Experience:", "## Skills", "3. Education" -> the kind, or null.
export function headingKind(line) {
  const t = String(line).trim();
  if (!t || t.length > 40) return null;
  const tryKey = k => HEADING_LOOKUP.get(k) || null;
  const paren = /^(.*?)\s*[(\[]\s*(.+?)\s*[)\]]\s*:?$/u.exec(t);
  if (paren) { const a = headingKind(paren[1]) || headingKind(paren[2]); if (a) return a; }
  const key = t.replace(/^[\s#*•\-–—_=|\d.)(]+/, '').replace(/[\s:#*_=\-–—|]+$/, '').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{M}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!key || key.split(' ').length > 5) return null;
  return tryKey(key);
}

// A line such as "Technical skills: Python, SQL" is a skills list even without a heading above it.
const SKILL_LABEL = /^\s*(?:[•*\-–]\s*)?(?:technical\s+skills?|skills?|key\s+skills?|tools?(?:\s+and\s+technologies)?|technologies|software|tech\s+stack|programming\s+languages?|languages\s*(?:&|and)\s*tools|core\s+competencies|competencies|skills\s*(?:&|and)\s*tools)\s*[:\-–—]\s*\S/i;
export function isSkillListLine(line) { return SKILL_LABEL.test(line); }

// For each line: { kind: section name or 'none', heading: bool, skillList: bool }.
// A skills section is the lines under a skills heading until the next heading.
export function sectionMap(lines) {
  const out = new Array(lines.length);
  let kind = 'none';
  for (let i = 0; i < lines.length; i++) {
    const h = headingKind(lines[i]);
    if (h) { kind = h; out[i] = { kind, heading: true, skillList: false }; continue; }
    out[i] = { kind, heading: false, skillList: kind === 'skills' || isSkillListLine(lines[i]) };
  }
  return out;
}

// The resume line, trimmed to 160 characters, as the person will see it next to a skill. When the line is longer,
// the window keeps the hit in view.
export const SOURCE_LINE_MAX = 160;
export function sourceLine(line, at = 0) {
  line = String(line);
  if (line.length > SOURCE_LINE_MAX * 3) {
    // a very long line (a pasted paragraph): look at a window around the hit only, so the work does not grow with the line
    const from = Math.max(0, at - SOURCE_LINE_MAX);
    line = line.slice(from, from + SOURCE_LINE_MAX * 3);
    at -= from;
  }
  const t = line.replace(/\s+/g, ' ').trim();
  if (t.length <= SOURCE_LINE_MAX) return t;
  // `at` is an index into the original line; map it roughly to the collapsed text.
  const pre = line.slice(0, at).replace(/\s+/g, ' ').trimStart().length;
  const from = Math.max(0, Math.min(t.length - SOURCE_LINE_MAX + 2, pre - 60));
  let s = t.slice(from, from + SOURCE_LINE_MAX);
  if (from > 0) s = '…' + s.slice(1);
  if (from + SOURCE_LINE_MAX < t.length) s = s.slice(0, -1) + '…';
  return s;
}

// Lines that look like instructions to a language model. They are plain text to us: we never run them, and we do not
// read skills out of them or the paragraph they sit in. Returns a Set of line indexes.
const INJECTION = /(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your|these)\s+(instructions?|prompts?|rules|directions?)|system\s+prompt|you\s+are\s+(now\s+)?(an?\s+)?(ai|assistant|language\s+model|chatbot)|as\s+an\s+ai\b|new\s+instructions?\s*:|do\s+not\s+(tell|reveal)\s+the\s+(user|recruiter)|<\/?(system|assistant|instructions?)>|rate\s+this\s+candidate|\bjailbreak\b/i;
export function injectionLines(lines) {
  const bad = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (!INJECTION.test(lines[i])) continue;
    // the whole paragraph: back to the blank line before, forward to the blank line after
    // (at most 3 lines each way and never across a heading, so pasted text with no blank lines is not thrown away)
    let a = i; while (a > 0 && i - a < 3 && lines[a - 1].trim() && !headingKind(lines[a - 1])) a--;
    let b = i; while (b < lines.length - 1 && b - i < 3 && lines[b + 1].trim() && !headingKind(lines[b + 1])) b++;
    for (let k = a; k <= b; k++) bad.add(k);
  }
  return bad;
}
