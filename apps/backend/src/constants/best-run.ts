/**
 * Best-run selection constants
 *
 * These constants name the four-tier ranking that determines which run in a
 * `(user_id, administration_id, task_variant_id)` partition carries
 * `use_for_reporting = true`. They're consumed by
 * `RunRepository.recomputeUseForReporting` and exist primarily as a semantic
 * anchor — naming the tiers in TypeScript makes the SQL CASE expression
 * readable to anyone scanning the file without having to reverse-engineer the
 * "1/2/3/4" priority order.
 *
 * The numeric values are arbitrary; they're chosen so that lower numbers
 * correspond to higher priority (Postgres sorts ascending by default).
 *
 * Selection priority (mirrors the legacy Firestore `selectBestRun` behavior):
 *   1. Reliable + completed   — earliest `created_at`
 *   2. Reliable + incomplete  — lowest `thetaSE`, then highest `numAttempted`
 *   3. Unreliable + completed — latest `created_at`
 *   4. Unreliable + incomplete — lowest `thetaSE`, then highest `numAttempted`,
 *                                then earliest `created_at`
 */
export const BEST_RUN_TIER = {
  RELIABLE_COMPLETED: 1,
  RELIABLE_INCOMPLETE: 2,
  UNRELIABLE_COMPLETED: 3,
  UNRELIABLE_INCOMPLETE: 4,
} as const;

export type BestRunTierValue = (typeof BEST_RUN_TIER)[keyof typeof BEST_RUN_TIER];
