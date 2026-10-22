import json
s=open('lamps19.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:100]); s=s.replace(a,b)
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
abroad=json.dumps(json.load(open('abroad.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index(';window.MW_STORY'); old=s[i:s.index('</script>',i)+9]; st=old[old.index('window.MW_STORY'):old.index(';window.MW_ABROAD')]
s=s[:i]+'<script>window.MW_CONTENT = '+content+';'+st+';window.MW_ABROAD = '+abroad+';</script>'+s[i+len(old):]

# B1: field ranking by percentile against reference journeys (baked), best four careers per field
rep("  function nullStats() {\n    if (NULLF) return NULLF;\n    if (CONTENT.fieldNull) { NULLF = CONTENT.fieldNull; return NULLF; }","  function refPct(id, x) {\n    var t = CONTENT.fieldRef && CONTENT.fieldRef[id]; if (!t) return null; var q = t.length - 1; if (x <= t[0]) return 0; if (x >= t[q]) return 1;\n    var i = 0; while (t[i + 1] < x) i++; return (i + (x - t[i]) / ((t[i + 1] - t[i]) || 1)) / q;\n  }\n  function nullStats() {\n    if (NULLF) return NULLF;")
rep("nf = nullStats()[f.id], score = (raw - nf.m) / nf.sd;","rp = refPct(f.id, raw), score; if (rp !== null) score = rp + .002 * raw; else { var nf = nullStats()[f.id]; score = (raw - nf.m) / nf.sd; }")
rep("    return .35 * APT.reduce(","    return .05 * APT.reduce(")
# M4: finish any rounds not yet shown before the walk ends; fairer hard word; clearer lock names; connected distractors
rep("    if (s.done) return toDreams();\n    var np = litCount()","    if (s.done) { var nx = [2, 4, 6, 8].filter(function (k) { return !state.lockDone[k]; })[0]; if (nx !== undefined && !first) { state.busy = false; document.body.classList.remove('busy'); return showLock(nx, function () { advance(false); }); } return toDreams(); }\n    var np = litCount()")
rep("q: 'Which word means almost the same as \"ephemeral\"?', o: ['short-lived', 'ancient', 'colourful', 'heavy'], a: 0","q: 'Which word means almost the same as \"ambiguous\"?', o: ['unclear', 'enormous', 'peaceful', 'honest'], a: 0")
rep("    $('lkName').textContent = L.name + (lk.i ? ' (2 of 2)' : ' (1 of 2)');","    $('lkName').textContent = 'Lock ' + (lk.i + 1) + ' of 2: ' + L.name.replace('The Lock of ', '');")
rep("      var near = c2.some(","      var near = connectedC(c2) && c2.some(")
rep("  function spatialItem(level) {","  function connectedC(c) { var seen = {}, st = [c[0]], n = 0; seen[c[0].join()] = 1; while (st.length) { var p = st.pop(); n++; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var q = [p[0] + d[0], p[1] + d[1]]; if (!seen[q.join()] && c.some(function (z) { return z[0] === q[0] && z[1] === q[1]; })) { seen[q.join()] = 1; st.push(q); } }); } return n === c.length; }\n  function spatialItem(level) {")
# M3: flag random / one-note players, no contradictory notes
rep("r.cautious = r.confidence === 'broad' || biased;","var tsp = {}, tt = 0; state.choices.forEach(function (c) { Object.keys(c.spent || {}).forEach(function (k) { var a = k.slice(-1); tsp[a] = (tsp[a] || 0) + c.spent[k]; tt += c.spent[k]; }); }); var oneNote = tt >= 8 && Math.max.apply(null, AREAS.map(function (a) { return tsp[a] || 0; })) / tt >= .7; r.oneNote = oneNote;\n    r.cautious = r.confidence === 'broad' || biased || oneNote || sd < .5;")
rep("var notes = [r.confidence === 'clear' ? 'Your top three stood out clearly.' :","var notes = [r.cautious && r.confidence === 'clear' ? 'Your top area stood out, but treat the rest of the order as a rough guide.' : r.confidence === 'clear' ? 'Your top three stood out clearly.' :")
rep("    if (r.biased) notes.unshift(","    if (r.oneNote) notes.unshift('Most of your oil went to one kind of activity, so only your top area is a reliable signal. Try another walk and spread your oil over what you would enjoy most.');\n    if (r.biased) notes.unshift(")
rep(" and lean on the Not clear cards. '"," '")
# M1: finale must not reveal the result and must leave cleanly
rep("  #finale.on { animation: fnin .9s ease-out both; } @keyframes fnin { from { opacity: 0; } to { opacity: 1; } }\n","")
rep("    function leave() { fnTimers.forEach(clearTimeout); f.classList.remove('on', 'lit'); var rv = $('reveal'); rv.scrollTop = 0; rv.classList.remove('on'); void rv.offsetWidth; rv.classList.add('on'); }","    function leave() { fnTimers.forEach(clearTimeout); $('reveal').scrollTop = 0; var done = function () { f.classList.remove('on', 'lit'); f.style.opacity = ''; try { $('openDoors').focus({ preventScroll: true }); } catch (e) { /* focus */ } }; if (state.reduce || !f.animate) return done(); f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-in-out', fill: 'forwards' }).onfinish = done; }")
# M5: honest India pay (no per-career figure that repeats for most jobs)
rep("inPay(c) + usPay(c)","usPay(c)")
rep("['', 'First jobs and pay in India', (roles ? 'Roles to look at first: ' + esc(roles) + '. ' : '') + plfsText()]","['', 'Roles and pay in India', (roles ? 'Roles to look at first: ' + esc(roles) + '. ' : '') + plfsText() + ' Pay for a specific job can be very different, so ask people who do it.']")
rep("(PLFS ' + p.year + ', <a href=\"' + p.src[0] + '\" target=\"_blank\" rel=\"noopener noreferrer\">MoSPI</a>)","(Periodic Labour Force Survey ' + p.year + ', <a href=\"' + p.src[0] + '\" target=\"_blank\" rel=\"noopener noreferrer\">MoSPI press note</a> and <a href=\"' + p.src[1] + '\" target=\"_blank\" rel=\"noopener noreferrer\">tables</a>)")
# M6: the phone's back gesture steps back inside the game
rep("  $('back').addEventListener('click', function () {\n    if (state.view === 'lock'","  var trapped = false;\n  function trapBack() { if (trapped) return; trapped = true; try { history.pushState({ mw: 1 }, ''); } catch (e) { /* no history */ } }\n  addEventListener('popstate', function () { if (state.view !== 'welcome') { try { history.pushState({ mw: 1 }, ''); } catch (e) { /* no history */ } $('back').click(); } else { trapped = false; } });\n  $('back').addEventListener('click', function () {\n    if (state.view === 'lock'")
rep("  function startWalk() {","  function startWalk() { trapBack();")
# M7: tester login expires after 12 hours (shared devices)
rep("try { TK = JSON.parse(localStorage.getItem('margwise.tester') || 'null'); } catch (e) { TK = null; }","try { TK = JSON.parse(localStorage.getItem('margwise.tester') || 'null'); if (TK && (!TK.at || Date.now() - TK.at > 43200000)) { TK = null; localStorage.removeItem('margwise.tester'); } } catch (e) { TK = null; }")
rep("TK = { id: x.j.testerId, token: x.j.token, name: name };","TK = { id: x.j.testerId, token: x.j.token, name: name, at: Date.now() };")
# M8: the gate lists everything we keep
rep("<p>We keep your name, the choices you make in the game, your results and any feedback you write. We never ask for your phone number, email or address.</p>","<p>We keep your name, the choices you make in the game and how long each place takes, your puzzle answers, the class, board and stream you pick, your results, your screen size and any feedback you write. We never ask for your phone number, email or address. A scrambled version of your connection address is kept for 24 hours only, to stop abuse.</p>")
# minor: self-XSS in the parent page name, contrast, abroad lead
rep("<input class=\"pnm\" id=\"pNm\" type=\"text\" maxlength=\"40\" autocomplete=\"off\" value=\"' + esc(nm) + '\">","<input class=\"pnm\" id=\"pNm\" type=\"text\" maxlength=\"40\" autocomplete=\"off\">")
rep("    $('pgcard').innerHTML = h;","    $('pgcard').innerHTML = h; $('pNm').value = nm;")
rep("#gate .gfine { margin: 0; font-size: 12.5px; font-weight: 600; color: #6a5f7c;","#gate .gfine { margin: 0; font-size: 12.5px; font-weight: 600; color: #4a3f5c;")
rep("'Two routes, eight countries. Figures are ranges from public sources, checked on ' + AB.asOf + '. We plan to refresh them by ' + AB.nextReview + '.'","'Two routes, eight countries. Figures come from public sources read on ' + AB.asOf + '. Some are our own estimates and are marked. We plan to refresh them by ' + AB.nextReview + '.'")
open('lamps20.html','w',encoding='utf8').write(s); print('ok')
