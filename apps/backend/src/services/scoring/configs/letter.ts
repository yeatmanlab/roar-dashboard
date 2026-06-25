import {
  LETTER_SUBTASK_SCORE_NAMES,
  LETTER_SUBTASK_DOMAINS,
  LETTER_COMPOSITE_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roar-letter';

/**
 * Letter ("ROAR-Letter") scoring config — letter, letter-es, letter-en-ca.
 *
 * Score-name strings come from the shared roar-letter module (the same
 * assessment that emits them), so letter is no longer provisional. The subscore
 * table is DOMAIN-INDEXED: each per-subtask value is the GENERIC `subScore`
 * emitted under a per-subtask domain (LowercaseNames / UppercaseNames /
 * Phonemes), matching the legacy dashboard mapping in `ScoreReport.vue`
 * (Lower Case = LowercaseNames.subScore, Total = composite.totalCorrect,
 * Letters To Work On = upperIncorrect + lowerIncorrect, etc.). Columns are
 * stringPassthrough — display-as-is, non-sortable — to mirror the dashboard's
 * text columns.
 *
 * Note: only English `letter` emits computed scores; `letter-es` and
 * `letter-en-ca` return null from the assessment's computedScoreCallback, so
 * their subscore cells resolve to null.
 */
export default {
  taskSlugs: ['letter', 'letter-es', 'letter-en-ca'],
  scoreFields: {
    percentile: [{ minVersion: 0, fieldName: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT }],
    percentileDisplay: [{ minVersion: 0, fieldName: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT }],
    // Letter has no standard score — preserve the base config's null fields.
    standardScore: [{ minVersion: 0, fieldName: null }],
    standardScoreDisplay: [{ minVersion: 0, fieldName: null }],
    rawScore: [{ minVersion: 0, fieldName: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT }],
  },
  classification: {
    type: 'none',
  },
  subscores: [
    {
      kind: 'stringPassthrough',
      key: 'lowerCase',
      label: 'Lower Case',
      name: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE,
      domain: LETTER_SUBTASK_DOMAINS.LOWERCASE_NAMES,
    },
    {
      kind: 'stringPassthrough',
      key: 'upperCase',
      label: 'Upper Case',
      name: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE,
      domain: LETTER_SUBTASK_DOMAINS.UPPERCASE_NAMES,
    },
    {
      kind: 'stringPassthrough',
      key: 'letterSounds',
      label: 'Letter Sounds',
      name: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE,
      domain: LETTER_SUBTASK_DOMAINS.PHONEMES,
    },
    {
      // Composite total correct (unique name; flat lookup, no domain needed).
      kind: 'stringPassthrough',
      key: 'total',
      label: 'Total',
      name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
    },
    {
      // Merge the upper- and lower-case incorrect-item lists, mirroring the
      // dashboard's combined "Letters To Work On" column.
      kind: 'letterToWorkOn',
      key: 'lettersToWorkOn',
      label: 'Letters To Work On',
      sources: [
        { name: LETTER_SUBTASK_SCORE_NAMES.UPPER_INCORRECT, domain: LETTER_SUBTASK_DOMAINS.UPPERCASE_NAMES },
        { name: LETTER_SUBTASK_SCORE_NAMES.LOWER_INCORRECT, domain: LETTER_SUBTASK_DOMAINS.LOWERCASE_NAMES },
      ],
    },
    {
      kind: 'stringPassthrough',
      key: 'soundsToWorkOn',
      label: 'Sounds To Work On',
      name: LETTER_SUBTASK_SCORE_NAMES.PHONEME_INCORRECT,
      domain: LETTER_SUBTASK_DOMAINS.PHONEMES,
    },
  ],
};
