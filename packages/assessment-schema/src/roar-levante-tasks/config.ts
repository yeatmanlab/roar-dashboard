/**
 * Canonical task IDs for the ROAR LEVANTE normed tasks.
 * Only trog and roar-inference have backend scoring configurations today.
 * Task IDs for all 12 levante tasks will be added in a follow-on PR once
 * the full assessment-schema migration is complete.
 */
export const LEVANTE_NORMED_TASK_IDS = {
  TROG: 'trog',
  ROAR_INFERENCE: 'roar-inference',
} as const;

export type LevanteNormedTaskId = (typeof LEVANTE_NORMED_TASK_IDS)[keyof typeof LEVANTE_NORMED_TASK_IDS];

/**
 * Scoring versions correspond to the GCS lookup table generation used to
 * produce normed scores. V1 is the initial release for trog and roar-inference.
 */
export const LEVANTE_SCORING_VERSION = {
  V1: 1,
} as const;

export type LevanteScoringVersion = (typeof LEVANTE_SCORING_VERSION)[keyof typeof LEVANTE_SCORING_VERSION];

/**
 * Per-task GCS bucket and CSV prefix for LEVANTE normed score lookup tables.
 * Each normed task stores its lookup table in a dedicated bucket.
 */
const LEVANTE_NORMED_TASK_TABLE_CONFIG: Record<LevanteNormedTaskId, { bucket: string; csvPrefix: string }> = {
  [LEVANTE_NORMED_TASK_IDS.TROG]: { bucket: 'roar-syntax', csvPrefix: 'trog' },
  [LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE]: { bucket: 'roar-inference', csvPrefix: 'inference' },
};

/**
 * GCS URL for a LEVANTE normed scoring lookup table.
 *
 * @param taskId - The normed LEVANTE task ID (trog or roar-inference)
 * @param version - The scoring version
 * @returns The full GCS URL for the lookup table CSV
 */
export const LEVANTE_SCORE_TABLE_URL = (taskId: LevanteNormedTaskId, version: LevanteScoringVersion): string => {
  const { bucket, csvPrefix } = LEVANTE_NORMED_TASK_TABLE_CONFIG[taskId];
  return `https://storage.googleapis.com/${bucket}/scores/${csvPrefix}_lookup_v${version}.csv`;
};
