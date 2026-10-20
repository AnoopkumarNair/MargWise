import type { TaxRegimeRules } from '@margwise/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NEW_REGIME_FIXTURE as NEW, OLD_REGIME_FIXTURE as OLD } from './fixtures.ts';
import { incomeTax, marginalRate, section129Saving } from './tax.ts';

describe('incomeTax (salaried; surcharge ignored in the alpha, 03 §3.6)', () => {
  it.each([
    // [gross, expected total] — hand-computed
    [0, 0],
    [475000, 0], // taxable 4,00,000: nil slab
    [1275000, 0], // taxable 12,00,000: slab tax 60,000 fully rebated
    [1275001, 62400.156], // taxable 12,00,001: no rebate, 60,000.15 × 1.04
    [2475000, 312000], // taxable 24,00,000: 3,00,000 × 1.04
    [3075000, 499200], // taxable 30,00,000: (3,00,000 + 1,80,000) × 1.04
  ])('new regime, gross %d → %d', (gross, total) => {
    expect(incomeTax(gross, NEW).total).toBeCloseTo(total, 2);
  });

  it.each([
    [550000, 0], // taxable 5,00,000: 12,500 rebated
    [550001, 13000.208], // taxable 5,00,001
    [1050000, 117000], // taxable 10,00,000: (12,500 + 1,00,000) × 1.04
  ])('old regime, gross %d → %d', (gross, total) => {
    expect(incomeTax(gross, OLD).total).toBeCloseTo(total, 2);
  });

  it('applies marginal relief only when the release says so', () => {
    const withRelief: TaxRegimeRules = { ...NEW, rebate: { ...NEW.rebate, marginalRelief: true } };
    expect(incomeTax(1275001, withRelief).total).toBeCloseTo(1.04, 6);
    expect(incomeTax(1300000, withRelief).total).toBeCloseTo(26000, 6); // income above 12L = 25,000 < 63,750 slab tax
    expect(incomeTax(1500000, withRelief).total).toBeCloseTo(incomeTax(1500000, NEW).total, 6); // relief no longer binds
  });

  it('property: tax is non-negative and never decreases as income rises (no relief)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (g, d) => {
          const a = incomeTax(g, NEW).total;
          const b = incomeTax(g + d, NEW).total;
          return a >= 0 && b >= a - 1e-6;
        },
      ),
    );
  });

  it('property: under marginal relief an extra rupee never costs more than one rupee plus cess', () => {
    const withRelief: TaxRegimeRules = { ...NEW, rebate: { ...NEW.rebate, marginalRelief: true } };
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 1, max: 200_000 }),
        (g, d) => {
          const inHand = (x: number) => x - incomeTax(x, withRelief).total;
          return inHand(g + d) >= inHand(g) - withRelief.cessRate * d - 1e-6;
        },
      ),
    );
  });
});

describe('marginalRate', () => {
  it('is the slab rate at the taxable income, including cess', () => {
    expect(marginalRate(1050000, OLD)).toBeCloseTo(0.312, 10);
    expect(marginalRate(800000, OLD)).toBeCloseTo(0.208, 10);
    expect(marginalRate(300000, OLD)).toBeCloseTo(0.052, 10); // taxable 2.5L boundary belongs to the 5% slab
  });
});

describe('section129Saving (ex-80E, 03 §3.8)', () => {
  it('is interest paid × old-regime marginal rate under the old regime, within 8 years', () => {
    expect(
      section129Saving(
        { interestPaid: 100000, parentGross: 1050000, regime: 'old', yearIndex: 1, maxYears: 8 },
        OLD,
      ),
    ).toBeCloseTo(31200, 6);
  });

  it('is ₹0 under the new regime, and "not sure" is treated as new', () => {
    expect(
      section129Saving(
        { interestPaid: 100000, parentGross: 1050000, regime: 'new', yearIndex: 1, maxYears: 8 },
        OLD,
      ),
    ).toBe(0);
    expect(
      section129Saving(
        {
          interestPaid: 100000,
          parentGross: 1050000,
          regime: 'not_sure',
          yearIndex: 1,
          maxYears: 8,
        },
        OLD,
      ),
    ).toBe(0);
  });

  it('stops after the 8th tax year from the first year of interest payment', () => {
    expect(
      section129Saving(
        { interestPaid: 100000, parentGross: 1050000, regime: 'old', yearIndex: 8, maxYears: 8 },
        OLD,
      ),
    ).toBeGreaterThan(0);
    expect(
      section129Saving(
        { interestPaid: 100000, parentGross: 1050000, regime: 'old', yearIndex: 9, maxYears: 8 },
        OLD,
      ),
    ).toBe(0);
  });

  it('refuses rules that do not allow the deduction', () => {
    expect(
      section129Saving(
        { interestPaid: 100000, parentGross: 1050000, regime: 'old', yearIndex: 1, maxYears: 8 },
        NEW,
      ),
    ).toBe(0);
  });
});
