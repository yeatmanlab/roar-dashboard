import { LEVANTE_PROVISIONAL_TASK_IDS, LEVANTE_SCORE_NAMES } from '@roar-platform/assessment-schema/roar-levante-tasks';

/**
 * Provisional scoring config for LEVANTE tasks that write raw count-based scores only.
 * Normed fields (percentile, standardScore) are null until psychometrics finalizes
 * lookup tables for each task. The subscore column surfaces totalCorrect/totalNumAttempted
 * in the progress report and is flagged provisional to signal it may change.
 */
export default {
  taskSlugs: Object.values(LEVANTE_PROVISIONAL_TASK_IDS),
  scoreFields: {
    percentile: [{ minVersion: 0, fieldName: null }],
    percentileDisplay: [{ minVersion: 0, fieldName: null }],
    standardScore: [{ minVersion: 0, fieldName: null }],
    standardScoreDisplay: [{ minVersion: 0, fieldName: null }],
    rawScore: [{ minVersion: 0, fieldName: LEVANTE_SCORE_NAMES.TOTAL_CORRECT }],
  },
  classification: {
    type: 'none' as const,
  },
  subscores: [
    {
      kind: 'itemLevel' as const,
      key: 'total',
      label: 'Total',
      provisional: true,
      correctName: LEVANTE_SCORE_NAMES.TOTAL_CORRECT,
      attemptedName: LEVANTE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
      percentCorrectName: LEVANTE_SCORE_NAMES.TOTAL_PERCENT_CORRECT,
      subskill: false,
    },
  ],
  displayCategory: [{ minVersion: 0, category: 'rawOnly' }],
  displayRanges: {
    rawScore: { min: 0, max: 100 },
  },
} as const;
