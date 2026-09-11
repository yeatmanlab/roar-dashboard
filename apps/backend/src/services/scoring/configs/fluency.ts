import {
  ROAM_FLUENCY_ARF_TASK_IDS,
  ROAM_FLUENCY_CALF_TASK_IDS,
  ROAM_FLUENCY_SUBTASK_DOMAINS,
  ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS,
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES,
  ROAM_FLUENCY_COMPOSITE_SCORE_NAMES,
  ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roam-apps';

const COMPOSITE_DOMAIN = 'composite';

const responseModalityColumns = [
  {
    keyPrefix: 'freeResponse',
    label: 'Free Response',
    domain: ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.FREE_RESPONSE,
  },
  {
    keyPrefix: 'multipleChoice',
    label: 'Multiple Choice',
    domain: ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.MULTIPLE_CHOICE,
  },
].flatMap(({ keyPrefix, label, domain }) => [
  {
    kind: 'number' as const,
    key: keyPrefix,
    label,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.RAW_SCORE,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${keyPrefix}NumCorrect`,
    label: `${label} Num Correct`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_CORRECT,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${keyPrefix}NumIncorrect`,
    label: `${label} Num Incorrect`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_INCORRECT,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${keyPrefix}NumAttempted`,
    label: `${label} Num Attempted`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED,
    provisional: true,
  },
]);

const fluencySubtaskColumns = Object.values(ROAM_FLUENCY_SUBTASK_DOMAINS).flatMap((domain) => [
  {
    kind: 'number' as const,
    key: `${domain}RawScore`,
    label: `${domain} Raw Score`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.RAW_SCORE,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${domain}NumCorrect`,
    label: `${domain} Num Correct`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_CORRECT,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${domain}NumIncorrect`,
    label: `${domain} Num Incorrect`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_INCORRECT,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${domain}NumAttempted`,
    label: `${domain} Num Attempted`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED,
    provisional: true,
  },
  {
    kind: 'number' as const,
    key: `${domain}PercentCorrect`,
    label: `${domain} Percent Correct`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
    provisional: true,
  },
  {
    kind: 'stringPassthrough' as const,
    key: `${domain}SkillsAssessed`,
    label: `${domain} Problem Types Assessed`,
    domain,
    name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.SKILLS_ASSESSED,
    provisional: true,
  },
]);

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
      key: 'compositeRawScore',
      label: 'Raw Score',
      domain: COMPOSITE_DOMAIN,
      name: ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.RAW_SCORE,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'compositeNumCorrect',
      label: 'Num Correct',
      domain: COMPOSITE_DOMAIN,
      name: ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'compositeNumIncorrect',
      label: 'Num Incorrect',
      domain: COMPOSITE_DOMAIN,
      name: ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_INCORRECT,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'compositeNumAttempted',
      label: 'Num Attempted',
      domain: COMPOSITE_DOMAIN,
      name: ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'compositePercentCorrect',
      label: 'Percent Correct',
      domain: COMPOSITE_DOMAIN,
      name: ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.SUB_PERCENT_CORRECT,
      provisional: true,
    },
    ...responseModalityColumns,
    ...fluencySubtaskColumns,
    ...Object.entries(ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES).map(([key, name]) => ({
      kind: 'stringPassthrough' as const,
      key: name,
      label: key,
      domain: COMPOSITE_DOMAIN,
      name,
      provisional: true,
    })),
  ],
} as const;
