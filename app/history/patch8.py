import json
s=open('lamps7.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
# 0. fresh content
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
story=json.dumps(json.load(open('story2.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index('</script>',i)+9
s=s[:i]+'<script>window.MW_CONTENT = '+content+';window.MW_STORY = '+story+';</script>'+s[j:]
# 1. no fit bands: rank only, field score = mean over all careers in the field
rep("      var top = ms.slice(0, 2), score = top.reduce(function (a, m) { return a + m.r; }, 0) / top.length;\n      return { f: f, ms: ms, score: score, band: score >= .5 ? 'strong' : score >= 0 ? 'mixed' : 'weak' };","      var score = ms.reduce(function (a, m) { return a + m.r; }, 0) / ms.length;\n      return { f: f, ms: ms, score: score };")
rep("<span class=\"meta\"><span class=\"pill ' + x.band + '\">' + FIT[x.band] + '</span><span class=\"pill\">' + x.f.group + '</span></span>","<span class=\"meta\"><span class=\"pill\">' + x.f.group + '</span></span>")
rep("<b>' + x.f.name + '</b><span class=\"pill ' + x.band + '\">' + FIT[x.band] + '</span><span class=\"chev\"","<b>' + x.f.name + '</b><span class=\"pill\">' + x.f.group.replace('Open to any stream', 'Any stream') + '</span><span class=\"chev\"")
rep("return '<div class=\"crow\"><b>' + c.title + '</b><span class=\"pill ' + m.band + '\">' + FIT[m.band] + '</span><p>' + c.line + '</p></div>';","return '<div class=\"crow\"><b>' + c.title + '</b><p>' + c.line + '</p></div>';")
rep("<p>Your three closest fields are first. Tap one to see careers and the school path.</p>","<p>These are ordered by how close they sit to your interest shape. That is a starting point for a conversation, not a verdict. Tap one to see careers and the school path.</p>") if False else None
# 2. signal gating, ties, position bias
rep("    var r = state.result = M.journeyResult(bank, state.choices);\n    var code = r.code.code, pr = r.profile;","""    var r = state.result = M.journeyResult(bank, state.choices);
    var code = r.code.code, pr = r.profile;
    var vs = AREAS.map(function (a) { return pr[a]; }), mu = vs.reduce(function (a, b) { return a + b; }, 0) / 6, sd = Math.sqrt(vs.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / 6);
    var tot = state.slots.reduce(function (a, b) { return a + b; }, 0), biased = tot >= 8 && Math.max.apply(null, state.slots) / tot >= .8;
    r.noSignal = !(sd >= .2) || !!r.lowEngagement; r.cautious = r.confidence === 'broad' || biased; r.biased = biased;""")
rep("    $('notes').hidden = false; $('notes').textContent = notes.join(' ');\n  }","""    if (r.biased) notes.unshift('Most of your oil went to the same position on the screen, so this may say more about where you tapped than what you like.');
    if (r.code.alternatives.length > 1) notes.push('Some of your top areas were tied, so the order of the top three is not fixed.');
    $('notes').hidden = false; $('notes').textContent = notes.join(' ');
    var none = r.noSignal; $('compass').parentNode.hidden = none; $('legend').hidden = none; $('openDoors').hidden = none; $('revealLine').hidden = none;
    if (none) { $('notes').textContent = 'There is not enough here to show a shape. That happens when almost no oil is spent or everything feels the same. It does not mean anything is wrong. Try the walk again and spend your oil on what you would enjoy most.'; $('revealLine').hidden = true; }
  }""")
rep("    var fits = state.fits = fieldFits(), lean = state.ctx.lean, ln = $('leanNote'); ln.hidden = true;","    var fits = state.fits = fieldFits(), lean = state.ctx.lean, ln = $('leanNote'); ln.hidden = true;\n    var caution = state.result.cautious ? 'Your shape was not sharp, so treat this order as a rough guide. ' : '';")
rep("ln.hidden = false; ln.textContent = hit ?","ln.hidden = false; ln.textContent = caution + (hit ?")
rep("Both are worth a look.';\n    } else if (lean === 'unsure')","Both are worth a look.');\n    } else if (lean === 'unsure')")
rep("ln.hidden = false; ln.textContent = 'Not sure yet is a fine place to be. Start with the first field and see if it feels right.'; }","ln.hidden = false; ln.textContent = caution + 'Not sure yet is a fine place to be. Start with the first field and see if it feels right.'; }\n    if (ln.hidden && caution) { ln.hidden = false; ln.textContent = caution.trim(); }")
rep("state.ctx = { cls: '', board: '', lean: '' };","state.ctx = { cls: '', board: '', lean: '' }; state.slots = [0, 0, 0, 0];")
rep("function startWalk() { state.choices = []; advance(true);","function startWalk() { state.choices = []; state.slots = [0, 0, 0, 0]; advance(true);")
rep("if (used < FLASKS && n < FLASKS) { state.spent[id] = n + 1;","if (used < FLASKS && n < FLASKS) { state.spent[id] = n + 1; var sl = Array.prototype.indexOf.call($('options').children, btn); if (sl >= 0) state.slots[sl]++;")
# 3. Class 11/12 line
rep("'. Put your effort into the subjects and exams below. ' + f.pick","'. If your subjects already fit, this path is open. If not, ask your school counsellor what is still possible. ' + f.pick")
# 4. accidental tap protection
rep("  function doLight() {\n    if (state.busy) return;","""  function doLight() {
    if (state.busy) return;
    if (totalSpent() === 0 && !state.confirmNone) {
      state.confirmNone = true; $('light').querySelector('.lbl').textContent = 'Tap again to keep your oil and light';
      setTimeout(function () { if (state.confirmNone) { state.confirmNone = false; if (state.view === 'stop' && !state.busy) refreshCards(); } }, 2600);
      return;
    }
    state.confirmNone = false;""")
# 5. modal behaviour: inert background, Escape, focus trap, number keys blocked
rep("if (state.view === 'stop' && !state.busy && $('about').hidden) {","if (state.view === 'stop' && !state.busy && $('about').hidden && $('beat').hidden && $('saveSheet').hidden) {")
rep("  document.addEventListener('keydown', function (e) {","""  function modalEl() { return !$('beat').hidden ? $('beat') : !$('saveSheet').hidden ? $('saveSheet') : !$('about').hidden ? $('about') : null; }
  function syncModal() { var on = !!modalEl(); document.querySelectorAll('#app > .screen, #hud').forEach(function (e) { e.inert = on; }); }
  ['beat', 'saveSheet', 'about'].forEach(function (id) { new MutationObserver(syncModal).observe($(id), { attributes: true, attributeFilter: ['hidden'] }); });
  document.addEventListener('keydown', function (e) {
    var m = modalEl(); if (!m) return;
    if (e.key === 'Escape' && m !== $('beat')) { m.hidden = true; return; }
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(m.querySelectorAll('button, input, a[href], [tabindex]'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1];
      if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('keydown', function (e) {""")
# 6. welcome text and forget-me
rep("About three minutes. Nothing is marked.","About five to eight minutes. Nothing is marked.")
rep("    el.hidden = !sv; if (sv) el.textContent = 'Welcome back, ' + sv.name + '. Your lighthouse last time: ' + sv.code.split('').map(function (a) { return NAME[a]; }).join(', ') + '.';","""    el.hidden = !sv; el.textContent = '';
    if (sv) {
      el.appendChild(document.createTextNode('Welcome back, ' + sv.name + '. Your lighthouse last time: ' + sv.code.split('').map(function (a) { return NAME[a]; }).join(', ') + '. '));
      var fb = document.createElement('button'); fb.type = 'button'; fb.textContent = 'Not you? Forget this'; fb.style.cssText = 'background:none;border:0;text-decoration:underline;color:inherit;font:inherit;font-weight:800;padding:8px 4px;min-height:40px';
      fb.addEventListener('click', function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage blocked */ } paintWelcomeBack(); });
      el.appendChild(fb);
    }""")
# 7. backdrop fallback if blob urls are blocked by the host
rep("  function artFor(id) { return ART.bg[id] ? '<img alt=\"\" decoding=\"async\" src=\"' + ART.bg[id] + '\">' : paint(id); }","""  var ORIG = {}; Object.keys(ART.bg).forEach(function (k) { ORIG[k] = ART.bg[k]; });
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.dataset.id && ORIG[t.dataset.id] && !t.dataset.fb) { t.dataset.fb = '1'; t.src = ORIG[t.dataset.id]; } }, true);
  function artFor(id) { return ART.bg[id] ? '<img alt="" decoding="async" data-id="' + id + '" src="' + ART.bg[id] + '">' : paint(id); }""")
open('lamps8.html','w',encoding='utf8').write(s); print('ok')
