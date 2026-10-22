import json
s=open('lamps14.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index(';window.MW_STORY')
s=s[:i]+'<script>window.MW_CONTENT = '+content+s[j:]

# ---------------- CSS
rep("  /* ----- tester pack: gate, ratings, feedback ----- */","""  /* ----- lamp locks (puzzles) ----- */
  #lock .lkcard { background: rgba(20,22,52,.72); border: 1.5px solid rgba(255,243,214,.35); border-radius: 18px; padding: 14px; display: grid; gap: 12px; }
  #lock .lkq { font-weight: 800; font-size: 17px; line-height: 1.35; color: #fff3d6; }
  #lock .lkfig { display: flex; justify-content: center; } #lock .lkfig svg { max-height: 120px; }
  #lock .lkopts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  #lock .lkopts button { min-height: 62px; border-radius: 14px; border: 2px solid rgba(255,243,214,.55); background: rgba(255,255,255,.08); color: #fff3d6; font-weight: 800; font-size: 17px; padding: 8px; display: grid; place-items: center; }
  #lock .lkopts button.fig { min-height: 96px; } #lock .lkopts button.fig svg { max-height: 74px; max-width: 100%; }
  #lock .lkopts button[aria-pressed="true"] { background: #ffe9a8; color: #2a2038; border-color: #ffcf6b; }
  #lock .lkopts button:disabled { opacity: 1; }
  #lock .lkfb { min-height: 2.6em; font-weight: 700; color: #ffe9a8; font-family: var(--hand); font-size: 16px; }
  #lock .gate svg { width: 70px; height: 70px; } #lock .shackle { transform-origin: 40px 30px; transition: transform .6s cubic-bezier(.2,.9,.3,1.3); }
  #lock.open .shackle { transform: translateY(-8px) rotate(-28deg); } #lock.open .keyglow { opacity: 1; }
  #lock .keyglow { opacity: .25; transition: opacity .6s; }
  @keyframes lkshake { 0%,100% { transform: none; } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  #lock.held .gate svg { animation: lkshake .35s 1; }
  .gate { display: flex; justify-content: center; }
  /* ----- finale ----- */
  #finale { position: absolute; inset: 0; z-index: 52; display: none; overflow: hidden; background: #070a22; }
  #finale.on { display: block; }
  #finale .fnbg { position: absolute; inset: -2%; background-size: cover; background-position: center; filter: brightness(.18) saturate(.7); transform: scale(1.1); transition: filter 3s ease, transform 9s ease-out; }
  #finale.lit .fnbg { filter: brightness(1) saturate(1.05); transform: scale(1); }
  #finale .fnflash { position: absolute; left: 50%; top: 24%; width: 40px; height: 40px; margin: -20px; border-radius: 50%; background: radial-gradient(circle, #fffbe0 0 25%, rgba(255,214,120,.9) 45%, rgba(255,190,90,0) 72%); opacity: 0; transform: scale(.2); }
  #finale.lit .fnflash { animation: fnflash 2.4s ease-out 1 both; }
  @keyframes fnflash { 0% { opacity: 0; transform: scale(.2); } 25% { opacity: 1; transform: scale(18); } 100% { opacity: 0; transform: scale(30); } }
  #finale .fnjyo { position: absolute; left: 50%; bottom: 14%; width: 58px; height: 58px; margin-left: -29px; transition: transform 1.8s cubic-bezier(.3,.7,.2,1), opacity .5s; animation: fnbob 2s ease-in-out infinite; }
  #finale .fnjyo svg { width: 100%; height: 100%; }
  #finale.lit .fnjyo { transform: translateY(-48vh) scale(.5); opacity: 0; }
  @keyframes fnbob { 0%,100% { margin-bottom: 0; } 50% { margin-bottom: 10px; } }
  #finale .fntext { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 16px calc(var(--safe-bot) + 18px); display: grid; gap: 10px; justify-items: center; text-align: center; background: linear-gradient(180deg, rgba(7,10,34,0), rgba(7,10,34,.82) 40%); }
  #finale .fnl1 { font-family: var(--hand); font-weight: 700; font-size: 19px; color: #fff3d6; opacity: 0; transition: opacity 1s; min-height: 1.3em; text-shadow: 0 2px 8px rgba(0,0,0,.7); }
  #finale .fnt { font-size: clamp(30px, 9vw, 40px); color: #fff3d6; opacity: 0; transform: translateY(10px) scale(.96); transition: opacity 1s, transform 1s; text-shadow: 0 0 24px rgba(255,200,90,.7), 0 2px 8px rgba(0,0,0,.7); }
  #finale .show { opacity: 1 !important; transform: none !important; }
  #finale .fnchips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; min-height: 44px; }
  #finale .fnchip { font-weight: 800; font-size: 17px; padding: 8px 14px; border-radius: 999px; background: rgba(20,22,52,.8); border: 2px solid var(--c, #ffcf6b); color: #fff3d6; opacity: 0; transform: translateY(8px) scale(.9); transition: opacity .6s, transform .6s; }
  #finale .fnchip b { color: var(--c, #ffcf6b); margin-right: 6px; }
  #finale .fnnote { font-family: var(--hand); font-weight: 700; font-size: 16.5px; line-height: 1.35; color: #f6eccf; max-width: 34ch; opacity: 0; transition: opacity 1s; }
  #finale .go { max-width: 340px; opacity: 0; transition: opacity .6s; } #finale .go.show { opacity: 1; }
  #finale .fnskip { position: absolute; top: calc(var(--safe-top) + 10px); right: 12px; background: rgba(14,16,40,.6); color: #fff3d6; border: 1.5px solid rgba(255,243,214,.4); border-radius: 999px; padding: 8px 14px; font-weight: 700; min-height: 40px; }
  @media (prefers-reduced-motion: reduce) { #finale .fnbg, #finale .fnjyo, #finale .fnt, #finale .fnchip { transition: none; } #finale.lit .fnflash { animation: none; } }
  .aptcard { background: rgba(20,22,52,.72); border: 1.5px solid rgba(255,243,214,.35); border-radius: 14px; padding: 10px 12px; display: grid; gap: 6px; font-size: 14.5px; font-weight: 600; color: #fff3d6; }
  .aptcard b.t { font-size: 16px; } .aptcard .ar { display: flex; justify-content: space-between; gap: 10px; } .aptcard .ar span:last-child { color: #ffe9a8; font-weight: 800; }
  /* ----- tester pack: gate, ratings, feedback ----- */""")

# ---------------- HTML
rep('  <section class="screen pad res" id="parent">','''  <section class="screen pad res" id="lock">
    <div class="head"><h2 id="lkName"></h2><p id="lkLead"></p></div>
    <div class="gate" aria-hidden="true"><svg viewBox="0 0 80 80"><path class="shackle" d="M24 36V26a16 16 0 0 1 32 0v10" fill="none" stroke="#fff3d6" stroke-width="6" stroke-linecap="round"/><rect x="16" y="34" width="48" height="36" rx="8" fill="#5a4a86" stroke="#fff3d6" stroke-width="3"/><circle class="keyglow" cx="40" cy="50" r="7" fill="#ffd978"/><rect x="38" y="52" width="4" height="10" rx="2" fill="#2a2038"/></svg></div>
    <div class="lkcard"><div class="lkq" id="lkQ"></div><div class="lkfig" id="lkFig"></div><div class="lkopts" id="lkOpts"></div><div class="lkfb" id="lkFb" role="status" aria-live="polite"></div></div>
    <div class="actions"><button class="go" id="lkNext" type="button" hidden>Next lock</button><button class="go quiet" id="lkSkip" type="button">Skip this lock</button></div>
  </section>

  <section class="screen pad res" id="parent">''')
rep('  <div id="consent" hidden role="dialog"','''  <section id="finale" aria-label="The lighthouse is lit"><div class="fnbg" id="fnBg"></div><div class="fnflash"></div><div class="fnjyo" id="fnJyo"></div>
    <button class="fnskip" id="fnSkip" type="button">Skip</button>
    <div class="fntext"><p class="fnl1" id="fnL1"></p><h2 class="fnt" id="fnT">The lighthouse is lit.</h2><div class="fnchips" id="fnChips"></div><p class="fnnote" id="fnNote"></p><button class="go" id="fnGo" type="button">See your shape</button></div>
  </section>
  <div id="consent" hidden role="dialog"''')
rep('<div class="lean" id="leanNote" hidden></div>','<div class="lean" id="leanNote" hidden></div><p class="fineprint" id="aptNote" hidden></p>')
rep("['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field', 'abroad', 'parent'].forEach","['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field', 'abroad', 'parent', 'lock'].forEach")
rep("if (v === 'dreams' || v === 'reveal'","if (v === 'lock') return 'A lock on the road';\n    if (v === 'dreams' || v === 'reveal'")
rep("    else if (state.view === 'parent') { show('doors'); }\n  });","    else if (state.view === 'parent') { show('doors'); }\n  });\n  var _bk = $('back'); _bk.addEventListener('click', function () { /* locks have no back step */ }, false);")
# back handler must ignore lock: add early return
rep("    if (state.busy && state.view === 'stop') return;\n    clearTimeout(advTimer);","    if (state.view === 'lock' || $('finale').classList.contains('on')) return;\n    if (state.busy && state.view === 'stop') return;\n    clearTimeout(advTimer);")

# ---------------- JS: locks, aptitude, finale (inserted before reviewer shortcuts)
rep("  // ---------- reviewer shortcuts","""  // ---------- lamp locks: short puzzles told as part of the story (original items; no copied test material)
  var APT = ['N', 'V', 'S', 'P'], APTN = { N: 'Numbers', V: 'Words', S: 'Shapes', P: 'Patterns' };
  var LOCKS = {
    N: { name: 'The Lock of Numbers', items: [
      { l: 1, q: 'The lamplighter carries 12 flasks and lights 4 lamps, using the same number at each. How many flasks does each lamp get?', o: ['2', '3', '4', '6'], a: 1 },
      { l: 2, q: 'A flask costs ₹40. The shop gives 1 flask free for every 4 you buy. You need 10 flasks. How much do you pay?', o: ['₹280', '₹320', '₹360', '₹400'], a: 1 },
      { l: 3, q: 'Two lamps blink together right now. One blinks every 6 seconds and the other every 8 seconds. After how many seconds do they next blink together?', o: ['14', '24', '36', '48'], a: 1 }] },
    V: { name: 'The Lock of Words', items: [
      { l: 1, q: 'Which word means almost the same as "gleam"?', o: ['shine', 'hide', 'break', 'follow'], a: 0 },
      { l: 2, q: 'Map is to traveller as recipe is to ...', o: ['cook', 'kitchen', 'meal', 'hunger'], a: 0 },
      { l: 3, q: 'Which word means almost the same as "ephemeral"?', o: ['short-lived', 'ancient', 'colourful', 'heavy'], a: 0 }] },
    P: { name: 'The Lock of Patterns', items: [
      { l: 1, q: 'What comes next?   A  B  A  B  A  ?', o: ['B', 'A', 'C', 'D'], a: 0 },
      { l: 2, q: 'What comes next?   ↑  →  ↓  ←  ↑  ?', o: ['→', '↓', '←', '↑'], a: 0 },
      { l: 3, q: 'What comes next?   2, 4, 3, 6, 5, 10, 9, ?', o: ['18', '11', '12', '20'], a: 0 }] },
    S: { name: 'The Lock of Shapes', spatial: true }
  };
  var SHAPES = { 1: [[0, 0], [0, 1], [0, 2], [1, 2]], 2: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]], 3: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]] };
  var ROUNDS = { 2: ['N', 'V', 1], 4: ['S', 'P', 1], 6: ['N', 'V', 2], 8: ['S', 'P', 2] };
  state.apt = { N: [], V: [], S: [], P: [] }; state.lockDone = {};
  function normC(c) { var mx = Math.min.apply(null, c.map(function (p) { return p[0]; })), my = Math.min.apply(null, c.map(function (p) { return p[1]; })); return c.map(function (p) { return [p[0] - mx, p[1] - my]; }); }
  function keyC(c) { return normC(c).map(function (p) { return p[0] + ',' + p[1]; }).sort().join(';'); }
  function rotC(c, k) { for (var i = 0; i < k; i++) c = c.map(function (p) { return [p[1], -p[0]]; }); return c; }
  function mirC(c) { return c.map(function (p) { return [-p[0], p[1]]; }); }
  function figSVG(c) {
    var n = normC(c), w = Math.max.apply(null, n.map(function (p) { return p[0]; })) + 1, h = Math.max.apply(null, n.map(function (p) { return p[1]; })) + 1, z = 18;
    return '<svg viewBox="0 0 ' + (w * z + 4) + ' ' + (h * z + 4) + '" role="img" aria-label="A shape made of ' + n.length + ' squares">' + n.map(function (p) { return '<rect x="' + (p[0] * z + 2) + '" y="' + (p[1] * z + 2) + '" width="' + (z - 2) + '" height="' + (z - 2) + '" rx="3" fill="#ffcf6b" stroke="#2a2038" stroke-width="1.5"/>'; }).join('') + '</svg>';
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function spatialItem(level) {
    var base = SHAPES[level], bk = {}, good = rotC(base, 1 + Math.floor(Math.random() * 3)), opts = [{ c: good, ok: true }], used = {};
    for (var r = 0; r < 4; r++) { bk[keyC(rotC(base, r))] = 1; }
    used[keyC(good)] = 1;
    var m = mirC(base); [0, 1, 2, 3].forEach(function (r) { bk[keyC(rotC(m, r))] = 'mirror'; });
    shuffle([0, 1, 2, 3]).some(function (r) { var c = rotC(m, r), k = keyC(c); if (used[k] || bk[k] === 1) return false; used[k] = 1; opts.push({ c: c }); return opts.length >= 3; });
    var guard = 0;
    while (opts.length < 4 && guard++ < 200) {
      var c2 = base.map(function (p) { return p.slice(); }), idx = Math.floor(Math.random() * c2.length), dx = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)], np = [c2[idx][0] + dx[0], c2[idx][1] + dx[1]];
      if (c2.some(function (p) { return p[0] === np[0] && p[1] === np[1]; })) continue; c2[idx] = np;
      var near = c2.some(function (p, i2) { return i2 !== idx && Math.abs(p[0] - np[0]) + Math.abs(p[1] - np[1]) === 1; }); if (!near) continue;
      var c3 = rotC(c2, Math.floor(Math.random() * 4)), k3 = keyC(c3); if (used[k3] || bk[k3]) continue; used[k3] = 1; opts.push({ c: c3 });
    }
    return { fig: base, opts: shuffle(opts) };
  }
  var lk = { items: [], i: 0, round: 0, done: null, cur: null, t0: 0, locked: false };
  function nextLevel(dom) { var a = state.apt[dom]; return a.length === 0 ? 2 : (a[0].ok ? 3 : 1); }
  function showLock(round, done) {
    var R = ROUNDS[round]; lk.items = [R[0], R[1]]; lk.i = 0; lk.round = round; lk.done = done; show('lock'); $('lock').scrollTop = 0; Voice.stop(); Snd.door();
    $('lkLead').textContent = 'The old lamplighter sealed this gate. Jyo says any key you try teaches the lantern a little about you.'; paintLock();
  }
  function paintLock() {
    var dom = lk.items[lk.i], L = LOCKS[dom], lvl = nextLevel(dom), it, opts, fig = '';
    $('lock').classList.remove('open', 'held'); lk.locked = false; $('lkNext').hidden = true; $('lkFb').textContent = ''; $('lkSkip').hidden = false;
    $('lkName').textContent = L.name + (lk.i ? ' (2 of 2)' : ' (1 of 2)');
    if (L.spatial) { var sp = spatialItem(lvl); $('lkQ').textContent = 'Which one is the same shape, just turned around? A flipped copy does not count.'; fig = figSVG(sp.fig); opts = sp.opts.map(function (o) { return { h: figSVG(o.c), ok: !!o.ok }; }); it = { id: 'S' + lvl, l: lvl }; }
    else { var base = L.items.filter(function (x) { return x.l === lvl; })[0], order = shuffle(base.o.map(function (t, i) { return { t: t, ok: i === base.a }; })); $('lkQ').textContent = base.q; opts = order.map(function (o) { return { h: esc(o.t), ok: o.ok }; }); it = { id: dom + lvl, l: lvl }; }
    lk.cur = it; lk.t0 = Date.now(); $('lkFig').innerHTML = fig; $('lkFig').hidden = !fig;
    $('lkOpts').innerHTML = opts.map(function (o, i) { return '<button type="button" class="' + (L.spatial ? 'fig' : '') + '" data-ok="' + (o.ok ? 1 : 0) + '" aria-label="' + (L.spatial ? 'Shape ' + (i + 1) : '') + '">' + o.h + '</button>'; }).join('');
  }
  function endLockItem(ok, skipped) {
    var dom = lk.items[lk.i];
    state.apt[dom].push({ id: lk.cur.id, l: lk.cur.l, ok: !!ok, skip: !!skipped, ms: Math.min(600000, Date.now() - lk.t0) });
    $('lkSkip').hidden = true; $('lkNext').hidden = false; $('lkNext').textContent = lk.i === 0 ? 'Next lock' : 'Walk on';
  }
  $('lkOpts').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || lk.locked) return; lk.locked = true;
    Array.prototype.forEach.call($('lkOpts').children, function (x) { x.disabled = true; x.setAttribute('aria-pressed', String(x === b)); });
    var ok = b.dataset.ok === '1'; $('lock').classList.add(ok ? 'open' : 'held');
    $('lkFb').textContent = ok ? 'Click. The lock turns and the gate swings open.' : 'The lock holds this time, so Jyo guides you round the side.';
    if (ok) Snd.lamp(litCount()); endLockItem(ok, false);
  });
  $('lkSkip').addEventListener('click', function () { if (lk.locked) return; lk.locked = true; $('lkFb').textContent = 'No problem. Jyo knows another way round.'; endLockItem(false, true); });
  $('lkNext').addEventListener('click', function () {
    if (lk.i === 0) { lk.i = 1; paintLock(); return; }
    var d = lk.done; lk.done = null; state.lockDone[lk.round] = 1; d && d();
  });
  function aptScores() {
    var out = {}, n = 0;
    APT.forEach(function (d) { var a = state.apt[d]; if (a.length === 2 && !a[0].skip && !a[1].skip) { out[d] = a[0].ok ? (a[1].ok ? 3 : 2) : (a[1].ok ? 1 : 0); n++; } });
    return { s: out, n: n };
  }
  var APTW = { health: { N: .2, V: .3, S: .2, P: .3 }, sci: { N: .3, V: .2, S: .1, P: .4 }, eng: { N: .35, V: 0, S: .3, P: .35 }, tec: { N: .3, V: .15, S: .1, P: .45 }, com: { N: .5, V: .2, S: 0, P: .3 }, des: { N: .1, V: .15, S: .5, P: .25 }, psy: { N: .15, V: .45, S: .1, P: .3 }, law: { N: .1, V: .6, S: 0, P: .3 }, media: { N: 0, V: .7, S: .1, P: .2 }, pub: { N: .2, V: .4, S: 0, P: .4 }, hos: { N: .2, V: .4, S: .2, P: .2 }, spo: { N: .15, V: .2, S: .35, P: .3 }, agr: { N: .25, V: .2, S: .2, P: .35 }, voc: { N: .3, V: 0, S: .4, P: .3 }, arts: { N: .1, V: .25, S: .35, P: .3 }, mar: { N: .3, V: .1, S: .3, P: .3 } };
  function aptNudge(fid) {
    var a = aptScores(); if (a.n < 4 || !APTW[fid]) return 0;
    return .35 * APT.reduce(function (t, d) { return t + APTW[fid][d] * (a.s[d] - 1.5) / 1.5; }, 0);
  }
  var LEVEL_WORD = ['Growing', 'Steady', 'Strong', 'Strong'];
  function paintApt() {
    var a = aptScores(), el = $('aptCard'); if (!el) { el = document.createElement('div'); el.id = 'aptCard'; el.className = 'aptcard'; $('legend').parentNode.insertBefore(el, $('legend').nextSibling); }
    if (a.n < 2 || (state.result && state.result.noSignal)) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<b class="t">Puzzle strengths</b>' + APT.filter(function (d) { return a.s[d] !== undefined; }).map(function (d) { return '<div class="ar"><span>' + APTN[d] + '</span><span>' + LEVEL_WORD[a.s[d]] + '</span></div>'; }).join('') + '<span style="font-weight:600;font-size:13.5px;color:#f3ecd8">These are a few quick puzzles, so a rough signal only. They nudge the order of fields a little and do not change your interest shape.</span>';
  }
  function trackApt() { var a = aptScores(); track('apt', { s: a.s, items: APT.reduce(function (o, d) { o[d] = state.apt[d].map(function (x) { return [x.l, x.ok ? 1 : 0, x.skip ? 1 : 0, x.ms]; }); return o; }, {}) }); }

  // ---------- finale: the lighthouse lights, then the shape appears
  var fnTimers = [];
  function fnAfter(ms, f) { fnTimers.push(setTimeout(f, ms)); }
  function playFinale() {
    var f = $('finale'), r = state.result, code = r.code.code, n = litCount(), COL = ['#ffcf6b', '#46b3b0', '#e8708a'];
    $('fnBg').style.backgroundImage = ART.bg && ART.bg.lighthouse ? 'url(' + ART.bg.lighthouse + ')' : 'linear-gradient(180deg,#0a0f2e,#24306a 55%,#ffbf6a)';
    $('fnJyo').innerHTML = sprite('jyo');
    $('fnL1').textContent = ''; $('fnL1').classList.remove('show'); $('fnT').classList.remove('show'); $('fnNote').classList.remove('show'); $('fnGo').classList.remove('show'); $('fnGo').disabled = true; $('fnChips').innerHTML = '';
    $('fnNote').textContent = (STORY.outro || '').replace(/^The lighthouse is lit\.\s*/, '');
    f.classList.remove('lit'); f.classList.add('on'); fnTimers.forEach(clearTimeout); fnTimers = [];
    var fin = false;
    function finish() {
      if (fin) return; fin = true; fnTimers.forEach(clearTimeout); fnTimers = [];
      f.classList.add('lit'); $('fnL1').classList.add('show'); $('fnL1').textContent = n + ' lamps are burning behind you.'; $('fnT').classList.add('show');
      $('fnChips').innerHTML = code.map(function (a, i) { return '<span class="fnchip show" style="--c:' + COL[i] + '"><b>' + (i + 1) + '</b>' + NAME[a] + '</span>'; }).join('');
      $('fnNote').classList.add('show'); $('fnGo').classList.add('show'); $('fnGo').disabled = false; $('fnGo').focus();
    }
    function leave() { fnTimers.forEach(clearTimeout); f.classList.remove('on', 'lit'); var rv = $('reveal'); rv.scrollTop = 0; rv.classList.remove('on'); void rv.offsetWidth; rv.classList.add('on'); }
    $('fnGo').onclick = leave; $('fnSkip').onclick = finish;
    if (state.reduce) { finish(); return; }
    fnAfter(500, function () { $('fnL1').classList.add('show'); $('fnL1').textContent = 'Every lamp you lit is still burning.'; });
    fnAfter(2600, function () { $('fnL1').classList.remove('show'); });
    fnAfter(3000, function () { f.classList.add('lit'); Snd.reveal(); });
    fnAfter(4600, function () { $('fnT').classList.add('show'); });
    fnAfter(5800, function () { var ch = $('fnChips'); code.forEach(function (a, i) { fnAfter(i * 700, function () { var s2 = document.createElement('span'); s2.className = 'fnchip'; s2.style.setProperty('--c', COL[i]); s2.innerHTML = '<b>' + (i + 1) + '</b>' + NAME[a]; ch.appendChild(s2); void s2.offsetWidth; s2.classList.add('show'); Snd.door(); }); }); });
    fnAfter(8400, function () { $('fnL1').textContent = n + ' lamps are burning behind you.'; $('fnL1').classList.add('show'); $('fnNote').classList.add('show'); });
    fnAfter(10200, function () { fin = true; $('fnGo').classList.add('show'); $('fnGo').disabled = false; });
  }
  // ---------- reviewer shortcuts""")

# hook locks into advance
rep("    if (s.done) return toDreams();\n    state.scene = s.scene;","    if (s.done) return toDreams();\n    var np = litCount(), rd = ROUNDS[np];\n    if (!first && rd && !state.lockDone[np] && !s.echo) { state.busy = false; document.body.classList.remove('busy'); return showLock(np, function () { advance(false); }); }\n    state.scene = s.scene;")
rep("  function startWalk() { state.choices = []; state.slots = [0, 0, 0, 0];","  function startWalk() { state.choices = []; state.slots = [0, 0, 0, 0]; state.apt = { N: [], V: [], S: [], P: [] }; state.lockDone = {};")
# dreamGo -> finale
rep("$('dreamGo').addEventListener('click', function () { track('context', state.ctx); toReveal(); });","$('dreamGo').addEventListener('click', function () { track('context', state.ctx); toReveal(); trackApt(); paintApt(); if (!state.result.noSignal) playFinale(); });")
# field ranking nudge
rep("      return { f: f, ms: ms, score: score, raw: raw };","      var nd = aptNudge(f.id); return { f: f, ms: ms, score: score + nd, raw: raw, nudge: nd };")
rep("    var caution = state.result.cautious","    var an = $('aptNote'); an.hidden = aptScores().n < 4; an.textContent = 'Your puzzle answers nudged this order a little. They are a few quick puzzles, so treat the nudge as a rough hint.';\n    var caution = state.result.cautious")
# India pay line in career cards
rep("return '<div class=\"crow\"><b>' + c.title + '</b><p>' + c.line + '</p>' + usPay(c) + '</div>'; }).join('');","return '<div class=\"crow\"><b>' + c.title + '</b><p>' + c.line + '</p>' + inPay(c) + usPay(c) + '</div>'; }).join('') + plfsNote();")
rep("  function usPay(c) {","""  function inPay(c) {
    if (!c.in) return '';
    return '<p class="us">India: salaried people in this broad group (' + esc(c.in.group.toLowerCase()) + ') earn about ₹' + c.in.monthly.toLocaleString('en-IN') + ' a month on average (PLFS ' + CONTENT.plfs.year + '). This covers all ages and jobs in the group, so a first job usually pays less.</p>';
  }
  function plfsNote() {
    var p = CONTENT.plfs; if (!p) return '';
    return '<div class="crow"><p class="us"><b>India pay, for comparison:</b> salaried graduates earn about ₹' + p.education.Graduate.toLocaleString('en-IN') + ' a month on average, and postgraduates ₹' + p.education['Postgraduate and above'].toLocaleString('en-IN') + '. People aged 25 to 29 earn about ₹' + p.age['25-29'].toLocaleString('en-IN') + '. Source: Periodic Labour Force Survey ' + p.year + ' (<a href="' + p.src[0] + '" target="_blank" rel="noopener noreferrer">MoSPI press note</a>, <a href="' + p.src[1] + '" target="_blank" rel="noopener noreferrer">tables</a>). Salaried workers only, and averages hide a wide spread.</p></div>';
  }
  function usPay(c) {""")
# parent page puzzle section
rep("    var conf = r.noSignal ?","    var ap = aptScores(); if (ap.n >= 2) h += '<div><h3>Puzzle strengths</h3><div class=\"pcar\">' + APT.filter(function (d) { return ap.s[d] !== undefined; }).map(function (d) { return APTN[d] + ': ' + LEVEL_WORD[ap.s[d]]; }).join(' · ') + '</div><div class=\"pmeta\">A few quick puzzles inside the game. A rough signal, not an ability test.</div></div>';\n    var conf = r.noSignal ?")
rep("show('reveal'); Snd.reveal(); $('reveal').scrollTop = 0;","show('reveal'); if (r.noSignal) Snd.reveal(); $('reveal').scrollTop = 0;")
open('lamps15.html','w',encoding='utf8').write(s); print('ok',len(s)//1000)
