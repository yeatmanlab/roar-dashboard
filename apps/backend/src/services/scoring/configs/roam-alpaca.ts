import {
  ROAM_ALPACA_TASK_IDS,
  ROAM_ALPACA_SUBTASK_DOMAINS,
  ROAM_ALPACA_SUBTASK_SCORE_NAMES,
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roam-apps';

export default {
  taskSlugs: [ROAM_ALPACA_TASK_IDS.EN, ROAM_ALPACA_TASK_IDS.ES, ROAM_ALPACA_TASK_IDS.PT],
  scoreFields: {
    percentile: [{ minVersion: 0, fieldName: null }],
    percentileDisplay: [{ minVersion: 0, fieldName: null }],
    standardScore: [{ minVersion: 0, fieldName: null }],
    standardScoreDisplay: [{ minVersion: 0, fieldName: null }],
    rawScore: [{ minVersion: 0, fieldName: null }],
  },
  classification: {
    type: 'assessment-computed',
    supportLevelField: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.SUPPORT_LEVEL,
  },
  // Ordered subscore-table columns. run_scores names/domains come from
  // @roar-platform/assessment-schema/roam-apps — the same constants scores.js
  // emits, so producer and reader can't drift. Per-subtask columns read the
  // shared `subPercentCorrect` name disambiguated by `domain`; composite columns
  // read distinct names. `key` is the stable response-side identifier (kept a
  // literal, decoupled from the run_scores domain string). `provisional` flags
  // columns still being validated against real run data.
  subscores: [
    {
      kind: 'number',
      key: 'rawScore',
      label: 'Raw Score',
      name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.ROAR_SCORE,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'numberKnowledge',
      label: 'Number Knowledge',
      domain: ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_KNOWLEDGE,
      name: ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'geometry',
      label: 'Geometry',
      domain: ROAM_ALPACA_SUBTASK_DOMAINS.GEOMETRY,
      name: ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'arithmeticExpressions',
      label: 'Arithmetic Expressions',
      domain: ROAM_ALPACA_SUBTASK_DOMAINS.ARITHMETIC_EXPRESSIONS,
      name: ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'rationalNumbersProbability',
      label: 'Rational Numbers & Probability',
      domain: ROAM_ALPACA_SUBTASK_DOMAINS.RATIONAL_NUMBERS_PROBABILITY,
      name: ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
      provisional: true,
    },
    {
      kind: 'number',
      key: 'algebraicThinking',
      label: 'Algebraic Thinking',
      domain: ROAM_ALPACA_SUBTASK_DOMAINS.ALGEBRAIC_THINKING,
      name: ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
      provisional: true,
    },
    {
      kind: 'stringPassthrough',
      key: 'incorrectSkills',
      label: 'Skills To Work On',
      name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.INCORRECT_SKILLS,
      provisional: true,
    },
  ],
} as const;
