import {
  SRE_COMPOSITE_SCORE_NAMES,
  SRE_TASK_IDS,
  SRE_SCORING_VERSION,
} from '@roar-platform/assessment-schema/roar-sre';

const COMPOSITE_DOMAIN = 'composite';

export default {
  taskSlugs: [SRE_TASK_IDS.ES],
  scoreFields: {
    percentile: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE }],
    percentileDisplay: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE }],
    standardScore: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }],
    standardScoreDisplay: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }],
    rawScore: [{ minVersion: 0, fieldName: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE }],
    correctIncorrectDifference: [{ minVersion: 0, fieldName: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [{ minVersion: SRE_SCORING_VERSION.V1, cutoffs: { achieved: 40, developing: 20 } }],
    rawScoreThresholds: [{ minVersion: SRE_SCORING_VERSION.V1, thresholds: { above: 25, some: 12 } }],
  },
  // Version-conditional: correct-incorrect difference at v0 (sreScore = numCorrect - numIncorrect),
  // normed at v1+.
  displayCategory: [
    { minVersion: SRE_SCORING_VERSION.V1, category: 'normed' },
    { minVersion: 0, category: 'correctIncorrectDifference' },
  ],
  displayRanges: {
    percentile: { min: 0, max: 99 },
    standardScore: { min: 0, max: 180 },
    rawScore: { min: 0, max: 140 },
    correctIncorrectDifference: { min: 0, max: 140 },
  },
  subscores: [
    {
      kind: 'number' as const,
      key: 'numCorrect',
      label: 'Num Correct',
      domain: COMPOSITE_DOMAIN,
      name: SRE_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
    },
    {
      kind: 'number' as const,
      key: 'numIncorrect',
      label: 'Num Incorrect',
      domain: COMPOSITE_DOMAIN,
      name: SRE_COMPOSITE_SCORE_NAMES.NUM_INCORRECT,
    },
    {
      kind: 'number' as const,
      key: 'numAttempted',
      label: 'Num Attempted',
      domain: COMPOSITE_DOMAIN,
      name: SRE_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED,
    },
    {
      kind: 'number' as const,
      key: 'correctIncorrectDifference',
      label: 'Correct/Incorrect Difference',
      domain: COMPOSITE_DOMAIN,
      name: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE,
    },
  ],
} as const;
