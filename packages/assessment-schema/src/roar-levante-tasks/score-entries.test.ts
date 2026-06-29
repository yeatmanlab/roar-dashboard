import { describe, it, expect } from 'vitest';
import { toLevanteScoreEntries } from './score-entries.js';
import type { LevanteScoreEntry } from './score-entries.js';
import { LEVANTE_SCORE_DOMAINS } from './domains.js';
import { LEVANTE_SCORE_NAMES } from './score-names.js';

describe('toLevanteScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toLevanteScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toLevanteScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when composite key is absent', () => {
      expect(toLevanteScoreEntries({})).toEqual([]);
    });
  });

  describe('score type assignment', () => {
    it('emits thetaEstimateRaw as type=raw', () => {
      const computed = { composite: { thetaEstimateRaw: 0.42 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'raw',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.THETA_ESTIMATE_RAW,
        value: '0.42',
        assessmentStage: 'test',
      });
    });

    it('emits thetaEstimate as type=computed', () => {
      const computed = { composite: { thetaEstimate: 0.42 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.THETA_ESTIMATE,
        value: '0.42',
        assessmentStage: 'test',
      });
    });

    it('emits thetaSERaw as type=raw', () => {
      const computed = { composite: { thetaSERaw: 0.15 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'raw',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.THETA_SE_RAW,
        value: '0.15',
        assessmentStage: 'test',
      });
    });

    it('emits thetaSE as type=computed', () => {
      const computed = { composite: { thetaSE: 0.15 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.THETA_SE,
        value: '0.15',
        assessmentStage: 'test',
      });
    });

    it('emits normed scores (percentile, standardScore, roarScore) as type=computed', () => {
      const computed = { composite: { percentile: 75, standardScore: 110, roarScore: 32 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.PERCENTILE,
        value: '75',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.STANDARD_SCORE,
        value: '110',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.ROAR_SCORE,
        value: '32',
        assessmentStage: 'test',
      });
    });

    it('emits scoringVersion as type=computed', () => {
      const computed = { composite: { scoringVersion: 1 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
        name: LEVANTE_SCORE_NAMES.SCORING_VERSION,
        value: '1',
        assessmentStage: 'test',
      });
    });
  });

  describe('assessmentStage', () => {
    it('all entries carry assessmentStage=test', () => {
      const computed = {
        composite: { thetaEstimate: 0.5, percentile: 75, standardScore: 110 },
      };
      const entries = toLevanteScoreEntries(computed);

      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.assessmentStage).toBe('test');
      }
    });
  });

  describe('null / undefined field values', () => {
    it('skips fields with null values', () => {
      const computed = { composite: { percentile: null, standardScore: 110 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: LEVANTE_SCORE_NAMES.PERCENTILE }));
      expect(entries).toContainEqual(expect.objectContaining({ name: LEVANTE_SCORE_NAMES.STANDARD_SCORE }));
    });

    it('skips fields with undefined values', () => {
      const computed = { composite: { percentile: undefined, standardScore: 110 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: LEVANTE_SCORE_NAMES.PERCENTILE }));
    });
  });

  describe('value serialization', () => {
    it('converts numeric values to strings', () => {
      const computed = { composite: { percentile: 75.5, scoringVersion: 1 } };
      const entries = toLevanteScoreEntries(computed);

      expect(entries).toContainEqual(expect.objectContaining({ name: LEVANTE_SCORE_NAMES.PERCENTILE, value: '75.5' }));
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LEVANTE_SCORE_NAMES.SCORING_VERSION, value: '1' }),
      );
    });
  });

  describe('full normed output', () => {
    it('maps complete scoring output for a normed levante task', () => {
      const computed = {
        composite: {
          thetaEstimateRaw: 0.42,
          thetaEstimate: 0.42,
          thetaSERaw: 0.15,
          thetaSE: 0.15,
          scoringVersion: 1,
          roarScore: 32,
          standardScore: 110,
          percentile: 75,
        },
      };
      const entries = toLevanteScoreEntries(computed);

      // 2 raw (thetaEstimateRaw, thetaSERaw) + 6 computed (thetaEstimate, thetaSE,
      // scoringVersion, roarScore, standardScore, percentile) = 8 entries
      expect(entries).toHaveLength(8);

      for (const entry of entries) {
        expect(entry.domain).toBe(LEVANTE_SCORE_DOMAINS.COMPOSITE);
      }

      const thetaRaw = entries.find((e: LevanteScoreEntry) => e.name === LEVANTE_SCORE_NAMES.THETA_ESTIMATE_RAW);
      expect(thetaRaw).toMatchObject({ type: 'raw', value: '0.42' });

      const theta = entries.find((e: LevanteScoreEntry) => e.name === LEVANTE_SCORE_NAMES.THETA_ESTIMATE);
      expect(theta).toMatchObject({ type: 'computed', value: '0.42' });

      const percentile = entries.find((e: LevanteScoreEntry) => e.name === LEVANTE_SCORE_NAMES.PERCENTILE);
      expect(percentile).toMatchObject({ type: 'computed', value: '75' });
    });
  });
});
