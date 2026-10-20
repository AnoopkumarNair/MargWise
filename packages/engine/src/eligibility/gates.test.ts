import type { Gate, SubjectSet } from '@margwise/contracts';
import { describe, expect, it } from 'vitest';
import { evaluateGate, evaluateRoute } from './gates.ts';

const prov = {
  id: '6d1f5c1e-5d0e-4c1e-9a33-0a4c1e8f9b21',
  status: 'sourced' as const,
  unit: 'gate_rule',
  asOf: '2026-10-15',
  confidence: 'high' as const,
  sourceUrl: 'https://example.gov.in/x',
  quote: 'fixture',
  snapshotId: '9b0a1f3e-2f53-4d9b-8a8f-6a1b2c3d4e5f',
};
// Fixture rule only (not a real eligibility fact).
const gate = (over: Partial<Gate> = {}): Gate => ({
  routeId: 'fixture-route',
  requirement: {
    allOf: ['physics', 'mathematics'],
    anyOf: [['chemistry', 'computer-science', 'biology']],
  },
  whenUnmet: 'LOCKED',
  reason: 'Fixture.',
  provenance: prov,
  ...over,
});
const set = (subjects: string[], board: SubjectSet['board'] = 'CBSE'): SubjectSet => ({
  board,
  subjects,
});

describe('evaluateGate', () => {
  it('OPEN when every allOf subject and one from each anyOf group is taken', () => {
    expect(
      evaluateGate(gate(), set(['english', 'physics', 'mathematics', 'computer-science'])),
    ).toEqual({ status: 'OPEN', missingAllOf: [], unmetAnyOf: [] });
  });

  it('LOCKED with the missing subjects named', () => {
    expect(evaluateGate(gate(), set(['english', 'physics', 'economics', 'psychology']))).toEqual({
      status: 'LOCKED',
      missingAllOf: ['mathematics'],
      unmetAnyOf: [['chemistry', 'computer-science', 'biology']],
    });
  });

  it('BRIDGE gates return BRIDGE when unmet', () => {
    const g = gate({ whenUnmet: 'BRIDGE', bridgeNote: 'Fixture bridge.' });
    expect(evaluateGate(g, set(['english', 'psychology', 'economics', 'painting'])).status).toBe(
      'BRIDGE',
    );
  });

  it('an empty requirement is OPEN for any combination', () => {
    const g = gate({ requirement: { allOf: [], anyOf: [] } });
    expect(
      evaluateGate(g, set(['english', 'painting', 'legal-studies', 'political-science'])).status,
    ).toBe('OPEN');
  });
});

describe('evaluateRoute (board-specific gates override the all-boards gate)', () => {
  const allBoards = gate();
  const cisce = gate({ board: 'CISCE', requirement: { allOf: ['mathematics'], anyOf: [] } });

  it('uses the board-specific gate when one exists', () => {
    expect(
      evaluateRoute(
        [allBoards, cisce],
        set(['english', 'mathematics', 'economics', 'commerce'], 'CISCE'),
      )?.status,
    ).toBe('OPEN');
  });

  it('falls back to the all-boards gate', () => {
    expect(
      evaluateRoute(
        [allBoards, cisce],
        set(['english', 'mathematics', 'economics', 'commerce'], 'CBSE'),
      )?.status,
    ).toBe('LOCKED');
  });

  it('returns null when no gate applies (shown as "eligibility not yet reviewed", never assumed open)', () => {
    expect(
      evaluateRoute([cisce], set(['english', 'mathematics', 'economics', 'commerce'], 'CBSE')),
    ).toBeNull();
  });
});
