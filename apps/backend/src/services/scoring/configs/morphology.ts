import {
  MORPHOLOGY_TASK_ID,
  MULTICHOICE_SCORING_VERSION,
  MULTICHOICE_COMPOSITE_SCORE_NAMES,
  MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roar-multichoice';

/**
 * Morphology scoring config.
 *
 * Morphology is one of the two tasks in the roar-multichoice assessment (the other is
 * CVA / written vocabulary), so its slug and score names come from the shared
 * roar-multichoice module rather than being named here. A rename of any of these fields
 * in assessment-schema is now a compile error here.
 *
 * The version split mirrors the assessment's two scoring modes:
 * - V1 (adaptive) emits the composite score names. `percentile` and `standardScore` are
 *   present only when the normed IRT lookup resolves, and `totalCorrect` is the raw score.
 * - v0 (pre-versioning, non-adaptive) emits only aggregate counts from the test stage —
 *   hence no normed scores, and the non-adaptive `subScore` as the raw score.
 */
export default {
  taskSlugs: [MORPHOLOGY_TASK_ID],
  scoreFields: {
    percentile: [
      { minVersion: MULTICHOICE_SCORING_VERSION.V1, fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.PERCENTILE },
      { minVersion: 0, fieldName: null },
    ],
    percentileDisplay: [
      { minVersion: MULTICHOICE_SCORING_VERSION.V1, fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.PERCENTILE },
      { minVersion: 0, fieldName: null },
    ],
    standardScore: [
      { minVersion: MULTICHOICE_SCORING_VERSION.V1, fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE },
      { minVersion: 0, fieldName: null },
    ],
    standardScoreDisplay: [
      { minVersion: MULTICHOICE_SCORING_VERSION.V1, fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE },
      { minVersion: 0, fieldName: null },
    ],
    rawScore: [
      { minVersion: MULTICHOICE_SCORING_VERSION.V1, fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT },
      { minVersion: 0, fieldName: MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES.SUB_SCORE },
    ],
  },
  classification: { type: 'none' as const },
} as const;
