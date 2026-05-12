import { PA_SCORE_NAMES, PA_TASK_ID, PA_SUBSCORE_DEFS } from '@roar-dashboard/assessment-schema/pa';

export default {
  taskSlugs: [PA_TASK_ID],
  scoreFields: {
    percentile: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.PERCENTILE },
            { gradeGte: 6, value: PA_SCORE_NAMES.PERCENTILE_SPR },
          ],
        },
      },
    ],
    percentileDisplay: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.PERCENTILE },
            { gradeGte: 6, value: PA_SCORE_NAMES.PERCENTILE_STRING_SPR },
          ],
        },
      },
    ],
    standardScore: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.STANDARD_SCORE },
            { gradeGte: 6, value: PA_SCORE_NAMES.STANDARD_SCORE_SPR },
          ],
        },
      },
    ],
    standardScoreDisplay: [
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: PA_SCORE_NAMES.STANDARD_SCORE },
            { gradeGte: 6, value: PA_SCORE_NAMES.STANDARD_SCORE_STRING_SPR },
          ],
        },
      },
    ],
    rawScore: [{ minVersion: 0, fieldName: PA_SCORE_NAMES.RAW_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore',
    percentileCutoffs: [
      { minVersion: 4, cutoffs: { achieved: 40, developing: 20 } },
      { minVersion: 0, cutoffs: { achieved: 50, developing: 25 } },
    ],
    rawScoreThresholds: [{ minVersion: 0, thresholds: { above: 55, some: 45 } }],
  },
  subscores: {
    FSM: PA_SUBSCORE_DEFS.FSM,
    LSM: PA_SUBSCORE_DEFS.LSM,
    DEL: PA_SUBSCORE_DEFS.DEL,
  },
} as const;
