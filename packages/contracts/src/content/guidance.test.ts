import { describe, expect, it } from 'vitest';
import { sourcedProv } from './fixtures.ts';
import { AiExposure, ExamDate, Quest } from './guidance.ts';

describe('ExamDate (05 §5.4)', () => {
  it('requires a source for official dates', () => {
    const official = {
      examId: 'jee-main',
      event: 'registration_opens',
      date: '2026-11-01',
      status: 'official',
    };
    expect(ExamDate.safeParse(official).success).toBe(false);
    expect(
      ExamDate.safeParse({ ...official, provenance: sourcedProv({ unit: 'date' }) }).success,
    ).toBe(true);
  });

  it('labels projected dates as expected with the basis', () => {
    const expected = {
      examId: 'jee-main',
      event: 'registration_opens',
      date: '2027-11-01',
      status: 'expected',
      basis: 'Projected from 2026 pattern',
    };
    expect(ExamDate.safeParse(expected).success).toBe(true);
  });
});

describe('Quest (02 §6)', () => {
  const quest = {
    id: 'psy-1-quest-1',
    careerId: 'psy-1',
    title: 'Fixture quest',
    goal: 'Notice what you enjoy.',
    steps: ['One', 'Two', 'Three'],
    timeNeeded: '1 week',
    whatToNotice: 'Which part felt easy?',
    reflections: [
      { prompt: 'Q1', options: ['A', 'B'] },
      { prompt: 'Q2', options: ['A', 'B', 'C'] },
    ],
    safety: { needsParentHelp: false },
  };

  it('accepts 3–5 steps and exactly two tap-based reflections', () => {
    expect(Quest.safeParse(quest).success).toBe(true);
  });

  it.each([2, 6])('rejects %d steps', (n) => {
    expect(
      Quest.safeParse({ ...quest, steps: Array.from({ length: n }, (_, i) => `s${i}`) }).success,
    ).toBe(false);
  });

  it('rejects free-text reflections (no free text from minors in the alpha)', () => {
    const freeText = {
      ...quest,
      reflections: [{ prompt: 'Q1', freeText: true }, quest.reflections[1]],
    };
    expect(Quest.safeParse(freeText).success).toBe(false);
  });
});

describe('AiExposure — ADR 008: two lenses, never one score', () => {
  const exposure = {
    careerId: 'tec-1',
    lensA: {
      source: 'ilo-2025',
      gradient: 'gradient_3',
      isco08: ['2512'],
      manyToOne: false,
      provenance: sourcedProv({ unit: 'ilo_gradient' }),
    },
    lensB: {
      source: 'anthropic-economic-index',
      releaseDate: '2026-09-01',
      automationShare: 0.4,
      augmentationShare: 0.6,
      provenance: sourcedProv({ unit: 'share' }),
    },
    whatsChanging: 'Reviewed paragraph.',
    skillsThatStay: ['Problem framing'],
  };

  it('accepts both lenses with their own provenance', () => {
    expect(AiExposure.safeParse(exposure).success).toBe(true);
  });

  it('rejects a combined score field', () => {
    expect(AiExposure.safeParse({ ...exposure, score: 0.5 }).success).toBe(false);
  });

  it('rejects automation + augmentation shares above 1', () => {
    const bad = {
      ...exposure,
      lensB: { ...exposure.lensB, automationShare: 0.7, augmentationShare: 0.6 },
    };
    expect(AiExposure.safeParse(bad).success).toBe(false);
  });
});
