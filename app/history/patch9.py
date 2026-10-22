s=open('lamps8.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
# ---------- CSS
rep("  /* ----- story beats ----- */","""  /* ----- tester pack: gate, ratings, feedback ----- */
  #gate { position: absolute; inset: 0; z-index: 55; display: grid; place-items: center; padding: 18px; background: radial-gradient(circle at 50% 30%, #2b2f63 0%, #141a3a 75%); overflow-y: auto; }
  #gate .beatcard { gap: 12px; }
  #gate label, .sheet label.fld { display: grid; gap: 4px; font-weight: 800; font-size: 14.5px; }
  #gate input[type=text], .sheet textarea { font: inherit; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--ink-soft); background: #fff; color: var(--ink); min-height: 46px; width: 100%; }
  .sheet textarea { min-height: 84px; resize: vertical; }
  #gate .chkrow { display: grid; grid-template-columns: 24px 1fr; gap: 10px; align-items: start; font-weight: 700; font-size: 14.5px; }
  #gate .chkrow input { width: 22px; height: 22px; margin-top: 2px; }
  #gate .err, .sheet .err { color: #a02323; font-weight: 800; min-height: 1.2em; font-size: 14.5px; }
  #gate small.fp { font-weight: 600; font-size: 13.5px; letter-spacing: 0; text-transform: none; color: var(--ink-soft); line-height: 1.4; }
  .rate { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .rate button { border: 2px solid var(--ink-soft); background: #fff; color: var(--ink); border-radius: 12px; min-height: 44px; font-weight: 800; font-size: 16px; }
  .rate button[aria-pressed="true"] { background: var(--glow); border-color: var(--glow-deep); }
  .rl { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--ink-soft); font-weight: 700; margin-top: 2px; }
  #selfq { display: grid; gap: 8px; background: rgba(255,255,255,.08); border-radius: 14px; padding: 12px; }
  #selfq .rate button { background: rgba(255,255,255,.1); color: var(--cream); border-color: rgba(255,243,214,.4); } #selfq .rate button[aria-pressed="true"] { background: var(--glow); color: var(--ink); }
  #selfq .rl { color: rgba(255,243,214,.8); }
  /* ----- story beats ----- */""")
# ---------- HTML
rep('<div id="app">\n','''<div id="app">
  <div id="gate" hidden role="dialog" aria-modal="true" aria-labelledby="gateT"><div class="beatcard">
    <small id="gateT">Test version</small><h3>Welcome, tester</h3>
    <p>Thank you for trying this. We record your name, the choices you make and your feedback, so we can see how people use it and what they think. Only the Margwise team sees this. You can ask us to delete it any time.</p>
    <label>Your name<input type="text" id="gName" maxlength="40" autocomplete="off"></label>
    <label>Invite code<input type="text" id="gCode" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
    <label class="chkrow"><input type="checkbox" id="gOk"><span>I am 18 or older, or a parent or guardian has agreed that I can take part.</span></label>
    <p class="err" id="gErr" role="alert"></p>
    <button class="go" id="gGo" type="button">Start</button>
  </div></div>
''')
rep('<div class="sheet" id="about" hidden>','''<div class="sheet" id="fbSheet" hidden><div role="dialog" aria-modal="true" aria-label="Your feedback">
  <h3>What did you think?</h3>
  <div class="fld" style="display:grid;gap:4px"><b>How did it look and feel?</b><div class="rate" data-k="look"></div><div class="rl"><span>Poor</span><span>Great</span></div></div>
  <div class="fld" style="display:grid;gap:4px"><b>Was it clear what to do?</b><div class="rate" data-k="clear"></div><div class="rl"><span>Confusing</span><span>Very clear</span></div></div>
  <div class="fld" style="display:grid;gap:4px"><b>Did you enjoy the walk?</b><div class="rate" data-k="fun"></div><div class="rl"><span>Not at all</span><span>A lot</span></div></div>
  <label class="fld">Anything else? What was confusing, boring or good?<textarea id="fbText" maxlength="1500"></textarea></label>
  <p class="err" id="fbMsg" aria-live="polite"></p>
  <button class="go" id="fbSend" type="button">Send</button><button class="go quiet" id="fbClose" type="button">Close</button>
</div></div>
<div class="sheet" id="chkSheet" hidden><div role="dialog" aria-modal="true" aria-label="Rate your interests">
  <h3>How much do you enjoy each of these?</h3><p class="mute">Answer for yourself, without thinking about the game. This helps us check how well the walk worked.</p>
  <div id="chkRows" style="display:grid;gap:12px"></div>
  <p class="err" id="chkMsg" aria-live="polite"></p>
  <button class="go" id="chkSend" type="button">Send</button><button class="go quiet" id="chkClose" type="button">Close</button>
</div></div>
<div class="sheet" id="about" hidden>''')
rep('<p class="outro" id="outro"></p>','<p class="outro" id="outro"></p>\n    <div id="selfq" hidden><b>Does this shape sound like you?</b><div class="rate" data-k="self"></div><div class="rl"><span>Not me</span><span>Very me</span></div><button class="go quiet" id="chkOpen" type="button">Rate each area yourself</button></div>')
rep('<div class="actions"><button class="go quiet" id="again">Walk the road again</button></div>','<div class="actions"><button class="go" id="fbOpen" type="button" hidden>Share your feedback</button><button class="go quiet" id="again">Walk the road again</button></div>')
# ---------- JS
rep("  var bank = applyStory(M.JOURNEY_BANK), STORY = bank.story;","""  var bank = applyStory(M.JOURNEY_BANK), STORY = bank.story;
  // ---------- tester mode: only active when the host page sets window.MW_CONFIG (the hosted test build)
  var MWC = window.MW_CONFIG || null, TK = null, SESSION = Math.random().toString(36).slice(2, 10), evq = [], flushT = null;
  try { TK = JSON.parse(localStorage.getItem('margwise.tester') || 'null'); } catch (e) { TK = null; }
  function flush() {
    if (!MWC || !TK || !evq.length) return;
    var batch = evq.splice(0, 40), body = JSON.stringify({ testerId: TK.id, token: TK.token, session: SESSION, events: batch });
    try { fetch(MWC.api + '/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).then(function (r) { if (!r.ok) evq = batch.concat(evq); }, function () { evq = batch.concat(evq); }); } catch (e) { evq = batch.concat(evq); }
  }
  function track(type, data) {
    if (!MWC || !TK) return;
    evq.push({ ts: Date.now(), type: type, data: data || {} });
    var urgent = /^(result|feedback|self|areas|walk_end)$/.test(type);
    if (urgent || evq.length >= 10) flush(); else { clearTimeout(flushT); flushT = setTimeout(flush, 4000); }
  }
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); }); addEventListener('pagehide', flush);
  addEventListener('error', function (e) { track('error', { msg: String(e.message).slice(0, 200), at: (e.filename || '').slice(-40) + ':' + e.lineno }); });""")
# start of walk, place done
rep("function startWalk() { state.choices = []; state.slots = [0, 0, 0, 0]; advance(true);","function startWalk() { state.choices = []; state.slots = [0, 0, 0, 0]; track('walk_start', { seed: SEED, vw: innerWidth, vh: innerHeight, ua: navigator.userAgent.slice(0, 110) }); advance(true);")
rep("    var shown = M.displayOptions(scene, SEED + (state.echo ? 97 : 0));\n    var box = $('options'); box.innerHTML = '';","    var shown = M.displayOptions(scene, SEED + (state.echo ? 97 : 0)); state.shownIds = shown.map(function (o) { return o.id; }); state.t0 = performance.now();\n    var box = $('options'); box.innerHTML = '';")
rep("    state.choices.push(choice); state.lit = true;","    state.choices.push(choice); state.lit = true;\n    track('place_done', { scene: scene.id, echo: !!state.echo, spent: spent, order: state.shownIds, ms: Math.round(performance.now() - (state.t0 || 0)), n: litCount() });")
rep("  $('beatGo').addEventListener('click', function () { $('beat').hidden = true;","  $('beatGo').addEventListener('click', function () { track('beat', { who: $('beatWho').textContent }); $('beat').hidden = true;")
rep("  $('dreamGo').addEventListener('click', function () { toReveal(); });","  $('dreamGo').addEventListener('click', function () { track('context', state.ctx); toReveal(); });")
rep("    r.noSignal = !(sd >= .2) || !!r.lowEngagement; r.cautious = r.confidence === 'broad' || biased; r.biased = biased;","    r.noSignal = !(sd >= .2) || !!r.lowEngagement; r.cautious = r.confidence === 'broad' || biased; r.biased = biased;\n    track('result', { code: code, alts: r.code.alternatives, profile: pr, scores: r.scores, confidence: r.confidence, noSignal: r.noSignal, cautious: r.cautious, biased: biased, sd: +sd.toFixed(3), stops: r.stopsPlayed, mixed: r.consistency && r.consistency.mixed, lowEngagement: !!r.lowEngagement, slots: state.slots });\n    $('selfq').hidden = !MWC || !TK || r.noSignal; $('selfq').querySelectorAll('.rate button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); $('chkOpen').hidden = !MWC;")
rep("    var fits = state.fits = fieldFits(), lean = state.ctx.lean, ln = $('leanNote'); ln.hidden = true;","    var fits = state.fits = fieldFits(), lean = state.ctx.lean, ln = $('leanNote'); ln.hidden = true;\n    track('fields', { order: fits.map(function (x) { return x.f.id; }), scores: fits.map(function (x) { return +x.score.toFixed(3); }) }); $('fbOpen').hidden = !(MWC && TK);")
rep("    show('field'); Snd.door(); $('field').scrollTop = 0; state.fieldId = id;","    show('field'); Snd.door(); $('field').scrollTop = 0; state.fieldId = id; track('field_open', { id: id });")
# modal list + escape
rep("  function modalEl() { return !$('beat').hidden ? $('beat') :","  function modalEl() { return !$('gate').hidden ? $('gate') : !$('beat').hidden ? $('beat') : !$('fbSheet').hidden ? $('fbSheet') : !$('chkSheet').hidden ? $('chkSheet') :")
rep("['beat', 'saveSheet', 'about'].forEach(function (id) { new MutationObserver","['gate', 'beat', 'saveSheet', 'about', 'fbSheet', 'chkSheet'].forEach(function (id) { new MutationObserver")
rep("if (e.key === 'Escape' && m !== $('beat')) { m.hidden = true; return; }","if (e.key === 'Escape' && m !== $('beat') && m !== $('gate')) { m.hidden = true; return; }")
rep("&& $('beat').hidden && $('saveSheet').hidden) {","&& $('beat').hidden && $('saveSheet').hidden && $('gate').hidden && $('fbSheet').hidden && $('chkSheet').hidden) {")
# gate + ratings + sheets logic, appended before boot line
rep("  $('jyoSprite').innerHTML = sprite('jyo');","""  // ---- gate
  function paintTester() {
    var el = $('welcomeBack');
    if (MWC && TK) { el.hidden = false; el.textContent = ''; el.appendChild(document.createTextNode('Hello, ' + TK.name + '. ')); var nb = document.createElement('button'); nb.type = 'button'; nb.textContent = 'Not you?'; nb.style.cssText = 'background:none;border:0;text-decoration:underline;color:inherit;font:inherit;font-weight:800;padding:8px 4px;min-height:40px'; nb.addEventListener('click', function () { try { localStorage.removeItem('margwise.tester'); } catch (e) { /* storage blocked */ } TK = null; $('gate').hidden = false; $('gName').focus(); paintTester(); }); el.appendChild(nb); }
  }
  if (MWC) {
    $('saveBtn').hidden = true;
    if (!TK) $('gate').hidden = false;
    paintTester();
    $('gGo').addEventListener('click', function () {
      var name = $('gName').value.trim(), code = $('gCode').value.trim(); $('gErr').textContent = '';
      if (!name) { $('gErr').textContent = 'Please add your name.'; return; }
      if (!code) { $('gErr').textContent = 'Please add the invite code you were given.'; return; }
      if (!$('gOk').checked) { $('gErr').textContent = 'Please tick the box to continue.'; return; }
      $('gGo').disabled = true;
      fetch(MWC.api + '/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name, code: code, consent: true }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          $('gGo').disabled = false;
          if (!x.ok) { $('gErr').textContent = x.j && x.j.error ? x.j.error : 'That did not work. Please try again.'; return; }
          TK = { id: x.j.testerId, token: x.j.token, name: name }; try { localStorage.setItem('margwise.tester', JSON.stringify(TK)); } catch (e) { /* storage blocked */ }
          $('gate').hidden = true; paintTester(); track('join', { vw: innerWidth, vh: innerHeight });
        }, function () { $('gGo').disabled = false; $('gErr').textContent = 'No connection. Please check your internet and try again.'; });
    });
  }
  // ---- ratings, feedback, own-area check
  function buildRates(root) { root.querySelectorAll('.rate').forEach(function (r) { if (r.children.length) return; for (var i = 1; i <= 5; i++) { var b = document.createElement('button'); b.type = 'button'; b.textContent = i; b.setAttribute('aria-pressed', 'false'); b.dataset.v = i; r.appendChild(b); } }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.rate button'); if (!b) return;
    var grp = b.parentNode; Array.prototype.forEach.call(grp.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    if (grp.dataset.k === 'self') { track('self', { v: +b.dataset.v }); }
  });
  buildRates($('selfq')); buildRates($('fbSheet'));
  $('chkRows').innerHTML = AREAS.map(function (a) { return '<div style="display:grid;gap:4px"><b>' + NAME[a] + ': ' + BLURB[a] + '</b><div class="rate" data-a="' + a + '"></div><div class="rl"><span>Not at all</span><span>Love it</span></div></div>'; }).join(''); buildRates($('chkRows'));
  $('chkOpen').addEventListener('click', function () { $('chkMsg').textContent = ''; $('chkSheet').hidden = false; $('chkSend').focus(); });
  $('chkClose').addEventListener('click', function () { $('chkSheet').hidden = true; });
  $('chkSend').addEventListener('click', function () {
    var out = {}, all = true; $('chkRows').querySelectorAll('.rate').forEach(function (r) { var p = r.querySelector('[aria-pressed="true"]'); if (p) out[r.dataset.a] = +p.dataset.v; else all = false; });
    if (!all) { $('chkMsg').textContent = 'Please rate all six, or close this.'; return; }
    track('areas', out); $('chkMsg').textContent = 'Thank you.'; setTimeout(function () { $('chkSheet').hidden = true; }, 900);
  });
  $('fbOpen').addEventListener('click', function () { $('fbMsg').textContent = ''; $('fbSheet').hidden = false; $('fbSend').focus(); });
  $('fbClose').addEventListener('click', function () { $('fbSheet').hidden = true; });
  $('fbSend').addEventListener('click', function () {
    var out = { text: $('fbText').value.trim().slice(0, 1500) }; $('fbSheet').querySelectorAll('.rate').forEach(function (r) { var p = r.querySelector('[aria-pressed="true"]'); if (p) out[r.dataset.k] = +p.dataset.v; });
    if (!out.look && !out.clear && !out.fun && !out.text) { $('fbMsg').textContent = 'Add a rating or a few words first.'; return; }
    track('feedback', out); $('fbMsg').textContent = 'Thank you. This helps a lot.'; $('fbText').value = ''; setTimeout(function () { $('fbSheet').hidden = true; }, 1100);
  });
  $('jyoSprite').innerHTML = sprite('jyo');""")
open('lamps9.html','w',encoding='utf8').write(s); print('ok')
