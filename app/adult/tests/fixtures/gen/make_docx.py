#!/usr/bin/env python3
"""Makes the DOCX fixture(s) by zipping the minimal Word XML parts. Standard library only.

    python3 app/adult/tests/fixtures/gen/make_docx.py [id ...]

Input: fixtures/<id>/resume.txt for each id marked "docx" in gen/layouts.json. Output: fixtures/<id>/resume.docx.
Headings (lines in capitals) use the Heading1 style; the rest are plain paragraphs. The zip uses a fixed timestamp, so the
file is the same every time it is made.
"""
import json
import os
import re
import sys
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
</w:styles>"""

HEADING = re.compile(r"^[A-Z][A-Z &/,'()-]{2,38}$")


def paragraph(text, style=None):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'


def build(lines):
    out = []
    first = True
    for line in lines:
        line = line.rstrip()
        if not line.strip():
            continue
        if first:
            out.append(paragraph(line, 'Title'))
            first = False
        elif HEADING.match(line.strip()):
            out.append(paragraph(line, 'Heading1'))
        elif line.startswith('- '):
            out.append(paragraph('• ' + line[2:]))
        else:
            out.append(paragraph(line))
    ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {ns}><w:body>{"".join(out)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>'


def write_docx(path, lines):
    parts = [('[Content_Types].xml', CONTENT_TYPES), ('_rels/.rels', RELS), ('word/_rels/document.xml.rels', DOC_RELS),
             ('word/styles.xml', STYLES), ('word/document.xml', build(lines))]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in parts:
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data.encode('utf-8'))


def main():
    layouts = json.load(open(os.path.join(HERE, 'layouts.json'), encoding='utf-8'))
    only = sys.argv[1:]
    for fid, cfg in layouts.items():
        if cfg.get('layout') != 'docx' or (only and fid not in only):
            continue
        src = os.path.join(ROOT, fid, 'resume.txt')
        lines = open(src, encoding='utf-8').read().split('\n')
        dst = os.path.join(ROOT, fid, 'resume.docx')
        write_docx(dst, lines)
        print(f'{fid}/resume.docx', os.path.getsize(dst), 'bytes')


if __name__ == '__main__':
    main()
