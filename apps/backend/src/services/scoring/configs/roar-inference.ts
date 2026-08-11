import { LEVANTE_NORMED_TASK_IDS, LEVANTE_SCORE_NAMES } from '@roar-platform/assessment-schema/roar-levante-tasks';

export default {
  taskSlugs: [LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE],
  scoreFields: {
    percentile: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.PERCENTILE }],
    percentileDisplay: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.PERCENTILE }],
    standardScore: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.STANDARD_SCORE }],
    standardScoreDisplay: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.STANDARD_SCORE }],
    rawScore: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.ROAR_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [{ minVersion: 0, cutoffs: { achieved: 40, developing: 20 } }],
    rawScoreThresholds: [{ minVersion: 0, thresholds: { above: 533, some: 473 } }],
  },
  displayCategory: [{ minVersion: 0, category: 'normed' }],
  displayRanges: {
    percentile: { min: 0, max: 99 },
    standardScore: { min: 0, max: 180 },
    rawScore: { min: 100, max: 900 },
  },
} as const;
