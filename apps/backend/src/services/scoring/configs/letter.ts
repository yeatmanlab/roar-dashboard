import {
  LETTER_SUBSCORE_KEYS,
  LETTER_SUBSCORE_DEFS,
  LETTER_COMPOSITE_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roar-letter';

/**
 * Letter ("ROAR-Letter") scoring config — letter, letter-es, letter-en-ca.
 *
 * The column grouping — label, run_scores name, and domain per subtask — comes
 * from `LETTER_SUBSCORE_DEFS` in the shared roar-letter module; the backend adds
 * only the report-presentation bits (`kind`, `key`) and the composite / computed
 * columns. Letter is domain-indexed: each per-subtask value is the GENERIC
 * `subScore` emitted under a per-subtask domain (LowercaseNames / UppercaseNames
 * / Phonemes). Mirrors the legacy dashboard mapping in `ScoreReport.vue`. Columns
 * are stringPassthrough — display-as-is, non-sortable — like the dashboard.
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
    // Per-subtask subScore columns (domain-indexed), grouping from roar-letter.
    ...LETTER_SUBSCORE_KEYS.map((key) => ({
      kind: 'stringPassthrough' as const,
      key,
      label: LETTER_SUBSCORE_DEFS[key].label,
      name: LETTER_SUBSCORE_DEFS[key].scoreName,
      domain: LETTER_SUBSCORE_DEFS[key].domain,
    })),
    {
      // Composite total correct (unique name; flat lookup, no domain needed).
      kind: 'stringPassthrough' as const,
      key: 'total',
      label: 'Total',
      name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
    },
    {
      // Merge the upper- and lower-case incorrect-item lists, mirroring the
      // dashboard's combined "Letters To Work On" column.
      kind: 'letterToWorkOn' as const,
      key: 'lettersToWorkOn',
      label: 'Letters To Work On',
      sources: [
        { name: LETTER_SUBSCORE_DEFS.upperCase.incorrectName, domain: LETTER_SUBSCORE_DEFS.upperCase.domain },
        { name: LETTER_SUBSCORE_DEFS.lowerCase.incorrectName, domain: LETTER_SUBSCORE_DEFS.lowerCase.domain },
      ],
    },
    {
      kind: 'stringPassthrough' as const,
      key: 'soundsToWorkOn',
      label: 'Sounds To Work On',
      name: LETTER_SUBSCORE_DEFS.letterSounds.incorrectName,
      domain: LETTER_SUBSCORE_DEFS.letterSounds.domain,
    },
  ],
  displayCategory: [{ minVersion: 0, category: 'percentCorrect' }],
  displayRanges: {
    percentCorrect: { min: 0, max: 100 },
    // Raw-score breakdown range, matching the dashboard's getRawScoreRange for letter.
    rawScore: { min: 0, max: 90 },
  },
};
