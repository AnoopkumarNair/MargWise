// Writes fixtures/ten_page/resume.txt and expected.json for the 10-page resume fixture.
// The roles, years and tools below are the truth the reader is tested against; nothing here calls the reader.
// Run: node app/adult/tests/fixtures/gen/make_long_text.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../ten_page/', import.meta.url));

// [title, company, place, dates text, startYear, endYear, current, tools: [[display, id]]]
const ROLES = [
  ['Head of Data and Analytics', 'Canaryworks Pvt Ltd', 'Bengaluru', 'Jan 2022 - Present', 2022, 2026, true,
    [['Python', 'tec:python'], ['SQL', 'tec:structured-query-language-sql'], ['Tableau', 'tec:tableau'], ['Power BI', 'tec:microsoft-power-bi'], ['PostgreSQL', 'tec:postgresql'], ['Docker', 'tec:docker'], ['Git', 'tec:git'], ['Jira', 'tec:atlassian-jira']]],
  ['Analytics Manager', 'Brightloom Analytics', 'Pune', 'Jun 2018 - Dec 2021', 2018, 2021, false,
    [['Python', 'tec:python'], ['SQL', 'tec:structured-query-language-sql'], ['Tableau', 'tec:tableau'], ['MySQL', 'tec:mysql'], ['Hadoop', 'tec:apache-hadoop'], ['Microsoft Excel', 'tec:microsoft-excel'], ['pandas', 'tec:pandas'], ['scikit-learn', 'tec:scikit-learn']]],
  ['Senior Business Analyst', 'Kestrel Logistics', 'Mumbai', 'Jul 2014 - May 2018', 2014, 2018, false,
    [['SQL', 'tec:structured-query-language-sql'], ['Microsoft Excel', 'tec:microsoft-excel'], ['SAS', 'tec:sas'], ['Minitab', 'tec:minitab'], ['Tableau', 'tec:tableau'], ['Microsoft Project', 'tec:microsoft-project'], ['Linux', 'tec:linux']]],
  ['Business Analyst', 'Hilltop Retail', 'Hyderabad', '2011-2014', 2011, 2014, false,
    [['SQL', 'tec:structured-query-language-sql'], ['Microsoft Excel', 'tec:microsoft-excel'], ['Microsoft Access', 'tec:microsoft-access'], ['SAS', 'tec:sas'], ['Oracle Database', 'tec:oracle-database']]],
  ['MIS Executive', 'Eastwind Traders', 'Chennai', '2008 - 2011', 2008, 2011, false,
    [['Microsoft Excel', 'tec:microsoft-excel'], ['Microsoft Access', 'tec:microsoft-access'], ['SQL', 'tec:structured-query-language-sql']]],
  ['Systems Executive', 'Northgate Stores', 'Coimbatore', 'Jan 2006 - Dec 2007', 2006, 2007, false,
    [['Microsoft Excel', 'tec:microsoft-excel'], ['Microsoft Access', 'tec:microsoft-access'], ['Linux', 'tec:linux']]],
  ['Trainee Programmer', 'Orchard Software Services', 'Madurai', '2004 – 2005', 2004, 2005, false,
    [['Java', 'tec:oracle-java'], ['C++', 'tec:cpp'], ['MySQL', 'tec:mysql']]],
];

const VERBS = ['Built', 'Designed', 'Automated', 'Improved', 'Reviewed', 'Planned', 'Led', 'Documented', 'Migrated', 'Tested', 'Simplified', 'Reported on'];
const OBJECTS = ['the weekly management report', 'a stock and sales dashboard', 'the customer churn model', 'the month-end checks', 'a supplier scorecard',
  'the forecasting process', 'the data quality rules', 'a pricing study', 'the return and refund analysis', 'a routing cost model', 'the monthly MIS pack',
  'a training programme for new analysts', 'the sales target tracker', 'an audit of delivery delays', 'the budget model for the year'];
const RESULTS = ['which cut the effort by half', 'and the team used it every week', 'so managers could decide faster', 'and errors fell sharply',
  'and it was adopted by two other teams', 'saving about two days each month', 'and leadership asked for it every quarter', 'and the review took one hour instead of a day'];

function bullet(roleIdx, k, tools) {
  const t = tools[(k + roleIdx) % tools.length][0];
  const t2 = tools[(k * 3 + roleIdx + 1) % tools.length][0];
  const v = VERBS[(k + roleIdx * 5) % VERBS.length];
  const o = OBJECTS[(k * 7 + roleIdx * 3) % OBJECTS.length];
  const r = RESULTS[(k * 5 + roleIdx) % RESULTS.length];
  return k % 3 === 0 ? `- ${v} ${o} in ${t}, ${r}.` : `- ${v} ${o} using ${t} and ${t2}, ${r}.`;
}

const lines = [];
const P = s => lines.push(s);
P('RAVINDRAN CANARYPALLY');
P('Head of Data and Analytics');
P('Bengaluru, Karnataka | canary.mail.7731@example.com | +91 98765 43210');
P('PAN: ABCDE1234F | Aadhaar: 2345 6789 0123');
P('');
P('SUMMARY');
P('Analytics leader with twenty years in data, reporting and decision support across retail, logistics and lending. I build small teams, simple dashboards and careful processes. This is the long version of my resume, with full detail for each role, my projects, talks, training and community work.');
P('');
P('EXPERIENCE');
ROLES.forEach((r, ri) => {
  const [title, company, place, dates, , , , tools] = r;
  P('');
  P(title);
  P(`${company}, ${place}`);
  P(dates);
  const n = 34 - ri * 2;
  for (let k = 0; k < n; k++) P(bullet(ri, k, tools));
  P('- Tools: ' + tools.map(t => t[0]).join(', ') + '.');
});
P('');
P('EDUCATION');
P('MBA, Analytics, Canary Institute of Technology, Chennai');
P('2002 - 2004');
P('B.Sc., Mathematics, Madurai Kamaraj University');
P('1999 - 2002');
P('');
P('PROJECTS');
for (let i = 1; i <= 22; i++) {
  P(`Project ${i}: ${OBJECTS[(i * 4) % OBJECTS.length]}`);
  P(`- Planned the scope with the business owner, built the first version in a week and iterated for ${i + 2} weeks.`);
  P(`- Wrote a one-page guide so that anyone on the team could run it. Presented the results to the leadership team.`);
  P(`- Lessons: start small, ask what decision the number will change, and check the data with the people who made it.`);
}
P('');
P('TALKS AND TRAINING');
for (let i = 1; i <= 24; i++) P(`- ${2004 + i} talk or course ${i}: practical reporting for non-technical teams; attended by ${20 + i * 3} people.`);
P('');
P('SKILLS');
P('Python, SQL, Tableau, Power BI, PostgreSQL, MySQL, Docker, Git, Jira, Microsoft Excel, SAS, Minitab, Linux, Java, C++ , Microsoft Access, pandas, scikit-learn');
P('');
P('LANGUAGES');
P('English, Hindi, Tamil, Telugu');

writeFileSync(OUT + 'resume.txt', lines.join('\n') + '\n');

// ---- expected.json: built from ROLES, not from the reader ----
const lastYearOf = new Map();
ROLES.forEach(r => r[7].forEach(([, id]) => { lastYearOf.set(id, Math.max(lastYearOf.get(id) || 0, r[5])); }));
const mustFind = [...lastYearOf.keys()].sort();
const mustFindYears = {};
// pandas and scikit-learn appear in the second role; Java and C++ only in the last role.
for (const id of ['tec:python', 'tec:tableau', 'tec:oracle-java', 'tec:cpp', 'tec:sas', 'tec:microsoft-access', 'tec:mysql']) mustFindYears[id] = lastYearOf.get(id);
const expected = {
  id: 'ten_page',
  shape: '10-page PDF (long resume, 7 roles over 22 years)',
  binary: 'resume.pdf',
  looksLikeResume: true,
  roles: ROLES.map(r => ({ titleContains: r[0], startYear: r[4], endYear: r[5], current: r[6] })),
  currentRoleIndex: 0,
  mustFind,
  mustNotFind: ['tec:r', 'tec:go', 'tec:c', 'tec:linkedin', 'tec:spring-framework'],
  mustFindYears,
  outOfDictionary: [],
  notes: 'Education years (2002 - 2004, 1999 - 2002) and the talk list must not become roles. Generated by gen/make_long_text.mjs from the ROLES table in that file.',
};
writeFileSync(OUT + 'expected.json', JSON.stringify(expected, null, 2) + '\n');
console.log('lines:', lines.length, 'words:', lines.join(' ').split(/\s+/).length);
