import { describe, expect, it } from 'vitest';
import { FORBIDDEN_SOURCE_DOMAINS, isForbiddenSource, Provenance } from './provenance.ts';

const sourced = {
  id: '6d1f5c1e-5d0e-4c1e-9a33-0a4c1e8f9b21',
  status: 'sourced',
  unit: 'percent_per_year',
  asOf: '2026-10-15',
  confidence: 'high',
  sourceUrl: 'https://sbi.bank.in/web/interest-rates/education-loan',
  quote: 'Rate of interest 10.15%',
  snapshotId: '9b0a1f3e-2f53-4d9b-8a8f-6a1b2c3d4e5f',
  reviewer: 'owner',
  reviewedAt: '2026-10-16T09:00:00Z',
} as const;

const assumption = {
  id: '2a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d',
  status: 'assumption',
  unit: 'percent_per_year',
  asOf: '2026-10-15',
  confidence: 'low',
  rationale: 'Education inflation range 6–10% per 03 §3.4; no single official series.',
} as const;

describe('Provenance — rule 2: never invent a number', () => {
  it('accepts a sourced fact with URL, verbatim quote and snapshot', () => {
    expect(Provenance.safeParse(sourced).success).toBe(true);
  });

  it('accepts an assumption with a written rationale', () => {
    expect(Provenance.safeParse(assumption).success).toBe(true);
  });

  it.each(['quote', 'snapshotId', 'sourceUrl'] as const)(
    'rejects a sourced fact without %s',
    (field) => {
      const { [field]: _omitted, ...rest } = sourced;
      expect(Provenance.safeParse(rest).success).toBe(false);
    },
  );

  it('rejects a sourced fact with a blank quote', () => {
    expect(Provenance.safeParse({ ...sourced, quote: '   ' }).success).toBe(false);
  });

  it('rejects an assumption without a rationale', () => {
    const { rationale: _r, ...rest } = assumption;
    expect(Provenance.safeParse(rest).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(Provenance.safeParse({ ...assumption, status: 'guess' }).success).toBe(false);
  });

  it('rejects valid_to earlier than as_of', () => {
    expect(Provenance.safeParse({ ...sourced, validTo: '2026-01-01' }).success).toBe(false);
  });

  it('accepts valid_to on or after as_of', () => {
    expect(Provenance.safeParse({ ...sourced, validTo: '2026-12-31' }).success).toBe(true);
  });

  it('rejects non-https source URLs', () => {
    expect(Provenance.safeParse({ ...sourced, sourceUrl: 'http://sbi.co.in/x' }).success).toBe(
      false,
    );
  });
});

describe('Forbidden sources (CLAUDE.md rule 2)', () => {
  it.each([
    'https://www.linkedin.com/salary/x',
    'https://glassdoor.co.in/Salaries/x',
    'https://www.glassdoor.com/x',
    'https://www.ambitionbox.com/salaries',
    'https://www.naukri.com/x',
    'https://old.reddit.com/r/india',
    'https://www.quora.com/What',
  ])('rejects %s', (url) => {
    expect(isForbiddenSource(url)).toBe(true);
    expect(Provenance.safeParse({ ...sourced, sourceUrl: url }).success).toBe(false);
  });

  it.each([
    'https://www.nirfindia.org/x',
    'https://sbi.bank.in/x',
    'https://www.gov.uk/graduate-visa',
  ])('allows official source %s', (url) => {
    expect(isForbiddenSource(url)).toBe(false);
  });

  it('does not match look-alike suffixes (e.g. notreddit.com is not reddit.com)', () => {
    expect(isForbiddenSource('https://notreddit.com/x')).toBe(false);
  });

  it('treats an unparsable URL as forbidden (fail closed)', () => {
    expect(isForbiddenSource('not a url')).toBe(true);
  });

  it('lists every domain named in the spec', () => {
    expect(FORBIDDEN_SOURCE_DOMAINS).toEqual(
      expect.arrayContaining([
        'linkedin.com',
        'glassdoor.com',
        'ambitionbox.com',
        'naukri.com',
        'reddit.com',
        'quora.com',
      ]),
    );
  });
});
