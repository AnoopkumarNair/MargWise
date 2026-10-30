// node --test app/adult/tests/intake/*.test.mjs
// The dictionary match (intake/match_dict.js): whole words, any case, longest term wins, unicode, positions, source lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatcher, findHits, fold } from '../../intake/match_dict.js';
import { splitLines, sectionMap, sourceLine, SOURCE_LINE_MAX } from '../../intake/lines.js';
import { loadGraph } from '../lib/graph.mjs';

const E = (id, label, alt = [], kind = 'technology') => ({ id, label, alt, kind });
const small = [
  E('t:excel', 'Microsoft Excel', ['MS Excel']),
  E('t:py', 'Python'),
  E('t:sql', 'Structured query language SQL', ['SQL']),
  E('t:cpp', 'C++'),
  E('t:cs', 'C#'),
  E('t:c', 'C'),
  E('t:node', 'Node.js'),
  E('t:pbi', 'Microsoft Power BI', ['Power BI', 'PowerBI']),
  E('t:cafe', 'Café POS'),
  E('t:data', 'डेटा', [], 'skill'),
  E('t:erp', 'SAP ERP Operations', ['SAP']),
];
function hits(text, index = small) {
  const lines = splitLines(text);
  return findHits(buildMatcher(index), lines, { sections: sectionMap(lines) });
}
const ids = (text, index) => hits(text, index).map(h => h.id);

test('finds terms in any case, as whole words', () => {
  assert.deepEqual(ids('I use PYTHON and python and Python.'), ['t:py', 't:py', 't:py']);
  assert.deepEqual(ids('pythonic and python3 and xpython'), []);
  assert.deepEqual(ids('(Python), [SQL]; "SQL"'), ['t:py', 't:sql', 't:sql']);
  assert.deepEqual(ids('Python/SQL, Python-SQL'), ['t:py', 't:sql', 't:py', 't:sql']);
});

test('the longest term wins where two overlap', () => {
  const h = hits('Daily work in Microsoft Excel and SAP ERP Operations.');
  assert.deepEqual(h.map(x => x.id), ['t:excel', 't:erp']);
  assert.equal(h[0].term, 'Microsoft Excel');
  assert.equal(h[1].term, 'SAP ERP Operations');
});

test('many patterns in one pass, with positions', () => {
  const text = 'Python, SQL and Power BI';
  const h = hits(text);
  assert.deepEqual(h.map(x => [x.id, x.term, text.slice(x.start, x.end)]), [['t:py', 'Python', 'Python'], ['t:sql', 'SQL', 'SQL'], ['t:pbi', 'Power BI', 'Power BI']]);
  assert.ok(h.every(x => x.line === 0));
});

test('terms with symbols: C++, C#, Node.js and plain C do not get mixed up', () => {
  assert.deepEqual(ids('Skills: C++, C#, C, Node.js'), ['t:cpp', 't:cs', 't:c', 't:node']);
  assert.deepEqual(ids('Wrote firmware in C++ and C# tools'), ['t:cpp', 't:cs']);
  assert.deepEqual(ids('R&D and C&A'), []);
});

test('unicode: accents, Devanagari, combining marks and emoji', () => {
  assert.deepEqual(ids('We run Café POS at the shop'), ['t:cafe']);
  assert.deepEqual(ids('CAFÉ POS'), ['t:cafe']);
  assert.deepEqual(ids('Python से रिपोर्ट'), ['t:py']);
  assert.deepEqual(ids('डेटा विश्लेषक'), ['t:data']);
  assert.deepEqual(ids('डेटाबेस प्रबंधन'), [], 'a Devanagari word that only starts with the term is not the term');
  assert.deepEqual(ids('🙂Python🙂'), ['t:py']);
  assert.deepEqual(ids('Pythonमें'), [], 'letters of another script stuck to the term make a different word');
});

test('fold keeps one character in and one out, so positions stay true', () => {
  for (const s of ['İstanbul Python', 'ǅ Python', 'ΑΣ Python', 'Ａ Python', 'a b c', 'x​y']) assert.equal(fold(s).length, s.length, s);
});

test('urls and email addresses are not skills', () => {
  assert.deepEqual(ids('github.com/python and www.python.org and python@example.com'), []);
  assert.deepEqual(ids('Contact python@example.com or use Python'), ['t:py']);
});

test('lines to leave out are left out', () => {
  const lines = ['Python', 'SQL'];
  const h = findHits(buildMatcher(small), lines, { skip: new Set([0]) });
  assert.deepEqual(h.map(x => x.id), ['t:sql']);
});

test('source line: the resume line, at most 160 characters, with the hit in view', () => {
  const long = 'word '.repeat(60) + 'Python' + ' word'.repeat(60);
  const [h] = hits(long);
  assert.ok(h.sourceLine.length <= SOURCE_LINE_MAX, 'length ' + h.sourceLine.length);
  assert.ok(h.sourceLine.includes('Python'));
  const [s] = hits('  Built   reports in   Python  ');
  assert.equal(s.sourceLine, 'Built reports in Python');
  assert.equal(sourceLine('x'.repeat(500)).length, SOURCE_LINE_MAX);
});

test('the matcher is cached per index and builds quickly', () => {
  const t0 = performance.now();
  const m1 = buildMatcher(small), m2 = buildMatcher(small);
  assert.equal(m1, m2);
  assert.ok(performance.now() - t0 < 500);
});

test('real index: common tools, vendor names without the vendor, aliases', () => {
  const { skillsIndex } = loadGraph();
  const f = t => new Set(ids(t, skillsIndex));
  const a = f('Python, SQL, Tableau and Microsoft Power BI; Photoshop and Illustrator; AutoCAD; Kafka; Angular; Node.js; C++');
  for (const id of ['tec:python', 'tec:structured-query-language-sql', 'tec:tableau', 'tec:microsoft-power-bi', 'tec:adobe-photoshop', 'tec:adobe-illustrator', 'tec:autodesk-autocad', 'tec:apache-kafka', 'tec:cpp']) {
    if (!a.has(id)) assert.fail('missing ' + id + ' in ' + [...a].join(', '));
  }
  assert.ok(a.has('tec:node-js'));
  assert.ok([...a].some(x => /angular/.test(x)), 'Angular');
});

test('real index: everyday words alone are not tools', () => {
  const { skillsIndex } = loadGraph();
  const none = [
    'The impact of the plan was good and the fastest route is by the square.',
    'We will go over the notes and the exchange rate, then write to the world.',
    'He is a director of the project and keeps the calendar and the docs.',
    'Drive the van to the sites; share the slides and the sheets.',
  ];
  for (const t of none) assert.deepEqual(ids(t, skillsIndex), [], t);
});
