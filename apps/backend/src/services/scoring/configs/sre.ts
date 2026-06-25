import {
  SRE_COMPOSITE_SCORE_NAMES,
  SRE_TASK_IDS,
  SRE_SCORING_VERSION,
} from '@roar-platform/assessment-schema/roar-sre';

export default {
  taskSlugs: [SRE_TASK_IDS.EN],
  scoreFields: {
    percentile: [
      { minVersion: SRE_SCORING_VERSION.V4, fieldName: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE },
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: SRE_COMPOSITE_SCORE_NAMES.TOSREC_PERCENTILE },
            { gradeGte: 6, value: SRE_COMPOSITE_SCORE_NAMES.SPR_PERCENTILE },
          ],
        },
      },
    ],
    percentileDisplay: [
      { minVersion: SRE_SCORING_VERSION.V4, fieldName: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE },
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: SRE_COMPOSITE_SCORE_NAMES.TOSREC_PERCENTILE },
            { gradeGte: 6, value: SRE_COMPOSITE_SCORE_NAMES.SPR_PERCENTILE },
          ],
        },
      },
    ],
    standardScore: [
      { minVersion: SRE_SCORING_VERSION.V4, fieldName: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE },
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: SRE_COMPOSITE_SCORE_NAMES.TOSREC_SS },
            { gradeGte: 6, value: SRE_COMPOSITE_SCORE_NAMES.SPR_STANDARD_SCORE },
          ],
        },
      },
    ],
    standardScoreDisplay: [
      { minVersion: SRE_SCORING_VERSION.V4, fieldName: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE },
      {
        minVersion: 0,
        fieldName: {
          gradeConditional: true,
          conditions: [
            { gradeLt: 6, value: SRE_COMPOSITE_SCORE_NAMES.TOSREC_SS },
            { gradeGte: 6, value: SRE_COMPOSITE_SCORE_NAMES.SPR_STANDARD_SCORE },
          ],
        },
      },
    ],
    rawScore: [{ minVersion: 0, fieldName: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE }],
  },
  classification: {
    type: 'percentile-then-rawscore' as const,
    percentileCutoffs: [
      { minVersion: SRE_SCORING_VERSION.V4, cutoffs: { achieved: 40, developing: 20 } },
      { minVersion: 0, cutoffs: { achieved: 50, developing: 25 } },
    ],
    rawScoreThresholds: [
      { minVersion: SRE_SCORING_VERSION.V4, thresholds: { above: 41, some: 23 } },
      { minVersion: 0, thresholds: { above: 70, some: 47 } },
    ],
  },
} as const;
