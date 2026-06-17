import { describe, it, expect } from 'vitest';
import { toSreScoreEntries } from './score-entries.js';
import type { SreScoreEntry } from './score-entries.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { COMPOSITE_DOMAIN, PRACTICE_DOMAIN } from '../constants/common-domains.js';
import { SRE_COMPOSITE_SCORE_NAMES, SRE_SUBTASK_DOMAINS, SRE_SUBTASK_SCORE_NAMES } from './score-names.js';

describe('toSreScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toSreScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toSreScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when computed is an empty object', () => {
      expect(toSreScoreEntries({})).toEqual([]);
    });
  });

  describe('composite domain', () => {
    it('emits sreScore as type=computed', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual({
        type: ScoreType.COMPUTED,
        domain: COMPOSITE_DOMAIN,
        name: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE,
        value: '10',
        assessmentStage: AssessmentStage.TEST,
      });
    });

    it('emits normed scores (percentile, standardScore) as type=computed for v4/v5', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 15, percentile: 72, standardScore: 108 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE, type: ScoreType.COMPUTED, value: '72' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE,
          type: ScoreType.COMPUTED,
          value: '108',
        }),
      );
    });

    it('emits legacy TOSREC scores for v3 grade < 6', () => {
      const computed = {
        [COMPOSITE_DOMAIN]: { sreScore: 12, tosrecPercentile: 65, tosrecSS: 105, scoringVersion: 3 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.TOSREC_PERCENTILE,
          type: ScoreType.COMPUTED,
          value: '65',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.TOSREC_SS, type: ScoreType.COMPUTED, value: '105' }),
      );
    });

    it('emits legacy SPR scores for v3 grade >= 6', () => {
      const computed = {
        [COMPOSITE_DOMAIN]: { sreScore: 18, sprPercentile: 80, sprStandardScore: 113, scoringVersion: 3 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.SPR_PERCENTILE,
          type: ScoreType.COMPUTED,
          value: '80',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.SPR_STANDARD_SCORE,
          type: ScoreType.COMPUTED,
          value: '113',
        }),
      );
    });

    it('emits scoringVersion as type=computed', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10, scoringVersion: 5 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.SCORING_VERSION,
          type: ScoreType.COMPUTED,
          value: '5',
        }),
      );
    });

    it('skips null values in composite domain', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10, percentile: null, standardScore: undefined } };
      const entries = toSreScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE }));
      expect(entries).not.toContainEqual(expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }));
      expect(entries).toContainEqual(expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE }));
    });
  });

  describe('non-composite domains', () => {
    it('emits only sreScore for the practice domain', () => {
      const computed = { [PRACTICE_DOMAIN]: { sreScore: 3 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: ScoreType.COMPUTED,
        domain: PRACTICE_DOMAIN,
        name: SRE_SUBTASK_SCORE_NAMES.SRE_SCORE,
        value: '3',
        assessmentStage: AssessmentStage.PRACTICE,
      });
    });

    it('emits only sreScore for the lab domain', () => {
      const computed = { [SRE_SUBTASK_DOMAINS.LAB]: { sreScore: 8 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        domain: SRE_SUBTASK_DOMAINS.LAB,
        name: SRE_SUBTASK_SCORE_NAMES.SRE_SCORE,
        value: '8',
        assessmentStage: AssessmentStage.TEST,
      });
    });

    it('emits only sreScore for the ai domain', () => {
      const computed = { [SRE_SUBTASK_DOMAINS.AI]: { sreScore: 6 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        domain: SRE_SUBTASK_DOMAINS.AI,
        name: SRE_SUBTASK_SCORE_NAMES.SRE_SCORE,
        value: '6',
        assessmentStage: AssessmentStage.TEST,
      });
    });

    it('skips non-composite domain when sreScore is null', () => {
      const computed = { [SRE_SUBTASK_DOMAINS.LAB]: { sreScore: null } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(0);
    });
  });

  describe('assessmentStage', () => {
    it('assigns practice stage to the practice domain', () => {
      const computed = { [PRACTICE_DOMAIN]: { sreScore: 3 } };
      const entries = toSreScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe(AssessmentStage.PRACTICE);
    });

    it('assigns test stage to the composite domain', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10 } };
      const entries = toSreScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe(AssessmentStage.TEST);
    });

    it('assigns test stage to all non-practice, non-composite domains', () => {
      const computed = { [SRE_SUBTASK_DOMAINS.LAB]: { sreScore: 8 }, [SRE_SUBTASK_DOMAINS.AI]: { sreScore: 5 } };
      const entries = toSreScoreEntries(computed);

      for (const entry of entries) {
        expect(entry.assessmentStage).toBe(AssessmentStage.TEST);
      }
    });
  });

  describe('all domains emitted together', () => {
    it('emits entries for all domains present in computed (practice + composite + lab)', () => {
      const computed = {
        [PRACTICE_DOMAIN]: { sreScore: 3 },
        [SRE_SUBTASK_DOMAINS.LAB]: { sreScore: 12 },
        [COMPOSITE_DOMAIN]: { sreScore: 12, percentile: 75, standardScore: 110, scoringVersion: 5 },
      };
      const entries = toSreScoreEntries(computed);

      // practice: 1 entry (sreScore)
      // lab: 1 entry (sreScore)
      // composite: 4 entries (sreScore, percentile, standardScore, scoringVersion)
      expect(entries).toHaveLength(6);

      expect(entries.filter((e: SreScoreEntry) => e.domain === PRACTICE_DOMAIN)).toHaveLength(1);
      expect(entries.filter((e: SreScoreEntry) => e.domain === SRE_SUBTASK_DOMAINS.LAB)).toHaveLength(1);
      expect(entries.filter((e: SreScoreEntry) => e.domain === COMPOSITE_DOMAIN)).toHaveLength(4);
    });
  });

  describe('value serialization', () => {
    it('converts numeric values to strings', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10.5 }, [PRACTICE_DOMAIN]: { sreScore: 3 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE, domain: COMPOSITE_DOMAIN, value: '10.5' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_SUBTASK_SCORE_NAMES.SRE_SCORE, domain: PRACTICE_DOMAIN, value: '3' }),
      );
    });
  });

  describe('strict mode', () => {
    it('does not throw on recognized composite score names in strict mode', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10, percentile: 75 } };
      expect(() => toSreScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('throws on unrecognized composite score name in strict mode', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10, unknownScore: 99 } };
      expect(() => toSreScoreEntries(computed, { strict: true })).toThrow(/unknownScore/);
    });

    it('does not throw on unrecognized composite score name in non-strict mode', () => {
      const computed = { [COMPOSITE_DOMAIN]: { sreScore: 10, unknownScore: 99 } };
      expect(() => toSreScoreEntries(computed, { strict: false })).not.toThrow();
    });

    it('does not throw on unrecognized non-composite domains in strict mode', () => {
      // Strict only checks composite field names, not domain keys
      const computed = { newDomain: { sreScore: 5 }, [COMPOSITE_DOMAIN]: { sreScore: 10 } };
      expect(() => toSreScoreEntries(computed, { strict: true })).not.toThrow();
    });
  });

  describe('full normed output (English v5)', () => {
    it('maps complete scoring output for a v5 English variant', () => {
      const computed = {
        [PRACTICE_DOMAIN]: { sreScore: 3 },
        [SRE_SUBTASK_DOMAINS.LAB]: { sreScore: 12 },
        [SRE_SUBTASK_DOMAINS.AI]: { sreScore: 10 },
        [COMPOSITE_DOMAIN]: {
          sreScore: 12,
          percentile: 78,
          standardScore: 112,
          scoringVersion: 5,
        },
      };
      const entries = toSreScoreEntries(computed);

      // practice: 1 (sreScore only), lab: 1 (sreScore only), ai: 1 (sreScore only), composite: 4 = 7
      expect(entries).toHaveLength(7);

      const compositeEntries = entries.filter((e: SreScoreEntry) => e.domain === COMPOSITE_DOMAIN);
      expect(compositeEntries).toHaveLength(4);
      for (const entry of compositeEntries) {
        expect(entry.type).toBe(ScoreType.COMPUTED);
        expect(entry.assessmentStage).toBe(AssessmentStage.TEST);
      }

      const practiceEntry = entries.find((e: SreScoreEntry) => e.domain === PRACTICE_DOMAIN);
      expect(practiceEntry).toMatchObject({
        assessmentStage: AssessmentStage.PRACTICE,
        type: ScoreType.COMPUTED,
        value: '3',
      });
    });
  });

  describe('raw trial counts', () => {
    it('emits numCorrect, numIncorrect, numAttempted as type=raw in composite domain', () => {
      const computed = {
        [COMPOSITE_DOMAIN]: { sreScore: 8, numCorrect: 10, numIncorrect: 2, numAttempted: 12 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.NUM_CORRECT, type: ScoreType.RAW, value: '10' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.NUM_INCORRECT, type: ScoreType.RAW, value: '2' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED, type: ScoreType.RAW, value: '12' }),
      );
    });

    it('emits numCorrect, numIncorrect, numAttempted as type=raw for non-composite domains', () => {
      const computed = {
        [SRE_SUBTASK_DOMAINS.LAB]: { sreScore: 8, numCorrect: 10, numIncorrect: 2, numAttempted: 12 },
        [SRE_SUBTASK_DOMAINS.TEST1]: { sreScore: 5, numCorrect: 7, numIncorrect: 2, numAttempted: 9 },
        [PRACTICE_DOMAIN]: { sreScore: 2, numCorrect: 3, numIncorrect: 1, numAttempted: 4 },
      };
      const entries = toSreScoreEntries(computed);

      const labEntries = entries.filter((e: SreScoreEntry) => e.domain === SRE_SUBTASK_DOMAINS.LAB);
      expect(labEntries).toHaveLength(4); // sreScore + 3 counts
      expect(labEntries.find((e) => e.name === SRE_SUBTASK_SCORE_NAMES.SRE_SCORE)?.type).toBe(ScoreType.COMPUTED);
      expect(labEntries.find((e) => e.name === SRE_SUBTASK_SCORE_NAMES.NUM_CORRECT)?.type).toBe(ScoreType.RAW);
      expect(labEntries.find((e) => e.name === SRE_SUBTASK_SCORE_NAMES.NUM_INCORRECT)?.type).toBe(ScoreType.RAW);
      expect(labEntries.find((e) => e.name === SRE_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED)?.type).toBe(ScoreType.RAW);

      const practiceEntries = entries.filter((e: SreScoreEntry) => e.domain === PRACTICE_DOMAIN);
      expect(practiceEntries).toHaveLength(4);
      for (const entry of practiceEntries) {
        expect(entry.assessmentStage).toBe(AssessmentStage.PRACTICE);
      }
    });

    it('sreScore stays type=computed even when counts are present', () => {
      const computed = {
        [COMPOSITE_DOMAIN]: { sreScore: 10, numCorrect: 12, numIncorrect: 2, numAttempted: 14 },
      };
      const entries = toSreScoreEntries(computed);

      const sreEntry = entries.find((e: SreScoreEntry) => e.name === SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE);
      expect(sreEntry?.type).toBe(ScoreType.COMPUTED);
    });
  });

  describe('theta scores', () => {
    it('emits thetaEstimateRaw and thetaSERaw as type=raw', () => {
      const computed = {
        [COMPOSITE_DOMAIN]: { sreScore: 10, thetaEstimateRaw: 1.2, thetaSERaw: 0.3 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
          type: ScoreType.RAW,
          value: '1.2',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.THETA_SE_RAW, type: ScoreType.RAW, value: '0.3' }),
      );
    });

    it('emits thetaEstimate and thetaSE as type=computed', () => {
      const computed = {
        [COMPOSITE_DOMAIN]: { sreScore: 10, thetaEstimate: 1.2, thetaSE: 0.3 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          name: SRE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE,
          type: ScoreType.COMPUTED,
          value: '1.2',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.THETA_SE, type: ScoreType.COMPUTED, value: '0.3' }),
      );
    });
  });
});
