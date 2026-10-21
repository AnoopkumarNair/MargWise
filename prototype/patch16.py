s=open('lamps16.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
rep('<span class="gmean">marg means path</span>','<span class="gmean">Light your way</span>')
rep('''  <div class="fld" style="display:grid;gap:4px"><b>Did you enjoy the walk?</b>''','''  <div class="fld" style="display:grid;gap:4px"><b>How did the puzzle locks feel?</b><div class="rate" data-k="puz"></div><div class="rl"><span>Stressful</span><span>Enjoyable</span></div></div>
  <div class="fld" style="display:grid;gap:4px"><b>Did you enjoy the walk?</b>''')
rep("if (!out.look && !out.clear && !out.fun && !out.text)","if (!out.look && !out.clear && !out.fun && !out.puz && !out.text)")
open('lamps17.html','w',encoding='utf8').write(s)
