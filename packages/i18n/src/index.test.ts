import { describe, expect, it } from 'vitest';
import { formatInr, formatIndianNumber, t } from './index.ts';

describe('t()', () => {
  it('returns the English string for a known key', () => {
    expect(t('app.title')).toBe('Margwise');
  });

  it('throws on an unknown key so missing strings fail loudly in tests', () => {
    // @ts-expect-error deliberately unknown key
    expect(() => t('does.not.exist')).toThrow(/Unknown message key/);
  });
});

describe('formatIndianNumber()', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [100000, '1,00,000'],
    [1234567, '12,34,567'],
    [10000000, '1,00,00,000'],
    [-250000, '-2,50,000'],
  ])('groups %d as %s (lakh/crore grouping)', (n, expected) => {
    expect(formatIndianNumber(n)).toBe(expected);
  });
});

describe('formatInr()', () => {
  it('prefixes the rupee sign and rounds to whole rupees', () => {
    expect(formatInr(1234567.6)).toBe('₹12,34,568');
  });
});
