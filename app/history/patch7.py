import re
s=open('lamps6.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:80]); s=s.replace(a,b)
# 1. tap to light
i=s.index("  // Hold the button to light the lamp"); j=s.index("  $('back').addEventListener('click'",i)
s=s[:i]+"  $('light').addEventListener('click', function () { doLight(); });\n"+s[j:]
rep('aria-label="Light the lamp. Hold the button, or press Enter"><span class="charge"></span><span class="lbl">Hold to light the lamp</span>','aria-label="Light the lamp"><span class="lbl">Light the lamp</span>')
rep("totalSpent() === 0 ? 'Hold to light · keep my oil' : 'Hold to light the lamp'","totalSpent() === 0 ? 'Light the lamp · keep my oil' : 'Light the lamp'")
rep("Keep holding until the lamp catches.","Keep holding until the lamp catches.") if False else None
# 2. haptics: one short pulse when a lamp is lit, nothing else
rep("jyoVisit(btn); buzz(10); Snd.spend();","jyoVisit(btn); Snd.spend();")
rep("jyoVisit(btn); buzz(6); Snd.refund();","jyoVisit(btn); Snd.refund();")
s=s.replace("buzz([8, 30, 8]); ","")
rep("    buzz([18, 40, 26]);\n","    buzz(12);\n")
rep(" if (on && navigator.vibrate) navigator.vibrate(10); },"," },")
rep(" if (on && navigator.vibrate) navigator.vibrate([8, 40, 8]); },"," },")
# 3. calmer animation
rep("animation: sway var(--dur, 5.4s) ease-in-out var(--del, 0s) infinite, objin","animation: objin")
rep("b.style.animationDelay = (-i * 1.1).toFixed(1) + 's, ' + ((base || 0) + i * 90 + 150) + 'ms';","b.style.animationDelay = ((base || 0) + i * 90 + 150) + 'ms';")
s=s.replace("mix-blend-mode: screen; }","}")
rep("animation: flapL .09s ease-in-out infinite alternate;","animation: flapL .2s ease-in-out infinite alternate;")
rep("buildEmbers('embers', 16); buildEmbers('embersW', 12);","buildEmbers('embers', 8); buildEmbers('embersW', 6);")
rep("background: #ffd978; box-shadow: 0 0 8px 2px rgba(255,200,90,.7); opacity: 0;","background: radial-gradient(circle, #fff3b0 0 35%, rgba(255,200,90,.55) 60%, rgba(255,200,90,0) 72%); opacity: 0;")
rep(".fromTo('#stopBg', { scale: 1 }, { scale: 1.035, duration: .22, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 60%' }, .05)\n","")
rep("tl.fromTo('#bloom', { opacity: 0, scale: .5 }, { opacity: .85, scale: 1, duration: .32 }, 0)\n      .to('#bloom', { opacity: 0, scale: 1.5, duration: .8, ease: 'power1.in' }, .32)","tl.fromTo('#bloom', { opacity: 0 }, { opacity: .7, duration: .3 }, 0)\n      .to('#bloom', { opacity: 0, duration: .8, ease: 'power1.in' }, .3)")
rep("for (var i = 0; i < 18; i++) (function (i) {","for (var i = 0; i < 10; i++) (function (i) {")
# trail: fewer dots
rep("var steps = Math.min(7, Math.max(3, Math.round(dur / 55))), st = $('stop');","var steps = Math.min(4, Math.max(2, Math.round(dur / 100))), st = $('stop');")
open('lamps7.html','w',encoding='utf8').write(s); print('ok')
