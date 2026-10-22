import json
s=open('lamps11.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
story=json.dumps(json.load(open('story2.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
abroad=json.dumps(json.load(open('abroad.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index('</script>',i)+9
s=s[:i]+'<script>window.MW_CONTENT = '+content+';window.MW_STORY = '+story+';window.MW_ABROAD = '+abroad+';</script>'+s[j:]
# CSS
rep("  /* ----- tester pack: gate, ratings, feedback ----- */","""  /* ----- study and work abroad ----- */
  #abroad.on { overflow-y: auto; }
  .cchips { display: flex; flex-wrap: wrap; gap: 8px; }
  .cchips button { border: 2px solid rgba(255,243,214,.35); background: rgba(255,255,255,.07); border-radius: 12px; padding: 8px 12px; min-height: 44px; font-weight: 800; font-size: 15px; }
  .cchips button[aria-pressed="true"] { background: #ffe9a8; color: var(--ink); border-color: var(--glow-deep); }
  .rcards { display: grid; gap: 8px; }
  .rcards button { text-align: left; border: 2px solid rgba(255,243,214,.35); background: rgba(255,255,255,.07); border-radius: 14px; padding: 10px 12px; min-height: 52px; display: grid; gap: 4px; }
  .rcards button[aria-pressed="true"] { background: rgba(255,233,168,.16); border-color: var(--glow); }
  .rcards b { font-size: 16px; } .rcards ul { margin: 4px 0 0; padding-left: 18px; display: grid; gap: 3px; font-size: 14px; font-weight: 600; color: rgba(255,243,214,.9); }
  .acard { background: rgba(255,255,255,.08); border-radius: 16px; padding: 14px; display: grid; gap: 12px; }
  .acard h3 { font-size: 22px; } .acard .k { font-size: 12.5px; letter-spacing: .08em; text-transform: uppercase; font-weight: 800; color: var(--glow); }
  .acard .v { font-weight: 800; font-size: 17px; } .acard .sm { font-size: 14px; font-weight: 600; color: rgba(255,243,214,.85); }
  .acard .vf { background: rgba(255,207,107,.14); border: 1.5px dashed var(--glow-deep); border-radius: 12px; padding: 8px 10px; font-size: 14px; font-weight: 600; }
  .acard ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14.5px; font-weight: 600; }
  .pill.cf { font-size: 11.5px; padding: 1px 8px; margin-left: 6px; vertical-align: middle; } .pill.cf.official { background: #bfe5e2; } .pill.cf.secondary { background: #ffe9a8; } .pill.cf.estimate { background: #e9dfe8; }
  .acard a { color: var(--glow); } .us { color: var(--cream-2); font-size: 13.5px; font-weight: 700; }
  /* ----- tester pack: gate, ratings, feedback ----- */""")
# HTML view
rep('  <section class="screen pad res" id="field">','''  <section class="screen pad res" id="abroad">
    <div class="head"><h2>Study and work abroad</h2><p id="abLead"></p></div>
    <div class="grp"><h3>Which route?</h3><div class="rcards" id="abRoutes"></div></div>
    <div id="abField" class="lean" hidden></div>
    <div class="grp"><h3>Which country?</h3><div class="cchips" id="abCountries" role="group" aria-label="Country"></div></div>
    <div class="acard" id="abCard"></div>
    <p class="fineprint" id="abFoot"></p>
    <div class="actions"><button class="go quiet" id="abBack" type="button">Back</button></div>
  </section>

  <section class="screen pad res" id="field">''')
rep('<div class="actions"><button class="go" id="fbOpen" type="button" hidden>Share your feedback</button>','<div class="actions"><button class="go" id="dAbroad" type="button">Study and work abroad</button><button class="go" id="fbOpen" type="button" hidden>Share your feedback</button>')
rep('<div class="actions"><button class="go quiet" id="fBack">','<div class="actions"><button class="go" id="fAbroad" type="button">Study and work abroad in this field</button><button class="go quiet" id="fBack">')
# views
rep("['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field'].forEach","['welcome', 'stop', 'dreams', 'reveal', 'doors', 'field', 'abroad'].forEach")
rep("if (v === 'dreams' || v === 'reveal' || v === 'doors' || v === 'field') return","if (v === 'dreams' || v === 'reveal' || v === 'doors' || v === 'field' || v === 'abroad') return")
rep("    else if (state.view === 'field') { show('doors'); }","    else if (state.view === 'field') { show('doors'); }\n    else if (state.view === 'abroad') { show(state.ab.from || 'doors'); }")
# US pay in careers list
rep("return '<div class=\"crow\"><b>' + c.title + '</b><p>' + c.line + '</p></div>';","return '<div class=\"crow\"><b>' + c.title + '</b><p>' + c.line + '</p>' + usPay(c) + '</div>';")
rep("  function renderPath() {","""  function usPay(c) {
    if (!c.us) return '';
    var p = c.us.annual ? 'US$' + c.us.annual.toLocaleString('en-US') + ' a year' : c.us.hourly ? 'US$' + c.us.hourly.toFixed(2) + ' an hour' : ''; if (!p) return '';
    return '<p class="us">US median pay ' + p + (c.us.growth ? ', jobs: ' + c.us.growth.toLowerCase() : '') + ' (O*NET and US Bureau of Labor Statistics)</p>';
  }
  function renderPath() {""")
# abroad logic before gate section
rep("  // ---- gate","""  // ---------- study and work abroad
  var AB = window.MW_ABROAD, UGY = { us: 4, ca: 4, uk: 3, au: 3, nl: 3, de: 3, cn: 4, sg: 4 }, PGY = { us: 2, ca: 2, uk: 1, au: 2, nl: 1, de: 2, cn: 2, sg: 2 };
  state.ab = { country: 'us', route: 'A', field: null, from: 'doors' };
  function money(sym, n) { return sym + Math.round(n).toLocaleString('en-US'); }
  function inr(cur, n) { var v = n * AB.fx[cur]; if (v >= 1e7) return '\\u20b9' + (v / 1e7).toFixed(1) + ' crore'; if (v >= 1e5) return '\\u20b9' + (v / 1e5).toFixed(v >= 1e6 ? 0 : 1) + ' lakh'; return '\\u20b9' + Math.round(v).toLocaleString('en-IN'); }
  function span(c, lo, hi, per) { return money(c.sym, lo) + ' to ' + money(c.sym, hi) + (per || ' a year') + ' (about ' + inr(c.cur, lo) + ' to ' + inr(c.cur, hi) + ')'; }
  function cf(x) { return '<span class="pill cf ' + x + '">' + ({ official: 'Official', secondary: 'Guide', estimate: 'Estimate' })[x] + '</span>'; }
  function row(k, v, n) { return '<div><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (n ? '<div class="sm">' + n + '</div>' : '') + '</div>'; }
  function renderAbroad() {
    var a = state.ab, c = AB.countries.filter(function (x) { return x.id === a.country; })[0], f = a.field ? FBY[a.field] : null;
    $('abLead').textContent = (f ? 'For ' + f.name + '. ' : '') + 'Two routes, eight countries. Figures are ranges from public sources, checked on ' + AB.asOf + '. We plan to refresh them by ' + AB.nextReview + '.';
    $('abRoutes').innerHTML = AB.routes.map(function (r) { return '<button type="button" data-r="' + r.id + '" aria-pressed="' + (r.id === a.route) + '"><b>' + (r.id === 'A' ? 'Route A: ' : 'Route B: ') + r.name + '</b>' + (r.id === a.route ? '<ul>' + r.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') + '</button>'; }).join('');
    $('abCountries').innerHTML = AB.countries.map(function (x) { return '<button type="button" data-c="' + x.id + '" aria-pressed="' + (x.id === a.country) + '">' + x.name + '</button>'; }).join('');
    var fn = $('abField'); fn.hidden = !f;
    if (f) { fn.textContent = ''; var b = document.createElement('b'); b.textContent = 'In this field: '; fn.appendChild(b); fn.appendChild(document.createTextNode(AB.fieldNotes[f.id] || '')); }
    var ugy = UGY[c.id], pgy = PGY[c.id], per = c.ug, pp = c.pg, lv = c.living;
    var totA = [ugy * (per.lo + lv.lo) + pgy * (pp.lo + lv.lo), ugy * (per.hi + lv.hi) + pgy * (pp.hi + lv.hi)], totB = [pgy * (pp.lo + lv.lo), pgy * (pp.hi + lv.hi)];
    var h = '<h3>' + c.name + '</h3>';
    h += row('Bachelor\\'s tuition' + cf(per.conf), span(c, per.lo, per.hi), per.note);
    h += row('Master\\'s tuition' + cf(pp.conf), span(c, pp.lo, pp.hi), pp.note);
    h += row('Living costs' + cf(lv.conf), span(c, lv.lo, lv.hi), lv.note);
    h += row(a.route === 'A' ? 'Rough total, Route A (' + ugy + ' years bachelor\\'s + ' + pgy + ' master\\'s)' : 'Rough total, Route B (' + pgy + ' years master\\'s abroad)', inr(c.cur, (a.route === 'A' ? totA : totB)[0]) + ' to ' + inr(c.cur, (a.route === 'A' ? totA : totB)[1]), 'Tuition plus living, before scholarships.' + (a.route === 'B' ? ' Add the cost of your degree in India.' : ''));
    h += '<div><div class="k">Scholarships</div><ul>' + c.scholarships.map(function (s2) { return '<li><b>' + (s2.u ? '<a href="' + s2.u + '" target="_blank" rel="noopener noreferrer">' + esc(s2.n) + '</a>' : esc(s2.n)) + '</b>: ' + esc(s2.t) + '</li>'; }).join('') + '</ul></div>';
    h += row('After you graduate' + cf(c.after.conf), esc(c.after.t));
    if (c.after.verify) h += '<div class="vf"><b>Check before relying on this:</b> ' + esc(c.after.verify) + '</div>';
    h += row('Settling', esc(c.settle));
    var sal = c.salary || ''; h += row('Graduate pay', esc(sal), c.salaryRange ? (c.salaryMonthly ? 'Monthly figures. ' : '') + 'Range used: ' + money(c.sym, c.salaryRange.lo) + ' to ' + money(c.sym, c.salaryRange.hi) + (c.salaryMonthly ? ' a month' : ' a year') + ' (' + ({ official: 'official', secondary: 'guide', estimate: 'estimate' })[c.salaryRange.conf] + ').' : '');
    if (c.id === 'us' && f) {
      var lines = CAREERS.filter(function (x) { return x.field === f.id && x.us; }).slice(0, 8).map(function (x) { return '<li>' + esc(x.title) + ': ' + (x.us.annual ? 'US$' + x.us.annual.toLocaleString('en-US') + ' a year' : x.us.hourly ? 'US$' + x.us.hourly.toFixed(2) + ' an hour' : 'n/a') + '</li>'; });
      if (lines.length) h += '<div><div class="k">US median pay for these careers (' + CAREERS.filter(function (x) { return x.us; })[0].us.wageYear + ')</div><ul>' + lines.join('') + '</ul><div class="sm">From O*NET and the US Bureau of Labor Statistics. These are US jobs.</div></div>';
    }
    h += row('Tests and applying', esc(c.tests));
    if (c.notes && c.notes.length) h += '<div><div class="k">Good to know</div><ul>' + c.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    var seen = {}, srcs = [per.src, pp.src, lv.src, c.after.src, c.salaryRange && c.salaryRange.src].filter(function (u) { if (!u || seen[u]) return false; seen[u] = 1; return true; });
    if (srcs.length) h += '<div class="sm"><b>Sources:</b> ' + srcs.map(function (u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + esc(u.replace(/^https?:\\/\\/(www\\.)?/, '').split('/')[0]) + '</a>'; }).join(', ') + '. Exchange rates from ' + esc(AB.fx.source) + ', ' + AB.fx.date + '.</div>';
    $('abCard').innerHTML = h;
    $('abFoot').textContent = AB.disclaimer + ' Badges: Official = read from an official page. Guide = from a news, university or education site. Estimate = our estimate, not checked.';
  }
  function toAbroad(fieldId, from) {
    state.ab.field = fieldId || null; state.ab.from = from; show('abroad'); Snd.door(); $('abroad').scrollTop = 0; renderAbroad(); track('abroad', { field: fieldId, country: state.ab.country, route: state.ab.route });
  }
  $('abRoutes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.ab.route = b.dataset.r; renderAbroad(); track('abroad', { field: state.ab.field, country: state.ab.country, route: state.ab.route }); });
  $('abCountries').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.ab.country = b.dataset.c; renderAbroad(); track('abroad', { field: state.ab.field, country: state.ab.country, route: state.ab.route }); });
  $('abBack').addEventListener('click', function () { show(state.ab.from || 'doors'); });
  $('fAbroad').addEventListener('click', function () { toAbroad(state.fieldId, 'field'); });
  $('dAbroad').addEventListener('click', function () { toAbroad(null, 'doors'); });
  // ---- gate""")
open('lamps12.html','w',encoding='utf8').write(s); print('ok',len(s)//1000,'KB')
