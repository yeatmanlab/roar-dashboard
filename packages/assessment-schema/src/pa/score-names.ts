/**
 * Canonical run_scores.name strings written by the PA scoring callback.
 * This is the single source of truth — both the assessment and the backend
 * scoring registry import from here to prevent field-name drift.
 *
 * Note: #Attempted names are not emitted by scores.js (which only tracks
 * numCorrect and percentCorrect per subtask). They are kept in PA_SUBSCORE_DEFS
 * for UI display purposes but should never appear in run_scores.
 */
export const PA_SCORE_NAMES = {
  // Summary scores
  RAW_SCORE: "roarScore",
  PERCENTILE: "percentile",
  PERCENTILE_SPR: "sprPercentile",
  PERCENTILE_STRING_SPR: "sprPercentileString",
  STANDARD_SCORE: "standardScore",
  STANDARD_SCORE_SPR: "sprStandardScore",
  STANDARD_SCORE_STRING_SPR: "sprStandardScoreString",

  // FSM subscores (First Sound Match)
  FSM_CORRECT: "fsmCorrect",
  FSM_PERCENT_CORRECT: "fsmPercentCorrect",

  // LSM subscores (Last Sound Match)
  LSM_CORRECT: "lsmCorrect",
  LSM_PERCENT_CORRECT: "lsmPercentCorrect",

  // DEL subscores (Delete)
  DEL_CORRECT: "delCorrect",
  DEL_PERCENT_CORRECT: "delPercentCorrect",
} as const;

export type PaScoreName = (typeof PA_SCORE_NAMES)[keyof typeof PA_SCORE_NAMES];
