import { SWR_SCORE_NAMES, SWR_TASK_IDS } from '@roar-platform/assessment-schema/roar-swr';

// German SWR has no normed scoring tables. The assessment emits numAttempted,
// numCorrect, numIncorrect, and percentCorrect to run_scores. Only numCorrect
// is mapped here as rawScore; full support for the other three raw count fields
// requires a scoreFields schema extension (TODO).
export default {
  taskSlugs: [SWR_TASK_IDS.DE],
  scoreFields: {
    rawScore: [{ minVersion: 0, fieldName: SWR_SCORE_NAMES.NUM_CORRECT }],
  },
  classification: { type: 'none' as const },
} as const;
