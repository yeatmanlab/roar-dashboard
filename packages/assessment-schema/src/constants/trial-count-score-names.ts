/**
 * Trial count score names shared across all ROAR assessments.
 *
 * Assessment-specific score-name maps (PA_SCORE_NAMES, SWR_SCORE_NAMES) spread
 * this object so the canonical strings live in exactly one place.
 */
export const TRIAL_COUNT_SCORE_NAMES = {
  NUM_CORRECT: 'numCorrect',
  NUM_ATTEMPTED: 'numAttempted',
  NUM_INCORRECT: 'numIncorrect',
} as const;
