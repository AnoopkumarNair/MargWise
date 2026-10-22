s=open('lamps15.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
a=s.index('  <div id="gate" hidden'); b=s.index('  <section id="finale"')
GATE='''  <div id="gate" hidden role="dialog" aria-modal="true" aria-labelledby="gateT">
    <div class="gscene" id="gScene" aria-hidden="true"></div>
    <div class="gwrap">
      <header class="ghead">
        <div class="gbrand"><svg viewBox="0 0 60 80" aria-hidden="true"><path d="M22 8h16" stroke="#fff3d6" stroke-width="3.5" stroke-linecap="round"/><path d="M20 14h20l6 12v32a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V26z" fill="rgba(255,243,214,.14)" stroke="#fff3d6" stroke-width="3" stroke-linejoin="round"/><path d="M30 28c2 8 10 10 10 20a10 10 0 0 1-20 0c0-6 4-8 5-14c2 2 4 3 5-6z" fill="#f2a03d"/><path d="M30 42c1 4 5 5 5 9a5 5 0 0 1-10 0c0-4 4-5 5-9z" fill="#ffe08a"/></svg><span class="gword">Margwise</span><span class="gmean">marg means path</span></div>
        <h1 id="gateT">What kind of work would suit you?</h1>
        <p class="glead">Margwise is a story game for students in Class 9 to 12. You walk a road at night, light lamps and make small choices. At the end you see which interests stand out and which careers are worth a closer look.</p>
        <p class="gfacts">About 15 minutes. No marks and no wrong answers. Best with a parent beside you.</p>
      </header>
      <div class="gcard">
        <p class="gtest">You are one of the first people to try this. Your feedback helps us fix it before other students see it.</p>
        <label>Your name<input type="text" id="gName" maxlength="40" autocomplete="given-name" enterkeyhint="next"><small class="fp">The person who invited you will use it to match your feedback to you.</small></label>
        <label id="gCodeL" hidden>Invite code<input type="text" id="gCode" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="go"><small class="fp">You got this from the person who invited you.</small></label>
        <label class="chkrow"><input type="checkbox" id="gOk"><span>I am 18 or older, or my parent or guardian knows about this and agrees.</span></label>
        <p class="err" id="gErr" role="alert"></p>
        <button class="go" id="gGo" type="button">Start the walk</button>
        <details class="gdata"><summary>What we keep, and who sees it</summary>
          <p>We keep your name, the choices you make in the game, your results and any feedback you write. We never ask for your phone number, email or address.</p>
          <p>Only the Margwise team can see it. We use it to improve the game and to check how well it measures interests.</p>
          <p>We keep it until the test ends, about 31 January 2027, then delete it. To have yours deleted sooner, tell the person who invited you.</p>
        </details>
        <p class="gfine">Early test version. This is an interest guide, not a test of ability. Career information is still a draft.</p>
      </div>
    </div>
  </div>
'''
s=s[:a]+GATE+s[b:]
# CSS: replace the old gate rules
rep("  #gate { position: absolute; inset: 0; z-index: 55; display: grid; place-items: center; padding: 18px; background: radial-gradient(circle at 50% 30%, #2b2f63 0%, #141a3a 75%); overflow-y: auto; }\n  #gate .beatcard { gap: 12px; }","""  #gate { position: absolute; inset: 0; z-index: 55; overflow-y: auto; background: #070a22; -webkit-overflow-scrolling: touch; }
  #gate .gscene { position: fixed; inset: 0; background: #070a22 center 18% / cover no-repeat; filter: brightness(.8) saturate(.95); }
  #gate .gscene::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(7,10,34,.15) 0%, rgba(7,10,34,.8) 42%, #070a22 100%); }
  #gate .gwrap { position: relative; min-height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 18px; padding: calc(var(--safe-top) + 22px) 16px calc(var(--safe-bot) + 18px); max-width: 520px; margin: 0 auto; }
  #gate .ghead { display: grid; gap: 10px; }
  #gate .gbrand { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } #gate .gbrand svg { width: 28px; height: 38px; }
  #gate .gword { font-family: var(--display); font-weight: 800; font-size: 26px; letter-spacing: .01em; color: #fff3d6; }
  #gate .gmean { font-size: 13.5px; font-weight: 600; color: #e6dfcc; }
  #gate h1 { font-family: var(--display); font-weight: 800; font-size: clamp(30px, 9vw, 38px); line-height: 1.1; margin: 4px 0 0; color: #fff3d6; text-wrap: balance; text-shadow: 0 2px 14px rgba(0,0,0,.6); }
  #gate .glead { margin: 0; font-size: 16.5px; line-height: 1.5; font-weight: 600; color: #f6eccf; max-width: 44ch; }
  #gate .gfacts { margin: 0; font-size: 15px; font-weight: 800; color: #ffe08a; }
  #gate .gcard { background: #fff8e6; color: var(--ink); border-radius: 22px; padding: 16px; display: grid; gap: 12px; box-shadow: 0 14px 40px rgba(0,0,0,.45); }
  #gate .gtest { margin: 0; font-size: 14.5px; font-weight: 700; color: #4a3f5c; line-height: 1.4; }
  #gate .gdata { font-size: 14px; font-weight: 600; color: #4a3f5c; line-height: 1.45; } #gate .gdata summary { cursor: pointer; font-weight: 800; color: var(--ink); min-height: 32px; display: flex; align-items: center; } #gate .gdata p { margin: 6px 0 0; }
  #gate .gfine { margin: 0; font-size: 12.5px; font-weight: 600; color: #6a5f7c; line-height: 1.4; }
  #gate input[type=text]:focus-visible, #gate summary:focus-visible, #gate .go:focus-visible, #gate input[type=checkbox]:focus-visible { outline: 3px solid #1f6feb; outline-offset: 2px; }""")
rep("  #gate input[type=text], .sheet textarea { font: inherit;","  #gate input[type=text], .sheet textarea { font: inherit; font-size: 16px;")
# background image for gate
rep("  if (MWC) {\n    (function () {","  if (MWC) {\n    try { $('gScene').style.backgroundImage = 'url(' + ((ART.bg && ART.bg.lighthouse) || 'art/bg-lighthouse.webp') + ')'; } catch (e) { /* plain dark gate */ }\n    (function () {")
open('lamps16.html','w',encoding='utf8').write(s); print('ok')
