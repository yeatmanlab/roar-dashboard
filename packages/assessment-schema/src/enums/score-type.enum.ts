/**
 * Score type enum for run_scores entries.
 *
 * Values match api-contract's ScoreTypeSchema and the backend
 * run_scores.type column.
 *
 * - RAW: live state captured per trial (CAT theta progression, trial counts)
 * - COMPUTED: derived/aggregate values (percentile, standard score, normed lookups)
 */
export enum ScoreType {
  RAW = 'raw',
  COMPUTED = 'computed',
}
