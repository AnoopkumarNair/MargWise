s=open('lamps17.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
rep('<div class="shade"></div><div class="embers" id="embersW"></div></div>','<div class="shade"></div><div class="embers" id="embersW"></div></div>\n    <div class="wscrim" aria-hidden="true"></div>')
rep('<div class="kicker">A road, a lantern, and a firefly</div>','<div class="kicker">Margwise · Light your way</div>')
rep('About five to eight minutes. Nothing is marked.','About 15 minutes. Nothing is marked.')
rep("  #welcome .hero .kicker { font-family: var(--hand); font-weight: 800; font-size: 15px; letter-spacing: .06em; text-transform: uppercase; color: var(--glow); }","""  #welcome .wscrim { position: absolute; left: 0; right: 0; bottom: 0; height: 70%; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(7,10,34,0) 0%, rgba(7,10,34,.6) 28%, rgba(7,10,34,.84) 58%, rgba(7,10,34,.93) 100%); }
  #welcome .hero .kicker { font-family: var(--body); font-weight: 800; font-size: 17px; letter-spacing: .01em; text-transform: none; color: #ffe08a; text-shadow: 0 1px 8px rgba(0,0,0,.8); }""")
rep("  #welcome .hero p { color: var(--cream); font-size: 16px; text-shadow: 0 1px 8px rgba(0,0,0,.6); }","  #welcome .hero p { color: #fff8e6; font-size: 17px; line-height: 1.5; text-shadow: 0 1px 3px rgba(0,0,0,.7), 0 0 12px rgba(0,0,0,.6); }")
rep("  #welcome .hero h1 { font-size: clamp(34px, 10vw, 46px); font-weight: 800; margin: 2px 0 8px; }","  #welcome .hero h1 { font-size: clamp(34px, 10vw, 46px); font-weight: 800; margin: 2px 0 8px; text-shadow: 0 2px 14px rgba(0,0,0,.7); }\n  #welcome .actions, #welcome .foot { position: relative; z-index: 2; } #welcome .tiny, #welcome .foot { color: #f6eccf; text-shadow: 0 1px 6px rgba(0,0,0,.8); }")
open('lamps18.html','w',encoding='utf8').write(s)
