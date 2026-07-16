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

  describe('single non-composite subtask (no composite key)', () => {
    test('response-modality FR only: builds a composite instead of reading undefined.rawScore', () => {
      mockSession({
        config: { taskName: 'fluency-arf', responseMode: 'production' },
        responseModality: true,
        trialNumTotalProduction: 10,
        totalCorrect: 7,
      });

      // Only the FR subtask is populated, so at the branch check computedScores is
      // length 1 with no 'composite' key. Before the `!Object.hasOwn(computedScores,
      // COMPOSITE_DOMAIN)` guard, length===1 fell through to the else branch and read
      // `computedScores.composite.rawScore` → undefined.rawScore → threw.
      let computed;
      expect(() => {
        computed = computedScoreCallback({ FR: { test: { numCorrect: 7, numIncorrect: 3, numAttempted: 10 } } });
      }).not.toThrow();

      expect(computed.FR).toMatchObject({ numCorrect: 7, numIncorrect: 3, numAttempted: 10, rawScore: 7 });
      // Composite is derived from the response-modality path (totalCorrect + FR totals),
      // not read blindly off a non-existent composite key.
      expect(computed.composite).toMatchObject({ numCorrect: 7, numIncorrect: 3, numAttempted: 10, rawScore: 7 });
    });
  });
});
