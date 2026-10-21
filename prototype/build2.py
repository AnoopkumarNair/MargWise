import json, glob, os, re, shutil
from PIL import Image
out='site'; shutil.rmtree(out,ignore_errors=True); os.makedirs(out+'/art')
art={'bg':{},'obj':{},'char':{}}; tot=0
for f in sorted(glob.glob('art/bg-*.jpg')):
    k=os.path.basename(f)[3:-4]; im=Image.open(f).convert('RGB'); w,h=im.size; cw=int(h*2/3); x=(w-cw)//2
    im=im.crop((x,0,x+cw,h)).resize((540,810),Image.LANCZOS); p=f'{out}/art/bg-{k}.webp'; im.save(p,'WEBP',quality=80,method=6)
    art['bg'][k]='art/bg-%s.webp'%k; tot+=os.path.getsize(p)
for f in sorted(glob.glob('art/obj-*.jpg')):
    k=os.path.basename(f)[4:-4]; im=Image.open(f).convert('RGB').resize((320,320),Image.LANCZOS); p=f'{out}/art/obj-{k}.webp'; im.save(p,'WEBP',quality=76,method=6)
    art['obj'][k]='art/obj-%s.webp'%k; tot+=os.path.getsize(p)
s=open('lamps15.html',encoding='utf8').read()
new='<script>window.LAMP_ART = '+json.dumps(art,separators=(',',':'))+';</script>'
s,n=re.subn(r'<script>window\.LAMP_ART = \{[^\n]*?\};</script>',lambda m:new,s,count=1); assert n==1
open('lamps15_built.html','w',encoding='utf8').write(s)
i=s.index('<body>')+6; j=s.rindex('</body>'); open(out+'/index.html','w',encoding='utf8').write(s[i:j].lstrip('\n')+'\n')
print(len(art['bg']),'bgs',tot/1e6,'MB images; html',len(s)/1e3,'KB')
