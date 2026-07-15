import { vi, describe, test, expect, beforeEach } from 'vitest';

// computedScoreCallback reads all its inputs from store2's session namespace.
// Mock store.session.get to return per-key values from a test-supplied object,
// so each test drives a specific task/stage scenario. (This is roam's analogue
// to levante's scoringHandler test — a unit test over the pure compute path.)
const mockGet = vi.hoisted(() => vi.fn());
vi.mock('store2', () => ({ default: { session: { get: mockGet } } }));

import { computedScoreCallback } from './scores.js';

function mockSession(session) {
  mockGet.mockImplementation((key) => session[key]);
}

describe('computedScoreCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('roam fluency — standard operator subtasks', () => {
    test('emits per-subtask percent/skills and a composite total', () => {
      mockSession({
        config: { taskName: 'fluency-arf', responseMode: 'production' },
        responseModality: false,
        magpiPilot: false,
        assessedSkills: { addition: ['Doubles'] },
        totalCorrect: 8,
        worstFacts: [],
        incorrectSkills: {},
      });

      const computed = computedScoreCallback({
        addition: { test: { numCorrect: 8, numIncorrect: 2, numAttempted: 10 } },
      });

      expect(computed.addition).toMatchObject({
        numCorrect: 8,
        numIncorrect: 2,
        numAttempted: 10,
        rawScore: 8,
        subPercentCorrect: 0.8,
        skillsAssessed: 'Doubles',
      });
      expect(computed.composite).toMatchObject({
        numCorrect: 8,
        numIncorrect: 2,
        numAttempted: 10,
        rawScore: 8,
        subPercentCorrect: 0.8,
      });
      expect(computed.composite.incorrectSkills).toEqual({});
    });
  });

  describe('roam-alpaca', () => {
    test('emits gradeEstimate/supportLevel per subtask and theta/roarScore on composite', () => {
      mockSession({
        config: { taskName: 'roam-alpaca', responseMode: 'production' },
        responseModality: false,
        magpiPilot: false,
        gradeEstimateObject: {
          geometry: { totalAttempted: 10, gradeScore: 4, supportCategory: 'accessible' },
          composite: { gradeScore: 3, supportCategory: 'some support', totalCorrect: 9 },
        },
        thetaEstimateRaw: 0.42,
        thetaEstimate: 0.5,
        skillScores: { skill1: { flag: true }, skill2: { flag: false } },
      });

      const computed = computedScoreCallback({
        geometry: { test: { numCorrect: 9, numIncorrect: 1, numAttempted: 10 } },
      });

      expect(computed.geometry).toMatchObject({
        numCorrect: 9,
        numAttempted: 10,
        rawScore: 9,
        subPercentCorrect: 0.9,
        gradeEstimate: 4,
        supportLevel: 'accessible',
      });
      expect(computed.composite).toMatchObject({
        numCorrect: 9,
        numIncorrect: 1,
        numAttempted: 10,
        thetaEstimate: 0.5,
        thetaEstimateRaw: 0.42,
        roarScore: 533, // Math.round(((0.5 + 6) * 200) / 3 + 100)
        gradeEstimate: 3,
        supportLevel: 'some support',
        incorrectSkills: 'skill1', // only flagged skills, joined
      });
    });

    test('numberLine is a reduced-shape subtask (base counts only, no gradeEstimate)', () => {
      mockSession({
        config: { taskName: 'roam-alpaca', responseMode: 'production' },
        responseModality: false,
        magpiPilot: false,
        gradeEstimateObject: { composite: { gradeScore: 2, supportCategory: 'x', totalCorrect: 6 } },
        thetaEstimateRaw: 0,
        thetaEstimate: 0,
        skillScores: {},
      });

      const computed = computedScoreCallback({
        numberLine: { test: { numCorrect: 6, numIncorrect: 2, numAttempted: 8 } },
      });

      expect(computed.numberLine).toEqual({ numCorrect: 6, numIncorrect: 2, numAttempted: 8, rawScore: 6 });
      expect(computed.numberLine).not.toHaveProperty('gradeEstimate');
      expect(computed.numberLine).not.toHaveProperty('subPercentCorrect');
    });
  });
});
