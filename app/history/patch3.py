s=open('lamps2.html',encoding='utf8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:80])
    s=s.replace(a,b)

# ================= CSS =================
rep("  /* ----- choreography: a lantern walk between places ----- */","""  /* ----- loader ----- */
  #loader { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; text-align: center; background: radial-gradient(circle at 50% 40%, #2b2f63 0%, #141a3a 70%); transition: opacity .55s ease; }
  #loader.done { opacity: 0; pointer-events: none; }
  .ld-in { display: grid; gap: 14px; justify-items: center; width: min(300px, 100%); }
  .ld-in svg { width: 84px; height: 112px; overflow: visible; filter: drop-shadow(0 0 18px rgba(255,200,90,.45)); }
  #ldFlame { transform-origin: 30px 58px; transform: scale(0); transition: transform .35s ease-out; }
  .ld-title { font-family: var(--display); font-weight: 800; font-size: 26px; }
  .ld-bar { width: 100%; height: 8px; border-radius: 99px; background: rgba(255,243,214,.18); overflow: hidden; }
  .ld-bar i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, var(--glow-deep), var(--glow)); transform-origin: 0 50%; transform: scaleX(0); transition: transform .3s ease-out; box-shadow: 0 0 12px rgba(255,207,107,.8); }
  .ld-txt { font-weight: 700; font-size: 14px; color: rgba(255,243,214,.9); }
  .ld-in .go { min-height: 46px; font-size: 16px; padding: 10px 18px; }
  /* ----- world: the night warms as lamps are lit ----- */
  .dusk { position: absolute; inset: 0; pointer-events: none; background: rgba(8,10,34,var(--dark, .36)); transition: background .9s; }
  .warmglow { position: absolute; inset: 0; pointer-events: none; opacity: var(--warm, 0); transition: opacity 1.2s; background: radial-gradient(120% 60% at 50% 100%, rgba(255,170,70,.45), rgba(255,170,70,0) 70%); mix-blend-mode: screen; }
  .embers { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .embers i { position: absolute; bottom: -10px; width: 4px; height: 4px; border-radius: 50%; background: #ffd978; box-shadow: 0 0 8px 2px rgba(255,200,90,.7); opacity: 0; animation: rise var(--d, 9s) linear var(--w, 0s) infinite; will-change: transform, opacity; }
  @keyframes rise { 0% { transform: translate(0,0); opacity: 0; } 12% { opacity: .9; } 100% { transform: translate(var(--x, 20px), -75vh); opacity: 0; } }
  #arrive { position: absolute; inset: 0; z-index: 4; pointer-events: none; display: grid; place-content: center; text-align: center; opacity: 0; gap: 4px; text-shadow: 0 2px 18px rgba(0,0,0,.8); }
  #arrive small { font-weight: 800; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; color: var(--glow); }
  #arrive b { font-family: var(--display); font-weight: 800; font-size: clamp(34px, 11vw, 48px); line-height: 1.05; }
  #beam { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: linear-gradient(100deg, transparent 30%, rgba(255,236,170,.4) 50%, transparent 70%); }
  .sheet label { display: grid; gap: 4px; font-weight: 800; font-size: 14px; }
  .sheet input[type=text], .sheet input[type=tel] { font: inherit; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--ink-soft); background: #fff; color: var(--ink); min-height: 44px; }
  .sheet label.chk { grid-auto-flow: column; justify-content: start; align-items: start; gap: 10px; font-weight: 700; }
  .sheet label.chk input { width: 22px; height: 22px; margin-top: 1px; }
  .sheet .demo { background: #fff1cd; border: 2px dashed #c58a2a; border-radius: 12px; padding: 8px 10px; font-weight: 700; }
  #light { position: relative; overflow: hidden; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
  #light .charge { position: absolute; inset: 0 auto 0 0; width: 0; background: rgba(255,255,255,.55); pointer-events: none; }
  #light .lbl { position: relative; }
  .bubble.nothread .thread { display: none; }
  /* ----- choreography: a lantern walk between places ----- */""")

# ================= HTML =================
rep('<div id="app">\n','''<div id="app">
  <div id="loader" role="status" aria-live="polite"><div class="ld-in">
    <svg viewBox="0 0 60 80" aria-hidden="true"><path d="M22 8h16" stroke="#fff3d6" stroke-width="3" stroke-linecap="round"/><path d="M20 14h20l6 12v32a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V26z" fill="rgba(255,243,214,.12)" stroke="#fff3d6" stroke-width="2.4" stroke-linejoin="round"/><g id="ldFlame"><path d="M30 28c2 8 10 10 10 20a10 10 0 0 1-20 0c0-6 4-8 5-14c2 2 4 3 5-6z" fill="#f2a03d"/><path d="M30 42c1 4 5 5 5 9a5 5 0 0 1-10 0c0-4 4-5 5-9z" fill="#ffe08a"/></g></svg>
    <div class="ld-title">The Night of Lamps</div>
    <div class="ld-bar"><i id="loadFill"></i></div>
    <div class="ld-txt" id="loadTxt">Lighting the lantern… 0%</div>
    <button class="go" id="loadRetry" hidden>Try again</button><button class="go quiet" id="loadSkip" hidden>Play anyway</button>
  </div></div>
''')
rep('<div class="shade"></div><div class="fore" id="fore"></div></div>','<div class="shade"></div><div class="dusk"></div><div class="warmglow"></div><div class="embers" id="embers"></div><div class="fore" id="fore"></div></div>\n    <div id="beam"></div><div id="arrive" aria-hidden="true"><small id="arrN"></small><b id="arrP"></b></div>')
rep('<div class="bg" id="welcomeBg"><div class="layer on" id="welcomeArt"></div><div class="shade"></div></div>','<div class="bg" id="welcomeBg"><div class="layer on" id="welcomeArt"></div><div class="shade"></div><div class="embers" id="embersW"></div></div>')
rep('<button class="go" id="light">Light the lamp</button>','<button class="go" id="light" aria-label="Light the lamp. Hold the button, or press Enter"><span class="charge"></span><span class="lbl">Hold to light the lamp</span></button>')
rep('<p class="tiny">About three minutes.','<p class="tiny" id="welcomeBack" hidden></p><p class="tiny">About three minutes.')
rep('<button class="go" id="openDoors">Open the doors</button>','<button class="go quiet" id="saveBtn">Save your lighthouse</button><button class="go" id="openDoors">Open the doors</button>')
rep('<div class="sheet" id="about" hidden>','''<div class="sheet" id="saveSheet" hidden><div role="dialog" aria-modal="true" aria-label="Save your lighthouse">
  <h3>Save your lighthouse</h3>
  <p class="demo">Demo only. Nothing is sent anywhere. Your lighthouse is kept on this phone.</p>
  <label>Explorer name<input type="text" id="svName" maxlength="20" autocomplete="off"></label>
  <label>A parent or guardian's phone (demo, never stored)<input type="tel" id="svPhone" inputmode="tel" maxlength="14" autocomplete="off" placeholder="10 digits"></label>
  <label class="chk"><input type="checkbox" id="svOk"><span>A parent or guardian knows I am saving this.</span></label>
  <div class="row"><button class="go quiet" id="svSend" type="button" style="flex:1">Send a demo code</button></div>
  <label>Code<input type="tel" id="svCode" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="4 digits"></label>
  <p id="svMsg" aria-live="polite"></p>
  <button class="go" id="svSave" type="button">Save</button><button class="go quiet" id="svClose" type="button">Not now</button>
</div></div>

<div class="sheet" id="about" hidden>''')

# ================= JS =================
# world state + hold-to-light + arrival + milestones
rep("  function paintHud() {\n    var done = litCount(),","  function paintHud() {\n    paintWorld();\n    var done = litCount(),")
rep("  function litCount()","""  function paintWorld() {
    var n = litCount(), b = $('stopBg');
    b.style.setProperty('--dark', Math.max(0, .38 - n * .026).toFixed(3)); b.style.setProperty('--warm', Math.min(1, n / 12).toFixed(3));
  }
  function buildEmbers(id, count) {
    var h = '', r = (id === 'embers') ? 7 : 5;
    for (var i = 0; i < count; i++) h += '<i style="left:' + ((i * 53 + 11) % 100) + '%;--d:' + (7 + (i * 7) % 6) + 's;--w:' + (-(i * 1.3) % 9).toFixed(1) + 's;--x:' + (((i % 5) - 2) * 14) + 'px"></i>';
    $(id).innerHTML = h;
  }
  function arrive(place, n, echo) {
    if (state.reduce) return;
    $('arrN').textContent = echo ? 'A second look' : 'Place ' + (n + 1); $('arrP').textContent = place;
    $('arrive').animate([{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none', offset: .22 }, { opacity: 1, transform: 'none', offset: .7 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 1500, delay: 250, easing: 'ease-out' });
  }
  function beamSweep() {
    if (state.reduce) return;
    $('beam').animate([{ opacity: 0, transform: 'translateX(-70%)' }, { opacity: 1, offset: .3 }, { opacity: 0, transform: 'translateX(70%)' }], { duration: 1700, easing: 'ease-in-out' });
  }
  function litCount()""")
rep("    renderStop(first ? 0 : 420);","    renderStop(first ? 0 : 420);\n    $('bubble').classList.toggle('nothread', !(state.echo || litCount() % 3 === 0));\n    arrive(s.scene.place, litCount(), state.echo); if (!first) Snd.walk();")
rep("    $('light').textContent = totalSpent() === 0 ? 'Keep my oil and light the lamp' : 'Light the lamp';","    $('light').querySelector('.lbl').textContent = totalSpent() === 0 ? 'Hold to light · keep my oil' : 'Hold to light the lamp';")
rep("  $('light').addEventListener('click', function () {\n    if (state.busy) return;","  function doLight() {\n    if (state.busy) return;")
rep("""    advTimer = setTimeout(function () { advance(false); }, state.reduce ? 3200 : 1350);
  });""","""    advTimer = setTimeout(function () { advance(false); }, state.reduce ? 3200 : 1350);
    if (!echoing && (n === 4 || n === 8 || n === 12)) setTimeout(beamSweep, 500);
  }
  // Hold the button to light the lamp: a small ritual. Keyboard and screen readers light it at once.
  (function () {
    var btn = $('light'), ch = btn.querySelector('.charge'), anim = null, timer = null, pulses = [];
    function stop() { clearTimeout(timer); pulses.forEach(clearTimeout); pulses = []; if (anim) { anim.cancel(); anim = null; } ch.style.width = '0'; }
    btn.addEventListener('pointerdown', function (e) {
      if (state.busy || e.button > 0) return;
      stop(); Snd.charge(); buzz(8);
      pulses = [180, 360].map(function (t) { return setTimeout(function () { buzz(t === 180 ? 12 : 18); }, t); });
      if (state.reduce) { timer = setTimeout(function () { stop(); doLight(); }, 150); return; }
      anim = ch.animate([{ width: '0%' }, { width: '100%' }], { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      timer = setTimeout(function () { stop(); doLight(); }, 560);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () { if (timer) { stop(); if (ev === 'pointerup' && !state.busy) hint('Keep holding until the lamp catches.'); } });
    });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function (e) { if (e.detail === 0) doLight(); });
  })();""")

# sound: footsteps, charge; default on at begin
rep("      place: function () { quick(","      walk: function () { quick(function (L, t) { kalimba(L, t, hz(-12), .05); kalimba(L, t + .26, hz(-9), .05); kalimba(L, t + .52, hz(-12), .04); kalimba(L, t + .78, hz(-7), .04); }); },\n      charge: function () { quick(function (L, t) { kalimba(L, t, hz(7), .05); kalimba(L, t + .17, hz(12), .06); kalimba(L, t + .34, hz(16), .07); }); },\n      place: function () { quick(")
rep("  $('begin').addEventListener('click', startWalk);","""  $('begin').addEventListener('click', function () {
    try { if (localStorage.getItem('margwise.mute') !== '1' && Snd.available() && !Snd.isOn()) { Snd.set(true); paintSound(); } } catch (e) { /* storage blocked: stay silent */ }
    startWalk();
  });""")
rep("  function toggleSound() { Snd.set(!Snd.isOn()); paintSound(); }","  function toggleSound() { Snd.set(!Snd.isOn()); paintSound(); try { localStorage.setItem('margwise.mute', Snd.isOn() ? '0' : '1'); } catch (e) { /* storage blocked */ } }")

# save-your-lighthouse (demo) + welcome back
rep("  $('openDoors').addEventListener('click', function () { toDoors(); });","""  $('openDoors').addEventListener('click', function () { toDoors(); });
  // ---------- save (prototype only: nothing leaves the phone, the phone number is never stored)
  var DEMO_CODE = '4271', SAVE_KEY = 'margwise.save';
  function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  function paintWelcomeBack() {
    var sv = readSave(), el = $('welcomeBack');
    el.hidden = !sv; if (sv) el.textContent = 'Welcome back, ' + sv.name + '. Your lighthouse last time: ' + sv.code.split('').map(function (a) { return NAME[a]; }).join(', ') + '.';
  }
  $('saveBtn').addEventListener('click', function () {
    $('svMsg').textContent = ''; $('saveSheet').hidden = false; $('svName').focus();
  });
  $('svClose').addEventListener('click', function () { $('saveSheet').hidden = true; $('saveBtn').focus(); });
  $('svSend').addEventListener('click', function () {
    if (!/^\\d{10}$/.test($('svPhone').value.replace(/\\s/g, ''))) { $('svMsg').textContent = 'Enter a 10-digit number. In this demo no message is sent.'; return; }
    $('svMsg').textContent = 'Demo code: ' + DEMO_CODE.split('').join(' ') + '. In the real app this arrives by SMS.';
  });
  $('svSave').addEventListener('click', function () {
    var name = $('svName').value.trim();
    if (!name) { $('svMsg').textContent = 'Add a name for your explorer.'; return; }
    if (!$('svOk').checked) { $('svMsg').textContent = 'A parent or guardian needs to know first.'; return; }
    if ($('svCode').value !== DEMO_CODE) { $('svMsg').textContent = 'That code does not match. Tap "Send a demo code".'; return; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ name: name, code: state.result.code.code.join(''), lit: litCount(), at: Date.now() })); $('svMsg').textContent = 'Saved on this phone, ' + name + '.'; }
    catch (e) { $('svMsg').textContent = 'This browser would not let us save. Your result is still on screen.'; }
    paintWelcomeBack(); setTimeout(function () { $('saveSheet').hidden = true; }, 1400);
  });""")

# loader (real byte progress) replaces the plain warm-up
rep("$('jyoIn').innerHTML = sprite('jyo'); warmArt();","$('jyoIn').innerHTML = sprite('jyo'); buildEmbers('embers', 16); buildEmbers('embersW', 12); paintWelcomeBack(); bootLoad();")
rep("  var artSlot = 'artA', sceneAnims = [];","""  function bootLoad() {
    var L = $('loader'), ids = Object.keys(ART.bg), first = null;
    try { first = M.step(bank, []).scene.id; } catch (e) { /* the walk will report it */ }
    var crit = ['welcome', first].filter(function (id, i, a) { return id && ART.bg[id] && a.indexOf(id) === i; });
    var rest = ids.filter(function (id) { return crit.indexOf(id) < 0; });
    function hide() { L.classList.add('done'); setTimeout(function () { L.hidden = true; }, 600); }
    if (!crit.length || location.protocol === 'file:' || !window.fetch) { hide(); warmArt(); return; }
    var frac = {}, t0 = performance.now();
    function setP() {
      var p = crit.reduce(function (a, id) { return a + (frac[id] || 0); }, 0) / crit.length;
      $('loadFill').style.transform = 'scaleX(' + p.toFixed(3) + ')'; $('ldFlame').style.transform = 'scale(' + Math.max(.05, p).toFixed(3) + ')';
      $('loadTxt').textContent = 'Lighting the lantern… ' + Math.round(p * 100) + '%';
    }
    function get(id, track) {
      return fetch(ART.bg[id]).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        var total = +r.headers.get('content-length') || 0, got = 0;
        if (!r.body || !r.body.getReader) return r.blob();
        var rd = r.body.getReader(), parts = [];
        return (function pump() { return rd.read().then(function (x) { if (x.done) return new Blob(parts); parts.push(x.value); got += x.value.length; if (track && total) { frac[id] = Math.min(.97, got / total); setP(); } return pump(); }); })();
      }).then(function (b) {
        var u = URL.createObjectURL(b); ART.bg[id] = u; var im = new Image(); im.src = u; warm.push(im);
        if (track) { frac[id] = 1; setP(); }
        return im.decode ? im.decode().catch(function () {}) : null;
      });
    }
    function run() {
      $('loadRetry').hidden = $('loadSkip').hidden = true; frac = {}; setP();
      var slow = setTimeout(function () { $('loadSkip').hidden = false; }, 7000);
      Promise.all(crit.map(function (id) { return get(id, true); })).then(function () {
        clearTimeout(slow);
        setTimeout(hide, Math.max(0, 700 - (performance.now() - t0)));
        var i = 0; (function next() { if (i >= rest.length) return; get(rest[i++], false).catch(function () {}).then(function () { if (window.requestIdleCallback) requestIdleCallback(next, { timeout: 400 }); else setTimeout(next, 80); }); })();
      }, function () { clearTimeout(slow); $('loadTxt').textContent = 'The connection dropped.'; $('loadRetry').hidden = $('loadSkip').hidden = false; });
    }
    $('loadRetry').addEventListener('click', run);
    $('loadSkip').addEventListener('click', function () { hide(); warmArt(); });
    run();
  }
  var artSlot = 'artA', sceneAnims = [];""")
open('lamps3.html','w',encoding='utf8').write(s); print('ok')
