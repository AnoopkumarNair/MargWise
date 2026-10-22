import json, io, base64, glob, os, re
from PIL import Image
def enc(path, size, crop=None, q=72):
    im=Image.open(path).convert('RGB')
    if crop:
        w,h=im.size; cw=int(h*crop); x=(w-cw)//2; im=im.crop((x,0,x+cw,h))
    im=im.resize(size, Image.LANCZOS)
    b=io.BytesIO(); im.save(b,'WEBP',quality=q,method=6)
    return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
art={'bg':{},'obj':{},'char':{}}
for f in sorted(glob.glob('art/bg-*.jpg')):
    art['bg'][os.path.basename(f)[3:-4]]=enc(f,(400,600),crop=2/3,q=68)
for f in sorted(glob.glob('art/obj-*.jpg')):
    art['obj'][os.path.basename(f)[4:-4]]=enc(f,(288,288),q=70)
s=open('lamps.html',encoding='utf8').read()
new='<script>window.LAMP_ART = '+json.dumps(art,separators=(',',':'))+';</script>'
s2,n=re.subn(r'<script>window\.LAMP_ART = \{[^\n]*?\};</script>',lambda m:new,s,count=1)
assert n==1
open('lamps_built.html','w',encoding='utf8').write(s2)
print(len(art['bg']),len(art['obj']),len(s2)/1e6,'MB')
