import json, html
E=lambda s: html.escape(s,quote=True)
b=json.load(open('bank.json')); st=json.load(open('story2.json')); ct=json.load(open('content.json'))
S=st['scenes']; M=st['meta']
NAME={'R':'Builder','I':'Thinker','A':'Creator','S':'Helper','E':'Persuader','C':'Organiser'}
h=[]
h.append('''<title>Margwise Content Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
/* Layout: one reading column; tables scroll inside their own box; details open one field at a time. */
:root{--bg:#f5f6fa;--card:#ffffff;--fg:#1c2040;--mute:#555b7e;--line:#d9dcea;--accent:#2f3d9e;--amber:#9a5b00;--amberbg:#fff0d0;--new:#e7f3ea;--newfg:#1d5a2f;--old:#f4eeee;--warn:#fff0d0;
--display:'Fraunces',Georgia,serif;--body:'Nunito','Segoe UI',system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#10132b;--card:#181c3d;--fg:#eceefa;--mute:#a4a9cc;--line:#2f3566;--accent:#9db0ff;--amber:#ffcf6b;--amberbg:#3a3014;--new:#17301f;--newfg:#9be0b0;--old:#2a1d28;--warn:#3a3014;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#10132b;--card:#181c3d;--fg:#eceefa;--mute:#a4a9cc;--line:#2f3566;--accent:#9db0ff;--amber:#ffcf6b;--amberbg:#3a3014;--new:#17301f;--newfg:#9be0b0;--old:#2a1d28;--warn:#3a3014;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:400 16px/1.55 var(--body);padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:860px;margin:0 auto;padding-block:28px 56px;display:grid;gap:26px}
h1,h2,h3{font-family:var(--display);line-height:1.15;margin:0;text-wrap:balance}
h1{font-size:clamp(30px,6vw,42px);font-weight:800} h2{font-size:26px;font-weight:800} h3{font-size:19px;font-weight:600}
p{margin:0;text-wrap:pretty} .mute{color:var(--mute)} .lead{font-size:18px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;display:grid;gap:10px;min-width:0}
.todo{background:var(--warn);border-color:var(--amber)}
.todo b{color:var(--amber)}
ul,ol{margin:0;padding-left:20px;display:grid;gap:6px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:640px;font-size:15px}
th,td{padding:9px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
th{font-size:12.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--mute);background:var(--bg)}
td.old{background:var(--old)} td.new{background:var(--new);color:var(--newfg);font-weight:700}
.tr{display:inline-block;font-weight:800;font-size:12.5px;border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-right:6px;color:var(--accent)}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 16px}
summary{cursor:pointer;font-weight:800;font-size:17px;padding:12px 0;min-height:44px;display:flex;align-items:center;gap:10px}
summary:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.det{display:grid;gap:12px;padding:4px 0 16px}
.k{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:800}
.chip{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:1px 10px;font-size:13.5px;font-weight:700;margin:2px 4px 2px 0}
.vals{font-variant-numeric:tabular-nums;font-size:13.5px;color:var(--mute)}
.verify{background:var(--warn);border-radius:10px;padding:10px 12px}
a{color:var(--accent)}
.ops{display:grid;gap:10px}.op{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.op p{margin:0}.was{color:var(--mute);text-decoration:line-through;text-decoration-color:var(--line)}.now{background:var(--new);color:var(--newfg);font-weight:700;border-radius:8px;padding:4px 8px;margin-top:4px!important}
.quote{border-left:4px solid var(--accent);padding-left:14px;font-family:var(--display);font-size:19px}
</style>
<div class="wrap">
<header style="display:grid;gap:10px"><p class="k">Review pack · draft 1 · 21 Oct 2026</p><h1>Margwise content review</h1>
<p class="lead mute">The rewritten story, the 60 option lines, and the career and school-path content for twelve fields. Please mark up anything that is wrong, unclear or unsuitable for Class 9 to 12 students.</p></header>
<section class="box todo"><h3>What to check, in order</h3><ol>
<li><b>Story:</b> do the three chapters, the recurring friend Ila and the collected note read well for a 14 to 17 year old?</li>
<li><b>Option lines:</b> does each new line still say the same thing as the old one? Ids and scoring are unchanged, so a line must keep the same type of activity (the letter shown next to it).</li>
<li><b>Fields and careers:</b> are the right careers in the right fields? Are any missing for India?</li>
<li><b>School paths:</b> every exam and eligibility line needs checking against the official site. Lines marked "Check before relying on this" are the ones where sources disagreed.</li></ol></section>
''')
# story
h.append('<section style="display:grid;gap:12px"><h2>1. The story</h2><p>The road, the lamplighter who has gone, Jyo the firefly and the lighthouse stay. New: three chapters, a recurring friend, a collectible note, and a named keeper in each town.</p>')
h.append('<div class="box"><h3>Three chapters</h3><ul>'+''.join(f'<li><b>{E(c["roman"])}: {E(c["title"])}</b> (starts after {c["at"]} lamps lit). {E(c["line"])}</li>' for c in M['chapters'])+'</ul><p class="mute">Places come in an adaptive order, so chapters follow the number of lamps lit, not a fixed list of towns.</p></div>')
h.append('<div class="box"><h3>Ila, who keeps turning up</h3><ul>'+''.join(f'<li><b>After lamp {k}:</b> {E(v)}</li>' for k,v in M['ila'].items())+'</ul></div>')
h.append('<div class="box"><h3>The lamplighter\'s note</h3><p>Each lit lamp adds a scrap of a note the old lamplighter left. After eight lamps it is whole.</p><p class="quote">'+E(' '.join(M['note']))+'</p></div></section>')
# options table
h.append('<section style="display:grid;gap:12px"><h2>2. The 15 places and 60 options</h2><p>Each option shows the old wording struck through and the new wording below it. The letter is the type of activity the option measures: '+', '.join(f'<b>{k}</b> {v}' for k,v in NAME.items())+'. The old options often joined two activities in one line ("study X, then sketch Y"). The new ones name one.</p>')
for sc in b['scenes']:
    n=S[sc['id']]
    rows=''.join(f'<div class="op"><span class="tr">{o["id"].split("-")[1]}</span><div><p class="was">{E(o["text"])}</p><p class="now">{E(n["o"][o["id"].split("-")[1]])}</p></div></div>' for o in sc['options'])
    h.append(f'<details><summary>{E(sc["place"])} <span class="mute" style="font-weight:600">· keeper: {E(n["keeper"])}</span></summary><div class="det"><div><p class="k">Setup</p><p class="mute">Old: {E(sc["story"]["setup"] if "story" in sc else sc["setup"])}</p><p>New: {E(n["setup"])}</p></div><div class="ops">{rows}</div><div><p class="k">When the lamp is lit</p><p>{E(n["lit"])}</p><p class="mute">{E(n["keeper"])}: “{E(n["line"])}”</p></div></div></details>')
h.append('</section>')
# fields
cb={c['field']:[] for c in ct['careers']}
for c in ct['careers']: cb[c['field']].append(c)
h.append('<section style="display:grid;gap:12px"><h2>3. Fields, careers and school paths</h2><p>Twelve fields grouped by the stream a student would usually pick in Class 11. Each career carries the real O*NET interest profile (R I A S E C, 0 to 100). O*NET describes US jobs, so it is a rough guide for India and the page says so.</p>')
for f in ct['fields']:
    cr=''.join(f'<tr><td><b>{E(c["title"])}</b><br><span class="mute">{E(c["line"])}</span></td><td class="vals">R{c["values"]["R"]} I{c["values"]["I"]} A{c["values"]["A"]} S{c["values"]["S"]} E{c["values"]["E"]} C{c["values"]["C"]}<br>{c["soc"]}</td></tr>' for c in cb[f['id']])
    ver=''.join(f'<li>{E(v)}</li>' for v in f['verify'])
    src=', '.join(f'<a href="{s["url"]}" target="_blank" rel="noopener noreferrer">{E(s["name"])}</a>' for s in f['sources'])
    h.append(f'''<details><summary><span aria-hidden="true">{f["icon"]}</span> {E(f["name"])} <span class="chip">{E(f["group"])}</span></summary><div class="det">
<p>{E(f["blurb"])}</p>
<div class="scroll"><table style="min-width:520px"><thead><tr><th>Career</th><th>O*NET interests</th></tr></thead><tbody>{cr}</tbody></table></div>
<div><p class="k">Usual stream</p><p>{E(f["pick"])}</p></div>
<div><p class="k">Class 11 and 12 subjects</p><ul><li><b>CBSE:</b> {E(f["subjects"]["cbse"])}</li><li><b>ICSE/ISC:</b> {E(f["subjects"]["isc"])}</li><li><b>State/other:</b> {E(f["subjects"]["state"])}</li></ul></div>
<div><p class="k">Entrance exams</p><p>{E(f["exams"])}</p></div>
<div><p class="k">Degree</p><p>{E(f["degree"])}</p></div>
<div><p class="k">Try it early</p><p>{E(f["early"])}</p></div>
{('<div><p class="k">Good to know</p><p>'+E(f["note"])+'</p></div>') if f["note"] else ''}
{('<div class="verify"><p class="k">Check before relying on this</p><ul>'+ver+'</ul></div>') if ver else ''}
<p class="mute"><b>Where to check:</b> {src}</p></div></details>''')
h.append('</section>')
h.append('''<section class="box"><h3>How the facts were gathered</h3><p>Career interest profiles were read directly from O*NET OnLine (version 31.0). Exam and admission lines were drafted from general knowledge and then spot-checked on 21 Oct 2026 against search results for NEET-UG, NDA, NCET/ITEP, CA Foundation, DGCA pilot rules and IISER admission. Those results were mostly coaching sites and news pages, and several conflicted with each other. Nothing here has been checked against the official bodies yet.</p></section>''')
h.append('''<section style="display:grid;gap:12px"><h2>4. Decisions and next steps</h2>
<div class="box"><h3>Decisions for you</h3><ul>
<li><b>Question formats.</b> Today every place is "spend two flasks across four options". I can make places feel different without changing what is measured, by changing the interaction (drag a flask, stock a stall, pick first and second). A truly different format, such as a slider, changes the measurement and needs a psychometric check.</li>
<li><b>Number of places.</b> The engine asks for 8 to 15. About 10 would feel tighter, but this setting lives in the scoring engine and should be changed with the instrument owner.</li>
<li><b>Who reviews what.</b> Question wording, school-path facts and the career list each need a named reviewer.</li></ul></div>
<div class="box"><h3>Proposed next steps</h3><ol>
<li><b>You review this pack.</b> I apply the changes.</li>
<li><b>Fact check.</b> A counsellor or subject expert checks every school-path line against official sites. Plan to repeat this every admission cycle, because exam rules change each year.</li>
<li><b>Instrument check.</b> The scoring is still marked uncalibrated. Pilot with 30 to 50 students, compare with an established interest inventory such as the O*NET Interest Profiler, and test whether results repeat a few weeks later.</li>
<li><b>Art.</b> When the image quota resets or a paid plan is added: four test images, then lock a style, then Jyo in five or six poses, layered backdrops and one consistent icon set for the options.</li>
<li><b>Question variety.</b> Build one or two new interaction types over the same scoring, and playtest them.</li>
<li><b>Playtest.</b> Five to eight students on a mid-range Android phone, watching for confusion and boredom, not asking.</li>
<li><b>Real app.</b> Accounts with parent consent for under-18s (India's DPDP Act), a backend (Supabase or Cloudflare), asset hosting on a CDN and a parent view. The product stays English only for now.</li></ol></div></section>
</div>''')
open('review.html','w',encoding='utf8').write('\n'.join(h)); print(len('\n'.join(h))//1000,'KB')
