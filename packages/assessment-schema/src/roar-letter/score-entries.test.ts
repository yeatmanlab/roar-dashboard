import { describe, it, expect } from 'vitest';
import { toLetterScoreEntries, toPhonicsScoreEntries } from './score-entries.js';
import type { LetterScoreEntry, PhonicsScoreEntry } from './score-entries.js';
import {
  LETTER_COMPOSITE_SCORE_NAMES,
  LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES,
  LETTER_SUBTASK_SCORE_NAMES,
  PHONICS_COMPOSITE_SCORE_NAMES,
  PHONICS_SUBTASK_SCORE_NAMES,
  PHONICS_GROUP_SCORE_NAMES,
} from './score-names.js';

// ─── toLetterScoreEntries ─────────────────────────────────────────────────────

describe('toLetterScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toLetterScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toLetterScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when computed is an empty object', () => {
      expect(toLetterScoreEntries({})).toEqual([]);
    });
  });

  describe('composite domain — IRT scores', () => {
    it('emits thetaEstimateRaw and thetaSERaw as type=raw', () => {
      const computed = { composite: { thetaEstimateRaw: 1.5, thetaSERaw: 0.4 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW, type: 'raw', value: '1.5' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.THETA_SE_RAW, type: 'raw', value: '0.4' }),
      );
    });

    it('emits thetaEstimate and thetaSE as type=computed', () => {
      const computed = { composite: { thetaEstimate: 1.5, thetaSE: 0.4 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE, type: 'computed', value: '1.5' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.THETA_SE, type: 'computed', value: '0.4' }),
      );
    });

    it('emits totalCorrect and totalNumAttempted as type=raw', () => {
      const computed = { composite: { totalCorrect: 18, totalNumAttempted: 20 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT, type: 'raw', value: '18' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED, type: 'raw', value: '20' }),
      );
    });

    it('emits totalPercentCorrect as type=computed', () => {
      const computed = { composite: { totalPercentCorrect: 0.9 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT, type: 'computed' }),
      );
    });
  });

  describe('composite domain — normed scores (EN only)', () => {
    it('emits roarScore, standardScore, percentile as type=computed when present', () => {
      const computed = { composite: { roarScore: 95, standardScore: 110, percentile: 75 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.ROAR_SCORE, type: 'computed', value: '95' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: LETTER_COMPOSITE_SCORE_NAMES.STANDARD_SCORE,
          type: 'computed',
          value: '110',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.PERCENTILE, type: 'computed', value: '75' }),
      );
    });

    it('omits normed scores when null (lookup failed or non-EN variant)', () => {
      const computed = { composite: { roarScore: null, standardScore: null, percentile: null, totalCorrect: 10 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.ROAR_SCORE }));
      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }),
      );
      expect(entries).not.toContainEqual(expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.PERCENTILE }));
      expect(entries).toContainEqual(expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT }));
    });

    it('emits scoringVersion and roarScoreKind as type=computed', () => {
      const computed = { composite: { scoringVersion: 1, roarScoreKind: 'standardScore' } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.SCORING_VERSION, type: 'computed', value: '1' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: LETTER_COMPOSITE_SCORE_NAMES.ROAR_SCORE_KIND,
          type: 'computed',
          value: 'standardScore',
        }),
      );
    });

    it('assigns assessmentStage=test to composite domain', () => {
      const computed = { composite: { totalCorrect: 18 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });
  });

  describe('composite_foundational domain', () => {
    it('emits all theta scores as type=computed', () => {
      const computed = {
        composite_foundational: {
          thetaEstimateRaw: 0.8,
          thetaSERaw: 0.5,
          thetaEstimate: 0.8,
          thetaSE: 0.5,
        },
      };
      const entries = toLetterScoreEntries(computed);

      for (const entry of entries) {
        expect(entry.type).toBe('computed');
        expect(entry.domain).toBe('composite_foundational');
        expect(entry.assessmentStage).toBe('test');
      }
      expect(entries).toHaveLength(4);
    });

    it('emits scoringVersion and roarScoreKind as type=computed', () => {
      const computed = { composite_foundational: { scoringVersion: 1, roarScoreKind: 'standardScore' } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({
          name: LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES.SCORING_VERSION,
          type: 'computed',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES.ROAR_SCORE_KIND,
          type: 'computed',
        }),
      );
    });

    it('skips null values in composite_foundational', () => {
      const computed = { composite_foundational: { thetaEstimate: null, thetaEstimateRaw: 0.8 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES.THETA_ESTIMATE }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES.THETA_ESTIMATE_RAW }),
      );
    });

    it('throws in strict mode on unrecognized composite_foundational score name', () => {
      const computed = { composite_foundational: { thetaEstimate: 0.8, unknownScore: 99 } };
      expect(() => toLetterScoreEntries(computed, { strict: true })).toThrow(/unknownScore/);
    });
  });

  describe('subtask domains', () => {
    it('emits subScore and subPercentCorrect as type=computed', () => {
      const computed = { LowercaseNames: { subScore: 15, subPercentCorrect: 0.75 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE, type: 'computed', value: '15' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: LETTER_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
          type: 'computed',
          value: '0.75',
        }),
      );
    });

    it('emits item lists as type=computed when present', () => {
      const computed = {
        LetterPractice: {
          subScore: 4,
          subPercentCorrect: 0.8,
          lowerCorrect: 'a,b,c,d',
          lowerIncorrect: 'e',
          upperCorrect: 'A,B,C,D',
          upperIncorrect: '',
          phonemeCorrect: '/a/,/b/',
          phonemeIncorrect: null,
        },
      };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_SUBTASK_SCORE_NAMES.LOWER_CORRECT, type: 'computed', value: 'a,b,c,d' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_SUBTASK_SCORE_NAMES.LOWER_INCORRECT, type: 'computed', value: 'e' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: LETTER_SUBTASK_SCORE_NAMES.UPPER_CORRECT, type: 'computed', value: 'A,B,C,D' }),
      );
      // null phonemeIncorrect should be omitted
      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: LETTER_SUBTASK_SCORE_NAMES.PHONEME_INCORRECT }),
      );
    });

    it('omits item list fields when null', () => {
      const computed = {
        Phonemes: {
          subScore: 8,
          subPercentCorrect: 0.8,
          phonemeCorrect: null,
          phonemeIncorrect: null,
        },
      };
      const entries = toLetterScoreEntries(computed);

      expect(entries).toHaveLength(2); // only subScore and subPercentCorrect
      expect(entries).not.toContainEqual(expect.objectContaining({ name: LETTER_SUBTASK_SCORE_NAMES.PHONEME_CORRECT }));
    });
  });

  describe('assessmentStage assignment', () => {
    it('assigns practice to LetterPractice domain', () => {
      const computed = { LetterPractice: { subScore: 4 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('practice');
    });

    it('assigns practice to PhonemePractice domain', () => {
      const computed = { PhonemePractice: { subScore: 3 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('practice');
    });

    it('assigns test to LowercaseNames domain', () => {
      const computed = { LowercaseNames: { subScore: 20 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });

    it('assigns test to UppercaseNames domain', () => {
      const computed = { UppercaseNames: { subScore: 20 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });

    it('assigns test to Phonemes domain', () => {
      const computed = { Phonemes: { subScore: 10 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });

    it('assigns test to composite_foundational domain', () => {
      const computed = { composite_foundational: { thetaEstimate: 0.5 } };
      const entries = toLetterScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });
  });

  describe('value serialization', () => {
    it('converts numeric values to strings', () => {
      const computed = { composite: { totalCorrect: 18, thetaEstimate: 1.234 } };
      const entries = toLetterScoreEntries(computed);

      const totalEntry = entries.find((e: LetterScoreEntry) => e.name === LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT);
      expect(totalEntry?.value).toBe('18');

      const thetaEntry = entries.find((e: LetterScoreEntry) => e.name === LETTER_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE);
      expect(thetaEntry?.value).toBe('1.234');
    });
  });

  describe('strict mode', () => {
    it('does not throw on recognized composite score names in strict mode', () => {
      const computed = { composite: { totalCorrect: 18, roarScore: 95 } };
      expect(() => toLetterScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('throws on unrecognized composite score name in strict mode', () => {
      const computed = { composite: { totalCorrect: 18, unknownScore: 99 } };
      expect(() => toLetterScoreEntries(computed, { strict: true })).toThrow(/unknownScore/);
    });

    it('does not throw on unrecognized composite score name in non-strict mode', () => {
      const computed = { composite: { totalCorrect: 18, unknownScore: 99 } };
      expect(() => toLetterScoreEntries(computed, { strict: false })).not.toThrow();
    });
  });

  describe('full normed output (EN letter)', () => {
    it('maps complete scoring output for a normed English run', () => {
      const computed = {
        LetterPractice: { subScore: 4, subPercentCorrect: 0.8, lowerCorrect: 'a,b,c,d', upperCorrect: 'A,B,C,D' },
        PhonemePractice: { subScore: 3, subPercentCorrect: 0.75, phonemeCorrect: '/a/,/b/,/c/' },
        LowercaseNames: { subScore: 20, subPercentCorrect: 0.95, lowerCorrect: 'a,b,c' },
        UppercaseNames: { subScore: 22, subPercentCorrect: 1.0, upperCorrect: 'A,B,C' },
        Phonemes: { subScore: 10, subPercentCorrect: 0.83, phonemeCorrect: '/a/,/b/' },
        composite: {
          thetaEstimateRaw: 1.5,
          thetaSERaw: 0.4,
          thetaEstimate: 1.5,
          thetaSE: 0.4,
          totalCorrect: 59,
          totalNumAttempted: 65,
          totalPercentCorrect: 0.91,
          roarScore: 95,
          standardScore: 110,
          percentile: 75,
          roarScoreKind: 'standardScore',
          scoringVersion: 1,
        },
        composite_foundational: {
          thetaEstimateRaw: 1.2,
          thetaSERaw: 0.45,
          thetaEstimate: 1.2,
          thetaSE: 0.45,
          roarScoreKind: 'standardScore',
          scoringVersion: 1,
        },
      };
      const entries = toLetterScoreEntries(computed);

      const byDomain = (domain: string) => entries.filter((e: LetterScoreEntry) => e.domain === domain);

      // LetterPractice: subScore + subPercentCorrect + 2 item lists = 4 (assessmentStage=practice)
      expect(byDomain('LetterPractice')).toHaveLength(4);
      expect(byDomain('LetterPractice')[0]!.assessmentStage).toBe('practice');

      // PhonemePractice: subScore + subPercentCorrect + 1 item list = 3 (assessmentStage=practice)
      expect(byDomain('PhonemePractice')).toHaveLength(3);
      expect(byDomain('PhonemePractice')[0]!.assessmentStage).toBe('practice');

      // LowercaseNames: subScore + subPercentCorrect + lowerCorrect = 3 (assessmentStage=test)
      expect(byDomain('LowercaseNames')).toHaveLength(3);
      expect(byDomain('LowercaseNames')[0]!.assessmentStage).toBe('test');

      // composite: 12 fields (4 theta + totalCorrect + totalNumAttempted + totalPercentCorrect +
      //   roarScore + standardScore + percentile + roarScoreKind + scoringVersion), all non-null
      expect(byDomain('composite')).toHaveLength(12);

      // composite_foundational: 6 fields (assessmentStage=test)
      expect(byDomain('composite_foundational')).toHaveLength(6);
    });
  });
});

// ─── toPhonicsScoreEntries ────────────────────────────────────────────────────

describe('toPhonicsScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toPhonicsScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toPhonicsScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when computed is an empty object', () => {
      expect(toPhonicsScoreEntries({})).toEqual([]);
    });
  });

  describe('composite domain — totals', () => {
    it('emits totalCorrect and totalNumAttempted as type=raw', () => {
      const computed = { composite: { totalCorrect: 30, totalNumAttempted: 40 } };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT, type: 'raw', value: '30' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
          type: 'raw',
          value: '40',
        }),
      );
    });

    it('emits totalPercentCorrect as type=computed', () => {
      const computed = { composite: { totalPercentCorrect: 0.75 } };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT, type: 'computed' }),
      );
    });

    it('assigns assessmentStage=test to composite domain', () => {
      const computed = { composite: { totalCorrect: 30 } };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });
  });

  describe('composite domain — group subscores flattening', () => {
    it('flattens cvc subscores to cvcCorrect / cvcAttempted', () => {
      const computed = {
        composite: { subscores: { cvc: { correct: 8, attempted: 10 } } },
      };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.CVC_CORRECT, type: 'computed', value: '8' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.CVC_ATTEMPTED, type: 'computed', value: '10' }),
      );
    });

    it('flattens all 9 groups when present', () => {
      const computed = {
        composite: {
          subscores: {
            cvc: { correct: 8, attempted: 10 },
            digraph: { correct: 6, attempted: 8 },
            initial_blend: { correct: 5, attempted: 7 },
            tri_blend: { correct: 3, attempted: 4 },
            final_blend: { correct: 4, attempted: 5 },
            r_controlled: { correct: 2, attempted: 3 },
            r_cluster: { correct: 1, attempted: 2 },
            silent_e: { correct: 3, attempted: 4 },
            vowel_team: { correct: 2, attempted: 3 },
          },
        },
      };
      const entries = toPhonicsScoreEntries(computed);

      // 9 groups × 2 fields = 18 entries
      expect(entries).toHaveLength(18);
      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_CORRECT, value: '6' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_ATTEMPTED, value: '3' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_CORRECT, value: '2' }),
      );
    });

    it('omits group fields when correct or attempted is null', () => {
      const computed = {
        composite: { subscores: { cvc: { correct: null, attempted: 10 } } },
      };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.CVC_CORRECT }));
      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_GROUP_SCORE_NAMES.CVC_ATTEMPTED, value: '10' }),
      );
    });

    it('ignores unknown group keys in subscores', () => {
      const computed = {
        composite: { subscores: { unknownGroup: { correct: 5, attempted: 6 } } },
      };
      expect(() => toPhonicsScoreEntries(computed)).not.toThrow();
      const entries = toPhonicsScoreEntries(computed);
      expect(entries).toHaveLength(0);
    });

    it('handles missing subscores key gracefully', () => {
      const computed = { composite: { totalCorrect: 30, totalNumAttempted: 40 } };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries).toHaveLength(2); // only totalCorrect and totalNumAttempted
    });
  });

  describe('non-composite subtask domains', () => {
    it('emits subScore and subPercentCorrect as type=computed', () => {
      const computed = { cvc: { subScore: 8, subPercentCorrect: 0.8 } };
      const entries = toPhonicsScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: PHONICS_SUBTASK_SCORE_NAMES.SUB_SCORE, type: 'computed', value: '8' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: PHONICS_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
          type: 'computed',
          value: '0.8',
        }),
      );
    });

    it('assigns assessmentStage=test to all subtask domains', () => {
      const computed = { cvc: { subScore: 8 }, digraph: { subScore: 6 } };
      const entries = toPhonicsScoreEntries(computed);

      for (const entry of entries) {
        expect(entry.assessmentStage).toBe('test');
      }
    });
  });

  describe('value serialization', () => {
    it('converts numeric values to strings', () => {
      const computed = { composite: { totalCorrect: 30, totalPercentCorrect: 0.75 } };
      const entries = toPhonicsScoreEntries(computed);

      const totalEntry = entries.find((e: PhonicsScoreEntry) => e.name === PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT);
      expect(totalEntry?.value).toBe('30');
      const pctEntry = entries.find(
        (e: PhonicsScoreEntry) => e.name === PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT,
      );
      expect(pctEntry?.value).toBe('0.75');
    });
  });

  describe('strict mode', () => {
    it('does not throw on recognized composite score names in strict mode', () => {
      const computed = { composite: { totalCorrect: 30, totalPercentCorrect: 0.75 } };
      expect(() => toPhonicsScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('does not throw when subscores key is present in strict mode', () => {
      const computed = {
        composite: { totalCorrect: 30, subscores: { cvc: { correct: 8, attempted: 10 } } },
      };
      expect(() => toPhonicsScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('throws on unrecognized composite top-level score name in strict mode', () => {
      const computed = { composite: { totalCorrect: 30, unknownScore: 99 } };
      expect(() => toPhonicsScoreEntries(computed, { strict: true })).toThrow(/unknownScore/);
    });

    it('does not throw on unrecognized score name in non-strict mode', () => {
      const computed = { composite: { totalCorrect: 30, unknownScore: 99 } };
      expect(() => toPhonicsScoreEntries(computed, { strict: false })).not.toThrow();
    });
  });

  describe('full phonics output', () => {
    it('maps a complete phonics run with totals and all group subscores', () => {
      const computed = {
        cvc: { subScore: 8, subPercentCorrect: 0.8 },
        digraph: { subScore: 6, subPercentCorrect: 0.75 },
        composite: {
          totalCorrect: 14,
          totalNumAttempted: 18,
          totalPercentCorrect: 0.78,
          subscores: {
            cvc: { correct: 8, attempted: 10 },
            digraph: { correct: 6, attempted: 8 },
            // other groups omitted to keep the test fixture small
          },
          roarScoreKind: 'rawScore',
          scoringVersion: null,
        },
      };
      const entries = toPhonicsScoreEntries(computed);

      const byDomain = (d: string) => entries.filter((e: PhonicsScoreEntry) => e.domain === d);

      // cvc subtask: subScore + subPercentCorrect = 2
      expect(byDomain('cvc')).toHaveLength(2);
      // digraph subtask: 2
      expect(byDomain('digraph')).toHaveLength(2);
      // composite: totalCorrect (raw) + totalNumAttempted (raw) + totalPercentCorrect (computed)
      //            + roarScoreKind (computed) + cvcCorrect + cvcAttempted + digraphCorrect + digraphAttempted
      //            scoringVersion is null → omitted
      expect(byDomain('composite')).toHaveLength(8);
    });
  });
});
