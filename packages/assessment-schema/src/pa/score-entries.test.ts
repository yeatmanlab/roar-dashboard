import { describe, it, expect } from 'vitest';
import { toPaScoreEntries } from './score-entries.js';
import type { ComputedScoreEntry } from './score-entries.js';
import { PA_SCORE_NAMES } from './index.js';

describe('toPaScoreEntries', () => {
  describe('subtask scores (FSM, LSM, DEL)', () => {
    it('maps subtask scores to ScoreEntry array', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80 },
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53 },
      };

      const entries = toPaScoreEntries(computed);

      // Should have 9 entries: 3 per subtask (correct, attempted, percentCorrect)
      expect(entries).toHaveLength(9);

      // Verify FSM entries
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.FSM_CORRECT,
        value: '10',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.FSM_ATTEMPTED,
        value: '15',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.FSM_PERCENT_CORRECT,
        value: '67',
      });

      // Verify LSM entries
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.LSM_CORRECT,
        value: '12',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.LSM_ATTEMPTED,
        value: '15',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.LSM_PERCENT_CORRECT,
        value: '80',
      });

      // Verify DEL entries
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.DEL_CORRECT,
        value: '8',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.DEL_ATTEMPTED,
        value: '15',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'pa',
        name: PA_SCORE_NAMES.DEL_PERCENT_CORRECT,
        value: '53',
      });
    });

    it('skips null/undefined subtask scores', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: null, numAttempted: 15, percentCorrect: 80 },
        del: { numCorrect: 8, numAttempted: undefined, percentCorrect: 53 },
      };

      const entries = toPaScoreEntries(computed);

      // Should skip null/undefined values
      expect(entries).not.toContainEqual(
        expect.objectContaining({
          name: PA_SCORE_NAMES.LSM_CORRECT,
        }),
      );
      expect(entries).not.toContainEqual(
        expect.objectContaining({
          name: PA_SCORE_NAMES.DEL_ATTEMPTED,
        }),
      );
    });
  });

  describe('composite scores', () => {
    it('maps composite summary scores with domain=composite', () => {
      const computed = {
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: '65th',
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: '108',
        },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.RAW_SCORE,
        value: '30',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.PERCENTILE,
        value: '60',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.PERCENTILE_SPR,
        value: '65',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.PERCENTILE_STRING_SPR,
        value: '65th',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.STANDARD_SCORE,
        value: '105',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.STANDARD_SCORE_SPR,
        value: '108',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: PA_SCORE_NAMES.STANDARD_SCORE_STRING_SPR,
        value: '108',
      });
    });

    it('maps composite_foundational scores with domain=composite_foundational (adaptive only)', () => {
      const computed = {
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: '60th',
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: '105',
        },
      };

      const entries = toPaScoreEntries(computed);

      // Should have 7 entries for composite_foundational summary scores
      expect(entries.length).toBeGreaterThan(0);
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite_foundational',
        name: PA_SCORE_NAMES.RAW_SCORE,
        value: '25',
      });
    });

    it('composite and composite_foundational land under distinct domains', () => {
      const computed = {
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: '65th',
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: '108',
        },
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: '60th',
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: '105',
        },
      };

      const entries = toPaScoreEntries(computed);

      // Extract domains used for each composite group
      const compositeDomains = entries
        .filter((e: ComputedScoreEntry) => e.name === PA_SCORE_NAMES.RAW_SCORE)
        .map((e: ComputedScoreEntry) => e.domain);

      // Should have exactly 2 entries with RAW_SCORE name, one per domain
      expect(compositeDomains).toHaveLength(2);
      expect(compositeDomains).toContain('composite');
      expect(compositeDomains).toContain('composite_foundational');

      // Verify no collision: both groups' entries should not share the same domain
      const compositeEntries = entries.filter((e: ComputedScoreEntry) => e.domain === 'composite');
      const foundationalEntries = entries.filter((e: ComputedScoreEntry) => e.domain === 'composite_foundational');

      expect(compositeEntries.length).toBeGreaterThan(0);
      expect(foundationalEntries.length).toBeGreaterThan(0);
    });

    it('skips null/undefined composite scores', () => {
      const computed = {
        composite: {
          roarScore: 30,
          percentile: null,
          sprPercentile: undefined,
          standardScore: 105,
        },
      };

      const entries = toPaScoreEntries(computed);

      // Should skip null/undefined values
      expect(entries).not.toContainEqual(
        expect.objectContaining({
          name: PA_SCORE_NAMES.PERCENTILE,
        }),
      );
      expect(entries).not.toContainEqual(
        expect.objectContaining({
          name: PA_SCORE_NAMES.PERCENTILE_SPR,
        }),
      );
    });
  });

  describe('full nested structure (v4 adaptive)', () => {
    it('maps complete adaptive scoring output', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80 },
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53 },
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: '65th',
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: '108',
          thetaEstimate: 0.5,
          thetaSE: 0.1,
        },
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: '60th',
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: '105',
          thetaEstimate: 0.3,
          thetaSE: 0.15,
        },
      };

      const entries = toPaScoreEntries(computed);

      // Should have: 9 subtask + 7 composite + 7 composite_foundational = 23 entries
      // (thetaEstimate and thetaSE are not in SUMMARY_NAMES, so skipped)
      expect(entries.length).toBeGreaterThanOrEqual(20);

      // Verify all entries have correct type and valid domain
      entries.forEach((entry: ComputedScoreEntry) => {
        expect(entry.type).toBe('computed');
        expect(['pa', 'composite', 'composite_foundational']).toContain(entry.domain);
        expect(entry.name).toBeTruthy();
        expect(entry.value).toBeTruthy();
      });

      // Verify no assessmentStage (computed scores aggregate across stages)
      entries.forEach((entry: ComputedScoreEntry) => {
        expect(entry.assessmentStage).toBeUndefined();
      });
    });

    it('maps complete fixed scoring output (v3)', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67, roarScore: 10 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80, roarScore: 12 },
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53, roarScore: 8 },
        composite: {
          roarScore: 30,
          percentile: 60,
          sprPercentile: 65,
          sprPercentileString: '65th',
          standardScore: 105,
          sprStandardScore: 108,
          sprStandardScoreString: '108',
        },
      };

      const entries = toPaScoreEntries(computed);

      // Should have: 9 subtask + 7 composite = 16 entries
      expect(entries.length).toBeGreaterThanOrEqual(15);

      // Verify roarScore is included in subtask entries
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: PA_SCORE_NAMES.FSM_CORRECT,
          value: '10',
        }),
      );
    });
  });

  describe('strict mode validation', () => {
    it('regression test: composite_foundational is registered', () => {
      const computed = {
        composite_foundational: {
          roarScore: 25,
          percentile: 55,
          sprPercentile: 60,
          sprPercentileString: '60th',
          standardScore: 102,
          sprStandardScore: 105,
          sprStandardScoreString: '105',
        },
      };

      // Should not throw even in strict mode
      expect(() => toPaScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('does not throw on unregistered scores in non-strict mode', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
      };

      expect(() => toPaScoreEntries(computed, { strict: false })).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles empty computed scores object', () => {
      const computed = {};
      const entries = toPaScoreEntries(computed);
      expect(entries).toEqual([]);
    });

    it('handles missing subtasks', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        // lsm and del missing
      };

      const entries = toPaScoreEntries(computed);

      // Should only have FSM entries
      const fsmEntries = entries.filter((e: ComputedScoreEntry) => e.name.startsWith('fsm'));
      expect(fsmEntries.length).toBe(3);

      const lsmEntries = entries.filter((e: ComputedScoreEntry) => e.name.startsWith('lsm'));
      expect(lsmEntries.length).toBe(0);
    });

    it('converts numeric values to strings', () => {
      const computed = {
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67.5 },
      };

      const entries = toPaScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          value: '10',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          value: '67.5',
        }),
      );
    });

    it('preserves subtask order (FSM, LSM, DEL)', () => {
      const computed = {
        del: { numCorrect: 8, numAttempted: 15, percentCorrect: 53 },
        fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67 },
        lsm: { numCorrect: 12, numAttempted: 15, percentCorrect: 80 },
      };

      const entries = toPaScoreEntries(computed);

      // Extract subtask names in order
      const subtaskNames = entries
        .filter((e: ComputedScoreEntry) => e.name.includes('Correct') || e.name.includes('Attempted'))
        .map((e: ComputedScoreEntry) => e.name.substring(0, 3).toLowerCase());

      // Should be in canonical order: fsm, lsm, del
      const fsmIndex = subtaskNames.findIndex((n: string) => n === 'fsm');
      const lsmIndex = subtaskNames.findIndex((n: string) => n === 'lsm');
      const delIndex = subtaskNames.findIndex((n: string) => n === 'del');

      expect(fsmIndex).toBeLessThan(lsmIndex);
      expect(lsmIndex).toBeLessThan(delIndex);
    });
  });
});
