import type { Provenance } from '../provenance.ts';

/**
 * Test-only provenance builders. These are fixtures, not facts: values in
 * tests are arbitrary and never ship in a release.
 */
export const sourcedProv = (overrides: Partial<Provenance> = {}): Provenance =>
  ({
    id: '6d1f5c1e-5d0e-4c1e-9a33-0a4c1e8f9b21',
    status: 'sourced',
    unit: 'inr_per_year',
    asOf: '2026-10-15',
    confidence: 'high',
    sourceUrl: 'https://example.gov.in/source',
    quote: 'fixture quote',
    snapshotId: '9b0a1f3e-2f53-4d9b-8a8f-6a1b2c3d4e5f',
    ...overrides,
  }) as Provenance;

export const assumedProv = (rationale = 'fixture rationale'): Provenance => ({
  id: '2a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d',
  status: 'assumption',
  unit: 'ratio',
  asOf: '2026-10-15',
  confidence: 'low',
  rationale,
});
