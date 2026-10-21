import json
s=open('lamps4.html',encoding='utf8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
def cut(start,end,new):
    global s
    i=s.index(start); j=s.index(end,i); s=s[:i]+new+s[j:]
content=open('content.json',encoding='utf8').read(); story=open('story2.json',encoding='utf8').read()

# data
rep("<script>window.LAMP_ART = ","<script>window.MW_CONTENT = "+content+";window.MW_STORY = "+story+";</script>\n<script>window.LAMP_ART = ") if False else None
i=s.index('<script>window.LAMP_ART'); s=s[:i]+'<script>window.MW_CONTENT = '+json.dumps(json.loads(content),separators=(',',':'),ensure_ascii=False)+';window.MW_STORY = '+json.dumps(json.loads(story),separators=(',',':'),ensure_ascii=False)+';</script>\n'+s[i:]

# story override
rep("  var bank = M.JOURNEY_BANK, STORY = bank.story;","""  var STORY2 = window.MW_STORY, META = STORY2.meta;
  // The story layer rewrites words only. Option ids and scoring loads are untouched.
  function applyStory(b) {
    var c = JSON.parse(JSON.stringify(b));
    c.scenes.forEach(function (sc) {
      var t = STORY2.scenes[sc.id]; if (!t) return;
      sc.place = t.place; sc.setup = t.setup; sc.lit = t.lit;
      sc.options.forEach(function (o) { var k = o.id.split('-')[1]; if (t.o[k]) o.text = t.o[k]; });
    });
    return c;
  }
  var bank = applyStory(M.JOURNEY_BANK), STORY = bank.story;""")
# careers
cut("  var CAREERS = [","  var BYID = {};","  var CONTENT = window.MW_CONTENT, CAREERS = CONTENT.careers;\n")

# beat overlay html + css
rep('<div id="app">\n','''<div id="app">
  <div class="beat" id="beat" hidden role="dialog" aria-modal="true" aria-labelledby="beatWho"><div class="beatcard"><small id="beatWho"></small><h3 id="beatTitle"></h3><p id="beatText"></p><button class="go" id="beatGo" type="button">Walk on</button></div></div>
''')
rep("  /* ----- loader ----- */","""  /* ----- story beats ----- */
  .beat { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; padding: 20px; background: rgba(10,12,30,.72); }
  .beatcard { background: var(--cream); color: var(--ink); border-radius: 22px; padding: 20px; width: min(380px, 100%); display: grid; gap: 10px; animation: pop .35s cubic-bezier(.2,1.4,.4,1) both; box-shadow: 0 8px 0 #b9955a; }
  .beatcard small { font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #8a4f10; font-size: 13px; }
  .beatcard h3 { font-size: 28px; font-weight: 800; } .beatcard h3:empty { display: none; }
  .beatcard p { font-size: 17px; font-weight: 600; color: var(--ink-soft); line-height: 1.4; }
  .beatcard .go { color: var(--ink); margin-top: 4px; }
  .frow { width: 100%; display: grid; grid-template-columns: 34px 1fr auto 16px; gap: 10px; align-items: center; text-align: left; background: rgba(255,255,255,.08); border: 0; border-radius: 14px; padding: 10px 12px; min-height: 52px; }
  .frow .gl { font-size: 22px; } .frow b { font-size: 16px; } .frow .chev { color: rgba(255,243,214,.7); }
  .sec { font-size: 17px; font-family: var(--body); font-weight: 800; margin-top: 4px; }
  details.allf { background: rgba(255,255,255,.05); border-radius: 16px; padding: 10px 12px; }
  details.allf summary { cursor: pointer; font-weight: 800; font-size: 16px; min-height: 36px; display: flex; align-items: center; }
  details.allf h3 { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--glow); font-family: var(--body); font-weight: 800; margin: 12px 0 6px; }
  details.allf .frow { margin-bottom: 6px; }
  .chk-list { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; } .src a { color: var(--glow); }
  /* ----- loader ----- */""")

# beat logic + start of walk
rep("  function startWalk() { state.choices = []; advance(true); }","""  var beatCb = null;
  function showBeat(who, title, text, cb) {
    $('beatWho').textContent = who; $('beatTitle').textContent = title || ''; $('beatText').textContent = text; beatCb = cb || null;
    $('beat').hidden = false; $('beatGo').focus();
  }
  $('beatGo').addEventListener('click', function () { $('beat').hidden = true; var f = beatCb; beatCb = null; if (f) f(); });
  function startWalk() { state.choices = []; advance(true); var c = META.chapters[0]; showBeat(c.roman, c.title, c.line, null); }""")

# lit line with keeper + note fragment, beats
i=s.index("    say('<span class=\"thread\">' + (echoing ?"); j=s.index("\n",i)
s=s[:i]+"""    var t2 = STORY2.scenes[scene.id] || {}, frag = META.note.slice(0, Math.min(n, META.note.length)).join(' ');
    $('bubble').classList.remove('nothread');
    say('<span class="thread">' + (echoing ? 'Steady again.' : esc(META.noteIntro + ' \\u201c' + frag + '\\u201d')) + '</span><span><b>Jyo</b>' + esc(echoing ? 'The flame holds. Thank you for looking again.' : scene.lit || 'The lamp is lit.') + '</span>' + (!echoing && t2.keeper ? '<span><b>' + esc(t2.keeper) + '</b>\\u201c' + esc(t2.line) + '\\u201d</span>' : ''));"""+s[j:]
rep("    advTimer = setTimeout(function () { advance(false); }, state.reduce ? 3200 : 1050);","""    var beat = null;
    if (!echoing) {
      if (META.ila[n]) beat = ['Ila', '', META.ila[n]];
      else META.chapters.forEach(function (c) { if (c.at === n && n > 0) beat = [c.roman, c.title, c.line]; });
    }
    if (beat) advTimer = setTimeout(function () { showBeat(beat[0], beat[1], beat[2], function () { advance(false); }); }, state.reduce ? 2600 : 2100);
    else advTimer = setTimeout(function () { advance(false); }, state.reduce ? 3600 : 2300);""")

# fields (new)
cut("  var FIELDS = [","  $('fields').addEventListener('click'","""  var FIELDS = CONTENT.fields, FBY = {}; FIELDS.forEach(function (f) { FBY[f.id] = f; });
  var GROUPS = ['Science', 'Commerce', 'Humanities', 'Open to any stream'];
  var FIT = { strong: 'Strong fit', mixed: 'Worth exploring', weak: 'Less likely fit', unclear: 'Not clear' };
  var LEAN_FIELDS = { science: ['health', 'sci', 'eng', 'tec'], commerce: ['com'], humanities: ['psy', 'law', 'media', 'pub'], arts: ['des', 'media'] }, LEAN_NAME = { science: 'Science', commerce: 'Commerce', humanities: 'Humanities', arts: 'Arts and design' };
  function fieldFits() {
    var r = state.result, matches = M.careerPaths(r.profile, CAREERS.map(function (c) { return { careerId: c.id, values: c.values }; })), by = {};
    matches.forEach(function (m) { by[m.careerId] = m; });
    return FIELDS.map(function (f) {
      var ms = CAREERS.filter(function (c) { return c.field === f.id; }).map(function (c) { return by[c.id]; }).sort(function (a, b) { return b.r - a.r; });
      var top = ms.slice(0, 2), score = top.reduce(function (a, m) { return a + m.r; }, 0) / top.length;
      return { f: f, ms: ms, score: score, band: score >= .5 ? 'strong' : score >= 0 ? 'mixed' : 'weak' };
    }).sort(function (a, b) { return b.score - a.score; });
  }
  function toDoors() {
    show('doors'); Snd.door(); $('doors').scrollTop = 0;
    var fits = state.fits = fieldFits(), lean = state.ctx.lean, ln = $('leanNote'); ln.hidden = true;
    if (LEAN_FIELDS[lean]) {
      var top3 = fits.slice(0, 3).map(function (x) { return x.f.id; }), hit = LEAN_FIELDS[lean].some(function (id) { return top3.indexOf(id) >= 0; });
      ln.hidden = false; ln.textContent = hit ? 'You were leaning towards ' + LEAN_NAME[lean] + '. Your shape agrees: at least one of your closest fields is in that area.' : 'You were leaning towards ' + LEAN_NAME[lean] + '. Your shape points to ' + fits[0].f.name + ' first. Both are worth a look.';
    } else if (lean === 'unsure') { ln.hidden = false; ln.textContent = 'Not sure yet is a fine place to be. Start with the first field and see if it feels right.'; }
    $('fields').innerHTML = fits.slice(0, 3).map(function (x) {
      return '<button type="button" class="fcard" data-id="' + x.f.id + '"><span class="gl" aria-hidden="true">' + x.f.icon + '</span><span><h3>' + x.f.name + '</h3><p>' + x.f.blurb + '</p><span class="meta"><span class="pill ' + x.band + '">' + FIT[x.band] + '</span><span class="pill">' + x.f.group + '</span></span></span><span class="chev" aria-hidden="true">\\u203a</span></button>';
    }).join('');
    $('allSum').textContent = 'All ' + fits.length + ' fields, by stream';
    $('allFields').innerHTML = GROUPS.map(function (g) {
      var rows = fits.filter(function (x) { return x.f.group === g; }); if (!rows.length) return '';
      return '<h3>' + g + '</h3>' + rows.map(function (x) { return '<button type="button" class="frow" data-id="' + x.f.id + '"><span class="gl" aria-hidden="true">' + x.f.icon + '</span><b>' + x.f.name + '</b><span class="pill ' + x.band + '">' + FIT[x.band] + '</span><span class="chev" aria-hidden="true">\\u203a</span></button>'; }).join('');
    }).join('');
  }
  $('allFields').addEventListener('click', function (e) { var b = e.target.closest('.frow'); if (b) toField(b.dataset.id); });
""")
cut("  function toField(id) {","  $('fBoard').addEventListener","""  function toField(id) {
    var x = state.fits.filter(function (y) { return y.f.id === id; })[0], f = x.f, code = state.result.code.code;
    show('field'); Snd.door(); $('field').scrollTop = 0; state.fieldId = id;
    $('fTitle').textContent = f.name;
    var sh = f.areas.filter(function (a) { return code.indexOf(a) >= 0; });
    $('fWhy').textContent = sh.length ? 'This lines up with your ' + sh.map(function (a) { return NAME[a]; }).join(' and ') + ' side.' : 'Not a close match to your top three, but it can still be worth a look.';
    $('fCareers').innerHTML = x.ms.map(function (m) { var c = BYID[m.careerId]; return '<div class="crow"><b>' + c.title + '</b><span class="pill ' + m.band + '">' + FIT[m.band] + '</span><p>' + c.line + '</p></div>'; }).join('');
    $('fSrc').innerHTML = (f.verify.length ? '<b>Check before relying on this:</b><ul class="chk-list">' + f.verify.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>' : '') + '<p class="src" style="margin-top:8px"><b>Where to check:</b> ' + f.sources.map(function (z) { return '<a href="' + z.url + '" target="_blank" rel="noopener noreferrer">' + esc(z.name) + '</a>'; }).join(', ') + '. Career fit uses O*NET interest profiles, which come from US jobs and are only a rough guide for India.</p>';
    renderPath();
  }
  function renderPath() {
    var f = FBY[state.fieldId], bk = boardKey(), cls = state.ctx.cls;
    $('fBoard').innerHTML = [['cbse', 'CBSE'], ['isc', 'ICSE / ISC'], ['state', 'State / other']].map(function (o) { return '<button type="button" data-b="' + o[0] + '" aria-pressed="' + (o[0] === bk) + '">' + o[1] + '</button>'; }).join('');
    var now = cls === '11' || cls === '12' ? 'You are in Class ' + cls + '. Put your effort into the subjects and exams below. ' + f.pick : cls === '10' || cls === '9' ? 'You will choose a stream soon. ' + f.pick : f.pick;
    var note = (state.ctx.board === 'isc') ? ' ICSE ends at Class 10, so you pick your stream when you move to ISC or another board for Class 11.' : '';
    var steps = [['now', 'Now', now + note], ['', 'Class 11 to 12 subjects', f.subjects[bk]], ['', 'Entrance exams', f.exams], ['', 'Degree', f.degree], ['', 'Try it early', f.early]];
    if (f.note) steps.push(['', 'Good to know', f.note]);
    $('fPath').innerHTML = steps.map(function (t) { return '<li class="' + t[0] + '"><small>' + t[1] + '</small><span>' + t[2] + '</span></li>'; }).join('');
  }
""")
# doors + field html
rep('''    <p class="fineprint">Prototype content. Careers and school paths are drafts for counsellor review. Check official sites for current rules.</p>
    <div class="actions"><button class="go quiet" id="again">Walk the road again</button></div>''','''    <details class="allf"><summary id="allSum">All fields, by stream</summary><div id="allFields"></div></details>
    <p class="fineprint">Prototype content. Careers and school paths are drafts for counsellor review. Check official sites for current rules.</p>
    <div class="actions"><button class="go quiet" id="again">Walk the road again</button></div>''')
rep('<div class="head"><h2>Where this can lead</h2><p>Five fields, ordered by how well they match your shape. Tap one to see careers and the school path.</p></div>\n    <div class="lean" id="leanNote" hidden></div>\n    <div style="display:grid; gap:12px" id="fields"></div>','<div class="head"><h2>Where this can lead</h2><p>Your three closest fields are first. Tap one to see careers and the school path.</p></div>\n    <div class="lean" id="leanNote" hidden></div>\n    <div style="display:grid; gap:12px" id="fields"></div>')
rep('<p class="fineprint">Prototype content. Drafts for counsellor review. Check official sites for current rules.</p>\n    <div class="actions"><button class="go quiet" id="fBack">','<div class="fineprint" id="fSrc"></div>\n    <div class="actions"><button class="go quiet" id="fBack">')
open('lamps5.html','w',encoding='utf8').write(s); print('ok',len(s)//1000,'KB')
