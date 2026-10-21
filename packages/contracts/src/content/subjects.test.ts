import { describe, expect, it } from 'vitest';
import { assumedProv, sourcedProv } from './fixtures.ts';
import { Board, Gate, Subject, SubjectRequirement, SubjectSet } from './subjects.ts';

describe('Board', () => {
  it('covers CBSE and CISCE for the alpha', () => {
    expect(Board.options).toEqual(['CBSE', 'CISCE']);
  });
});

describe('Subject (catalogue entry, sourced from the board)', () => {
  const subject = {
    key: 'legal-studies',
    board: 'CBSE',
    boardCode: '074',
    name: 'Legal Studies',
    kind: 'elective',
    area: 'humanities-social',
    provenance: sourcedProv({ unit: 'subject' }),
  };

  it('accepts an official subject with its board code', () => {
    expect(Subject.safeParse(subject).success).toBe(true);
  });

  it('requires sourced provenance — subject lists come from the board', () => {
    expect(Subject.safeParse({ ...subject, provenance: assumedProv() }).success).toBe(false);
  });
});

describe('SubjectSet (what the student actually studies)', () => {
  it('accepts 4–8 distinct subject keys', () => {
    expect(
      SubjectSet.safeParse({
        board: 'CBSE',
        subjects: ['english', 'psychology', 'economics', 'legal-studies', 'painting'],
      }).success,
    ).toBe(true);
  });

  it('rejects duplicates', () => {
    expect(
      SubjectSet.safeParse({
        board: 'CBSE',
        subjects: ['english', 'english', 'physics', 'chemistry'],
      }).success,
    ).toBe(false);
  });

  it.each([3, 9])('rejects %d subjects', (n) => {
    const subjects = Array.from({ length: n }, (_, i) => `subject-${String.fromCharCode(97 + i)}`);
    expect(SubjectSet.safeParse({ board: 'CISCE', subjects }).success).toBe(false);
  });
});

describe('SubjectRequirement', () => {
  it('accepts allOf plus anyOf groups', () => {
    expect(
      SubjectRequirement.safeParse({
        allOf: ['physics', 'mathematics'],
        anyOf: [['chemistry', 'biology', 'informatics-practices']],
      }).success,
    ).toBe(true);
  });

  it('accepts an open requirement (any subject combination)', () => {
    expect(SubjectRequirement.safeParse({ allOf: [], anyOf: [] }).success).toBe(true);
  });

  it('rejects an empty anyOf group (it could never be met)', () => {
    expect(SubjectRequirement.safeParse({ allOf: [], anyOf: [[]] }).success).toBe(false);
  });

  it('rejects a minimum percentage outside 0–100', () => {
    expect(
      SubjectRequirement.safeParse({ allOf: [], anyOf: [], minAggregatePercent: 101 }).success,
    ).toBe(false);
  });
});

describe('Gate (rule over subjects → Open / Bridge / Locked)', () => {
  const gate = {
    routeId: 'tec-1-btech',
    requirement: {
      allOf: ['physics', 'mathematics'],
      anyOf: [['chemistry', 'biology', 'computer-science']],
    },
    whenUnmet: 'LOCKED',
    reason: 'Fixture reason.',
    provenance: sourcedProv({ unit: 'gate_rule' }),
  };

  it('accepts a sourced rule that locks when unmet', () => {
    expect(Gate.safeParse(gate).success).toBe(true);
  });

  it('a BRIDGE gate must say what the bridge is', () => {
    expect(Gate.safeParse({ ...gate, whenUnmet: 'BRIDGE' }).success).toBe(false);
    expect(
      Gate.safeParse({ ...gate, whenUnmet: 'BRIDGE', bridgeNote: 'Fixture bridge.' }).success,
    ).toBe(true);
  });

  it('may be scoped to one board', () => {
    expect(Gate.safeParse({ ...gate, board: 'CISCE' }).success).toBe(true);
  });

  it('is never an assumption', () => {
    expect(Gate.safeParse({ ...gate, provenance: assumedProv() }).success).toBe(false);
  });
});
