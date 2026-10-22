s=open('lamps3.html',encoding='utf8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
def cut(start,end,new):
    global s
    i=s.index(start); j=s.index(end,i); s=s[:i]+new+s[j:]

# ---------------- CSS
rep("  /* ----- loader ----- */","""  /* ----- results redesign ----- */
  #dreams.on, #reveal.on, #doors.on, #field.on { overflow-y: auto; }
  .screen.pad.res { padding-bottom: calc(var(--safe-bot) + 14px); gap: 12px; }
  .grp { display: grid; gap: 8px; }
  .grp h3 { font-size: 17px; font-family: var(--body); font-weight: 800; color: var(--cream); }
  .grp .chips { flex: none; }
  .grp .chips.row3 { grid-template-columns: 1fr 1fr 1fr; }
  .radarwrap { display: grid; place-items: center; background: rgba(255,255,255,.06); border-radius: 20px; padding: 6px 4px 2px; }
  .radarwrap svg { width: min(100%, 360px); height: auto; display: block; }
  .rpoly { transform-origin: 160px 140px; animation: rgrow .9s cubic-bezier(.2,.8,.2,1) .2s both; }
  @keyframes rgrow { from { transform: scale(.05); opacity: 0; } to { transform: none; opacity: 1; } }
  .howto { font-size: 14px; color: rgba(255,243,214,.85); text-align: center; padding: 0 10px 8px; }
  .ranked { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .ranked li { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: start; background: rgba(255,255,255,.08); border-radius: 14px; padding: 10px 12px; }
  .ranked li.dim { background: rgba(255,255,255,.04); opacity: .85; }
  .ranked .rk { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-family: var(--display); font-weight: 800; background: var(--glow); color: var(--ink); }
  .ranked li.dim .rk { background: rgba(255,243,214,.2); color: var(--cream); }
  .ranked .nm { font-weight: 800; font-size: 16px; }
  .ranked .nm span { font-weight: 700; color: rgba(255,243,214,.8); font-size: 14.5px; }
  .ranked .bar { display: block; height: 7px; border-radius: 9px; background: rgba(255,243,214,.15); margin: 6px 0 4px; overflow: hidden; }
  .ranked .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--glow-deep), var(--glow)); border-radius: 9px; }
  .ranked .sch { font-size: 14px; color: var(--cream-2); }
  .pill { display: inline-block; font-size: 13px; font-weight: 800; padding: 3px 10px; border-radius: 99px; border: 2px solid var(--ink); background: var(--cream-2); color: var(--ink); white-space: nowrap; }
  .pill.strong { background: var(--glow); } .pill.mixed { background: #bfe5e2; } .pill.weak { background: #e9dfe8; }
  .fcard { width: 100%; text-align: left; display: grid; grid-template-columns: 52px 1fr auto; gap: 12px; align-items: center; background: var(--cream); color: var(--ink); border: 0; border-radius: 20px; padding: 14px; box-shadow: 0 5px 0 #b9955a; }
  .fcard:active { transform: translateY(3px); box-shadow: 0 2px 0 #b9955a; }
  .fcard .gl { width: 52px; height: 52px; border-radius: 16px; background: #ffe9a8; display: grid; place-items: center; font-size: 28px; }
  .fcard h3 { font-size: 20px; font-weight: 800; }
  .fcard p { font-size: 14.5px; color: var(--ink-soft); font-weight: 700; margin-top: 2px; }
  .fcard .chev { font-size: 22px; color: var(--ink-soft); }
  .fcard .meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .lean { background: rgba(255,207,107,.14); border: 1.5px dashed var(--glow-deep); border-radius: 14px; padding: 10px 12px; font-size: 15px; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .seg button { border: 2px solid rgba(255,243,214,.35); background: rgba(255,255,255,.07); border-radius: 12px; padding: 8px 6px; min-height: 44px; font-weight: 800; font-size: 14px; }
  .seg button[aria-pressed="true"] { background: #ffe9a8; color: var(--ink); border-color: var(--glow-deep); }
  .crow { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; background: rgba(255,255,255,.08); border-radius: 14px; padding: 10px 12px; }
  .crow b { font-size: 16px; } .crow p { grid-column: 1 / -1; font-size: 14.5px; color: rgba(255,243,214,.88); font-weight: 600; }
  .tl { list-style: none; margin: 0; padding: 0 0 0 16px; border-left: 3px solid rgba(255,207,107,.5); display: grid; gap: 14px; }
  .tl li { position: relative; }
  .tl li::before { content: ''; position: absolute; left: -24px; top: 4px; width: 13px; height: 13px; border-radius: 50%; background: var(--glow); box-shadow: 0 0 8px rgba(255,207,107,.8); }
  .tl li.now::before { background: var(--rose); box-shadow: 0 0 8px rgba(232,112,138,.9); }
  .tl small { display: block; font-weight: 800; font-size: 12.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--glow); }
  .tl span { font-size: 15.5px; font-weight: 600; }
  .fineprint { font-size: 13px; color: rgba(255,243,214,.7); }
  /* ----- loader ----- */""")

# ---------------- HTML sections
i=s.index('  <section class="screen pad" id="dreams">'); j=s.index('</div>\n\n<div class="sheet" id="saveSheet"')
s=s[:i]+'''  <section class="screen pad res" id="dreams">
    <div class="head"><h2>Two quick things first</h2><p>So the next screens fit your school. Skip anything you like.</p></div>
    <div class="grp"><h3>Which class are you in?</h3><div class="chips" id="cClass"></div></div>
    <div class="grp"><h3>Which board?</h3><div class="chips" id="cBoard"></div></div>
    <div class="grp"><h3>Where is your mind right now?</h3><div class="chips" id="cLean"></div></div>
    <div class="actions" style="margin-top:auto"><button class="go" id="dreamGo">Show my interest shape</button></div>
  </section>

  <section class="screen pad res" id="reveal">
    <div class="head"><h2>Your interest shape</h2><p id="revealLine"></p></div>
    <div class="radarwrap"><svg id="compass" viewBox="-10 0 340 290" role="img" aria-label="Radar chart of your six interest areas"></svg><p class="howto">The further a point is from the middle, the more you enjoyed that kind of activity, compared with your own other choices.</p></div>
    <ol class="ranked" id="legend"></ol>
    <p class="note" id="notes" hidden></p>
    <p class="outro" id="outro"></p>
    <div class="actions" style="margin-top:auto"><button class="go quiet" id="saveBtn">Save your lighthouse</button><button class="go" id="openDoors">See where this can lead</button></div>
  </section>

  <section class="screen pad res" id="doors">
    <div class="head"><h2>Where this can lead</h2><p>Five fields, ordered by how well they match your shape. Tap one to see careers and the school path.</p></div>
    <div class="lean" id="leanNote" hidden></div>
    <div style="display:grid; gap:12px" id="fields"></div>
    <p class="fineprint">Prototype content. Careers and school paths are drafts for counsellor review. Check official sites for current rules.</p>
    <div class="actions"><button class="go quiet" id="again">Walk the road again</button></div>
  </section>

  <section class="screen pad res" id="field">
    <div class="head"><h2 id="fTitle"></h2><p id="fWhy"></p></div>
    <div class="grp"><h3>Careers in this field</h3><div style="display:grid; gap:8px" id="fCareers"></div></div>
    <div class="grp"><h3>Your school path</h3><div class="seg" id="fBoard" role="group" aria-label="Board"></div><ol class="tl" id="fPath"></ol></div>
    <p class="fineprint">Prototype content. Drafts for counsellor review. Check official sites for current rules.</p>
    <div class="actions"><button class="go quiet" id="fBack">Back to all fields</button></div>
  </section>
'''+s[j:]

# ---------------- JS: views, progress, back
rep("['welcome', 'stop', 'dreams', 'reveal', 'doors'].forEach","['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field'].forEach")
rep("if (v === 'dreams' || v === 'reveal' || v === 'doors') return","if (v === 'dreams' || v === 'reveal' || v === 'doors' || v === 'field') return")
rep("    else if (state.view === 'doors') { show('reveal'); }\n  });","    else if (state.view === 'doors') { show('reveal'); }\n    else if (state.view === 'field') { show('doors'); }\n  });")
rep("state.choices = []; state.dreams = []; advance(true);","state.choices = []; advance(true);")
rep("    state.dreams = ['psy-1', 'tec-1'];\n","")

# ---------------- JS: context step
cut("  // ---------- dreams","  // ---------- reveal","""  // ---------- context: class, board, leaning (all optional)
  var CTX = {
    cls: [['9', 'Class 8 or 9'], ['10', 'Class 10'], ['11', 'Class 11'], ['12', 'Class 12']],
    board: [['cbse', 'CBSE'], ['isc', 'ICSE or ISC'], ['state', 'State board'], ['other', 'Other']],
    lean: [['science', 'Science'], ['commerce', 'Commerce'], ['humanities', 'Humanities'], ['arts', 'Arts and design'], ['unsure', 'Not sure yet']]
  };
  state.ctx = { cls: '', board: '', lean: '' };
  function toDreams() {
    show('dreams'); paintHud();
    [['cClass', 'cls'], ['cBoard', 'board'], ['cLean', 'lean']].forEach(function (g) {
      $(g[0]).innerHTML = CTX[g[1]].map(function (o) { return '<button type="button" class="chip" data-k="' + g[1] + '" data-v="' + o[0] + '" aria-pressed="' + (state.ctx[g[1]] === o[0]) + '">' + o[1] + '</button>'; }).join('');
    });
  }
  ['cClass', 'cBoard', 'cLean'].forEach(function (id) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var k = b.dataset.k; state.ctx[k] = state.ctx[k] === b.dataset.v ? '' : b.dataset.v;
      Array.prototype.forEach.call($(id).children, function (c) { c.setAttribute('aria-pressed', String(c.dataset.v === state.ctx[k])); });
    });
  });
  $('dreamGo').addEventListener('click', function () { toReveal(); });

""")

# ---------------- JS: radar + reveal
cut("  function compass(code) {","  function list(arr)","""  var AREA_SCHOOL = { R: 'Physics, workshops, technical drawing', I: 'Maths, Science, Computer Science', A: 'Art, languages, design, literature', S: 'Psychology, Biology, languages', E: 'Economics, Business Studies, debate', C: 'Accountancy, Maths, Computer Science' };
  function zv(z) { return Math.max(.08, Math.min(1, (z + 1.6) / 3.2)); }
  function radar(profile, code) {
    var cx = 160, cy = 140, R = 86, h = '', pt = function (i, k) { var a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]; };
    [1, .66, .33].forEach(function (k) { h += '<polygon points="' + AREAS.map(function (_, i) { return pt(i, k).join(','); }).join(' ') + '" fill="' + (k === 1 ? 'rgba(255,255,255,.04)' : 'none') + '" stroke="rgba(255,243,214,.28)" stroke-width="1.2"/>'; });
    AREAS.forEach(function (_, i) { var p = pt(i, 1); h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="rgba(255,243,214,.2)" stroke-width="1"/>'; });
    var pts = AREAS.map(function (a, i) { return pt(i, zv(profile[a])); });
    h += '<g class="rpoly"><polygon points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" fill="rgba(255,207,107,.38)" stroke="#ffcf6b" stroke-width="3" stroke-linejoin="round"/>';
    pts.forEach(function (p) { h += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="#fff3d6"/>'; });
    code.forEach(function (a, r) { var p = pts[AREAS.indexOf(a)], col = r === 0 ? '#ffcf6b' : r === 1 ? '#46b3b0' : '#e8708a'; h += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="12" fill="' + col + '" stroke="#2a2038" stroke-width="2"/><text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" style="font-family:var(--display);font-weight:800;font-size:14px;fill:#2a2038">' + (r + 1) + '</text>'; });
    h += '</g>';
    AREAS.forEach(function (a, i) {
      var p = pt(i, 1.0), ang = -Math.PI / 2 + i * Math.PI / 3, lx = cx + Math.cos(ang) * (R + 16), ly = cy + Math.sin(ang) * (R + 16) + (Math.sin(ang) > .5 ? 14 : Math.sin(ang) < -.5 ? -4 : 5), c = Math.cos(ang);
      h += '<text x="' + lx + '" y="' + ly + '" text-anchor="' + (c > .3 ? 'start' : c < -.3 ? 'end' : 'middle') + '" style="font-family:var(--body);font-weight:800;font-size:15px;fill:' + (code.indexOf(a) >= 0 ? '#fff3d6' : '#a9a1c8') + '">' + NAME[a] + '</text>';
    });
    return h;
  }
""")
cut("  function toReveal() {","  $('openDoors').addEventListener","""  function toReveal() {
    var r = state.result = M.journeyResult(bank, state.choices);
    var code = r.code.code, pr = r.profile;
    show('reveal'); Snd.reveal(); $('reveal').scrollTop = 0;
    $('compass').innerHTML = radar(pr, code);
    $('compass').setAttribute('aria-label', 'Radar chart. Your strongest areas: ' + code.map(function (a) { return NAME[a]; }).join(', ') + '.');
    $('outro').textContent = STORY.outro;
    var tied = r.code.alternatives.length > 1;
    $('revealLine').textContent = 'Your top three: ' + code.map(function (a) { return NAME[a]; }).join(', ') + '.';
    var order = AREAS.slice().sort(function (a, b) { return pr[b] - pr[a]; });
    $('legend').innerHTML = order.map(function (a, i) {
      var top = code.indexOf(a) >= 0, rk = top ? code.indexOf(a) + 1 : '';
      return '<li class="' + (top ? '' : 'dim') + '" style="animation-delay:' + (i * 120) + 'ms"><span class="rk">' + (rk || '·') + '</span><div><div class="nm">' + NAME[a] + ' <span>' + BLURB[a] + '</span></div><span class="bar"><i style="width:' + Math.round(zv(pr[a]) * 100) + '%"></i></span>' + (top ? '<div class="sch">In school this often shows up in: ' + AREA_SCHOOL[a] + '.</div>' : '') + '</div></li>';
    }).join('');
    var notes = [r.confidence === 'clear' ? 'Your top three stood out clearly.' : r.confidence === 'close' ? 'Some areas were close, so the order could swap on another day.' : 'You liked many kinds of things, so these are close calls. Nothing is wrong, and another walk on another day will sharpen it.'];
    if (r.consistency.mixed) notes.push('When a lamp flickered back, your choice changed. People change their minds. Treat this as a first draft.');
    if (r.lowEngagement) notes.push('Not much caught your eye on this walk. Try again when you feel like it.');
    $('notes').hidden = false; $('notes').textContent = notes.join(' ');
  }
""")

# ---------------- JS: fields + field detail
cut("  var BAND_BADGE","  $('again').addEventListener","""  var FIELDS = [
    { id: 'psy', cluster: 'Psychology', name: 'Understanding people', icon: '🧠', blurb: 'Helping people think, feel and grow.', areas: ['S', 'I'], stream: 'Any stream (Humanities with Psychology is common)',
      steps: { exams: 'CUET-UG (Psychology) for central universities. Many private universities run their own tests.', degree: 'BA or BSc Psychology (3 years), then MA or MSc (2 years). Clinical psychologists then need an RCI-recognised M.Phil. School counsellors often add a B.Ed.', early: 'Volunteer with a school counsellor, a clinic or an NGO.' },
      subjects: { cbse: 'English, Psychology, and two or three of Biology, Sociology, Political Science, Economics.', isc: 'English, Psychology, and two or three of Biology, Sociology, Political Science, Economics, Computer Science.', state: 'Humanities or Science (Biology). Psychology is offered in many state boards.' } },
    { id: 'tec', cluster: 'Tech and AI', name: 'Technology and data', icon: '💻', blurb: 'Building software, AI and electronics.', areas: ['I', 'R', 'C'], stream: 'Science with Maths (PCM + Computer Science)',
      steps: { exams: 'JEE Main and Advanced (NITs, IITs), state entrance tests, and private ones such as BITSAT and VITEEE.', degree: 'B.Tech or BE (4 years) in computer science, AI and data science, or electronics. Some online BS degrees accept students from other streams.', early: 'Build small projects, try coding contests, join a robotics or EV club.' },
      subjects: { cbse: 'English, Physics, Chemistry, Mathematics, and Computer Science or Informatics Practices.', isc: 'English, Physics, Chemistry, Mathematics, and Computer Science.', state: 'Science stream with Maths (PCM). Many states offer Computer Science as an option.' } },
    { id: 'com', cluster: 'Commerce', name: 'Business and money', icon: '📊', blurb: 'Accounts, markets, running and starting businesses.', areas: ['E', 'C'], stream: 'Commerce (add Maths for finance and economics)',
      steps: { exams: 'CUET-UG for BCom and BBA at central universities. IPMAT for the 5-year IPM at some IIMs. NPAT and SET for some private universities. CA Foundation from ICAI.', degree: 'BCom or BBA (3 years). CA runs alongside: Foundation, Intermediate, Final and practical training. An MBA comes later.', early: 'Run the budget for a school fest or a small stall.' },
      subjects: { cbse: 'English, Accountancy, Business Studies, Economics. Add Mathematics if you want finance or data work later.', isc: 'English, Accounts, Commerce or Business Studies, Economics. Mathematics is a strong add-on.', state: 'Commerce stream. Take Maths if your board offers it.' } },
    { id: 'des', cluster: 'Design', name: 'Design and building', icon: '✏️', blurb: 'Shaping how apps, products and buildings look and work.', areas: ['A', 'R', 'I'], stream: 'Any stream (Science with PCM for Architecture)',
      steps: { exams: 'UCEED (IITs), NID DAT and NIFT entrance, plus university tests. Architecture: NATA or JEE Main Paper 2.', degree: 'B.Des (4 years) or B.Arch (5 years). UX roles also come through computer science or psychology degrees.', early: 'Keep a sketchbook, redesign an app you use, build a small portfolio.' },
      subjects: { cbse: 'Any stream works for most design courses. Add Fine Arts or Informatics Practices if you enjoy them. For Architecture take Physics, Chemistry and Mathematics.', isc: 'Any stream works for most design courses. Art or Computer Science helps. For Architecture take Physics, Chemistry and Mathematics.', state: 'Any stream for design. For Architecture take PCM.' } },
    { id: 'law', cluster: 'Law', name: 'Law and justice', icon: '⚖️', blurb: 'Arguing, advising and deciding fairly.', areas: ['E', 'I', 'S'], stream: 'Any stream (Humanities is common)',
      steps: { exams: 'CLAT for National Law Universities, AILET for NLU Delhi, plus CUET and university tests.', degree: '5-year integrated BA LLB or BBA LLB, or a 3-year LLB after any degree. Judicial services: the state judicial services exam after LLB. Check your state\\'s rules.', early: 'Join debate or Model UN. Read a news story and argue both sides.' },
      subjects: { cbse: 'English plus subjects that build reading and argument: Political Science, History, Legal Studies, Economics.', isc: 'English plus Political Science, History, Legal Studies, Economics or Psychology.', state: 'Any stream. Humanities is common.' } }
  ];
  var BLINE = {
    'psy-1': 'Helps people with serious mental-health conditions, through assessment and therapy.', 'psy-2': 'Talks with people about stress, relationships and life choices.',
    'psy-3': 'Supports students with studies, feelings and career choices.', 'psy-4': 'Makes workplaces fairer, healthier and more effective.',
    'psy-5': 'Finds out how people use apps and products so designers can fix what frustrates them.', 'tec-1': 'Builds the software and AI tools that apps and companies run on.',
    'tec-2': 'Finds patterns in large amounts of data to answer questions and predict what comes next.', 'tec-3': 'Designs the circuits, batteries and controls inside devices and electric vehicles.',
    'com-1': 'Keeps accounts honest: audit, tax and financial advice for businesses.', 'com-2': 'Runs a team or starts a business: plans, people and money.',
    'des-1': 'Shapes how apps and products look and feel to use.', 'des-2': 'Designs buildings and spaces that are safe, useful and beautiful.',
    'law-1': 'Advises companies on contracts, deals and rules.', 'law-2': 'Hears cases and decides them fairly, after the state judicial exams.'
  };
  var FIT = { strong: 'Strong fit', mixed: 'Worth exploring', weak: 'Less likely fit', unclear: 'Not clear' };
  var LEAN_FIELDS = { science: ['tec', 'psy'], commerce: ['com'], humanities: ['psy', 'law'], arts: ['des'] }, LEAN_NAME = { science: 'Science', commerce: 'Commerce', humanities: 'Humanities', arts: 'Arts and design' };
  function fieldFits() {
    var r = state.result, matches = M.careerPaths(r.profile, CAREERS.map(function (c) { return { careerId: c.id, values: VEC[c.soc] }; })), by = {};
    matches.forEach(function (m) { by[m.careerId] = m; });
    return FIELDS.map(function (f) {
      var ms = CAREERS.filter(function (c) { return c.cluster === f.cluster; }).map(function (c) { return by[c.id]; }).sort(function (a, b) { return b.r - a.r; });
      var top = ms.slice(0, 2), score = top.reduce(function (a, m) { return a + m.r; }, 0) / top.length;
      return { f: f, ms: ms, score: score, band: score >= .5 ? 'strong' : score >= 0 ? 'mixed' : 'weak' };
    }).sort(function (a, b) { return b.score - a.score; });
  }
  function toDoors() {
    show('doors'); Snd.door(); $('doors').scrollTop = 0;
    var fits = state.fits = fieldFits(), lean = state.ctx.lean;
    var ln = $('leanNote'); ln.hidden = true;
    if (LEAN_FIELDS[lean]) {
      var hit = LEAN_FIELDS[lean].indexOf(fits[0].f.id) >= 0;
      ln.hidden = false; ln.textContent = hit ? 'You were leaning towards ' + LEAN_NAME[lean] + '. Your shape agrees: ' + fits[0].f.name + ' is your closest match.' : 'You were leaning towards ' + LEAN_NAME[lean] + '. Your shape points to ' + fits[0].f.name + ' first. Both are worth a look.';
    } else if (lean === 'unsure') { ln.hidden = false; ln.textContent = 'Not sure yet is a fine place to be. Start with the first field and see if it feels right.'; }
    $('fields').innerHTML = fits.map(function (x, i) {
      return '<button type="button" class="fcard" data-id="' + x.f.id + '"><span class="gl" aria-hidden="true">' + x.f.icon + '</span><span><h3>' + x.f.name + '</h3><p>' + x.f.blurb + '</p><span class="meta"><span class="pill ' + x.band + '">' + FIT[x.band] + '</span><span class="pill">Class 11 to 12: ' + x.f.stream.split(' (')[0] + '</span></span></span><span class="chev" aria-hidden="true">›</span></button>';
    }).join('');
  }
  $('fields').addEventListener('click', function (e) { var b = e.target.closest('.fcard'); if (b) toField(b.dataset.id); });
  function boardKey() { var b = state.ctx.board; return b === 'cbse' ? 'cbse' : b === 'isc' ? 'isc' : 'state'; }
  function toField(id) {
    var x = state.fits.filter(function (y) { return y.f.id === id; })[0], f = x.f, code = state.result.code.code;
    show('field'); Snd.door(); $('field').scrollTop = 0; state.fieldId = id;
    $('fTitle').textContent = f.name;
    var sh = f.areas.filter(function (a) { return code.indexOf(a) >= 0; });
    $('fWhy').textContent = sh.length ? 'This lines up with your ' + sh.map(function (a) { return NAME[a]; }).join(' and ') + ' side.' : 'Not a close match to your top three, but it can still be worth a look.';
    $('fCareers').innerHTML = x.ms.map(function (m) { var c = BYID[m.careerId]; return '<div class="crow"><b>' + c.title + '</b><span class="pill ' + m.band + '">' + FIT[m.band] + '</span><p>' + BLINE[c.id] + '</p></div>'; }).join('');
    renderPath();
  }
  function renderPath() {
    var f = state.fits.filter(function (y) { return y.f.id === state.fieldId; })[0].f, bk = boardKey(), cls = state.ctx.cls;
    $('fBoard').innerHTML = [['cbse', 'CBSE'], ['isc', 'ICSE / ISC'], ['state', 'State / other']].map(function (o) { return '<button type="button" data-b="' + o[0] + '" aria-pressed="' + (o[0] === bk) + '">' + o[1] + '</button>'; }).join('');
    var now = cls === '11' || cls === '12' ? 'You are in Class ' + cls + '. Your stream is set, so put your effort into the subjects below and the exams.' : cls === '10' || cls === '9' ? 'You are choosing a stream soon. This field usually points to ' + f.stream + '.' : 'This field usually points to ' + f.stream + ' in Class 11 and 12.';
    var note = (state.ctx.board === 'isc') ? ' ICSE ends at Class 10, so you pick your stream when you move to ISC or another board for Class 11.' : '';
    $('fPath').innerHTML = [['now', 'Now', now + note], ['', 'Class 11 to 12 subjects', f.subjects[bk]], ['', 'Entrance exams', f.steps.exams], ['', 'Degree', f.steps.degree], ['', 'Try it early', f.steps.early]].map(function (t) { return '<li class="' + t[0] + '"><small>' + t[1] + '</small><span>' + t[2] + '</span></li>'; }).join('');
  }
  $('fBoard').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.ctx.board = b.dataset.b === 'state' ? 'state' : b.dataset.b; renderPath(); });
  $('fBack').addEventListener('click', function () { show('doors'); });
""")
open('lamps4.html','w',encoding='utf8').write(s); print('ok')
