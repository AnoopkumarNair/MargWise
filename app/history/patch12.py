import json
s=open('lamps12.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
abroad=json.dumps(json.load(open('abroad.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index('</script>',i)+9
old=s[i:j]; st=old[old.index('window.MW_STORY'):old.index(';window.MW_ABROAD')]
s=s[:i]+'<script>window.MW_CONTENT = '+content+';'+st+';window.MW_ABROAD = '+abroad+';</script>'+s[j:]

# 1. gate notice: purpose, deletion route, retention
rep("<p>Thank you for trying this. We record your name, the choices you make and your feedback, so we can see how people use it and what they think. Only the Margwise team sees this. You can ask us to delete it any time.</p>",
 "<p>Thank you for trying this. We record your name, the choices you make, your results and your feedback. We use them to improve the game and to check how well it measures interests. Only the Margwise team sees them. To have your data deleted, ask the person who invited you. We plan to keep it until the test ends (about 31 January 2027) and then delete it.</p>")
rep("I am 18 or older, or a parent or guardian has agreed that I can take part.","I am 18 or older, or my parent or guardian has agreed that I can take part.")

# 2. telemetry: event ids, retry, beacon, no UA
a=s.index("  function flush() {"); b=s.index("  addEventListener('error', function (e) { track('error'")
new_flush = r"""  var EID = 0, failN = 0;
  function flush(useBeacon) {
    if (!MWC || !TK || !evq.length) return;
    var batch = evq.splice(0, 40), body = JSON.stringify({ testerId: TK.id, token: TK.token, session: SESSION, events: batch }), url = MWC.api + '/event';
    function back() { evq = batch.concat(evq); failN++; clearTimeout(flushT); if (failN < 8) flushT = setTimeout(flush, Math.min(60000, 2000 * Math.pow(2, failN))); }
    if (useBeacon === true && navigator.sendBeacon) { try { if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { /* fall through */ } back(); return; }
    try { fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).then(function (r) { if (r.ok || (r.status >= 400 && r.status < 500)) { failN = 0; if (evq.length) flush(); } else back(); }, back); } catch (e) { back(); }
  }
  function track(type, data) {
    if (!MWC || !TK) return;
    if (evq.length > 400) evq.splice(0, evq.length - 400);
    evq.push({ eid: SESSION + '-' + (++EID), ts: Date.now(), type: type, data: data || {} });
    var urgent = /^(result|feedback|self|areas)$/.test(type);
    if (urgent || evq.length >= 10) flush(); else { clearTimeout(flushT); flushT = setTimeout(flush, 4000); }
  }
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); }); addEventListener('pagehide', function () { flush(true); });
"""
s=s[:a]+new_flush+s[b:]
rep(", ua: navigator.userAgent.slice(0, 110) }",  " }")
# Not you: flush then clear
rep("nb.addEventListener('click', function () { try { localStorage.removeItem('margwise.tester'); }","nb.addEventListener('click', function () { flush(true); evq = []; try { localStorage.removeItem('margwise.tester'); }")

# 3. hide reviewer shortcuts in the hosted test build
rep("  if (MWC) {\n    $('saveBtn').hidden = true;","  if (MWC) {\n    (function () { var pe = $('personas'), x = pe.previousElementSibling; pe.hidden = true; while (x && (x.tagName === 'P' || x.tagName === 'H3')) { var p = x.previousElementSibling; if (/Reviewer|Fill the road/.test(x.textContent)) x.hidden = true; x = p && p.tagName !== 'BUTTON' ? p : null; } })();\n    $('saveBtn').hidden = true;")

# 4. no-signal: offer another walk
rep("$('revealLine').hidden = true; }\n  }","$('revealLine').hidden = true; }\n    var na = $('noSigAgain'); if (!na) { na = document.createElement('button'); na.type = 'button'; na.id = 'noSigAgain'; na.className = 'go'; na.textContent = 'Walk the road again'; na.addEventListener('click', function () { show('welcome'); }); $('notes').parentNode.appendChild(na); } na.hidden = !none;\n  }")

# 5. field ranking: standardise against random-profile null so no field wins by shape of its careers alone
rep("  function fieldFits() {\n    var r = state.result, matches","""  var NULLF = null;
  function nullStats() {
    if (NULLF) return NULLF;
    var seed = 12345; function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    function gauss() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var vals = {}, N = 150; FIELDS.forEach(function (f) { vals[f.id] = []; });
    for (var k = 0; k < N; k++) {
      var p = {}; AREAS.forEach(function (a) { p[a] = gauss(); });
      var ms = M.careerPaths(p, CAREERS.map(function (c) { return { careerId: c.id, values: c.values }; })), by = {}; ms.forEach(function (m) { by[m.careerId] = m.r; });
      FIELDS.forEach(function (f) { var cs = CAREERS.filter(function (c) { return c.field === f.id; }); vals[f.id].push(cs.reduce(function (a, c) { return a + by[c.id]; }, 0) / cs.length); });
    }
    NULLF = {}; FIELDS.forEach(function (f) { var v = vals[f.id], m = v.reduce(function (a, b) { return a + b; }, 0) / N, sd = Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / N) || 1; NULLF[f.id] = { m: m, sd: sd }; });
    return NULLF;
  }
  function fieldFits() {
    var r = state.result, matches""")
rep("      var score = ms.reduce(function (a, m) { return a + m.r; }, 0) / ms.length;\n      return { f: f, ms: ms, score: score };","      var raw = ms.reduce(function (a, m) { return a + m.r; }, 0) / ms.length, nf = nullStats()[f.id], score = (raw - nf.m) / nf.sd;\n      return { f: f, ms: ms, score: score, raw: raw };")

# 6. quieter tone when the shape is rough
rep("var caution = state.result.cautious ? 'Your shape was not sharp, so treat this order as a rough guide. ' : '';","var caution = state.result.cautious ? 'Your shape was not sharp, so treat this order as a rough guide, and lean on the Not clear cards. ' : '';")

# 7. abroad buttons quiet
rep('<button class="go" id="dAbroad" type="button">','<button class="go quiet" id="dAbroad" type="button">')
rep('<button class="go" id="fAbroad" type="button">','<button class="go quiet" id="fAbroad" type="button">')

# 8. abroad pay as official points; no totals for health; remove invented ranges
rep("var sal = c.salary || ''; h += row('Graduate pay', esc(sal), c.salaryRange ?","var sal = c.salary || '';\n    var pts = c.salaryPoints ? '<ul>' + c.salaryPoints.map(function (p) { return '<li>' + esc(p.l) + ': <b>' + esc(p.v) + '</b> ' + cf(p.conf) + '</li>'; }).join('') + '</ul>' : '';\n    h += row('Graduate pay', esc(sal) + pts, c.salaryRange ?")
rep("    h += row(a.route === 'A' ? 'Rough total, Route A","    var noTot = f && f.id === 'health';\n    if (noTot) h += row('Rough total', 'Not shown for health courses', 'Medicine and dentistry abroad do not follow the 4 + 2 pattern, and fees and licensing differ a lot. Ask the university for the full cost.'); else h += row(a.route === 'A' ? 'Rough total, Route A")
rep("(a.route === 'A' ? totA : totB)[0]) + ' to ' + inr(c.cur, (a.route === 'A' ? totA : totB)[1]), 'Tuition plus living, before scholarships.' + (a.route === 'B' ? ' Add the cost of your degree in India.' : ''));","(a.route === 'A' ? totA : totB)[0]) + ' to ' + inr(c.cur, (a.route === 'A' ? totA : totB)[1]), 'Tuition plus living, before scholarships. If you borrow, plan how to repay it even if you do not get a job abroad.' + (a.route === 'B' ? ' Add the cost of your degree in India.' : ''));")
open('lamps13.html','w',encoding='utf8').write(s); print('ok',len(s)//1000,'KB')
