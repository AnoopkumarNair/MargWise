import json
s=open('lamps9.html',encoding='utf8').read()
def rep(a,b,c=1):
    global s
    assert s.count(a)==c,(s.count(a),a[:90]); s=s.replace(a,b)
content=json.dumps(json.load(open('content.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
story=json.dumps(json.load(open('story2.json',encoding='utf8')),separators=(',',':'),ensure_ascii=False)
i=s.index('<script>window.MW_CONTENT = '); j=s.index('</script>',i)+9
s=s[:i]+'<script>window.MW_CONTENT = '+content+';window.MW_STORY = '+story+';</script>'+s[j:]
rep("var LEAN_FIELDS = { science: ['health', 'sci', 'eng', 'tec'], commerce: ['com'], humanities: ['psy', 'law', 'media', 'pub'], arts: ['des', 'media'] }","var LEAN_FIELDS = { science: ['health', 'sci', 'eng', 'tec', 'agr', 'mar'], commerce: ['com'], humanities: ['psy', 'law', 'media', 'pub'], arts: ['des', 'media', 'arts'] }")
rep('<label>Invite code<input type="text" id="gCode"','<label id="gCodeL" hidden>Invite code<input type="text" id="gCode"')
rep("if (!code) { $('gErr').textContent = 'Please add the invite code you were given.'; return; }","if (!$('gCodeL').hidden && !code) { $('gErr').textContent = 'Please add the invite code you were given.'; return; }")
rep("    if (!TK) $('gate').hidden = false;\n    paintTester();","    if (!TK) $('gate').hidden = false;\n    fetch(MWC.api + '/config').then(function (r) { return r.json(); }).then(function (j) { $('gCodeL').hidden = !j.needsCode; }, function () { $('gCodeL').hidden = false; });\n    paintTester();")
open('lamps10.html','w',encoding='utf8').write(s); print('ok')
