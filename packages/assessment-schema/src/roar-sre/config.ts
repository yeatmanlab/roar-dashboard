/**
 * IRT linear-transformation parameters for the composite_foundational domain.
 * Converts the composite sreScore (clamped to ≥ 0) to a shared-scale theta estimate:
 *   thetaEstimate = round((sreScore * scale + shift) * 10) / 10
 *
 * Derived from calibration against the foundational phonological composite in roar-pa.
 */
export const SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS = {
  /** trial_type identifier matching the CSV source these were derived from */
  TRIAL_TYPE: 'composite_foundational',
  TRANSFORMATION_SCALE: 0.0770899,
  TRANSFORMATION_SHIFT: -3.0328717,
} as const;

export const SRE_TASK_IDS = {
  EN: 'sre',
  ES: 'sre-es',
  PT: 'sre-pt',
  DE: 'sre-de',
  // TODO: Add IT: 'sre-it' when Italian translation is complete
} as const;

export type SreTaskId = (typeof SRE_TASK_IDS)[keyof typeof SRE_TASK_IDS];

/**
 * Scoring versions for SRE.
 * V1 is used for Spanish. V3 and V4 are used for English (V4 is current; V5 is reserved for the next lookup table).
 * Portuguese and German have no normed scoring version.
 */
export const SRE_SCORING_VERSION = {
  V1: 1,
  V3: 3,
  V4: 4,
  V5: 5,
} as const;

export type SreScoringVersion = (typeof SRE_SCORING_VERSION)[keyof typeof SRE_SCORING_VERSION];

/**
 * GCS URL for the SRE scoring lookup table.
 * Only English (sre) and Spanish (sre-es) have normed lookup tables.
 * The filename prefix is derived from the task ID: 'sre' → 'sre', 'sre-es' → 'sre_es'.
 *
 * @param taskId - The task ID for the language variant
 * @param version - The scoring version
 * @returns The full GCS URL for the lookup table
 */
export const SRE_SCORE_TABLE_URL = (taskId: 'sre' | 'sre-es', version: SreScoringVersion): string => {
  const prefix = taskId.replace('-', '_');
  return `https://storage.googleapis.com/roar-sre/scores/${prefix}_lookup_v${version}.csv`;
};
