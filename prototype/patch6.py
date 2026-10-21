s=open('lamps5.html',encoding='utf8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
# gsap from the allowed CDN, before the app script
i=s.index('<script>var Margwise=')
s=s[:i]+'<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>\n'+s[i:]
# css
rep("  /* ----- story beats ----- */","""  /* ----- Jyo the firefly, and the lamp-lighting sequence ----- */
  .ff { width: 100%; height: 100%; overflow: visible; display: block; }
  .ff .wing { transform-box: fill-box; transform-origin: 50% 100%; animation: flapL .09s ease-in-out infinite alternate; }
  .ff .wing.r { transform-origin: 50% 100%; animation-name: flapR; }
  @keyframes flapL { from { transform: rotate(-8deg) scaleY(1); } to { transform: rotate(22deg) scaleY(.7); } }
  @keyframes flapR { from { transform: rotate(8deg) scaleY(1); } to { transform: rotate(-22deg) scaleY(.7); } }
  .ff .glow { animation: glowp 2.4s ease-in-out infinite; transform-origin: 0 0; }
  @keyframes glowp { 0%,100% { opacity: .85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
  .ff .tail { animation: tailp 1.6s ease-in-out infinite; transform-origin: 0 8px; }
  @keyframes tailp { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
  #jyoLive.droop .ff .wing { animation-duration: .6s; } #jyoLive.droop .ff .glow { animation: none; opacity: .4; }
  #jyoLive.happy .ff .glow { animation-duration: .5s; }
  .trail { position: absolute; z-index: 4; width: 9px; height: 9px; margin: -4px 0 0 -4px; border-radius: 50%; background: #ffe9a0; box-shadow: 0 0 10px 3px rgba(255,207,107,.8); pointer-events: none; }
  #ring { position: absolute; z-index: 4; left: 50%; top: 58%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 4px solid #ffe08a; box-shadow: 0 0 24px 6px rgba(255,200,90,.7); opacity: 0; pointer-events: none; }
  /* ----- story beats ----- */""")
rep('<div id="bloom"></div>','<div id="bloom"></div><div id="ring"></div>')
# firefly svg
i=s.index("    return '<svg viewBox=\"-12 -12 24 24\"><g class=\"jug\">"); j=s.index("\n",i)
s=s[:i]+"""    return '<svg class="ff" viewBox="-40 -40 80 80" aria-hidden="true"><defs><radialGradient id="ffg"><stop offset="0" stop-color="#fffbd0"/><stop offset=".35" stop-color="#ffd978" stop-opacity=".85"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs><circle class="glow" r="32" fill="url(#ffg)"/><g class="wing l"><ellipse cx="-10" cy="-8" rx="12" ry="5" transform="rotate(-38 -10 -8)" fill="#fff" opacity=".6"/></g><g class="wing r"><ellipse cx="10" cy="-8" rx="12" ry="5" transform="rotate(38 10 -8)" fill="#fff" opacity=".6"/></g><ellipse cx="0" cy="2" rx="5" ry="8" fill="#5a4380"/><circle cx="0" cy="-8" r="4.2" fill="#3b2f66"/><circle cx="-1.6" cy="-8.6" r="1" fill="#fff"/><circle cx="1.6" cy="-8.6" r="1" fill="#fff"/><ellipse class="tail" cx="0" cy="9" rx="4.6" ry="5.4" fill="#fff7c0"/></svg>';"""+s[j:]
# trail in jyoGo
rep("    jyoAnim = el.animate([{ transform: 'translate(' + from.x + 'px,' + from.y + 'px)' }, { transform: 'translate(' + x + 'px,' + y + 'px)' }], { duration: dur, easing: ease || 'cubic-bezier(.3,.7,.3,1)' });",
"""    jyoAnim = el.animate([{ transform: 'translate(' + from.x + 'px,' + from.y + 'px)' }, { transform: 'translate(' + x + 'px,' + y + 'px)' }], { duration: dur, easing: ease || 'cubic-bezier(.3,.7,.3,1)' });
    var steps = Math.min(7, Math.max(3, Math.round(dur / 55))), st = $('stop');
    for (var k = 1; k <= steps; k++) (function (k) {
      setTimeout(function () {
        var t = k / steps, e = 1 - Math.pow(1 - t, 2), d = document.createElement('i'); d.className = 'trail';
        d.style.left = (from.x + (x - from.x) * e + 20) + 'px'; d.style.top = (from.y + (y - from.y) * e + 20) + 'px'; st.appendChild(d);
        d.animate([{ opacity: .9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.2)' }], { duration: 650, easing: 'ease-out' }).onfinish = function () { d.remove(); };
      }, dur * k / steps);
    })(k);""")
# gsap sequence
a="    if (!state.reduce) {\n      buzz([18, 40, 26]);"
assert s.count(a)==1
i=s.index(a); j=s.index("    clearTimeout(advTimer);",i)
s=s[:i]+"""    if (!state.reduce) litSequence(n, echoing);
"""+s[j:]
rep("  function doLight() {","""  // The lamp-lighting moment: one GSAP timeline, with a plain fallback if the library did not load.
  function litSequence(n, echoing) {
    buzz([18, 40, 26]);
    var lr = $('stop').getBoundingClientRect();
    jyoGo(lr.width / 2 - 20, lr.height * .3, 420);
    $('jyoLive').classList.add('happy');
    setTimeout(function () { $('jyoLive').classList.remove('happy'); }, 1500);
    setTimeout(function () { $('options').classList.add('leaving'); }, 760);
    if (!window.gsap) {
      $('bloom').animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: .85, transform: 'scale(1)', offset: .35 }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 1100, easing: 'ease-out' });
      return;
    }
    var g = window.gsap, tl = g.timeline({ defaults: { ease: 'power2.out' } }), cx = lr.width / 2, cy = lr.height * .58;
    tl.fromTo('#bloom', { opacity: 0, scale: .5 }, { opacity: .85, scale: 1, duration: .32 }, 0)
      .to('#bloom', { opacity: 0, scale: 1.5, duration: .8, ease: 'power1.in' }, .32)
      .fromTo('#ring', { opacity: .9, scale: .1 }, { opacity: 0, scale: 3.2, duration: .95, ease: 'power3.out' }, .1)
      .fromTo('#stopBg', { scale: 1 }, { scale: 1.035, duration: .22, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 60%' }, .05)
      .fromTo('#jyoIn', { rotation: 0, scale: 1 }, { rotation: 720, scale: 1.55, duration: .6, ease: 'back.inOut(1.4)', yoyo: true, repeat: 1, repeatDelay: 0 }, .35);
    var dot = $('lampRow').children[n - 1];
    if (dot && !echoing) tl.fromTo(dot, { scale: 2.4 }, { scale: 1.2, duration: .7, ease: 'elastic.out(1,.45)', clearProps: 'transform' }, .15);
    for (var i = 0; i < 18; i++) (function (i) {
      var p = document.createElement('i'); p.className = 'spark'; p.style.left = cx + 'px'; p.style.top = cy + 'px'; $('stop').appendChild(p);
      var a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 110;
      g.fromTo(p, { x: 0, y: 0, opacity: 1, scale: 1 }, { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, opacity: 0, scale: .2, duration: .8 + Math.random() * .5, ease: 'power2.out', delay: .25, onComplete: function () { p.remove(); } });
    })(i);
  }
  function doLight() {""")
open('lamps6.html','w',encoding='utf8').write(s); print('ok')
