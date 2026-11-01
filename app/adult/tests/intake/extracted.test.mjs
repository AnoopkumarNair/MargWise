// The same fixtures, read from the text a real PDF extractor makes (poppler's pdftotext), not from the hand-written twin.
// Skipped when pdftotext is not installed. It shows that line breaks, blank lines, page breaks and wrapped lines do not break the read.
// Not included on purpose: two_col and table_layout. A text extractor that reads across a two-column page, or lists table cells
// column by column, hands over the words in an order that no reader can repair; that is the file-reading lane's job (column order).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readResume } from '../../intake/read.js';
import { loadGraph } from '../lib/graph.mjs';
import { loadFixture, score, NOW, FIXTURES_DIR } from '../lib/fixtures.mjs';

const have = spawnSync('pdftotext', ['-v']).error === undefined;
const g = loadGraph();
const OK = ['single_col', 'ambiguous_terms', 'dates_five', 'devanagari_mixed', 'hidden_text', 'indian_format', 'linkedin_export', 'ten_page', 'non_resume', 'scanned'];

for (const mode of [[], ['-layout']]) {
  for (const id of OK) {
    test(`pdftotext ${mode.join(' ') || 'reading order'}: ${id}`, t => {
      if (!have) return t.skip('pdftotext is not installed');
      const pdf = FIXTURES_DIR + id + '/resume.pdf';
      assert.ok(existsSync(pdf));
      const out = spawnSync('pdftotext', [...mode, pdf, '-'], { encoding: 'utf8' });
      assert.equal(out.status, 0);
      const e = loadFixture(id).expected;
      const r = readResume(out.stdout, { ...g, now: NOW });
      assert.equal(r.looksLikeResume, e.looksLikeResume);
      if (id === 'scanned') { assert.ok(r.warnings.some(w => w.code === 'too_little_text')); return; }
      assert.equal(r.roles.length, e.roles.length, JSON.stringify(r.roles.map(x => [x.titleText, x.startYear, x.endYear])));
      e.roles.forEach((want, i) => {
        assert.ok(r.roles[i].titleText.toLowerCase().includes(want.titleContains.toLowerCase()), `role ${i}: ${r.roles[i].titleText}`);
        assert.equal(r.roles[i].startYear, want.startYear);
        assert.equal(r.roles[i].endYear, want.endYear);
        assert.equal(r.roles[i].current, want.current);
      });
      const sc = score(r, e);
      assert.deepEqual(sc.missed, []);
      assert.deepEqual(sc.falsePos, []);
    });
  }
}
