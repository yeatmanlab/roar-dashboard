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
  // Version-conditional: percent-correct at v0 (no normed fields exist for v0),
  // normed at v1+. NOTE: confirm the v0 percent-correct value source against the
  // norming tables — flagged for backend/integration verification.
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
