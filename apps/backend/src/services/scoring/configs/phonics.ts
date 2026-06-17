import { PHONICS_GROUP_SCORE_NAMES, PHONICS_COMPOSITE_SCORE_NAMES } from '@roar-platform/assessment-schema/roar-letter';

/**
 * Phonics scoring config.
 *
 * Phonics is a task WITHIN the ROAR-Letter assessment ("Letter and Phonics"),
 * so its `run_scores.name` strings live in the shared roar-letter module
 * (`PHONICS_GROUP_SCORE_NAMES` / `PHONICS_COMPOSITE_SCORE_NAMES`) — the single
 * source of truth shared with the assessment, not a standalone phonics module.
 *
 * The 9 sub-skill columns are itemLevel with distinct correct/attempted names
 * (no domain disambiguation needed, unlike PA). Phonics emits per-skill
 * correct/attempted counts but no per-skill percentCorrect, so no
 * `percentCorrectName` is declared and the per-skill columns aren't numerically
 * sortable; the derived percent is still computed by the individual-student
 * report. The `totalPercentCorrect` number column IS numerically sortable.
 * Column keys stay snake_case to preserve the response keys the
 * individual-student-report already emits.
 */
const PHONICS_SUBSKILL_COLUMNS = [
  {
    key: 'cvc',
    label: 'CVC',
    correctName: PHONICS_GROUP_SCORE_NAMES.CVC_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.CVC_ATTEMPTED,
  },
  {
    key: 'digraph',
    label: 'Digraph',
    correctName: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_ATTEMPTED,
  },
  {
    key: 'initial_blend',
    label: 'Initial Blend',
    correctName: PHONICS_GROUP_SCORE_NAMES.INITIAL_BLEND_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.INITIAL_BLEND_ATTEMPTED,
  },
  {
    key: 'tri_blend',
    label: 'Triple Blend',
    correctName: PHONICS_GROUP_SCORE_NAMES.TRI_BLEND_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.TRI_BLEND_ATTEMPTED,
  },
  {
    key: 'final_blend',
    label: 'Final Blend',
    correctName: PHONICS_GROUP_SCORE_NAMES.FINAL_BLEND_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.FINAL_BLEND_ATTEMPTED,
  },
  {
    key: 'r_controlled',
    label: 'R-Controlled',
    correctName: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_ATTEMPTED,
  },
  {
    key: 'r_cluster',
    label: 'R-Cluster',
    correctName: PHONICS_GROUP_SCORE_NAMES.R_CLUSTER_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.R_CLUSTER_ATTEMPTED,
  },
  {
    key: 'silent_e',
    label: 'Silent E',
    correctName: PHONICS_GROUP_SCORE_NAMES.SILENT_E_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.SILENT_E_ATTEMPTED,
  },
  {
    key: 'vowel_team',
    label: 'Vowel Team',
    correctName: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_ATTEMPTED,
  },
] as const;

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
    ...PHONICS_SUBSKILL_COLUMNS.map((c) => ({
      kind: 'itemLevel' as const,
      key: c.key,
      label: c.label,
      correctName: c.correctName,
      attemptedName: c.attemptedName,
    })),
    {
      kind: 'number' as const,
      key: 'totalPercentCorrect',
      label: 'Total % Correct',
      name: PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_PERCENT_CORRECT,
      round: true,
    },
  ],
};
