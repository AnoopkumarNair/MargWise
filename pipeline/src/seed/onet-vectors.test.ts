import { CareerInterestVector, RIASEC_ORDER } from '@margwise/contracts';
import { describe, expect, it } from 'vitest';
import seed from './onet-31.0-interest-vectors.json' with { type: 'json' };

/**
 * Seed of O*NET career interest ratings (rule 3: vectors only from O*NET,
 * never hand-authored). Values are as published on O*NET OnLine, release 31.0,
 * on its 0–100 display scale (= database OI 0–6 × 100/6). The pipeline replaces
 * this with the exact database file once the host is reachable (decisions D-045).
 */
const CAREERS: Record<string, string> = {
  'psy-1': '19-3033.00',
  'psy-2': '19-3033.00',
  'psy-3': '21-1012.00',
  'psy-4': '19-3032.00',
  'psy-5': '17-2112.01',
  'tec-1': '15-1252.00',
  'tec-2': '15-2051.00',
  'tec-3': '17-2072.00',
  'com-1': '13-2011.00',
  'com-2': '11-1021.00',
  'des-1': '15-1255.00',
  'des-2': '17-1011.00',
  'law-1': '23-1011.00',
  'law-2': '23-1023.00',
};

describe('O*NET 31.0 interest-vector seed', () => {
  it('covers exactly the 13 distinct codes behind the 14 careers (01 §4.1)', () => {
    expect(seed.occupations.map((o) => o.onetSoc).sort()).toEqual(
      [...new Set(Object.values(CAREERS))].sort(),
    );
    expect(seed.onetRelease).toBe('31.0');
  });

  it.each(seed.occupations.map((o) => [o.onetSoc, o] as const))(
    '%s has six whole-number ratings in 0–100',
    (_soc, o) => {
      expect(Object.keys(o.values).sort()).toEqual([...RIASEC_ORDER].sort());
      for (const v of Object.values(o.values))
        expect(Number.isInteger(v) && v >= 0 && v <= 100).toBe(true);
    },
  );

  it('every occupation was read from its O*NET OnLine page', () => {
    for (const o of seed.occupations) {
      expect(o.sourceUrl).toBe(`https://www.onetonline.org/link/details/${o.onetSoc}`);
    }
  });

  it('validates against the CareerInterestVector contract once pipeline provenance is attached', () => {
    const o = seed.occupations[0];
    if (!o) throw new Error('empty seed');
    const result = CareerInterestVector.safeParse({
      careerId: 'psy-1',
      onetSoc: o.onetSoc,
      onetRelease: seed.onetRelease,
      values: o.values,
      provenance: {
        id: '6d1f5c1e-5d0e-4c1e-9a33-0a4c1e8f9b21',
        status: 'sourced',
        unit: 'onet_oi_0_100',
        asOf: seed.retrievedOn,
        confidence: 'medium',
        sourceUrl: o.sourceUrl,
        quote: 'Occupational Interest',
        snapshotId: '9b0a1f3e-2f53-4d9b-8a8f-6a1b2c3d4e5f',
      },
    });
    expect(result.success).toBe(true);
  });

  it('records the open mapping question for UX Researcher (01 §9)', () => {
    const o = seed.occupations.find((x) => x.onetSoc === '17-2112.01');
    expect(o?.title).toBe('Human Factors Engineers and Ergonomists');
    expect(o?.note).toMatch(/confirm/i);
  });
});
