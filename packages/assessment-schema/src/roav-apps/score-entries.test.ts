import { describe, it, expect } from 'vitest';
import { toRoavAppsScoreEntries } from './score-entries.js';
import { ROAV_APPS_COMPOSITE_SCORE_NAMES } from './score-names.js';
import { ROAV_APPS_SCORE_DOMAINS, ROAV_APPS_STAGE_KEYS } from './domains.js';

const { NUM_ATTEMPTED, NUM_CORRECT, NUM_INCORRECT, THETA_ESTIMATE, THETA_SE } = ROAV_APPS_COMPOSITE_SCORE_NAMES;
const COMPOSITE = ROAV_APPS_SCORE_DOMAINS.COMPOSITE;

describe('toRoavAppsScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toRoavAppsScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toRoavAppsScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when computed is an empty object', () => {
      expect(toRoavAppsScoreEntries({})).toEqual([]);
    });

    it('returns [] when the composite domain has no stage objects', () => {
      expect(toRoavAppsScoreEntries({ [COMPOSITE]: {} })).toEqual([]);
    });

    it('skips a stage whose value is null or not an object', () => {
      expect(toRoavAppsScoreEntries({ [COMPOSITE]: { test: null, practice: 42 } })).toEqual([]);
    });
  });

  describe('composite counts by stage', () => {
    it('emits practice counts as type=raw under the composite domain (stage=practice)', () => {
      const entries = toRoavAppsScoreEntries({
        [COMPOSITE]: { [ROAV_APPS_STAGE_KEYS.PRACTICE]: { numAttempted: 10, numCorrect: 6, numIncorrect: 4 } },
      });

      expect(entries).toHaveLength(3);
      for (const name of [NUM_ATTEMPTED, NUM_CORRECT, NUM_INCORRECT]) {
        expect(entries).toContainEqual(
          expect.objectContaining({ type: 'raw', domain: 'composite', name, assessmentStage: 'practice' }),
        );
      }
    });

    it('emits test counts under the composite domain (stage=test)', () => {
      const entries = toRoavAppsScoreEntries({
        [COMPOSITE]: { [ROAV_APPS_STAGE_KEYS.TEST]: { numAttempted: 84, numCorrect: 45, numIncorrect: 39 } },
      });

      expect(entries).toHaveLength(3);
      expect(entries).toContainEqual({
        type: 'raw',
        domain: 'composite',
        name: NUM_ATTEMPTED,
        value: '84',
        assessmentStage: 'test',
      });
    });

    it('emits both practice and test stages from one composite payload (roav-rvp screenshot values)', () => {
      const entries = toRoavAppsScoreEntries({
        [COMPOSITE]: {
          practice: { numAttempted: 10, numCorrect: 6, numIncorrect: 4, thetaEstimate: null, thetaSE: null },
          test: { numAttempted: 84, numCorrect: 45, numIncorrect: 39, thetaEstimate: null, thetaSE: null },
        },
      });

      // 3 counts × 2 stages; null theta contributes nothing.
      expect(entries).toHaveLength(6);
      expect(entries.filter((e) => e.assessmentStage === 'practice')).toHaveLength(3);
      expect(entries.filter((e) => e.assessmentStage === 'test')).toHaveLength(3);
      expect(entries.every((e) => e.domain === 'composite')).toBe(true);
    });

    it('converts numeric values to strings', () => {
      const entries = toRoavAppsScoreEntries({ [COMPOSITE]: { test: { numCorrect: 38 } } });
      expect(entries[0]!.value).toBe('38');
      expect(typeof entries[0]!.value).toBe('string');
    });
  });

  describe('theta handling', () => {
    it('skips null thetaEstimate / thetaSE (the current roav-apps behavior)', () => {
      const entries = toRoavAppsScoreEntries({
        [COMPOSITE]: {
          test: { numAttempted: 51, numCorrect: 38, numIncorrect: 13, thetaEstimate: null, thetaSE: null },
        },
      });

      expect(entries).toHaveLength(3);
      expect(entries.some((e) => e.name === THETA_ESTIMATE || e.name === THETA_SE)).toBe(false);
    });

    it('emits thetaEstimate / thetaSE as type=computed when present (future CAT variant)', () => {
      const entries = toRoavAppsScoreEntries({ [COMPOSITE]: { test: { thetaEstimate: 0.5, thetaSE: 0.2 } } });

      expect(entries).toContainEqual(
        expect.objectContaining({ name: THETA_ESTIMATE, type: 'computed', value: '0.5', assessmentStage: 'test' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: THETA_SE, type: 'computed', value: '0.2', assessmentStage: 'test' }),
      );
    });
  });

  describe('strict mode', () => {
    it('throws on an unrecognized top-level domain', () => {
      expect(() => toRoavAppsScoreEntries({ bogus: { test: { numAttempted: 1 } } }, { strict: true })).toThrow(/bogus/);
    });

    it('throws on an unrecognized nested stage key', () => {
      expect(() => toRoavAppsScoreEntries({ [COMPOSITE]: { warmup: { numAttempted: 1 } } }, { strict: true })).toThrow(
        /warmup/,
      );
    });

    it('does not throw on composite with practice/test stages', () => {
      expect(() =>
        toRoavAppsScoreEntries(
          { [COMPOSITE]: { practice: { numAttempted: 1 }, test: { numAttempted: 2 } } },
          { strict: true },
        ),
      ).not.toThrow();
    });

    it('does not throw on unrecognized keys when strict is off', () => {
      expect(() => toRoavAppsScoreEntries({ [COMPOSITE]: { warmup: { numAttempted: 1 } } })).not.toThrow();
    });
  });
});
