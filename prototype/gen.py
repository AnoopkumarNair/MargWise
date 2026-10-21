import json, os, base64, time, urllib.request, concurrent.futures as cf
b=json.load(open('bank.json'))
exec(open('vis.py').read())
URL=f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID']}/ai/run/@cf/black-forest-labs/flux-1-schnell"
STYLE="soft painterly children's storybook illustration, warm lantern glow, dusk sky in deep indigo and amber, gentle and magical, purely visual image with absolutely no text, no writing, no letters, no signs, no captions"
jobs={}
jobs['bg-welcome']="wide view of a winding old road lined with unlit lamp posts under a twilight sky, a tall lighthouse far away on the sea horizon, a firefly glowing, "+STYLE
jobs['bg-lighthouse']="a tall lighthouse at the end of the road shining a bright golden beam over the sea at night, rows of lit lamps along the road, "+STYLE
for s in b['scenes']:
    jobs['bg-'+s['id']]=f"scene of {s['place']}, {s['setup'].rstrip('.')}, empty of close-up characters, centred composition, "+STYLE
    for o in s['options']:
        jobs['obj-'+o['id']]="a close-up of "+V[o['id']]+", centred subject, simple clear shapes, "+STYLE
def run(k):
    f=f'art/{k}.jpg'
    if os.path.exists(f): return k,'cached'
    for a in range(5):
        try:
            r=urllib.request.Request(URL,json.dumps({'prompt':jobs[k],'steps':6}).encode(),{'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(r,timeout=90))
            open(f,'wb').write(base64.b64decode(d['result']['image'])); return k,'ok'
        except Exception as e:
            err=str(e); time.sleep(8*(a+1))
    return k,'FAIL '+err
with cf.ThreadPoolExecutor(2) as ex:
    for k,st in ex.map(run,jobs): print(k,st,flush=True)
