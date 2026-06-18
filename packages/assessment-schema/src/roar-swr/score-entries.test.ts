import { describe, it, expect } from 'vitest';
import { toSwrScoreEntries } from './score-entries.js';
import type { SwrScoreEntry } from './score-entries.js';
import { SWR_SCORE_DOMAINS } from './domains.js';
import { SWR_SCORE_NAMES } from './score-names.js';

describe('toSwrScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toSwrScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toSwrScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when composite key is absent', () => {
      expect(toSwrScoreEntries({})).toEqual([]);
    });
  });

  describe('score type assignment', () => {
    it('emits thetaEstimate as type=computed', () => {
      const computed = { composite: { thetaEstimate: 0.42 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.THETA_ESTIMATE,
        value: '0.42',
        assessmentStage: 'test',
      });
    });

    it('emits thetaEstimateRaw as type=raw', () => {
      const computed = { composite: { thetaEstimateRaw: 0.42 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'raw',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.THETA_ESTIMATE_RAW,
        value: '0.42',
        assessmentStage: 'test',
      });
    });

    it('emits thetaEstimateRaw (raw) and thetaEstimate (computed) with equal values when SWR is the reference scale', () => {
      const computed = { composite: { thetaEstimateRaw: 0.42, thetaEstimate: 0.42 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SWR_SCORE_NAMES.THETA_ESTIMATE_RAW, type: 'raw', value: '0.42' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SWR_SCORE_NAMES.THETA_ESTIMATE, type: 'computed', value: '0.42' }),
      );
    });

    it('emits normed scores (percentile, standardScore, roarScore) as type=computed', () => {
      const computed = { composite: { percentile: 75, standardScore: 110, roarScore: 32 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.PERCENTILE,
        value: '75',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.STANDARD_SCORE,
        value: '110',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.RAW_SCORE,
        value: '32',
        assessmentStage: 'test',
      });
    });

    it('emits legacy wjPercentile as type=computed', () => {
      const computed = { composite: { wjPercentile: 70 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.WJ_PERCENTILE,
        value: '70',
        assessmentStage: 'test',
      });
    });

    it('emits raw counts (numCorrect, numAttempted, numIncorrect, percentCorrect) as type=raw', () => {
      const computed = {
        composite: { numCorrect: 20, numAttempted: 25, numIncorrect: 5, percentCorrect: 80 },
      };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'raw',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.NUM_CORRECT,
        value: '20',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'raw',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.NUM_ATTEMPTED,
        value: '25',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'raw',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.NUM_INCORRECT,
        value: '5',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'raw',
        domain: SWR_SCORE_DOMAINS.COMPOSITE,
        name: SWR_SCORE_NAMES.PERCENT_CORRECT,
        value: '80',
        assessmentStage: 'test',
      });
    });
  });

  describe('assessmentStage', () => {
    it('all entries carry assessmentStage=test', () => {
      const computed = {
        composite: { thetaEstimate: 0.5, percentile: 75, standardScore: 110, numCorrect: 20 },
      };
      const entries = toSwrScoreEntries(computed);

      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.assessmentStage).toBe('test');
      }
    });
  });

  describe('null / undefined field values', () => {
    it('skips fields with null values', () => {
      const computed = { composite: { percentile: null, standardScore: 110 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: SWR_SCORE_NAMES.PERCENTILE }));
      expect(entries).toContainEqual(expect.objectContaining({ name: SWR_SCORE_NAMES.STANDARD_SCORE }));
    });

    it('skips fields with undefined values', () => {
      const computed = { composite: { percentile: undefined, standardScore: 110 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: SWR_SCORE_NAMES.PERCENTILE }));
    });
  });

  describe('value serialization', () => {
    it('converts numeric values to strings', () => {
      const computed = { composite: { percentile: 75.5, numCorrect: 20 } };
      const entries = toSwrScoreEntries(computed);

      expect(entries).toContainEqual(expect.objectContaining({ name: SWR_SCORE_NAMES.PERCENTILE, value: '75.5' }));
      expect(entries).toContainEqual(expect.objectContaining({ name: SWR_SCORE_NAMES.NUM_CORRECT, value: '20' }));
    });
  });

  describe('strict mode', () => {
    it('does not throw on composite key in strict mode', () => {
      const computed = { composite: { percentile: 75 } };
      expect(() => toSwrScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('throws on unrecognized domain key in strict mode', () => {
      const computed = { composite: { percentile: 75 }, unknown_domain: { someScore: 100 } };
      expect(() => toSwrScoreEntries(computed, { strict: true })).toThrow(/unknown_domain/);
    });

    it('does not throw on unrecognized domain key in non-strict mode', () => {
      const computed = { composite: { percentile: 75 }, unknown_domain: { someScore: 100 } };
      expect(() => toSwrScoreEntries(computed, { strict: false })).not.toThrow();
    });
  });

  describe('full normed output (English / Spanish)', () => {
    it('maps complete scoring output for a normed language variant', () => {
      const computed = {
        composite: {
          thetaEstimateRaw: 0.42,
          thetaEstimate: 0.42,
          percentile: 75,
          standardScore: 110,
          roarScore: 32,
          numCorrect: 20,
          numAttempted: 25,
          numIncorrect: 5,
          percentCorrect: 80,
        },
      };
      const entries = toSwrScoreEntries(computed);

      // 4 computed (thetaEstimate, percentile, standardScore, roarScore) +
      // 5 raw (thetaEstimateRaw, numCorrect, numAttempted, numIncorrect, percentCorrect) = 9 entries
      expect(entries).toHaveLength(9);

      // All entries have correct domain
      for (const entry of entries) {
        expect(entry.domain).toBe(SWR_SCORE_DOMAINS.COMPOSITE);
      }

      // Type assertions spot-check
      const thetaRaw = entries.find((e: SwrScoreEntry) => e.name === SWR_SCORE_NAMES.THETA_ESTIMATE_RAW);
      expect(thetaRaw).toMatchObject({ type: 'raw', value: '0.42' });

      const theta = entries.find((e: SwrScoreEntry) => e.name === SWR_SCORE_NAMES.THETA_ESTIMATE);
      expect(theta).toMatchObject({ type: 'computed', value: '0.42' });

      const numCorrect = entries.find((e: SwrScoreEntry) => e.name === SWR_SCORE_NAMES.NUM_CORRECT);
      expect(numCorrect).toMatchObject({ type: 'raw', value: '20' });
    });
  });
});
