import { en, type MessageKey } from './messages.en.ts';

export type { MessageKey };

export function t(key: MessageKey): string {
  const message = (en as Record<string, string>)[key];
  if (message === undefined) throw new Error(`Unknown message key: ${key}`);
  return message;
}

/** Formats an integer with Indian digit grouping (lakh/crore), e.g. 12,34,567. */
export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

export function formatInr(amount: number): string {
  return `₹${formatIndianNumber(Math.round(amount))}`;
}
