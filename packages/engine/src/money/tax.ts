import type { TaxRegimeRules } from '@margwise/contracts';

export interface TaxBreakdown {
  taxable: number;
  slabTax: number;
  rebate: number;
  /** Reduction from marginal relief above the rebate limit, if the rules allow it. */
  marginalRelief: number;
  cess: number;
  total: number;
}

function slabTax(taxable: number, rules: TaxRegimeRules): number {
  let tax = 0;
  for (const slab of rules.slabs) {
    const top = slab.to ?? Infinity;
    if (taxable > slab.from) tax += (Math.min(taxable, top) - slab.from) * slab.rate;
  }
  return tax;
}

/**
 * Indian income tax for a salaried individual (03 §3.8): standard deduction,
 * slabs, rebate, optional marginal relief, cess. Surcharge and EPF are ignored
 * in the alpha (stated in the report). All rules come from the content release.
 */
export function incomeTax(gross: number, rules: TaxRegimeRules): TaxBreakdown {
  const taxable = Math.max(0, gross - rules.standardDeduction);
  const base = slabTax(taxable, rules);
  const { maxTaxableIncome, maxRebate, marginalRelief: reliefApplies } = rules.rebate;
  const rebate = taxable <= maxTaxableIncome ? Math.min(base, maxRebate) : 0;
  const afterRebate = base - rebate;
  const relief =
    reliefApplies && taxable > maxTaxableIncome
      ? Math.max(0, afterRebate - (taxable - maxTaxableIncome))
      : 0;
  const beforeCess = afterRebate - relief;
  const cess = beforeCess * rules.cessRate;
  return { taxable, slabTax: base, rebate, marginalRelief: relief, cess, total: beforeCess + cess };
}

/** Rate of the slab containing the taxable income (upper bounds exclusive), including cess. */
export function marginalRate(gross: number, rules: TaxRegimeRules): number {
  const taxable = Math.max(0, gross - rules.standardDeduction);
  const slab = rules.slabs.find((s) => taxable >= s.from && (s.to === null || taxable < s.to));
  return (slab?.rate ?? 0) * (1 + rules.cessRate);
}

export interface Section129Input {
  interestPaid: number;
  /** Parent's representative gross income (from the income band). */
  parentGross: number;
  regime: 'new' | 'old' | 'not_sure';
  /** 1 = first tax year in which interest was paid. */
  yearIndex: number;
  maxYears: number;
}

/**
 * Section 129 (ex-80E) tax saving (03 §3.8): interest actually paid × the
 * parent's old-regime marginal rate, for at most `maxYears` from the first
 * year of interest payment. ₹0 under the new regime; "not sure" → new.
 */
export function section129Saving(input: Section129Input, oldRules: TaxRegimeRules): number {
  if (input.regime !== 'old' || !oldRules.section129Allowed) return 0;
  if (input.yearIndex < 1 || input.yearIndex > input.maxYears || input.interestPaid <= 0) return 0;
  return input.interestPaid * marginalRate(input.parentGross, oldRules);
}
