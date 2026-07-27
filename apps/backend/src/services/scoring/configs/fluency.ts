import {
  ROAM_FLUENCY_ARF_TASK_IDS,
  ROAM_FLUENCY_CALF_TASK_IDS,
  ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS,
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roam-apps';

export default {
  taskSlugs: [
    ROAM_FLUENCY_ARF_TASK_IDS.EN,
    ROAM_FLUENCY_CALF_TASK_IDS.EN,
    ROAM_FLUENCY_ARF_TASK_IDS.ES,
    ROAM_FLUENCY_CALF_TASK_IDS.ES,
    ROAM_FLUENCY_ARF_TASK_IDS.PT,
    ROAM_FLUENCY_CALF_TASK_IDS.PT,
  ],
  scoreFields: {},
  classification: {
    type: 'none',
  },
  // Response-modality subscore columns. `domain` (FR/FC) and `name` (rawScore)
  // come from @roar-platform/assessment-schema/roam-apps — the same constants
  // scores.js emits. `key` is the stable response-side identifier. `provisional`
  // flags columns still being validated against real run data.
  subscores: [
    {
      kind: 'number',
      key: 'freeResponse',
      label: 'Free Response',
      domain: ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.FREE_RESPONSE,
      name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.RAW_SCORE,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'multipleChoice',
      label: 'Multiple Choice',
      domain: ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.MULTIPLE_CHOICE,
      name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.RAW_SCORE,
      provisional: true,
    },
  ],
} as const;
