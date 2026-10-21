import { describe, expect, it } from 'vitest';
import { assumedProv, sourcedProv } from './fixtures.ts';
import { Cutoff, NotReported, ProgrammeFee } from './colleges.ts';

describe('NotReported — 01 §5.2: missing data shows "not reported", never a guess', () => {
  it('is an explicit marker distinct from zero', () => {
    expect(NotReported.parse({ notReported: true })).toEqual({ notReported: true });
  });

  it('a programme fee may be a fact or not reported, never a bare number', () => {
    const base = { programmeId: 'iit-x-btech-cse', year: 2026 };
    expect(ProgrammeFee.safeParse({ ...base, annualInr: { notReported: true } }).success).toBe(
      true,
    );
    expect(
      ProgrammeFee.safeParse({ ...base, annualInr: { value: 200000, provenance: sourcedProv() } })
        .success,
    ).toBe(true);
    expect(ProgrammeFee.safeParse({ ...base, annualInr: 200000 }).success).toBe(false);
  });
});

describe('Cutoff', () => {
  const cutoff = {
    programmeId: 'iit-x-btech-cse',
    year: 2026,
    round: 6,
    quota: 'AI',
    category: 'OPEN',
    seatPool: 'gender-neutral',
    openingRank: 10,
    closingRank: 200,
    provenance: sourcedProv({ unit: 'rank' }),
  };

  it('accepts opening ≤ closing rank', () => {
    expect(Cutoff.safeParse(cutoff).success).toBe(true);
  });

  it('rejects opening > closing rank', () => {
    expect(Cutoff.safeParse({ ...cutoff, openingRank: 500 }).success).toBe(false);
  });

  it('only accepts ranks published by a counselling body (sourced)', () => {
    expect(Cutoff.safeParse({ ...cutoff, provenance: assumedProv() }).success).toBe(false);
  });
});
