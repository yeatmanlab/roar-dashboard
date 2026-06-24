import { describe, it, expect } from 'vitest';
import { toMultichoiceScoreEntries } from './score-entries.js';
import type { MultichoiceScoreEntry } from './score-entries.js';
import { MULTICHOICE_SCORE_DOMAINS } from './domains.js';
import {
  MULTICHOICE_COMPOSITE_SCORE_NAMES,
  MULTICHOICE_COMPREHENSION_SCORE_NAMES,
  MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES,
} from './score-names.js';

// ---------------------------------------------------------------------------
// Fixtures matching production Firestore output from scores.js
// ---------------------------------------------------------------------------

/** Case 1 — adaptive, theta null, no normed scores */
const ADAPTIVE_NO_IRT = {
  composite: {
    totalCorrect: 9,
    totalNumAttempted: 35,
    totalPercentCorrect: 26,
    thetaEstimateRaw: null,
    thetaSERaw: null,
    thetaEstimate: null,
    thetaSE: null,
    roarScoreKind: 'scaled_irt',
    scoringVersion: 1,
  },
  composite_comprehension: {
    thetaEstimateRaw: null,
    thetaSERaw: null,
    thetaEstimate: null,
    thetaSE: null,
    roarScoreKind: 'scaled_irt',
    scoringVersion: 1,
  },
};

/** Case 2 — adaptive, IRT converged, normed scores present */
const ADAPTIVE_IRT_NORMED = {
  composite: {
    totalCorrect: 0,
    totalNumAttempted: 4,
    totalPercentCorrect: 0,
    thetaEstimateRaw: -1.4819746845644142,
    thetaSERaw: 8.371050627797134,
    thetaEstimate: -0.9684045273347119,
    thetaSE: 6.174486943063166,
    roarScore: 433,
    standardScore: 76,
    percentile: 6,
    roarScoreKind: 'scaled_irt',
    scoringVersion: 1,
  },
  composite_comprehension: {
    thetaEstimateRaw: -1.3955357489255995,
    thetaSERaw: 8.673061144790063,
    thetaEstimate: -1.0796823491889755,
    thetaSE: 6.950591201434757,
    roarScoreKind: 'scaled_irt',
    scoringVersion: 1,
  },
};

/** Case 3 — adaptive, IRT converged, no normed scores (lookup failed or non-EN) */
const ADAPTIVE_IRT_NO_NORMED = {
  composite: {
    totalCorrect: 3,
    totalNumAttempted: 7,
    totalPercentCorrect: 43,
    thetaEstimateRaw: 0.5,
    thetaSERaw: 1.2,
    thetaEstimate: 1.1,
    thetaSE: 0.9,
    roarScoreKind: 'scaled_irt',
    scoringVersion: 1,
  },
};

/** Case 4 — non-adaptive */
const NON_ADAPTIVE = {
  composite: {
    subScore: 9,
    subPercentCorrect: 26,
  },
};

// ---------------------------------------------------------------------------
// null / missing input
// ---------------------------------------------------------------------------

describe('toMultichoiceScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toMultichoiceScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toMultichoiceScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when composite key is absent', () => {
      expect(toMultichoiceScoreEntries({})).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-adaptive path
  // ---------------------------------------------------------------------------

  describe('non-adaptive mode', () => {
    it('emits subScore and subPercentCorrect as type=computed', () => {
      const entries = toMultichoiceScoreEntries(NON_ADAPTIVE);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
        name: MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES.SUB_SCORE,
        value: '9',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
        name: MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES.SUB_PERCENT_CORRECT,
        value: '26',
        assessmentStage: 'test',
      });
    });

    it('emits exactly 2 entries for a non-adaptive run', () => {
      expect(toMultichoiceScoreEntries(NON_ADAPTIVE)).toHaveLength(2);
    });

    it('does not emit composite_comprehension for non-adaptive runs', () => {
      const entries = toMultichoiceScoreEntries(NON_ADAPTIVE);
      expect(entries.some((e) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Adaptive, IRT not converged
  // ---------------------------------------------------------------------------

  describe('adaptive mode — IRT not converged (theta null)', () => {
    it('emits totalCorrect as type=raw', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_NO_IRT);
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'raw',
          domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
          value: '9',
        }),
      );
    });

    it('emits totalNumAttempted as type=raw', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_NO_IRT);
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'raw',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
          value: '35',
        }),
      );
    });

    it('emits totalPercentCorrect as type=computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_NO_IRT);
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT,
          value: '26',
        }),
      );
    });

    it('skips null theta fields', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_NO_IRT);
      const names = entries.map((e) => e.name);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE_RAW);
    });

    it('emits roarScoreKind and scoringVersion as type=computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_NO_IRT);
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.ROAR_SCORE_KIND,
          value: 'scaled_irt',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.SCORING_VERSION,
          value: '1',
        }),
      );
    });

    it('also emits composite_comprehension metadata when present', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_NO_IRT);
      const comprehensionEntries = entries.filter(
        (e) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION,
      );
      expect(comprehensionEntries.length).toBeGreaterThan(0);

      // Null theta fields are skipped; only roarScoreKind and scoringVersion survive
      expect(comprehensionEntries).toContainEqual(
        expect.objectContaining({
          name: MULTICHOICE_COMPREHENSION_SCORE_NAMES.ROAR_SCORE_KIND,
          value: 'scaled_irt',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Adaptive, IRT converged, no normed scores
  // ---------------------------------------------------------------------------

  describe('adaptive mode — IRT converged, no normed scores', () => {
    it('emits thetaEstimateRaw as type=raw', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NO_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'raw',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
          value: '0.5',
        }),
      );
    });

    it('emits thetaSERaw as type=raw', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NO_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({ type: 'raw', name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE_RAW }),
      );
    });

    it('emits thetaEstimate as type=computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NO_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({ type: 'computed', name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE }),
      );
    });

    it('emits thetaSE as type=computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NO_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({ type: 'computed', name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE }),
      );
    });

    it('does not emit normed scores when lookup was not resolved', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NO_NORMED);
      const names = entries.map((e) => e.name);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.ROAR_SCORE);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE);
      expect(names).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.PERCENTILE);
    });
  });

  // ---------------------------------------------------------------------------
  // Adaptive, IRT converged + normed scores
  // ---------------------------------------------------------------------------

  describe('adaptive mode — IRT converged with normed scores', () => {
    it('emits roarScore, standardScore, percentile as type=computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.ROAR_SCORE,
          value: '433',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE,
          value: '76',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.PERCENTILE,
          value: '6',
        }),
      );
    });

    it('emits full composite_comprehension IRT pair as raw + computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      const cc = entries.filter((e) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION);

      expect(cc).toContainEqual(
        expect.objectContaining({
          type: 'raw',
          name: MULTICHOICE_COMPREHENSION_SCORE_NAMES.THETA_ESTIMATE_RAW,
        }),
      );
      expect(cc).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPREHENSION_SCORE_NAMES.THETA_ESTIMATE,
        }),
      );
      expect(cc).toContainEqual(
        expect.objectContaining({
          type: 'raw',
          name: MULTICHOICE_COMPREHENSION_SCORE_NAMES.THETA_SE_RAW,
        }),
      );
      expect(cc).toContainEqual(
        expect.objectContaining({
          type: 'computed',
          name: MULTICHOICE_COMPREHENSION_SCORE_NAMES.THETA_SE,
        }),
      );
    });

    it('composite_comprehension does not contain normed scores', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      const cc = entries.filter((e) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION);
      const ccNames = cc.map((e) => e.name);
      expect(ccNames).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.ROAR_SCORE);
      expect(ccNames).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE);
      expect(ccNames).not.toContain(MULTICHOICE_COMPOSITE_SCORE_NAMES.PERCENTILE);
    });
  });

  // ---------------------------------------------------------------------------
  // Score type assignment
  // ---------------------------------------------------------------------------

  describe('score type assignment', () => {
    it('classifies totalCorrect and totalNumAttempted as type=raw', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT, type: 'raw' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
          type: 'raw',
        }),
      );
    });

    it('classifies thetaEstimateRaw and thetaSERaw as type=raw', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
          type: 'raw',
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE_RAW, type: 'raw' }),
      );
    });

    it('classifies thetaEstimate and thetaSE as type=computed', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE, type: 'computed' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE, type: 'computed' }),
      );
    });

    it('all entries carry assessmentStage=test', () => {
      for (const fixture of [ADAPTIVE_NO_IRT, ADAPTIVE_IRT_NORMED, ADAPTIVE_IRT_NO_NORMED, NON_ADAPTIVE]) {
        const entries = toMultichoiceScoreEntries(fixture);
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
          expect(entry.assessmentStage).toBe('test');
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Null / undefined field handling
  // ---------------------------------------------------------------------------

  describe('null / undefined field values', () => {
    it('skips fields with null values', () => {
      const computed = { composite: { totalCorrect: 5, thetaEstimate: null } };
      const entries = toMultichoiceScoreEntries(computed);
      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT }),
      );
    });

    it('skips fields with undefined values', () => {
      const computed = { composite: { totalCorrect: 5, thetaEstimate: undefined } };
      const entries = toMultichoiceScoreEntries(computed);
      expect(entries).not.toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Value serialization
  // ---------------------------------------------------------------------------

  describe('value serialization', () => {
    it('converts numbers to strings', () => {
      const computed = { composite: { totalCorrect: 9, totalNumAttempted: 35 } };
      const entries = toMultichoiceScoreEntries(computed);
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT, value: '9' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
          value: '35',
        }),
      );
    });

    it('converts float values to strings without loss', () => {
      const computed = { composite: { totalCorrect: 1, thetaEstimate: -0.9684045273347119 } };
      const entries = toMultichoiceScoreEntries(computed);
      expect(entries).toContainEqual(
        expect.objectContaining({
          name: MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE,
          value: '-0.9684045273347119',
        }),
      );
    });

    it('converts string metadata values to strings unchanged', () => {
      const computed = { composite: { totalCorrect: 1, roarScoreKind: 'scaled_irt' } };
      const entries = toMultichoiceScoreEntries(computed);
      expect(entries).toContainEqual(
        expect.objectContaining({ name: MULTICHOICE_COMPOSITE_SCORE_NAMES.ROAR_SCORE_KIND, value: 'scaled_irt' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // composite_comprehension — present / absent
  // ---------------------------------------------------------------------------

  describe('composite_comprehension domain', () => {
    it('does not invent composite_comprehension when the callback did not produce it', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NO_NORMED);
      expect(entries.some((e) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION)).toBe(false);
    });

    it('emits composite_comprehension when present', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);
      expect(entries.some((e) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Strict mode
  // ---------------------------------------------------------------------------

  describe('strict mode', () => {
    it('does not throw on composite key in strict mode', () => {
      expect(() => toMultichoiceScoreEntries(NON_ADAPTIVE, { strict: true })).not.toThrow();
    });

    it('does not throw on composite_comprehension key in strict mode', () => {
      expect(() => toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED, { strict: true })).not.toThrow();
    });

    it('throws on unrecognized domain key in strict mode', () => {
      const computed = { composite: { totalCorrect: 5 }, unknown_domain: { someScore: 1 } };
      expect(() => toMultichoiceScoreEntries(computed, { strict: true })).toThrow(/unknown_domain/);
    });

    it('does not throw on unrecognized domain key in non-strict mode', () => {
      const computed = { composite: { totalCorrect: 5 }, unknown_domain: { someScore: 1 } };
      expect(() => toMultichoiceScoreEntries(computed, { strict: false })).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Full output shape assertions (spot-check against production fixture)
  // ---------------------------------------------------------------------------

  describe('full adaptive+normed output (production fixture)', () => {
    it('emits the expected entry set for a fully scored adaptive run', () => {
      const entries = toMultichoiceScoreEntries(ADAPTIVE_IRT_NORMED);

      // composite: totalCorrect(r), totalNumAttempted(r), totalPercentCorrect(c),
      //            thetaEstimateRaw(r), thetaSERaw(r), thetaEstimate(c), thetaSE(c),
      //            roarScore(c), standardScore(c), percentile(c),
      //            roarScoreKind(c), scoringVersion(c) = 12 entries
      // composite_comprehension: thetaEstimateRaw(r), thetaSERaw(r),
      //            thetaEstimate(c), thetaSE(c),
      //            roarScoreKind(c), scoringVersion(c) = 6 entries
      // total = 18
      expect(entries).toHaveLength(18);

      const compositeEntries = entries.filter(
        (e: MultichoiceScoreEntry) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
      );
      const comprehensionEntries = entries.filter(
        (e: MultichoiceScoreEntry) => e.domain === MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION,
      );

      expect(compositeEntries).toHaveLength(12);
      expect(comprehensionEntries).toHaveLength(6);
    });
  });
});
