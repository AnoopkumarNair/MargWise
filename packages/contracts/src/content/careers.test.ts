import { describe, expect, it } from 'vitest';
import { assumedProv, sourcedProv } from './fixtures.ts';
import {
  Career,
  CareerInterestVector,
  CareerLevel,
  OnetSocCode,
  REQUIRED_DOSSIER_SECTIONS,
  Route,
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
    values: { R: 2, I: 76, A: 34, S: 93, E: 28, C: 42 },
    provenance: sourcedProv({
      unit: 'onet_oi_0_100',
      sourceUrl: 'https://www.onetcenter.org/database.html',
    }),
  };

  it('accepts OI ratings on the published 0–100 scale for all six areas', () => {
    expect(CareerInterestVector.safeParse(vector).success).toBe(true);
  });

  it('rejects ratings outside 0–100', () => {
    expect(
      CareerInterestVector.safeParse({ ...vector, values: { ...vector.values, R: -1 } }).success,
    ).toBe(false);
    expect(
      CareerInterestVector.safeParse({ ...vector, values: { ...vector.values, C: 100.5 } }).success,
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

  it('accepts O*NET OnLine (onetonline.org), an official O*NET site', () => {
    const prov = sourcedProv({
      unit: 'onet_oi_0_100',
      sourceUrl: 'https://www.onetonline.org/link/details/19-3033.00',
    });
    expect(CareerInterestVector.safeParse({ ...vector, provenance: prov }).success).toBe(true);
  });

  it('rejects a vector sourced from anywhere but O*NET sites', () => {
    const prov = sourcedProv({ unit: 'onet_oi_0_100', sourceUrl: 'https://example.com/vectors' });
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

describe('Route', () => {
  const stage = (order: number) => ({
    order,
    kind: 'ug',
    title: `Stage ${order}`,
    durationYears: { value: 4, provenance: sourcedProv({ unit: 'years' }) },
    entranceTests: [],
    country: 'IN',
  });
  const route = {
    id: 'tec-1-btech',
    careerId: 'tec-1',
    title: 'B.Tech',
    kind: 'main',
    stages: [stage(1), stage(2)],
  };

  it('accepts stages ordered 1..n', () => {
    expect(Route.safeParse(route).success).toBe(true);
  });

  it('rejects gaps or reordering in stage order', () => {
    expect(Route.safeParse({ ...route, stages: [stage(1), stage(3)] }).success).toBe(false);
    expect(Route.safeParse({ ...route, stages: [stage(2), stage(1)] }).success).toBe(false);
  });
});
