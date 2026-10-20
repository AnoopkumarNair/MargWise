import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { emi, loanSchedule } from './loans.ts';

// Expected values from docs/golden/money-hand-cases.md (independent Python).
describe('emi (annuity, monthly)', () => {
  it('₹10,00,000 at 10% for 10 years', () => {
    expect(emi(1_000_000, 0.1, 120)).toBeCloseTo(13215.073688176193, 6);
  });

  it('zero rate → straight division', () => {
    expect(emi(120_000, 0, 12)).toBe(10_000);
  });

  it('property: n × EMI ≥ principal, and higher rate → higher EMI', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1e8 }),
        fc.double({ min: 0, max: 0.3, noNaN: true }),
        fc.integer({ min: 12, max: 180 }),
        (p, r, n) => {
          return emi(p, r, n) * n >= p - 1e-6 && emi(p, r + 0.01, n) > emi(p, r, n);
        },
      ),
    );
  });
});

describe('loanSchedule (03 §3.5: simple moratorium interest, capitalised unless serviced)', () => {
  const base = {
    disbursements: [
      { month: 0, amount: 250_000 },
      { month: 12, amount: 250_000 },
    ],
    annualRate: 0.09,
    repaymentStartMonth: 36,
    tenureMonths: 60,
    serviceInterestDuringMoratorium: false,
  };

  it('capitalises simple moratorium interest per disbursement', () => {
    const s = loanSchedule(base);
    expect(s.capitalisedInterest).toBeCloseTo(112_500, 6);
    expect(s.principalAtRepayment).toBeCloseTo(612_500, 6);
    expect(s.emi).toBeCloseTo(12714.492576141749, 6);
    expect(s.debtFreeMonth).toBe(96);
  });

  it('aggregates interest and principal by plan year', () => {
    const s = loanSchedule(base);
    expect(s.yearly[0]).toMatchObject({ interestPaid: 0, payment: 0 });
    expect(s.yearly[3]?.interestPaid).toBeCloseTo(51003.02186669772, 4);
    expect(s.yearly[3]?.payment).toBeCloseTo(12 * 12714.492576141749, 4);
    expect(s.yearly[3]?.balanceEnd).toBeCloseTo(510929.1109529969, 4);
    expect(s.yearly.at(-1)?.balanceEnd).toBeCloseTo(0, 4);
  });

  it('servicing interest during the moratorium pays it each year and capitalises nothing', () => {
    const s = loanSchedule({ ...base, serviceInterestDuringMoratorium: true });
    expect(s.capitalisedInterest).toBe(0);
    expect(s.yearly.slice(0, 3).map((y) => y.interestPaid)).toEqual([22_500, 45_000, 45_000]);
    expect(s.yearly.slice(0, 3).map((y) => y.payment)).toEqual([22_500, 45_000, 45_000]);
  });

  it('rate-reduction subvention lowers moratorium interest only', () => {
    const s = loanSchedule({ ...base, subvention: { kind: 'rate_reduction', reduction: 0.03 } });
    expect(s.capitalisedInterest).toBeCloseTo(75_000, 6);
    expect(s.emi).toBeCloseTo(emi(575_000, 0.09, 60), 6);
  });

  it('full subvention removes moratorium interest', () => {
    expect(loanSchedule({ ...base, subvention: { kind: 'full' } }).capitalisedInterest).toBe(0);
  });

  it('rejects a disbursement after repayment starts', () => {
    expect(() => loanSchedule({ ...base, disbursements: [{ month: 40, amount: 1 }] })).toThrow(
      /after repayment/,
    );
  });

  it('property: total paid = disbursed + capitalised interest + interest paid; final balance is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10_000, max: 5_000_000 }),
        fc.double({ min: 0, max: 0.2, noNaN: true }),
        fc.integer({ min: 0, max: 48 }),
        fc.integer({ min: 12, max: 180 }),
        fc.boolean(),
        (amount, rate, start, tenure, serviced) => {
          const s = loanSchedule({
            disbursements: [{ month: 0, amount }],
            annualRate: rate,
            repaymentStartMonth: start,
            tenureMonths: tenure,
            serviceInterestDuringMoratorium: serviced,
          });
          const paid = s.yearly.reduce((t, y) => t + y.payment, 0);
          const interest = s.yearly.reduce((t, y) => t + y.interestPaid, 0);
          return (
            Math.abs(paid - (amount + s.capitalisedInterest + interest)) <
              1e-4 * Math.max(1, amount) && Math.abs(s.yearly.at(-1)?.balanceEnd ?? 1) < 1e-4
          );
        },
      ),
    );
  });
});
