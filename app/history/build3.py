import re, shutil, os
s=open('site/index.html',encoding='utf8').read()
doc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><style>:root{color-scheme:dark}html,body{margin:0;padding:0;background:#141a3a;color:#fff3d6;font:14px -apple-system,BlinkMacSystemFont,sans-serif}[hidden]{display:none!important}</style>'+'<script>window.MW_CONFIG={api:"/api"};</script>'+s.replace('<title>','</head><body><title>',1)+'</body></html>'
# keep <title> inside head: move it
doc=doc.replace('</head><body><title>The Night of Lamps</title>','<title>The Night of Lamps</title></head><body>',1)
os.makedirs('deploy/public',exist_ok=True)
open('deploy/public/index.html','w',encoding='utf8').write(doc)
shutil.rmtree('deploy/public/art',ignore_errors=True); shutil.copytree('site/art','deploy/public/art')
print('deploy html',len(doc)//1000,'KB')
