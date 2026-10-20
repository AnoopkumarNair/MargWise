"""Transcribe the O*NET IP Short Form items from the official paper PDF.

Usage: pdftotext -layout docs/assessment/sources/onet-ipsf-paper-v1-2024-11-04.pdf - \
         | python3 -I scripts/instrument/transcribe_ipsf.py > packages/engine/src/assessment/data/onet-ipsf-v1.items.json

Reads the two-column layout: each area block has five rows; column 1 is the
left item, column 2 the right. Wrapped lines (e.g. "...hard of / hearing") are
joined. Output: [{id, area, text, paper: {column, row}}] in area order R-I-A-S-E-C,
column 1 rows 1-5 then column 2 rows 1-5. The engine test independently checks
the result against a hand-typed list.
"""
import json
import re
import sys

AREAS = ["R", "I", "A", "S", "E", "C"]
BOX = "◻"  # the checkbox glyph printed before each item

lines = sys.stdin.read().splitlines()
blocks, current, last_row = [], [], None
for line in lines:
    if "checks =" in line:
        blocks.append(current)
        current, last_row = [], None
        continue
    if BOX in line:
        parts = [p.strip() for p in line.split(BOX)[1:]]
        left = re.sub(r"\s{2,}.*$", "", parts[0]) if parts else ""
        right = re.sub(r"\s{2,}(Total)?\s*$", "", parts[1]) if len(parts) > 1 else ""
        last_row = [left.strip(), right.strip()]
        current.append(last_row)
    elif last_row is not None and line.strip() and line.startswith(" " * 40) and "Total" not in line:
        # continuation of the right-hand item on the next line
        last_row[1] = f"{last_row[1]} {line.strip()}"

if len(blocks) != 6 or any(len(b) != 5 for b in blocks):
    sys.exit(f"unexpected layout: {[len(b) for b in blocks]}")

items = []
for area, block in zip(AREAS, blocks):
    for column in (1, 2):
        for row, pair in enumerate(block, start=1):
            n = (column - 1) * 5 + row
            items.append({"id": f"{area}{n}", "area": area, "text": pair[column - 1], "paper": {"column": column, "row": row}})
json.dump(items, sys.stdout, indent=2, ensure_ascii=False)
sys.stdout.write("\n")
