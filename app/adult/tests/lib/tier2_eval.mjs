// Scores tier 2 suggestions against the synthetic fixtures in tests/fixtures/tier2 (each line lists what it must give and what is also fair).
// Test and tuning use only. `embed` is any async (texts) => vectors, so the real model, a fake one or a cached one all work.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { achievementLines, suggest } from '../../intake/tier2.js';

export const TIER2_DIR = fileURLToPath(new URL('../fixtures/tier2/', import.meta.url));
export const NOW_YEAR = 2026;

// The three fixtures with Achievements, Awards, Volunteering and a rich Summary (S5 review S6). Kept apart: the threshold was tuned on the first eight.
export const SECTIONS_DIR = fileURLToPath(new URL('../fixtures/tier2_sections/', import.meta.url));

export function tier2Fixtures(dir = TIER2_DIR) {
  return readdirSync(dir).filter(d => existsSync(dir + d + '/expected.json')).sort().map(id => ({
    id, text: readFileSync(dir + id + '/resume.txt', 'utf8'), expected: JSON.parse(readFileSync(dir + id + '/expected.json', 'utf8')),
  }));
}

// A wrapper that embeds each distinct text once, so a sweep over thresholds does not run the model again.
export function memoEmbed(embed) {
  const memo = new Map();
  return async texts => {
    const need = [...new Set(texts.filter(t => !memo.has(t)))];
    if (need.length) { const v = await embed(need); need.forEach((t, i) => memo.set(t, v[i])); }
    return texts.map(t => memo.get(t));
  };
}

// Counts one fixture's suggestions against what its lines say they must or may give. `got` is a list of { id, sourceLine }.
export function scoreFixture(f, got) {
  const entryOf = s => f.expected.lines.find(e => s.startsWith(e.contains.slice(0, 30)));
  const out = { tp: 0, ok: 0, fp: 0, falsePos: [], foundPairs: new Set(), hitLines: new Set() };
  for (const s of got) {
    const e = entryOf(s.sourceLine);
    if (e && e.must.includes(s.id)) { out.tp++; out.foundPairs.add(s.id); out.hitLines.add(e); }
    else if (e && e.ok.includes(s.id)) { out.ok++; out.hitLines.add(e); }
    else { out.fp++; out.falsePos.push(`${f.id}: ${s.id} ${s.score} <- "${s.sourceLine.slice(0, 60)}"`); }
  }
  return out;
}

// The totals over all fixtures. `perFixture` is { fixture id: suggestions }, whoever made them (Node, or the browser).
export function summarise(fixtures, perFixture) {
  const r = { fixtures: fixtures.length, suggested: 0, tp: 0, ok: 0, fp: 0, mustPairs: 0, found: 0, impliedLines: 0, linesHit: 0, missed: [], falsePos: [], perFixture: {} };
  for (const f of fixtures) {
    const got = perFixture[f.id] || [];
    const sc = scoreFixture(f, got);
    const must = new Set(f.expected.lines.flatMap(e => e.must));
    for (const id of must) { r.mustPairs++; if (sc.foundPairs.has(id)) r.found++; else r.missed.push(`${f.id}: ${id}`); }
    for (const e of f.expected.lines) if (e.must.length) { r.impliedLines++; if (sc.hitLines.has(e)) r.linesHit++; }
    r.suggested += got.length; r.tp += sc.tp; r.ok += sc.ok; r.fp += sc.fp; r.falsePos.push(...sc.falsePos);
    r.perFixture[f.id] = { suggested: got.length, tp: sc.tp, ok: sc.ok, fp: sc.fp };
  }
  r.recall = r.mustPairs ? r.found / r.mustPairs : 1;
  r.lineRecall = r.impliedLines ? r.linesHit / r.impliedLines : 1;   // implied lines that got at least one fair suggestion (a "must" or an "ok" id)
  r.precision = r.suggested ? r.tp / r.suggested : 1;               // strict: only the lines' own "must" ids count as right
  r.precisionFair = r.suggested ? (r.tp + r.ok) / r.suggested : 1;  // fair: "ok" readings count as right too
  r.perResume = r.suggested / r.fixtures;
  return r;
}

// opts: { embed, vecs, threshold, perLine, cap, fixtures, skipSections (see achievementLines), maxLines }. Runs tier 2 on each fixture and returns summarise()'s totals.
export async function evaluate(opts) {
  const fixtures = opts.fixtures || tier2Fixtures();
  const per = {};
  for (const f of fixtures) {
    const lines = achievementLines(f.text, { nowYear: NOW_YEAR, skipSections: opts.skipSections, maxLines: opts.maxLines });
    per[f.id] = await suggest(lines, { embed: opts.embed, vecs: opts.vecs, threshold: opts.threshold, perLine: opts.perLine, cap: opts.cap || 1000, exclude: opts.exclude });
  }
  return summarise(fixtures, per);
}
