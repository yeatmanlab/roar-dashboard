import { SWR_SCORE_NAMES, SWR_TASK_IDS, SWR_SCORING_VERSION } from '@roar-platform/assessment-schema/roar-swr';

export default {
  taskSlugs: [SWR_TASK_IDS.ES],
  scoreFields: {
    percentile: [{ minVersion: SWR_SCORING_VERSION.V1, fieldName: SWR_SCORE_NAMES.PERCENTILE }],
    percentileDisplay: [{ minVersion: SWR_SCORING_VERSION.V1, fieldName: SWR_SCORE_NAMES.PERCENTILE }],
    standardScore: [{ minVersion: SWR_SCORING_VERSION.V1, fieldName: SWR_SCORE_NAMES.STANDARD_SCORE }],
    standardScoreDisplay: [{ minVersion: SWR_SCORING_VERSION.V1, fieldName: SWR_SCORE_NAMES.STANDARD_SCORE }],
    rawScore: [{ minVersion: 0, fieldName: SWR_SCORE_NAMES.RAW_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [{ minVersion: SWR_SCORING_VERSION.V1, cutoffs: { achieved: 40, developing: 20 } }],
    rawScoreThresholds: [{ minVersion: SWR_SCORING_VERSION.V1, thresholds: { above: 547, some: 447 } }],
  },
} as const;
