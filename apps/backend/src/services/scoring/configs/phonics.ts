import {
  PHONICS_SUBSKILL_KEYS,
  PHONICS_SUBSKILL_DEFS,
  PHONICS_COMPOSITE_SCORE_NAMES,
} from '@roar-platform/assessment-schema/roar-letter';

/**
 * Phonics scoring config.
 *
 * Phonics is a task WITHIN the ROAR-Letter assessment ("Letter and Phonics"),
 * so its column grouping — label + correct/attempted names per sub-skill — comes
 * from `PHONICS_SUBSKILL_DEFS` in the shared roar-letter module. The backend
 * adds only the report-presentation bits (`kind`, `key`, `round`). A rename of
 * any phonics field in assessment-schema is now a compile error here.
 *
 * The 9 sub-skill columns are itemLevel with distinct correct/attempted names
 * (no domain). Phonics emits no per-skill percentCorrect, so the per-skill
 * columns aren't numerically sortable; the `totalPercentCorrect` number column
 * is. Keys stay snake_case to preserve the individual-student-report's keys.
 */
export default {
  taskSlugs: ['phonics'],
  scoreFields: {
    percentile: [{ minVersion: 0, fieldName: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT }],
    percentileDisplay: [{ minVersion: 0, fieldName: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT }],
    standardScore: [{ minVersion: 0, fieldName: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT }],
    standardScoreDisplay: [{ minVersion: 0, fieldName: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT }],
    rawScore: [{ minVersion: 0, fieldName: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT }],
  },
  classification: {
    type: 'none',
  },
  subscores: [
    ...PHONICS_SUBSKILL_KEYS.map((key) => ({
      kind: 'itemLevel' as const,
      key,
      label: PHONICS_SUBSKILL_DEFS[key].label,
      correctName: PHONICS_SUBSKILL_DEFS[key].correctName,
      attemptedName: PHONICS_SUBSKILL_DEFS[key].attemptedName,
    })),
    {
      kind: 'number' as const,
      key: 'totalPercentCorrect',
      label: 'Total % Correct',
      name: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT,
      round: true,
    },
  ],
  displayCategory: [{ minVersion: 0, category: 'percentCorrect' }],
  displayRanges: {
    percentCorrect: { min: 0, max: 100 },
    // Raw-score breakdown range, matching the dashboard's getRawScoreRange for phonics.
    rawScore: { min: 0, max: 150 },
  },
};
