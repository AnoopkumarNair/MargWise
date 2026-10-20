export interface LoanInput {
  /** Disbursements by month from plan start (month 0 = first month of plan year 1). */
  disbursements: ReadonlyArray<{ month: number; amount: number }>;
  /** Annual rate as a ratio, after any concessions the family qualifies for. */
  annualRate: number;
  /** First EMI month (end of moratorium). */
  repaymentStartMonth: number;
  tenureMonths: number;
  /** Family pays moratorium interest monthly instead of having it capitalised. */
  serviceInterestDuringMoratorium: boolean;
  /** Interest subvention during the moratorium only (03 §3.5). */
  subvention?: { kind: 'full' } | { kind: 'rate_reduction'; reduction: number };
}

export interface LoanYear {
  /** Plan year, 1-based. */
  year: number;
  /** Interest component of payments made this year (serviced moratorium interest + EMI interest). */
  interestPaid: number;
  principalPaid: number;
  /** Total paid by the family this year. */
  payment: number;
  balanceEnd: number;
}

export interface LoanSchedule {
  capitalisedInterest: number;
  principalAtRepayment: number;
  emi: number;
  /** Month after the last EMI. */
  debtFreeMonth: number;
  /** One row per plan year from year 1 to the debt-free year. */
  yearly: LoanYear[];
}

/** Monthly annuity payment. */
export function emi(principal: number, annualRate: number, months: number): number {
  if (months <= 0) throw new Error('tenure must be positive');
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  // (1 + r)^n − 1 via expm1/log1p stays accurate for very small rates.
  const growth = Math.expm1(months * Math.log1p(r));
  return (principal * r * (1 + growth)) / growth;
}

/**
 * Builds the loan schedule (03 §3.5). Moratorium interest is simple interest
 * on the amount disbursed so far, at the rate less any subvention; it is paid
 * monthly if serviced, otherwise capitalised at the first EMI. Repayment is an
 * annuity over `tenureMonths`.
 */
export function loanSchedule(input: LoanInput): LoanSchedule {
  const { repaymentStartMonth: start, tenureMonths } = input;
  if (input.disbursements.some((d) => d.month > start)) {
    throw new Error('disbursement after repayment starts');
  }
  const sub = input.subvention;
  const moratoriumRate =
    sub?.kind === 'full'
      ? 0
      : Math.max(0, input.annualRate - (sub?.kind === 'rate_reduction' ? sub.reduction : 0));
  const lastMonth = start + tenureMonths;
  const months = Array.from({ length: lastMonth }, () => ({ interest: 0, principal: 0 }));

  let disbursed = 0;
  let capitalised = 0;
  for (let m = 0; m < start; m++) {
    disbursed += input.disbursements.filter((d) => d.month === m).reduce((t, d) => t + d.amount, 0);
    const interest = (disbursed * moratoriumRate) / 12;
    if (input.serviceInterestDuringMoratorium)
      (months[m] as { interest: number }).interest += interest;
    else capitalised += interest;
  }
  disbursed += input.disbursements
    .filter((d) => d.month === start)
    .reduce((t, d) => t + d.amount, 0);

  const principalAtRepayment = disbursed + capitalised;
  const payment = emi(principalAtRepayment, input.annualRate, tenureMonths);
  const r = input.annualRate / 12;
  let balance = principalAtRepayment;
  const balanceByMonth: number[] = Array.from({ length: lastMonth }, () => 0);
  for (let m = start; m < lastMonth; m++) {
    const interest = balance * r;
    const principal = m === lastMonth - 1 ? balance : payment - interest;
    balance -= principal;
    const row = months[m] as { interest: number; principal: number };
    row.interest += interest;
    row.principal += principal;
    balanceByMonth[m] = balance;
  }

  const years = Math.ceil(lastMonth / 12);
  const yearly: LoanYear[] = Array.from({ length: years }, (_, y) => {
    const slice = months.slice(y * 12, y * 12 + 12);
    const interestPaid = slice.reduce((t, x) => t + x.interest, 0);
    const principalPaid = slice.reduce((t, x) => t + x.principal, 0);
    const endMonth = Math.min(y * 12 + 11, lastMonth - 1);
    const outstanding =
      endMonth < start
        ? input.disbursements.filter((d) => d.month <= endMonth).reduce((t, d) => t + d.amount, 0)
        : (balanceByMonth[endMonth] as number);
    return {
      year: y + 1,
      interestPaid,
      principalPaid,
      payment: interestPaid + principalPaid,
      balanceEnd: Math.abs(outstanding) < 1e-9 ? 0 : outstanding,
    };
  });

  return {
    capitalisedInterest: capitalised,
    principalAtRepayment,
    emi: payment,
    debtFreeMonth: lastMonth,
    yearly,
  };
}
