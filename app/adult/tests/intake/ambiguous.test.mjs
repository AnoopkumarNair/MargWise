// Ambiguous short terms (intake/ambiguous.js): R, C, Go, Spring, Excel, Access, JS, MIS ...
// Each term has lines where it is a skill and lines where it is only a word. Real skills index.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatcher, findHits } from '../../intake/match_dict.js';
import { splitLines, sectionMap } from '../../intake/lines.js';
import { decide, ruleFor, RULES } from '../../intake/ambiguous.js';
import { loadGraph } from '../lib/graph.mjs';

const { skillsIndex } = loadGraph();
const matcher = buildMatcher(skillsIndex);
function ids(text) {
  const lines = splitLines(text);
  return new Set(findHits(matcher, lines, { sections: sectionMap(lines) }).map(h => h.id));
}
const yes = (text, id) => assert.ok(ids(text).has(id), `should find ${id} in: ${text}`);
const no = (text, id) => assert.ok(!ids(text).has(id), `should NOT find ${id} in: ${text}`);

test('Go: the language, not the verb', () => {
  for (const t of ['Built payment services in Go with gRPC', 'Backend: Go, Python, PostgreSQL', 'Wrote microservices using Go and Docker', 'Skills: Go', 'Golang developer', 'Go (Golang) concurrency, goroutines'])
    yes(t, 'tec:go');
  for (const t of ['Owned the go-to-market plan', 'Helped the team go live in two weeks', 'Go to market strategy for the new range', "Let's go to the customer site", 'I am the go-to person for reports', 'Plans to go ahead with the launch', 'We must go through the audit', 'Go for it'])
    no(t, 'tec:go');
});

test('R: the language, not the letter', () => {
  for (const t of ['Analysed results in R (ggplot2, dplyr)', 'Statistics with R and Python', 'Skills: R, SQL, Tableau', 'Used R for regression models'])
    yes(t, 'tec:r');
  for (const t of ['Worked with the R&D team', 'Reported to Dr. R. Menon', 'Section R of the form', 'Mr. R Kumar, manager', 'Joined R & D in 2019'])
    no(t, 'tec:r');
});

test('C: the language, not a grade or a suite', () => {
  yes('Wrote firmware in C and C++ for a battery controller', 'tec:c');
  yes('Embedded C programming on microcontrollers', 'tec:c');
  yes('Skills: C, C++, Python', 'tec:c');
  for (const t of ['Presented to C-level stakeholders', 'Vitamin C supplements', 'Passed with grade C', 'Option C was chosen', 'Plan C']) no(t, 'tec:c');
  no('Wrote firmware in C++ for a controller', 'tec:c');
});

test('Excel: the tool, not the verb', () => {
  for (const t of ['Microsoft Excel and VLOOKUP', 'Advanced Excel (pivot tables, macros)', 'Reports prepared in Excel every week', 'Proficient in Excel and PowerPoint', 'Skills: Excel, Word, Outlook', 'MS Excel dashboards', 'Used Excel for daily reports', 'Python and Excel in daily work'])
    yes(t, 'tec:microsoft-excel');
  for (const t of ['Excel in sales and client handling', 'I excel in client-facing roles', 'Consistently excel at explaining technical work', 'Students who excel in maths', 'Helps people to excel in their careers', 'Will excel under pressure'])
    no(t, 'tec:microsoft-excel');
});

test('Spring: the framework, not the season', () => {
  yes('Java Spring REST services with Hibernate', 'tec:spring-framework');
  yes('Backend: Java, Spring, Kafka', 'tec:spring-framework');
  yes('Built APIs with Spring Boot', 'tec:spring-boot');
  no('Built APIs with Spring Boot', 'tec:spring-framework');
  for (const t of ['Spring 2018 internship', 'Exchange semester, Spring 2017', 'Spring semester abroad', 'in spring and summer', 'Fall/Spring term projects', 'Spring cleaning of the data room', 'Summer and Spring campaigns'])
    no(t, 'tec:spring-framework');
});

test('Access: the database, not the noun', () => {
  yes('Microsoft Access database with VBA forms', 'tec:microsoft-access');
  yes('Reports in Access and Excel', 'tec:microsoft-access');
  yes('Skills: Access, SQL, Excel', 'tec:microsoft-access');
  for (const t of ['Provided read access to production logs', 'Reviewed role-based access rules', 'Access to data was limited', 'Full access control for admins', 'gain access to the system'])
    no(t, 'tec:microsoft-access');
});

test('JS, MIS, QC and the SAP module codes need a context word', () => {
  yes('React, Node and JS for the front end', 'tec:javascript');
  yes('Skills: JS, HTML, CSS', 'tec:javascript');
  no('Mr. JS Patel signed the letter', 'tec:javascript');
  yes('Prepared daily MIS reports in Excel', 'tec:microsoft-excel');
  no('Joined the MIS team in 2019', 'tec:microsoft-excel');
  yes('QC inspection of samples in the lab', 'skl:2.B.3.m');
  no('QC was changed to Q3', 'skl:2.B.3.m');
  yes('SAP MM procurement and inventory', 'tec:sap-erp-operations');
  no('Room MM and SD are booked', 'tec:sap-erp-operations');
});

test('sites and apps are skills only when the line is about marketing', () => {
  yes('Social media marketing on LinkedIn and Instagram', 'tec:linkedin');
  yes('Skills: LinkedIn, Canva', 'tec:linkedin');
  no('LinkedIn: linkedin.com/in/ravindran-canarypally', 'tec:linkedin');
  no('Joined Google Data Analytics certificate course', 'tec:google');
  no('Had a Zoom call with the client', 'tec:zoom');
  no('Worked at Google India as an analyst', 'tec:google');
});

test('everyday-word skills count only in a skills list', () => {
  const lines = ['Design and installation of the plant', 'SKILLS', 'Design, Installation, Monitoring'];
  const h = findHits(matcher, lines, { sections: sectionMap(lines) });
  assert.ok(!h.some(x => x.line === 0), 'in a sentence: no');
  assert.ok(h.some(x => x.line === 2 && x.label === 'Design'), 'in the skills list: yes');
});

test('rules are data: cs, ctx, listOnly, negBefore, negAfter, verb', () => {
  const rule = { cs: 'Zed', ctx: ['lang'], negBefore: [/\bnot\s+$/], negAfter: [/^\s+the\b/] };
  const d = (line, inList = false) => { const s = line.indexOf('Zed'); return decide(rule, { line, start: s, end: s + 3, inList }); };
  assert.equal(d('the lang Zed'), true);
  assert.equal(d('Zed'), false, 'no context');
  assert.equal(d('Zed', true), true, 'a skills list is enough');
  assert.equal(d('not Zed lang'), false, 'ruled out before');
  assert.equal(d('Zed the lang'), false, 'ruled out after');
  assert.equal(decide(rule, { line: 'zed lang', start: 0, end: 3, inList: true }), false, 'exact spelling');
  assert.equal(decide({ listOnly: true, ctx: ['x'] }, { line: 'x Zed', start: 2, end: 5, inList: false }), false);
  assert.equal(decide(null, {}), true, 'no rule: always a skill');
  assert.ok(RULES.excel.verb && RULES.go.negAfter && RULES.spring.negAfter, 'the rules named in the build plan exist');
  assert.equal(ruleFor('python', { kind: 'technology' }, 'Python'), null);
});
