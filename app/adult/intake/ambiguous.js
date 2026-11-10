// Short or everyday terms that are also plain words (BUILD_PLAN T4.4).
//   "R", "C", "Go", "Spring", "Excel", "Access", "JS", "MIS", "QC" ...
// Rule: such a term counts as a skill only when the line shows what it means. That is
//   - a context word within 8 words of the term (a "context word" below), or
//   - the term sits in a skills list (under a Skills heading, or an item in "Python, R, SQL").
// Some terms also need an exact spelling ("Go", not "go") and some phrases rule them out ("go to market").
// Pure data and functions. Add a term by adding a rule here; the unit tests in tests/intake/ambiguous.test.mjs show the shape.

const W = s => s.split(/\s+/).filter(Boolean);
// "written in Go", "results in R", "using Excel", "Python and R": a small word before the term settles it
const LEAD = /\b(in|using|with|via|through|on|from|of|use|used|into|plus|and|or)\s+$/;

const TECH_CTX = W('software tool tools platform platforms using used use proficient proficiency experience experienced knowledge skills skill library libraries framework language languages open-source opensource implementation implemented configured configuration administration developer development tech technology technologies stack');
const MARKETING_CTX = W('marketing ads advertising campaign campaigns social media seo sem content community strategy posts engagement followers manager management brand digital audience paid organic ppc');

// Rules by folded term (lower case). Fields:
//   cs       exact spelling required (the text must read exactly this)
//   ctx      context words, any one within 8 words of the term
//   listOk   a skills list also counts (default true)
//   listOnly only a skills list counts (no context words)
//   negBefore / negAfter   regexes on the text before / after the term (lower case); a match rules the term out
//   verb     {before, after}: the "excel in sales" test. Rules out the term when it reads as a verb and no strong word is near
//   strong   words that always settle it
export const RULES = {
  r: {
    cs: 'R', listOk: true, lead: LEAD,
    ctx: W('statistics statistical ggplot ggplot2 tidyverse dplyr cran rstudio shiny regression analysis analytics python sql sas spss data packages programming modelling modeling machine learning visualization visualisation bioinformatics econometrics forecasting stata matlab'),
    negBefore: [/\b(dr|mr|mrs|ms|shri|smt|sri)\.?\s+$/, /[a-z]\.\s*$/],
    negAfter: [/^\s*&/, /^\s*\.\s*[a-z]\./, /^\s+(kumar|k\.|s\.)/],
  },
  c: {
    cs: 'C', listOk: true,
    ctx: W('programming embedded firmware c++ linux kernel language languages compiler systems c# java python pointers rtos microcontroller microcontrollers drivers algorithms development developer software unix'),
    negBefore: [/\b(vitamin|grade|plan|class|category|section|option|type|hepatitis|schedule|group|level|part|tier|wing|block|form|appendix|exhibit)\s+$/, /\(\s*$/],
    negAfter: [/^[\s-]*(level|suite|section|grade|class|block)\b/, /^\s*\)/],
  },
  go: {
    cs: 'Go', listOk: true, lead: LEAD,
    ctx: W('golang backend microservices docker kubernetes grpc concurrency goroutines python java rust programming language api apis rest developer development software engineer services c++ nodejs typescript'),
    negBefore: [/\b(to|will|can|would|should|must|please|let's|lets|we|they|you|i|who|not|ready to|time to|how to|where to)\s+$/],
    negAfter: [/^[\s-]+(to|live|ahead|through|forward|get|getter|market|back|out)\b/],
  },
  spring: {
    cs: 'Spring', listOk: true,
    ctx: W('java boot hibernate jpa microservices mvc maven gradle rest backend framework junit kafka developer spring-boot security cloud dependency injection beans'),
    negBefore: [/\b(fall|autumn|winter|summer|this|last|next|every|in|during|since|each)\s+$/, /\b(fall|winter|summer)\s*[,/&]\s*$/],
    negAfter: [/^[\s,]*(semester|term|break|season|intake|batch|quarter|campaign|sale|cleaning|equinox|festival|holiday|20\d\d|19\d\d|'\d\d)/, /^\s*\/\s*(fall|summer|winter|autumn)/],
  },
  access: {
    cs: 'Access', listOk: true,
    ctx: W('database databases microsoft ms vba queries forms tables reports excel office sql relational'),
    negBefore: [/\b(to|with|have|has|had|gain|gained|provide|provided|providing|grant|granted|limited|remote|full|physical|easy|equal|improve|improved|secure|restrict|restricted|data|user|role)\s+$/, /\b(role|user)[- ]based\s+$/],
    negAfter: [/^\s+(to|control|management|controls|rights|point|permissions?|badge|card|rules|policy|policies|levels?|review|reviews|requests?)\b/, /^s\b/],
  },
  excel: {
    cs: /^(Excel|EXCEL)$/, listOk: true, lead: LEAD,
    ctx: W('spreadsheet spreadsheets pivot vlookup xlookup macros macro vba formulas formula dashboard dashboards powerpoint word outlook office sheets tally power bi charts reports reporting mis analysis tables data ms microsoft advanced proficient proficiency knowledge skills tools software sql intermediate basic expert'),
    strong: W('spreadsheet spreadsheets pivot vlookup xlookup macros macro vba formulas formula powerpoint word outlook office sheets ms microsoft'),
    verb: {
      before: /(^|\b(to|can|will|who|always|consistently|continue[sd]?|i|that|also|helped|help|strive|able|ability|constantly|consistently)\s+)$/,
      after: /^[\s,]*(in|at|as|under|during|beyond|through|within|over|when|while|by|on|despite|even)\b/,
      // "Advanced Excel in sales dashboards" has a word before it that names a tool, so the "in" after it does not make it a verb
      qual: /(advanced|proficient|proficiency|knowledge|using|with|expert|intermediate|basic|skills?|ms|microsoft|of|and|in|,)\s*$/,
    },
  },
  word: {
    cs: 'Word', listOk: true,
    ctx: W('excel powerpoint outlook office ms microsoft documents docx access spreadsheets'),
  },
  mis: {
    cs: 'MIS', listOk: true,
    ctx: W('reports reporting dashboard dashboards excel data vlookup pivot executive preparation prepared analysis daily weekly monthly management information system systems'),
  },
  js: {
    cs: 'JS', listOk: true,
    ctx: W('react node nodejs angular vue frontend front-end html css web typescript ajax jquery developer javascript browser express api'),
  },
  finance: {
    cs: null, listOk: false,
    ctx: W('accounting accounts ledger audit budgeting taxation gst reconciliation tally bookkeeping payable receivable financial statements close'),
  },
  rca: {
    cs: 'RCA', listOk: true,
    ctx: W('incident incidents defect defects problem postmortem quality failures troubleshooting 8d fmea capa corrective issue issues production'),
  },
  qc: {
    cs: 'QC', listOk: true,
    ctx: W('quality inspection testing lab laboratory samples standards iso qa audit defects products manufacturing sampling analytical'),
  },
  mm: { cs: 'MM', listOk: true, ctx: W('sap erp procurement purchase inventory materials s/4hana abap modules module po mrp') },
  sd: { cs: 'SD', listOk: true, ctx: W('sap erp sales distribution billing order modules module s/4hana abap') },
  bw: { cs: 'BW', listOk: true, ctx: W('sap bi hana bex abap data warehouse etl') },
  basis: { cs: 'BASIS', listOk: true, ctx: W('sap netweaver administration abap hana transport') },
  snow: { cs: 'SNOW', listOk: true, ctx: W('servicenow itsm incident itil cmdb ticketing platform') },
};

// Terms the index does not hold but people write. Each points at an id that must exist in the index; if it does not, the alias is skipped.
export const EXTRA_ALIASES = [
  { term: 'Spring', id: 'tec:spring-framework' },
  { term: 'Golang', id: 'tec:go' },
  { term: 'Access', id: 'tec:microsoft-access' },
  { term: 'MS Access', id: 'tec:microsoft-access' },
  { term: 'Tally', id: 'tec:tally' },
  { term: 'Word', id: 'tec:microsoft-word' },
];

// Words that are also tools in the O*NET technology list. They count in a skills list, or with a "tool" word nearby.
export const GENERIC = new Set(W('route square cents compilers debuggers emulators profilers diameter analyze scheme forth hotspot honeypot algae shiny swift julia ferret excavator travis velvet dig eko fear jet puff sand cyclone blink bing chef loom iris kant canu abbott archon aztec clipper magic mendel oberon piazza prince reduce vigilant zocalo gazebo cubic harvest bowtie blender paintbrush juris kismet litchi coeus bootstrap samba rapide layers fastest ant pig hive flex director world connect persuasion presenter contribute mechanical smoke combustion continuum air inventor distiller bamboo analytics ads calendar groovy maya'));
// Sites and apps: a skill only with a marketing word near, or in a skills list. "LinkedIn: linkedin.com/in/x" is contact info.
export const SOCIAL = new Set(W('google facebook instagram linkedin twitter youtube whatsapp snapchat pinterest tiktok tumblr myspace skype zoom slack dropbox paypal vimeo canva'));
// Everyday-word O*NET skills and activities: only in a skills list.
export const LIST_ONLY = new Set(W('design administrative transportation monitoring installation mechanical science speaking coordination instructing repairing writing monitor documenting administration'));

const RULE_GENERIC = { cs: null, ctx: TECH_CTX, listOk: true };
const RULE_SOCIAL = { cs: null, ctx: MARKETING_CTX, listOk: true };
const RULE_LIST_ONLY = { cs: null, ctx: [], listOk: true, listOnly: true };
// An all-capitals name of 5 letters or more in the index ("IMPACT", "FASTEST", "HARVEST") is usually an everyday word:
// it counts when written in capitals, or in a skills list, or with a tool word near it.
const RULE_CAPS = { cs: null, ctx: TECH_CTX, listOk: true, capsOr: true };
const RULE_SHORT = { cs: null, ctx: TECH_CTX, listOk: true }; // 1 or 2 letter terms with no rule of their own

export const fold = s => String(s).toLowerCase();

// The rule for one term of one index entry, or null if the term is always safe.
export function ruleFor(termFolded, entry, original) {
  if (RULES[termFolded]) return RULES[termFolded];
  if (SOCIAL.has(termFolded)) return RULE_SOCIAL;
  if (GENERIC.has(termFolded)) return RULE_GENERIC;
  if (entry && entry.kind !== 'technology' && LIST_ONLY.has(termFolded)) return RULE_LIST_ONLY;
  if (entry && Array.isArray(entry.ambiguous) && entry.ambiguous.some(a => fold(a) === termFolded)) return RULE_GENERIC;
  if (original && /^[A-Z]{5,}$/.test(original) && entry && entry.kind === 'technology') return RULE_CAPS;
  const letters = termFolded.replace(/[^\p{L}\p{N}\p{M}]/gu, '');
  if (letters.length <= 2 && !/[+#]/.test(termFolded)) return RULE_SHORT;
  return null;
}

const TOKEN = /[^\p{L}\p{N}\p{M}+#./'-]+/u;
function words(s) { return s.toLowerCase().split(TOKEN).map(t => t.replace(/^[.'/-]+|[.'/-]+$/g, '')).filter(Boolean); }

// ctx = { line, start, end, inList } where line[start..end) is the matched term. Returns true when the term should count.
export function decide(rule, ctx) {
  if (!rule) return true;
  const { line, start, end } = ctx;
  const matched = line.slice(start, end);
  if (rule.cs && (rule.cs instanceof RegExp ? !rule.cs.test(matched) : matched !== rule.cs)) return false;
  const before = line.slice(0, start).toLowerCase();
  const after = line.slice(end).toLowerCase();
  if (rule.negBefore && rule.negBefore.some(re => re.test(before))) return false;
  if (rule.negAfter && rule.negAfter.some(re => re.test(after))) return false;
  const near = words(line.slice(Math.max(0, start - 90), start)).slice(-8).concat(words(line.slice(end, end + 90)).slice(0, 8));
  const has = list => !!list && near.some(w => list.indexOf(w) >= 0);
  if (rule.capsOr && /^[A-Z]{3,}$/.test(matched)) return true;
  if (rule.verb) {
    const verbLike = rule.verb.before.test(before) || (rule.verb.after.test(after) && !(rule.verb.qual && rule.verb.qual.test(before)));
    if (verbLike && !has(rule.strong)) return false;
  }
  if (rule.lead && rule.lead.test(before)) return true;
  if (rule.listOnly) return !!ctx.inList;
  if (rule.listOk !== false && ctx.inList) return true;
  return has(rule.ctx);
}
