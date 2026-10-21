import { describe, expect, it } from 'vitest';
import { ChangeEvent, ReviewDecision, SEVERITY_TARGET_HOURS } from './review.ts';

const changeEvent = {
  id: '3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7',
  sourceId: 'sbi-education-loan-rates',
  kind: 'value_changed',
  entity: 'loan_schemes',
  entityKey: 'sbi-student-loan',
  field: 'rate',
  oldValue: { low: 0.1, likely: 0.1, high: 0.1 },
  newValue: { low: 0.11, likely: 0.11, high: 0.11 },
  severity: 'high',
  detectedAt: '2026-10-20T06:00:00Z',
  extraction: {
    extractor: 'sbi-rates-table@1',
    method: 'parser',
    snapshotId: '9b0a1f3e-2f53-4d9b-8a8f-6a1b2c3d4e5f',
    quote: 'fixture quote',
    confidence: 'high',
  },
};

describe('ChangeEvent', () => {
  it('accepts a value change with its extraction evidence', () => {
    expect(ChangeEvent.safeParse(changeEvent).success).toBe(true);
  });

  it('accepts the programme-registry event kinds (05 §5.2)', () => {
    for (const kind of [
      'programme_added',
      'programme_dropped',
      'programme_renamed',
      'programme_moved',
      'intake_changed',
      'fee_changed',
      'institution_relocated',
      'approval_changed',
    ]) {
      expect(ChangeEvent.safeParse({ ...changeEvent, kind }).success).toBe(true);
    }
  });

  it('rejects an LLM extraction with confidence high before approval (05 §6.3)', () => {
    const llm = {
      ...changeEvent,
      extraction: { ...changeEvent.extraction, method: 'llm', confidence: 'high' },
    };
    expect(ChangeEvent.safeParse(llm).success).toBe(false);
  });

  it('rejects an extraction without a quote', () => {
    const noQuote = { ...changeEvent, extraction: { ...changeEvent.extraction, quote: '' } };
    expect(ChangeEvent.safeParse(noQuote).success).toBe(false);
  });
});

describe('ReviewDecision', () => {
  const base = { taskId: changeEvent.id, reviewer: 'owner', decidedAt: '2026-10-20T07:00:00Z' };

  it('approve needs no note', () => {
    expect(ReviewDecision.safeParse({ ...base, decision: 'approve' }).success).toBe(true);
  });

  it('reject and edit require a note', () => {
    expect(ReviewDecision.safeParse({ ...base, decision: 'reject' }).success).toBe(false);
    expect(
      ReviewDecision.safeParse({ ...base, decision: 'reject', note: 'Wrong table' }).success,
    ).toBe(true);
    expect(
      ReviewDecision.safeParse({ ...base, decision: 'edit', note: 'Fix unit', editedValue: 1 })
        .success,
    ).toBe(true);
  });

  it('edit requires the edited value', () => {
    expect(ReviewDecision.safeParse({ ...base, decision: 'edit', note: 'x' }).success).toBe(false);
  });
});

describe('SEVERITY_TARGET_HOURS (05 §8)', () => {
  it('critical 48 h, high 1 week, medium 2 weeks; low has no deadline (next release)', () => {
    expect(SEVERITY_TARGET_HOURS).toEqual({ critical: 48, high: 168, medium: 336, low: null });
  });
});
