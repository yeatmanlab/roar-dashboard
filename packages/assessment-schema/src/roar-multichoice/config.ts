export const MORPHOLOGY_TASK_ID = 'morphology' as const;
export type MorphologyTaskId = typeof MORPHOLOGY_TASK_ID;

export const CVA_TASK_ID = 'cva' as const;
export type CvaTaskId = typeof CVA_TASK_ID;

export type MultichoiceTaskId = MorphologyTaskId | CvaTaskId;

/**
 * Scoring versions correspond to the normed IRT lookup tables published to GCS.
 * V1 is current for both morphology and CVA.
 */
export const MULTICHOICE_SCORING_VERSION = {
  V1: 1,
} as const;

export type MultichoiceScoringVersion =
  (typeof MULTICHOICE_SCORING_VERSION)[keyof typeof MULTICHOICE_SCORING_VERSION];

/**
 * GCS URL for the normed IRT scoring lookup table.
 *
 * @param task - 'morphology' or 'cva'
 * @param version - The scoring version (from MULTICHOICE_SCORING_VERSION)
 */
export const MULTICHOICE_SCORE_TABLE_URL = (
  task: 'morphology' | 'cva',
  version: MultichoiceScoringVersion,
): string => `https://storage.googleapis.com/roar-survey/scores/${task}_lookup_v${version}.csv`;
