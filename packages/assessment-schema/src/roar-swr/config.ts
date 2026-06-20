export const SWR_TASK_IDS = {
  EN: 'swr',
  ES: 'swr-es',
  IT: 'swr-it',
  PT: 'swr-pt',
  DE: 'swr-de',
} as const;

export type SwrTaskId = (typeof SWR_TASK_IDS)[keyof typeof SWR_TASK_IDS];

/**
 * Scoring versions correspond to the CAT model used to produce normed scores.
 * V1 is used for Spanish; V6 and V7 are used for English (V7 is current).
 * Italian, Portuguese, and German have no normed scoring version.
 */
export const SWR_SCORING_VERSION = {
  V1: 1,
  V6: 6,
  V7: 7,
} as const;

export type SwrScoringVersion = (typeof SWR_SCORING_VERSION)[keyof typeof SWR_SCORING_VERSION];

/**
 * GCS URL for the SWR scoring lookup table.
 * Only English (swr) and Spanish (swr-es) have normed lookup tables.
 * The filename prefix is derived from the task ID: 'swr' → 'swr', 'swr-es' → 'swr_es'.
 *
 * Currently only used by the roar-swr assessment app (src/experiment/scores.js).
 *
 * @param taskId - The task ID for the language variant
 * @param version - The scoring version
 * @returns The full GCS URL for the lookup table
 */
export const SWR_SCORE_TABLE_URL = (taskId: 'swr' | 'swr-es', version: SwrScoringVersion): string => {
  const prefix = taskId.replace('-', '_');
  return `https://storage.googleapis.com/roar-swr/scores/${prefix}_lookup_v${version}.csv`;
};
