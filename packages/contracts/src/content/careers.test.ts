import { describe, expect, it } from 'vitest';
import { assumedProv, sourcedProv } from './fixtures.ts';
import {
  Career,
  CareerInterestVector,
  CareerLevel,
  Gate,
  OnetSocCode,
  REQUIRED_DOSSIER_SECTIONS,
} from './careers.ts';

describe('OnetSocCode', () => {
  it.each(['19-3033.00', '17-2112.01', '15-1252.00'])('accepts %s', (c) => {
    expect(OnetSocCode.safeParse(c).success).toBe(true);
  });
  it.each(['19-3033', '193033.00', '19-3033.0'])('rejects %s', (c) => {
    expect(OnetSocCode.safeParse(c).success).toBe(false);
  });
});

describe('CareerInterestVector — rule 3: vectors only from the O*NET Interests file', () => {
  const vector = {
    careerId: 'psy-1',
    onetSoc: '19-3033.00',
    onetRelease: '30.0',
    values: { R: 1.5, I: 6.2, A: 3.1, S: 6.8, E: 2.0, C: 3.0 },
    provenance: sourcedProv({
      unit: 'onet_oi_rating',
      sourceUrl: 'https://www.onetcenter.org/database.html',
    }),
  };

  it('accepts OI ratings on the 1–7 scale for all six areas', () => {
    expect(CareerInterestVector.safeParse(vector).success).toBe(true);
  });

  it('rejects ratings outside 1–7', () => {
    expect(
      CareerInterestVector.safeParse({ ...vector, values: { ...vector.values, R: 0.5 } }).success,
    ).toBe(false);
    expect(
      CareerInterestVector.safeParse({ ...vector, values: { ...vector.values, C: 7.1 } }).success,
    ).toBe(false);
  });

  it('rejects a missing area', () => {
    const { C: _c, ...five } = vector.values;
    expect(CareerInterestVector.safeParse({ ...vector, values: five }).success).toBe(false);
  });

  it('rejects a hand-authored (assumption) vector', () => {
    expect(CareerInterestVector.safeParse({ ...vector, provenance: assumedProv() }).success).toBe(
      false,
    );
  });

  it('rejects a vector sourced from anywhere but onetcenter.org', () => {
    const prov = sourcedProv({ unit: 'onet_oi_rating', sourceUrl: 'https://example.com/vectors' });
    expect(CareerInterestVector.safeParse({ ...vector, provenance: prov }).success).toBe(false);
  });
});

describe('CareerLevel (ladder)', () => {
  const level = {
    careerId: 'tec-1',
    order: 1,
    title: 'Software Engineer I',
    typicalYearsFrom: 0,
    typicalYearsTo: 2,
    payIndia: { value: { p10: 400000, p50: 800000, p90: 1800000 }, provenance: sourcedProv() },
    payAbroad: [],
  };

  it('accepts a level with an India P10/P50/P90 pay fact', () => {
    expect(CareerLevel.safeParse(level).success).toBe(true);
  });

  it('rejects inverted percentiles', () => {
    const bad = { ...level, payIndia: { ...level.payIndia, value: { p10: 9, p50: 5, p90: 10 } } };
    expect(CareerLevel.safeParse(bad).success).toBe(false);
  });

  it('rejects typicalYearsTo < typicalYearsFrom', () => {
    expect(
      CareerLevel.safeParse({ ...level, typicalYearsFrom: 5, typicalYearsTo: 2 }).success,
    ).toBe(false);
  });

  it('rejects negative pay (03 §3.12 sanity)', () => {
    const bad = { ...level, payIndia: { ...level.payIndia, value: { p10: -1, p50: 5, p90: 10 } } };
    expect(CareerLevel.safeParse(bad).success).toBe(false);
  });
});

describe('Gate', () => {
  const gate = {
    routeId: 'tec-1-btech-cse',
    subjectCombination: 'pcm',
    status: 'OPEN',
    reason: 'JEE Main eligibility requires Physics, Chemistry and Mathematics.',
    provenance: sourcedProv({ unit: 'gate_status' }),
  };

  it('accepts OPEN / BRIDGE / LOCKED with reason and source', () => {
    for (const status of ['OPEN', 'BRIDGE', 'LOCKED']) {
      expect(Gate.safeParse({ ...gate, status }).success).toBe(true);
    }
  });

  it('requires a non-empty reason', () => {
    expect(Gate.safeParse({ ...gate, reason: '' }).success).toBe(false);
  });

  it('requires a sourced (not assumed) provenance — eligibility is never a guess', () => {
    expect(Gate.safeParse({ ...gate, provenance: assumedProv() }).success).toBe(false);
  });
});

describe('Career', () => {
  const career = {
    id: 'psy-1',
    clusterId: 'psychology',
    title: 'Clinical Psychologist (RCI-registered)',
    onet: [{ soc: '19-3033.00', release: '30.0', note: 'Verified mapping' }],
    sections: REQUIRED_DOSSIER_SECTIONS.map((kind) => ({ kind, body: 'Text', sourceIds: [] })),
  };

  it('accepts a career with every required dossier section (01 §4.3)', () => {
    expect(Career.safeParse(career).success).toBe(true);
  });

  it('rejects a career missing a required section (05 §9 gate)', () => {
    const missing = {
      ...career,
      sections: career.sections.filter((s) => s.kind !== 'honest_notes'),
    };
    const result = Career.safeParse(missing);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('honest_notes');
  });

  it('rejects duplicate sections', () => {
    const dup = { ...career, sections: [...career.sections, career.sections[0]] };
    expect(Career.safeParse(dup).success).toBe(false);
  });

  it('requires at least one O*NET mapping', () => {
    expect(Career.safeParse({ ...career, onet: [] }).success).toBe(false);
  });

  it('lists the 13 sections named in 01 §4.3', () => {
    expect(REQUIRED_DOSSIER_SECTIONS).toHaveLength(13);
  });
});
