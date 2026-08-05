import { SWR_SCORE_NAMES, SWR_TASK_IDS, SWR_SCORING_VERSION } from '@roar-platform/assessment-schema/roar-swr';

export default {
  taskSlugs: [SWR_TASK_IDS.EN, SWR_TASK_IDS.ES],
  scoreFields: {
    percentile: [
      { minVersion: SWR_SCORING_VERSION.V7, fieldName: SWR_SCORE_NAMES.PERCENTILE },
      { minVersion: SWR_SCORING_VERSION.V1, fieldName: SWR_SCORE_NAMES.PERCENTILE },
      { minVersion: 0, fieldName: SWR_SCORE_NAMES.WJ_PERCENTILE },
    ],
    percentileDisplay: [
      { minVersion: SWR_SCORING_VERSION.V7, fieldName: SWR_SCORE_NAMES.PERCENTILE },
      { minVersion: SWR_SCORING_VERSION.V1, fieldName: SWR_SCORE_NAMES.PERCENTILE },
      { minVersion: 0, fieldName: SWR_SCORE_NAMES.WJ_PERCENTILE },
    ],
    standardScore: [{ minVersion: 0, fieldName: SWR_SCORE_NAMES.STANDARD_SCORE }],
    standardScoreDisplay: [{ minVersion: 0, fieldName: SWR_SCORE_NAMES.STANDARD_SCORE }],
    rawScore: [{ minVersion: 0, fieldName: SWR_SCORE_NAMES.RAW_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [
      { minVersion: SWR_SCORING_VERSION.V7, cutoffs: { achieved: 40, developing: 20 } },
      { minVersion: SWR_SCORING_VERSION.V1, cutoffs: { achieved: 40, developing: 20 } },
      { minVersion: 0, cutoffs: { achieved: 50, developing: 25 } },
    ],
    rawScoreThresholds: [
      { minVersion: SWR_SCORING_VERSION.V7, thresholds: { above: 513, some: 413 } },
      { minVersion: SWR_SCORING_VERSION.V1, thresholds: { above: 547, some: 447 } },
      { minVersion: 0, thresholds: { above: 550, some: 400 } },
    ],
  },
  displayCategory: [
    { minVersion: SWR_SCORING_VERSION.V1, category: 'normed' },
    { minVersion: 0, category: 'percentCorrect' },
  ],
  displayRanges: {
    percentile: { min: 0, max: 99 },
    standardScore: { min: 0, max: 180 },
    rawScore: { min: 100, max: 900 },
    percentCorrect: { min: 0, max: 100 },
  },
} as const;
