import json
s=open('lamps13.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
story=json.dumps(json.load(open('story2.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('window.MW_STORY = '); j=s.index(';window.MW_ABROAD')
s=s[:i]+'window.MW_STORY = '+story+s[j:]

# ---- CSS: contrast pass, consent popup, parent page, print
rep("  /* ----- tester pack: gate, ratings, feedback ----- */","""  /* ----- contrast pass ----- */
  .progwrap { background: rgba(14,16,40,.62); border-radius: 12px; padding: 4px 10px 5px; }
  .prog span { color: #ffe08a; }
  .bubble .thread { color: #3e3354; }
  .ranked li.dim { opacity: 1; background: rgba(255,255,255,.07); }
  .ranked li.dim .nm, .ranked li.dim .nm span { color: #f3ecd8; }
  .ranked li.dim .sch { color: #e6dfcc; }
  .ranked .nm span { color: #f3ecd8; }
  .note { background: rgba(20,22,52,.72); border-color: #ffcf6b; color: #fff3d6; }
  .howto { color: #efe7d2; }
  .cchips button, .rcards button, .chip { background: rgba(20,22,52,.55); border-color: rgba(255,243,214,.6); color: #fff3d6; }
  .cchips button[aria-pressed="true"], .rcards button[aria-pressed="true"] { color: #2a2038; }
  .rcards button[aria-pressed="true"] { background: #ffe9a8; }
  .rcards button[aria-pressed="true"] ul, .rcards button[aria-pressed="true"] b { color: #2a2038; }
  .acard .vf { background: rgba(20,22,52,.75); border-color: #ffcf6b; color: #fff3d6; }
  .acard .sm { color: #f3ecd8; }
  /* ----- consent popup ----- */
  #consent { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; padding: 18px; background: rgba(10,12,30,.78); }
  #consent .beatcard { gap: 12px; } #consent .go.quiet { margin-top: 0; }
  /* ----- parent summary ----- */
  #parent { overflow-y: auto; } #parent .pgcard { background: #fff8e6; color: #2a2038; border-radius: 18px; padding: 16px; display: grid; gap: 12px; }
  #parent h3 { font-size: 17px; margin: 0; color: #2a2038; } #parent .pnm { font: inherit; font-weight: 800; font-size: 18px; padding: 8px 10px; border-radius: 10px; border: 2px solid #8a7a98; background: #fff; color: #2a2038; width: 100%; }
  #parent .pmeta { font-size: 14px; color: #4a3f5c; font-weight: 600; }
  #parent .prow { display: grid; grid-template-columns: 110px 1fr 38px; gap: 8px; align-items: center; font-weight: 700; font-size: 14.5px; }
  #parent .pbar { height: 10px; border-radius: 8px; background: #e8dcc0; overflow: hidden; } #parent .pbar i { display: block; height: 100%; background: #d9881c; }
  #parent ol, #parent ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 14.5px; font-weight: 600; }
  #parent .pcar { font-weight: 600; color: #4a3f5c; }
  #parent .pfine { font-size: 13px; font-weight: 600; color: #4a3f5c; border-top: 1px solid #d7c9a6; padding-top: 8px; }
  @media print {
    html, body { background: #fff !important; }
    #app > *:not(#parent) { display: none !important; }
    #parent { display: block !important; position: static !important; overflow: visible !important; padding: 0 !important; }
    #parent .head, #parent .actions, #parent .pnoprint { display: none !important; }
    #parent .pgcard { background: #fff; border: 1px solid #999; border-radius: 0; }
    #parent .pnm { border: 0; padding: 0; font-size: 22px; }
  }
  /* ----- tester pack: gate, ratings, feedback ----- */""")

# ---- HTML: consent popup, parent section, buttons
rep('  <div class="beat" id="beat" hidden','''  <div id="consent" hidden role="dialog" aria-modal="true" aria-labelledby="consentT"><div class="beatcard">
    <small>Before you begin</small><h3 id="consentT">Is a parent or guardian with you?</h3>
    <p>Please make sure a parent or guardian has agreed to this, or take the test together with them. Students under 18 should not do it alone.</p>
    <button class="go" id="consentYes" type="button">Yes, a parent has agreed or is with me</button>
    <button class="go quiet" id="consentNo" type="button">Go back</button>
  </div></div>
  <div class="beat" id="beat" hidden''')
rep('  <section class="screen pad res" id="abroad">','''  <section class="screen pad res" id="parent">
    <div class="head"><h2>Summary for parents</h2><p>One page you can read together, save or print.</p></div>
    <div class="pgcard" id="pgcard"></div>
    <div class="actions"><button class="go" id="pPrint" type="button">Print or save as PDF</button><button class="go quiet" id="pBack" type="button">Back</button></div>
  </section>

  <section class="screen pad res" id="abroad">''')
rep('<div class="actions"><button class="go quiet" id="dAbroad" type="button">','<div class="actions"><button class="go" id="dParent" type="button">Summary for parents</button><button class="go quiet" id="dAbroad" type="button">')
rep("['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field', 'abroad'].forEach","['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field', 'abroad', 'parent'].forEach")
rep("    else if (state.view === 'abroad') { show(state.ab.from || 'doors'); }\n  });","    else if (state.view === 'abroad') { show(state.ab.from || 'doors'); }\n    else if (state.view === 'parent') { show('doors'); }\n  });")
# radar label contrast
rep("'#fff3d6' : '#a9a1c8'","'#fff3d6' : '#ddd6f2'")

# ---- parent summary logic
rep("  // ---- gate\n","""  // ---- parent summary
  function parentName() { return (TK && TK.name) || (readSave() && readSave().name) || ''; }
  function paintParent() {
    var r = state.result; if (!r) return;
    var fits = state.fits || fieldFits(), nm = $('pNm') ? $('pNm').value : parentName(), pr = r.profile, d = new Date();
    var order = AREAS.slice().sort(function (a, b) { return pr[b] - pr[a]; }), ctx = state.ctx || {};
    var ctxLine = [ctx.cls && ('Class ' + ctx.cls), ctx.board && ('Board: ' + ctx.board), ctx.lean && ('Leaning towards: ' + (LEAN_NAME[ctx.lean] || ctx.lean))].filter(Boolean).join(' · ');
    var h = '<div><label class="pnoprint" for="pNm" style="font-size:13px;font-weight:700">Student name (you can edit it)</label><input class="pnm" id="pNm" type="text" maxlength="40" autocomplete="off" value="' + esc(nm) + '"><div class="pmeta">' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + (ctxLine ? ' · ' + esc(ctxLine) : '') + '</div></div>';
    h += '<div><h3>Interest shape: ' + esc(r.code.code.slice(0, 3).map(function (a) { return NAME[a]; }).join(', ')) + '</h3><div class="pmeta">Strongest first. The bars compare the student\\'s own choices with each other.</div></div>';
    h += '<div style="display:grid;gap:6px">' + order.map(function (a) { var w = Math.round(zv(pr[a]) * 100); return '<div class="prow"><span>' + NAME[a] + '</span><span class="pbar"><i style="width:' + w + '%"></i></span><span>' + w + '</span></div><div class="pmeta" style="margin-top:-4px">' + esc(BLURB[a]) + '</div>'; }).join('') + '</div>';
    h += '<div><h3>Closest fields</h3><ol>' + fits.slice(0, 5).map(function (x) { var top = x.ms.slice(0, 3).map(function (m) { var c = CAREERS.filter(function (cc) { return cc.id === m.careerId; })[0]; return c ? c.title : ''; }).filter(Boolean).join(', '); return '<li><b>' + esc(x.f.name) + '</b> (' + esc(x.f.stream) + ')<div class="pcar">Careers to look at: ' + esc(top) + '</div></li>'; }).join('') + '</ol></div>';
    var conf = r.noSignal ? 'There was not enough signal to show a clear shape.' : r.cautious ? 'The shape was not sharp, so treat this as a rough first draft.' : 'The shape was fairly clear. It can still change as the student grows and tries new things.';
    h += '<div><h3>How much to trust this</h3><p class="pcar" style="margin:0">' + conf + ' The order of close areas can swap on another day.</p></div>';
    h += '<div><h3>Talking points for home</h3><ul><li>Ask which activities in the game they enjoyed most, and why.</li><li>Look at the careers above together, and check subjects and entrance exams on official sites.</li><li>Treat this as one input next to marks, strengths, family circumstances and a counsellor\\'s advice.</li></ul></div>';
    h += '<div class="pfine">This is an interest guide from a prototype game, not a test of ability and not a prediction. It is still being checked against established inventories. Career data: O*NET 31.0 (USDOL/ETA, CC BY 4.0, modified). School and exam facts are drafts for counsellor review.</div>';
    $('pgcard').innerHTML = h;
    $('pNm').addEventListener('input', function () { /* name is local to this page */ });
  }
  function toParent() { show('parent'); $('parent').scrollTop = 0; paintParent(); track('field_open', { id: 'parent' }); }
  $('dParent').addEventListener('click', toParent);
  $('pBack').addEventListener('click', function () { show('doors'); });
  $('pPrint').addEventListener('click', function () { window.print(); });
  // ---- consent popup before starting the test
  var consentGo = null;
  function askConsent(go) { consentGo = go; $('consent').hidden = false; $('consentYes').focus(); }
  $('consentYes').addEventListener('click', function () { $('consent').hidden = true; var g = consentGo; consentGo = null; if (g) g(); });
  $('consentNo').addEventListener('click', function () { $('consent').hidden = true; consentGo = null; });
  // ---- gate
""")
# gate flow: ask consent before join; non-hosted build asks at Begin
rep("      $('gGo').disabled = true;\n      fetch(MWC.api + '/join'","      if (!$('consent').hidden) return; askConsent(function () { doJoin(name, code); });\n    });\n    function doJoin(name, code) {\n      $('gGo').disabled = true;\n      fetch(MWC.api + '/join'")
rep("catch (e) { $('gGo').disabled = false; $('gErr').textContent = 'No connection","catch (e) { $('gGo').disabled = false; $('gErr').textContent = 'No connection") if False else None
rep("No connection. Please check your internet and try again.'; });\n    });\n  }\n  // ---- ratings","No connection. Please check your internet and try again.'; });\n    }\n  }\n  // ---- ratings")
rep("function modalEl() { return !$('gate').hidden ? $('gate')","function modalEl() { return !$('consent').hidden ? $('consent') : !$('gate').hidden ? $('gate')")
rep("['gate', 'beat', 'saveSheet', 'about', 'fbSheet', 'chkSheet'].forEach","['consent', 'gate', 'beat', 'saveSheet', 'about', 'fbSheet', 'chkSheet'].forEach")
rep("m !== $('beat') && m !== $('gate')) { m.hidden = true; return; }","m !== $('beat') && m !== $('gate') && m !== $('consent')) { m.hidden = true; return; }")
rep("$('beat').hidden && $('saveSheet').hidden && $('gate').hidden &&","$('beat').hidden && $('saveSheet').hidden && $('gate').hidden && $('consent').hidden &&")
open('lamps14.html','w',encoding='utf8').write(s); print('ok')
