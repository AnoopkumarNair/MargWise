import { z } from 'zod';

/** Lowercase kebab-case identifier used for careers, courses, cities, etc. */
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected kebab-case slug');

export const Uuid = z.uuid();

/** Calendar date, `YYYY-MM-DD`. */
export const IsoDate = z.iso.date();

/** Instant with an explicit offset, e.g. `2026-10-16T09:00:00Z`. */
export const IsoDateTime = z.iso.datetime({ offset: true });

/** INR plus the currencies of the six in-depth countries (01 §4.2). */
export const CurrencyCode = z.enum(['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD']);
export type CurrencyCode = z.infer<typeof CurrencyCode>;

export const CountryCode = z.enum(['IN', 'US', 'GB', 'DE', 'CA', 'AU', 'IE']);
export type CountryCode = z.infer<typeof CountryCode>;

export const FiniteNumber = z.number().refine(Number.isFinite, 'Must be a finite number');

/** Triangular range used by the money engine. Release gate: low ≤ likely ≤ high (05 §9). */
export const NumericRange = z
  .strictObject({ low: FiniteNumber, likely: FiniteNumber, high: FiniteNumber })
  .refine((r) => r.low <= r.likely, { message: 'low must be ≤ likely', path: ['low'] })
  .refine((r) => r.likely <= r.high, { message: 'likely must be ≤ high', path: ['high'] });
export type NumericRange = z.infer<typeof NumericRange>;

/** P10/P50/P90 pay band. */
export const Percentiles = z
  .strictObject({ p10: FiniteNumber, p50: FiniteNumber, p90: FiniteNumber })
  .refine((p) => p.p10 <= p.p50 && p.p50 <= p.p90, { message: 'Expected p10 ≤ p50 ≤ p90' });
export type Percentiles = z.infer<typeof Percentiles>;

export const Riasec = z.enum(['R', 'I', 'A', 'S', 'E', 'C']);
export type Riasec = z.infer<typeof Riasec>;
export const RIASEC_ORDER = Riasec.options;

export const HttpsUrl = z.url({ protocol: /^https$/ });
