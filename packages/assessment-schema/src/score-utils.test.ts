import { describe, it, expect } from 'vitest';
import { buildRawCountEntries } from './score-utils.js';
import { TRIAL_COUNT_SCORE_NAMES } from './constants/trial-count-score-names.js';
import { AssessmentStage } from './enums/assessment-stage.enum.js';

describe('buildRawCountEntries', () => {
  it('returns three entries with correct shape for typical counts', () => {
    const entries = buildRawCountEntries(
      'composite',
      { numCorrect: 10, numAttempted: 15, numIncorrect: 5 },
      AssessmentStage.PRACTICE,
    );

    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual({
      type: 'raw',
      domain: 'composite',
      name: TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT,
      value: '10',
      assessmentStage: AssessmentStage.PRACTICE,
    });
    expect(entries).toContainEqual({
      type: 'raw',
      domain: 'composite',
      name: TRIAL_COUNT_SCORE_NAMES.NUM_ATTEMPTED,
      value: '15',
      assessmentStage: AssessmentStage.PRACTICE,
    });
    expect(entries).toContainEqual({
      type: 'raw',
      domain: 'composite',
      name: TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT,
      value: '5',
      assessmentStage: AssessmentStage.PRACTICE,
    });
  });

  it('propagates the domain to all entries', () => {
    const entries = buildRawCountEntries(
      'FSM',
      { numCorrect: 3, numAttempted: 5, numIncorrect: 2 },
      AssessmentStage.PRACTICE,
    );

    for (const entry of entries) {
      expect(entry.domain).toBe('FSM');
    }
  });

  it('propagates the stage to all entries', () => {
    const entries = buildRawCountEntries(
      'composite',
      { numCorrect: 5, numAttempted: 5, numIncorrect: 0 },
      AssessmentStage.TEST,
    );

    for (const entry of entries) {
      expect(entry.assessmentStage).toBe(AssessmentStage.TEST);
    }
  });

  it('serializes zero counts as string "0"', () => {
    const entries = buildRawCountEntries(
      'composite',
      { numCorrect: 0, numAttempted: 0, numIncorrect: 0 },
      AssessmentStage.PRACTICE,
    );

    for (const entry of entries) {
      expect(entry.value).toBe('0');
    }
  });
});
