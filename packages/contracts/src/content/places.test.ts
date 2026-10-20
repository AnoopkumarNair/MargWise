import { describe, expect, it } from 'vitest';
import { sourcedProv } from './fixtures.ts';
import { CountryPolicy, policyAppliesTo } from './places.ts';

const policy = {
  id: 'us-h1b-fee-fixture',
  country: 'US',
  title: 'Fixture fee',
  kind: 'post_study_work',
  status: 'proposed',
  history: [
    { status: 'proposed', on: '2026-08-01', provenance: sourcedProv({ unit: 'policy_status' }) },
  ],
  effect: { kind: 'one_time_cost', currency: 'USD', amount: 100 },
};

describe('CountryPolicy lifecycle (05 §5.3)', () => {
  it('accepts a policy whose status equals its latest history entry', () => {
    expect(CountryPolicy.safeParse(policy).success).toBe(true);
  });

  it('rejects a status that disagrees with the latest transition', () => {
    expect(CountryPolicy.safeParse({ ...policy, status: 'in_force' }).success).toBe(false);
  });

  it('rejects history out of date order', () => {
    const history = [
      { status: 'announced', on: '2026-09-01', provenance: sourcedProv() },
      { status: 'proposed', on: '2026-08-01', provenance: sourcedProv() },
    ];
    expect(CountryPolicy.safeParse({ ...policy, status: 'proposed', history }).success).toBe(false);
  });

  it.each([
    ['proposed', 'policy_shock'],
    ['announced', 'policy_shock'],
    ['in_force', 'base_values'],
    ['amended', 'base_values'],
    ['suspended_or_blocked', 'display_only'],
    ['withdrawn', 'display_only'],
  ] as const)('a %s item is used for %s', (status, use) => {
    expect(policyAppliesTo(status)).toBe(use);
  });
});
