import {
  LEVANTE_NORMED_TASK_IDS,
  LEVANTE_SCORE_NAMES,
  LEVANTE_SCORING_VERSION,
} from '@roar-platform/assessment-schema/roar-levante-tasks';

export default {
  taskSlugs: [LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE],
  scoreFields: {
    percentile: [{ minVersion: LEVANTE_SCORING_VERSION.V1, fieldName: LEVANTE_SCORE_NAMES.PERCENTILE }],
    percentileDisplay: [{ minVersion: LEVANTE_SCORING_VERSION.V1, fieldName: LEVANTE_SCORE_NAMES.PERCENTILE }],
    standardScore: [{ minVersion: LEVANTE_SCORING_VERSION.V1, fieldName: LEVANTE_SCORE_NAMES.STANDARD_SCORE }],
    standardScoreDisplay: [{ minVersion: LEVANTE_SCORING_VERSION.V1, fieldName: LEVANTE_SCORE_NAMES.STANDARD_SCORE }],
    rawScore: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.ROAR_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [{ minVersion: LEVANTE_SCORING_VERSION.V1, cutoffs: { achieved: 40, developing: 20 } }],
    rawScoreThresholds: [{ minVersion: LEVANTE_SCORING_VERSION.V1, thresholds: { above: 533, some: 473 } }],
  },
  displayCategory: [
    { minVersion: LEVANTE_SCORING_VERSION.V1, category: 'normed' },
    { minVersion: 0, category: 'rawOnly' },
  ],
  displayRanges: {
    percentile: { min: 0, max: 99 },
    standardScore: { min: 0, max: 180 },
    rawScore: { min: 100, max: 900 },
  },
} as const;
