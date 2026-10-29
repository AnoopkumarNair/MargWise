#!/usr/bin/env python3
"""Writes a minimal DOCX (a zip of three XML parts) from a JSON list of lines. Used by the S3 e2e tests to make a sample resume.
   python3 make_docx.py lines.json out.docx     Standard library only."""
import json, sys, zipfile
from xml.sax.saxutils import escape

lines = json.load(open(sys.argv[1], encoding='utf8'))
body = ''.join('<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % escape(l) for l in lines)
doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
       '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>%s</w:body></w:document>' % body)
ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      '<Default Extension="xml" ContentType="application/xml"/>'
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', ct)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', doc)
