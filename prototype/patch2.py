s=open('lamps.html',encoding='utf8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70])
    s=s.replace(a,b)

# ---------- CSS: layers keep drifting (on the image, not the layer), no backdrop blur, fixed tag height
rep(".bg .layer { position: absolute; inset: -3%; opacity: 0; transition: opacity .9s ease; }\n  .bg .layer.on { opacity: 1; animation: drift 26s ease-in-out infinite alternate; }",
    ".bg .layer { position: absolute; inset: -3%; opacity: 0; will-change: transform, opacity; }\n  .bg .layer.on { opacity: 1; }\n  .bg .layer > img, .bg .layer > svg { animation: drift 26s ease-in-out infinite alternate; }")
s=s.replace("backdrop-filter: blur(4px); ","")
s=s.replace("backdrop-filter: blur(1.5px); ","")
rep("display: grid; place-items: center; min-height: 3.1em; }","display: grid; place-items: center; min-height: 3.75em; }")
rep("  .spark {","""  /* ----- choreography: a lantern walk between places ----- */
  .fore { position: absolute; left: -20%; right: -20%; bottom: 0; height: 24%; pointer-events: none; z-index: 1; will-change: transform;
    background: radial-gradient(60% 90% at 12% 100%, #070a1f 60%, transparent 61%), radial-gradient(50% 70% at 46% 100%, #0a0e28 60%, transparent 61%), radial-gradient(55% 85% at 82% 100%, #070a1f 60%, transparent 61%), linear-gradient(0deg, #070a1f 0 18%, transparent 100%); }
  #bloom { position: absolute; inset: 0; z-index: 4; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 58%, rgba(255,236,160,.95) 0%, rgba(255,196,90,.5) 28%, rgba(255,170,60,0) 62%); }
  .objs.leaving .obj { animation: objout .26s ease-in both; animation-delay: calc(var(--i) * 35ms); }
  @keyframes objout { to { opacity: 0; translate: 0 18px; scale: .93; } }
  #jyoLive { position: absolute; z-index: 5; left: 0; top: 0; width: 40px; height: 40px; pointer-events: none; will-change: transform; }
  #jyoLive .in { width: 100%; height: 100%; animation: jbob 2.2s ease-in-out infinite; transform-origin: 50% 60%; }
  #jyoLive .in svg, #jyoLive .in img { width: 100%; height: 100%; display: block; overflow: visible; }
  #jyoLive.droop .in { animation: none; transform: translateY(5px) scale(.85); opacity: .7; transition: transform .3s, opacity .3s; }
  @keyframes jbob { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-6px) rotate(4deg); } }
  .drop { position: absolute; z-index: 7; left: 0; top: 0; width: 10px; height: 14px; margin: -7px 0 0 -5px; border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%; background: var(--glow); box-shadow: 0 0 10px 3px rgba(255,207,107,.8); pointer-events: none; }
  .spark {""")
rep("</div>\n    <div class=\"top\">","""<div class="fore" id="fore"></div></div>
    <div id="bloom"></div><div id="jyoLive" aria-hidden="true"><div class="in" id="jyoIn"></div></div>
    <div class="top">""") if False else None
rep('<div class="bg" id="stopBg"><div class="layer" id="artA"></div><div class="layer" id="artB"></div><div class="shade"></div></div>',
    '<div class="bg" id="stopBg"><div class="layer" id="artA"></div><div class="layer" id="artB"></div><div class="shade"></div><div class="fore" id="fore"></div></div>\n    <div id="bloom"></div><div id="jyoLive" aria-hidden="true"><div class="in" id="jyoIn"></div></div>')
rep('<div class="prog" id="prog" aria-live="polite"></div>','<div class="prog" id="prog"></div>')

# ---------- JS: per-session option order (no shared position bias)
rep("var SEED = 11, FLASKS = M.FLASKS;","var SEED = (function () { var m = /[?&]seed=(\\d+)/.exec(location.search); return m ? +m[1] : Math.floor(Math.random() * 1e6); })(), FLASKS = M.FLASKS;")

# ---------- JS: decoded-image cache + scene transitions
rep("""  function artFor(id) { return ART.bg[id] ? '<img alt="" src="' + ART.bg[id] + '">' : paint(id); }
  var artSlot = 'artA';
  function setScene(id, instant) {
    var next = artSlot === 'artA' ? 'artB' : 'artA', cur = $(artSlot), n = $(next);
    n.innerHTML = artFor(id);
    if (instant) { n.style.transition = cur.style.transition = 'none'; }
    n.classList.add('on'); cur.classList.remove('on'); artSlot = next;
    if (instant) { void n.offsetWidth; n.style.transition = cur.style.transition = ''; }
    $('stopBg').classList.remove('lit');
  }""","""  function artFor(id) { return ART.bg[id] ? '<img alt="" decoding="async" src="' + ART.bg[id] + '">' : paint(id); }
  // Decode every backdrop once, off the critical moment, and keep the bitmaps warm.
  var warm = [];
  function warmArt() {
    var ids = Object.keys(ART.bg), i = 0;
    (function next() {
      if (i >= ids.length) return;
      var im = new Image(); im.decoding = 'async'; im.src = ART.bg[ids[i++]]; warm.push(im);
      (im.decode ? im.decode() : Promise.resolve()).catch(function () {}).then(function () { (window.requestIdleCallback || setTimeout)(next, 60); });
    })();
  }
  var artSlot = 'artA', sceneAnims = [];
  // mode: 'cut' (no motion), 'fade' (quick crossfade), 'walk' (camera moves on to the next place)
  function setScene(id, mode) {
    if (mode === true) mode = 'cut'; if (!mode) mode = 'fade';
    if (state.reduce) mode = 'cut';
    sceneAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); sceneAnims = [];
    var next = artSlot === 'artA' ? 'artB' : 'artA', cur = $(artSlot), n = $(next), fore = $('fore');
    n.innerHTML = artFor(id);
    var commit = function () { n.classList.add('on'); cur.classList.remove('on'); sceneAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); sceneAnims = []; };
    var go = function () {
      if (mode === 'cut') { commit(); }
      else if (mode === 'fade') {
        n.style.opacity = 0; n.classList.add('on'); cur.style.zIndex = 0; n.style.zIndex = 1;
        var a = n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out', fill: 'both' }); sceneAnims.push(a);
        a.onfinish = function () { n.style.opacity = ''; cur.classList.remove('on'); a.cancel(); };
      } else {
        var out = 'cubic-bezier(.65,0,.35,1)';
        n.classList.add('on'); n.style.zIndex = 1; cur.style.zIndex = 0;
        var a1 = cur.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.16) translateY(-2.5%)' }], { duration: 760, easing: out, fill: 'both' });
        var a2 = n.animate([{ opacity: 0, transform: 'translateX(9%) scale(1.06)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.22,.8,.2,1)', delay: 120, fill: 'both' });
        var a3 = fore.animate([{ transform: 'translateX(0)', offset: 0 }, { transform: 'translateX(-34%)', offset: .5 }, { transform: 'translateX(34%)', offset: .5001 }, { transform: 'translateX(0)', offset: 1 }], { duration: 1000, easing: 'cubic-bezier(.5,0,.3,1)' });
        sceneAnims.push(a1, a2, a3);
        a2.onfinish = function () { cur.classList.remove('on'); cur.style.zIndex = n.style.zIndex = ''; a1.cancel(); a2.cancel(); sceneAnims = []; };
      }
    };
    var img = n.querySelector('img');
    if (img && img.decode) img.decode().catch(function () {}).then(go); else go();
    if (mode === 'cut') { cur.style.zIndex = n.style.zIndex = ''; }
    $('stopBg').classList.remove('lit');
  }
  // Jyo, the firefly, lives in the scene. Every tap sends her to that object, the same way for all of them.
  var jyo = { x: 0, y: 0 }, jyoTimer = null, jyoAnim = null;
  function jyoHome() { var r = $('stop').getBoundingClientRect(); return { x: r.width - 62, y: Math.round(r.height * .2) }; }
  function jyoGo(x, y, dur, ease) {
    var el = $('jyoLive'), from = { x: jyo.x, y: jyo.y };
    if (jyoAnim) { try { jyoAnim.cancel(); } catch (e) {} }
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)'; jyo = { x: x, y: y };
    if (state.reduce || !dur) return;
    jyoAnim = el.animate([{ transform: 'translate(' + from.x + 'px,' + from.y + 'px)' }, { transform: 'translate(' + x + 'px,' + y + 'px)' }], { duration: dur, easing: ease || 'cubic-bezier(.3,.7,.3,1)' });
  }
  function jyoToHome(delay) { clearTimeout(jyoTimer); jyoTimer = setTimeout(function () { var h = jyoHome(); jyoGo(h.x, h.y, 520); }, delay || 0); }
  function jyoVisit(btn) {
    var r = btn.querySelector('.art').getBoundingClientRect(), s = $('stop').getBoundingClientRect();
    jyoGo(r.left - s.left + r.width / 2 - 20, r.top - s.top + 6, 300); jyoToHome(900);
  }
  function oilDrop(btn, back) {
    if (state.reduce) return;
    var app = $('app').getBoundingClientRect(), f = $('oil').getBoundingClientRect(), a = btn.querySelector('.art').getBoundingClientRect();
    var fx = f.left - app.left + f.width / 2, fy = f.top - app.top + f.height / 2, ax = a.left - app.left + a.width / 2, ay = a.top - app.top + a.height / 2;
    var p = back ? [ax, ay, fx, fy] : [fx, fy, ax, ay], d = document.createElement('span'); d.className = 'drop'; $('app').appendChild(d);
    var mx = (p[0] + p[2]) / 2, my = Math.min(p[1], p[3]) - 40;
    d.animate([{ transform: 'translate(' + p[0] + 'px,' + p[1] + 'px) scale(.6)', opacity: 1 }, { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1)', opacity: 1, offset: .5 }, { transform: 'translate(' + p[2] + 'px,' + p[3] + 'px) scale(.5)', opacity: .2 }], { duration: 380, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = function () { d.remove(); };
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }""")

# sprite for live Jyo at boot
rep("  $('jyoSprite').innerHTML = sprite('jyo');","  $('jyoSprite').innerHTML = sprite('jyo'); $('jyoIn').innerHTML = sprite('jyo'); warmArt();")

# ---------- advance: safe, with a walk
rep("""  function advance(first) {
    var s = M.step(bank, state.choices);
    if (s.done) return toDreams();
    state.scene = s.scene; state.echo = s.echo; state.spent = {};
    show('stop'); paintHud();
    setScene(s.scene.id, !!first);
    Voice.stop(); Snd.place();
    renderStop();
    state.busy = true; document.body.classList.add('busy');
    setTimeout(function () { state.busy = false; document.body.classList.remove('busy'); }, state.reduce ? 0 : 700);
  }""","""  var advTimer = null;
  function advance(first) {
    clearTimeout(advTimer);
    var s;
    try { s = M.step(bank, state.choices); } catch (e) { console.error(e); state.busy = false; document.body.classList.remove('busy'); return; }
    if (s.done) return toDreams();
    state.scene = s.scene; state.echo = s.echo; state.spent = {};
    show('stop');
    setScene(s.scene.id, first ? 'cut' : 'walk');
    Voice.stop(); Snd.place();
    renderStop(first ? 0 : 420);
    $('jyoLive').classList.remove('droop');
    var h = jyoHome(); if (first) jyoGo(h.x, h.y, 0); else { jyoGo(h.x, h.y - 30, 600); jyoToHome(650); }
    state.busy = true; document.body.classList.add('busy');
    advTimer = setTimeout(function () { state.busy = false; document.body.classList.remove('busy'); }, state.reduce ? 0 : (first ? 700 : 1000));
  }""")
rep("    document.body.classList.remove('busy');\n  }\n\n  function startWalk()","    document.body.classList.remove('busy'); state.busy = false;\n  }\n\n  function startWalk()")
rep("  function renderStop() {","  function renderStop(base) {")
rep("b.style.setProperty('--i', i);","b.style.setProperty('--i', i); b.style.animationDelay = (-i * 1.1).toFixed(1) + 's, ' + ((base || 0) + i * 90 + 150) + 'ms';")
rep("    refreshCards(); paintHud();\n    equalise();\n  }","    $('options').classList.remove('leaving');\n    refreshCards();\n  }")
# remove equalise body
a=s.index("  function equalise() {"); b=s.index("  window.addEventListener('resize', function () { if (state.view === 'stop') equalise(); });")
b2=b+len("  window.addEventListener('resize', function () { if (state.view === 'stop') equalise(); });")
s=s[:a]+s[b2:]
# tapOption: jyo + droplet + haptic
rep("if (used < FLASKS && n < FLASKS) { state.spent[id] = n + 1; sparks(btn); Snd.spend(); }\n    else if (n > 0) { delete state.spent[id]; Snd.refund();",
    "if (used < FLASKS && n < FLASKS) { state.spent[id] = n + 1; sparks(btn); oilDrop(btn, false); jyoVisit(btn); buzz(10); Snd.spend(); }\n    else if (n > 0) { delete state.spent[id]; oilDrop(btn, true); jyoVisit(btn); buzz(6); Snd.refund();")
rep("Snd.deny(); hint('Both flasks","$('jyoLive').classList.add('droop'); setTimeout(function () { $('jyoLive').classList.remove('droop'); }, 900); buzz([8, 30, 8]); Snd.deny(); hint('Both flasks")

# ---------- lighting the lamp: bloom, then walk on
rep("    setTimeout(function () { advance(false); }, state.reduce ? 3200 : 2300);",
"""    if (!state.reduce) {
      buzz([18, 40, 26]);
      $('bloom').animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: .85, transform: 'scale(1)', offset: .35 }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 1100, easing: 'ease-out' });
      var lr = $('stop').getBoundingClientRect(); jyoGo(lr.width / 2 - 20, lr.height * .3, 420);
      jyoAnim && jyoAnim.finished.then(function () { $('jyoIn').animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(360deg) scale(1.5)' }, { transform: 'rotate(720deg) scale(1)' }], { duration: 700, easing: 'ease-in-out' }); });
      setTimeout(function () { $('options').classList.add('leaving'); }, 1050);
    }
    clearTimeout(advTimer);
    advTimer = setTimeout(function () { advance(false); }, state.reduce ? 3200 : 1350);""")
# back: clear timer
rep("  $('back').addEventListener('click', function () {\n    if (state.busy && state.view === 'stop') return;","  $('back').addEventListener('click', function () {\n    if (state.busy && state.view === 'stop') return;\n    clearTimeout(advTimer);")
open('lamps2.html','w',encoding='utf8').write(s)
print('ok')
