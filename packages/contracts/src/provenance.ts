import { z } from 'zod';
import { HttpsUrl, IsoDate, IsoDateTime, Uuid } from './primitives.ts';

/**
 * Domains that may never be cited (CLAUDE.md rule 2, 05 §4). Matching is by
 * exact host or subdomain. Coaching-institute marketing pages and cached AI
 * answers cannot be caught by domain; reviewers reject them in the Studio.
 */
export const FORBIDDEN_SOURCE_DOMAINS = [
  'linkedin.com',
  'lnkd.in',
  'glassdoor.com',
  'glassdoor.co.in',
  'ambitionbox.com',
  'naukri.com',
  'reddit.com',
  'redd.it',
  'quora.com',
] as const;

export function isForbiddenSource(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  return FORBIDDEN_SOURCE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export const Confidence = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

const NonBlank = z.string().trim().min(1);

const common = {
  id: Uuid,
  /** Unit of the value this record evidences, e.g. `inr_per_year`, `percent_per_year`. */
  unit: z.string().regex(/^[a-z0-9_]+$/, 'Expected snake_case unit'),
  asOf: IsoDate,
  validTo: IsoDate.optional(),
  confidence: Confidence,
  reviewer: z.string().min(1).optional(),
  reviewedAt: IsoDateTime.optional(),
};

const SourcedProvenance = z.strictObject({
  ...common,
  status: z.literal('sourced'),
  sourceUrl: HttpsUrl.refine((u) => !isForbiddenSource(u), 'Source domain is forbidden (05 §4)'),
  /** Verbatim text from the snapshot that evidences the value. */
  quote: NonBlank,
  snapshotId: Uuid,
  /** Page number or section heading inside the snapshot. */
  locator: z.string().min(1).optional(),
});

const AssumptionProvenance = z.strictObject({
  ...common,
  status: z.literal('assumption'),
  rationale: NonBlank,
});

export const Provenance = z
  .discriminatedUnion('status', [SourcedProvenance, AssumptionProvenance])
  .refine((p) => p.validTo === undefined || p.validTo >= p.asOf, {
    message: 'validTo must not be earlier than asOf',
    path: ['validTo'],
  });
export type Provenance = z.infer<typeof Provenance>;

/** A value that carries its own evidence. Every fact in a release is one of these. */
export function fact<T extends z.ZodType>(value: T) {
  return z.strictObject({ value, provenance: Provenance });
}

/** Provenance that must be `sourced` — for facts that may never be assumptions (gates, vectors). */
export const SourcedOnlyProvenance = Provenance.refine((p) => p.status === 'sourced', {
  message: 'This fact must be sourced, not an assumption',
});
