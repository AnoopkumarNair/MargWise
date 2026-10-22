import json
s=open('lamps18.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:100]); s=s.replace(a,b)
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index(';window.MW_STORY')
s=s[:i]+'<script>window.MW_CONTENT = '+content+s[j:]

# 1. a new walk gets a fresh card layout (was: same SEED all session, so "walk again" repeated the same layout)
rep("  function startWalk() { state.choices = [];","  function startWalk() { if (!/[?&]seed=\\d+/.test(location.search)) SEED = Math.floor(Math.random() * 1e6); state.choices = [];")
# 2. veil: every change of screen fades up from night instead of cutting
rep("  function show(view) {\n    state.view = view;","  function veilGo() { if (state.reduce) return; try { var v = $('veil'); v.getAnimations().forEach(function (a) { a.cancel(); }); v.animate([{ opacity: 1 }, { opacity: 1, offset: .18 }, { opacity: 0 }], { duration: 560, easing: 'ease-out' }); } catch (e) { /* no animation support */ } }\n  function show(view) {\n    var prev = state.view; if (prev && prev !== view) veilGo();\n    state.view = view;")
rep('  <div id="gate" hidden','  <div id="veil" aria-hidden="true"></div>\n  <div id="gate" hidden')
rep("  /* ----- lamp locks (puzzles) ----- */","  #veil { position: absolute; inset: 0; z-index: 48; background: #070a22; opacity: 0; pointer-events: none; }\n  #finale.on { animation: fnin .9s ease-out both; } @keyframes fnin { from { opacity: 0; } to { opacity: 1; } }\n  .linkbtn { background: none; border: 0; color: #ffe08a; text-decoration: underline; font: inherit; font-weight: 700; text-align: left; padding: 10px 0; min-height: 44px; }\n  /* ----- lamp locks (puzzles) ----- */")
# 3. fewer voices: narration is unlabelled, only the keeper speaks after a lamp is lit, Jyo speaks only in hints
rep("    say('<span class=\"thread\" aria-hidden=\"false\">' + esc(threadFor()) + '</span><span><b>Jyo</b>' + esc(state.echo ? 'The lamp at ' + scene.place + ' is flickering, as if it wants a second look.' : scene.setup) + '</span>');","    say('<span class=\"thread\"></span><span>' + esc(state.echo ? 'The lamp at ' + scene.place + ' is flickering, as if it wants a second look.' : scene.setup) + '</span>');")
rep("    $('bubble').classList.toggle('nothread', !(state.echo || litCount() % 3 === 0));","    $('bubble').classList.add('nothread');")
rep("    $('bubble').classList.remove('nothread');\n    say('<span class=\"thread\">' + (echoing ? 'Steady again.' : esc(META.noteIntro + ' \\u201c' + frag + '\\u201d')) + '</span><span><b>Jyo</b>' + esc(echoing","    $('bubble').classList.add('nothread');\n    say('<span class=\"thread\"></span><span>' + esc(echoing")
# 4. abroad lives inside the field page only
rep('<button class="go quiet" id="dAbroad" type="button">Study and work abroad</button>','')
rep("  $('dAbroad').addEventListener('click', function () { toAbroad(null, 'doors'); });\n","")
rep('<div class="actions"><button class="go quiet" id="fAbroad" type="button">Study and work abroad in this field</button><button class="go quiet" id="fBack">Back to all fields</button></div>','<div class="actions"><button class="go quiet" id="fBack">Back to all fields</button></div>')
rep('<ol class="tl" id="fPath"></ol></div>','<ol class="tl" id="fPath"></ol><button class="linkbtn" id="fAbroad" type="button">Thinking of studying or working abroad? See how it works for this field.</button></div>')
# 5. India path: first jobs and pay, plan B, how to compare colleges
rep("    var steps = [['now', 'Now', now + note], ['', 'Class 11 to 12 subjects', f.subjects[bk]], ['', 'Entrance exams', f.exams], ['', 'Degree', f.degree], ['', 'Try it early', f.early]];","""    var fx = (state.fits || []).filter(function (y) { return y.f.id === f.id; })[0], roles = fx ? fx.ms.slice(0, 3).map(function (m) { return BYID[m.careerId].title; }).join(', ') : '';
    var steps = [['now', 'Now', now + note], ['', 'Class 11 to 12 subjects', f.subjects[bk]], ['', 'Entrance exams', f.exams], ['', 'Degree', f.degree], ['', 'First jobs and pay in India', (roles ? 'Roles to look at first: ' + esc(roles) + '. ' : '') + plfsText()], ['', 'If plan A does not work', f.backup || ''], ['', 'Compare colleges', f.compare || ''], ['', 'Try it early', f.early]];""")
rep("    if (f.note) steps.push(['', 'Good to know', f.note]);\n    $('fPath').innerHTML = steps.map(","    if (f.note) steps.push(['', 'Good to know', f.note]);\n    steps = steps.filter(function (t) { return t[2]; });\n    $('fPath').innerHTML = steps.map(")
rep("</div>'; }).join('') + plfsNote();","</div>'; }).join('');")
rep("  function plfsNote() {","""  function plfsText() {
    var p = CONTENT.plfs; if (!p) return '';
    return 'Salaried graduates in India earn about ₹' + p.education.Graduate.toLocaleString('en-IN') + ' a month on average, and postgraduates ₹' + p.education['Postgraduate and above'].toLocaleString('en-IN') + ' (PLFS ' + p.year + ', <a href="' + p.src[0] + '" target="_blank" rel="noopener noreferrer">MoSPI</a>). People aged 25 to 29 earn about ₹' + p.age['25-29'].toLocaleString('en-IN') + '. These are averages for salaried workers, and they hide a wide spread.';
  }
  function plfsNote() {""")
# 6. field score: average of the best four careers, compared with a baked null from real random journeys
rep("      var raw = ms.reduce(function (a, m) { return a + m.r; }, 0) / ms.length, nf = nullStats()[f.id], score = (raw - nf.m) / nf.sd;","      var kk = Math.min(CONTENT.fieldK || ms.length, ms.length), raw = ms.slice(0, kk).reduce(function (a, m) { return a + m.r; }, 0) / kk, nf = nullStats()[f.id], score = (raw - nf.m) / nf.sd;")
rep("  function nullStats() {\n    if (NULLF) return NULLF;","  function nullStats() {\n    if (NULLF) return NULLF;\n    if (CONTENT.fieldNull) { NULLF = CONTENT.fieldNull; return NULLF; }")
open('lamps19.html','w',encoding='utf8').write(s); print('ok')
