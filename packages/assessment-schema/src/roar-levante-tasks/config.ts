/**
 * Canonical task IDs for the ROAR LEVANTE normed tasks.
 * These tasks write IRT-based scores (theta, roarScore, standardScore, percentile)
 * via GCS lookup tables.
 */
export const LEVANTE_NORMED_TASK_IDS = {
  TROG: 'trog',
  ROAR_INFERENCE: 'roar-inference',
} as const;

export type LevanteNormedTaskId = (typeof LEVANTE_NORMED_TASK_IDS)[keyof typeof LEVANTE_NORMED_TASK_IDS];

/**
 * Canonical task IDs for LEVANTE tasks with provisional scoring configs.
 * These tasks write raw count-based scores (totalCorrect, totalNumAttempted,
 * totalPercentCorrect) only. Normed scoring is deferred pending psychometrics.
 */
export const LEVANTE_PROVISIONAL_TASK_IDS = {
  EGMA_MATH: 'egma-math',
  MATRIX_REASONING: 'matrix-reasoning',
  MENTAL_ROTATION: 'mental-rotation',
  SAME_DIFFERENT_SELECTION: 'same-different-selection',
  THEORY_OF_MIND: 'theory-of-mind',
} as const;

export type LevanteProvisionalTaskId = (typeof LEVANTE_PROVISIONAL_TASK_IDS)[keyof typeof LEVANTE_PROVISIONAL_TASK_IDS];

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
