import {
  SRE_COMPOSITE_SCORE_NAMES,
  SRE_TASK_IDS,
  SRE_SCORING_VERSION,
} from '@roar-platform/assessment-schema/roar-sre';

export default {
  taskSlugs: [SRE_TASK_IDS.ES],
  scoreFields: {
    percentile: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE }],
    percentileDisplay: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE }],
    standardScore: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }],
    standardScoreDisplay: [{ minVersion: SRE_SCORING_VERSION.V1, fieldName: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }],
    rawScore: [{ minVersion: 0, fieldName: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [{ minVersion: SRE_SCORING_VERSION.V1, cutoffs: { achieved: 40, developing: 20 } }],
    rawScoreThresholds: [{ minVersion: SRE_SCORING_VERSION.V1, thresholds: { above: 25, some: 12 } }],
  },
} as const;
