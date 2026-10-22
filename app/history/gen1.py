import json, os, base64, urllib.request, sys
b=json.load(open('bank.json'))
src=open('gen.py').read(); STYLE=src[src.index('STYLE="')+7:src.index('"',src.index('STYLE="')+8)]
sid=sys.argv[1]; s=[x for x in b['scenes'] if x['id']==sid][0]
prompt=f"scene of {s['place']}, {s['setup'].rstrip('.')}, empty of close-up characters, centred composition, "+STYLE
URL=f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID']}/ai/run/@cf/black-forest-labs/flux-1-schnell"
r=urllib.request.Request(URL,json.dumps({'prompt':prompt,'steps':6}).encode(),{'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'})
try:
    d=json.load(urllib.request.urlopen(r,timeout=90)); open(f'art/bg-{sid}.jpg','wb').write(base64.b64decode(d['result']['image'])); print('ok',s['place'])
except urllib.error.HTTPError as e: print('HTTP',e.code,e.read()[:200])
