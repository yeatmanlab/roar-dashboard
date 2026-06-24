/**
 * Foundational composite service types.
 *
 * Service-owned types (not imported from the api-contract) per `backend-service-pattern`.
 */

/**
 * A single LPW subtest's theta pair, read from its `use_for_reporting` run under
 * `(type = computed, domain = composite_foundational)`. Both values come from the same
 * run. `thetaSE` must be `> 0` to contribute (inverse-variance weighting).
 */
export interface SubtestThetaInput {
  thetaEstimate: number;
  thetaSE: number;
}

/**
 * Assembled inputs to the pure composite calculation.
 *
 * - `lpw` — the available Letter/Phoneme/Word theta pairs (0–3 entries).
 * - `sreTransformed` — the Sentence/SRE transformed score (its `thetaEstimate`), or `null` if the
 *   student did not take Sentence (or it produced no score).
 */
export interface FoundationalCompositeInputs {
  lpw: SubtestThetaInput[];
  sreTransformed: number | null;
}

/**
 * Parameters for recomputing and persisting a student's foundational composite.
 *
 * `transaction` is **required** — the recompute reads its own writes (the just-recomputed
 * `use_for_reporting` flags) and takes a transaction-scoped advisory lock, both of which
 * only work inside a transaction (the `writeTrial` tx).
 */
export interface RecomputeFoundationalCompositeParams {
  userId: string;
  administrationId: string;
  /** The `task_id` of the run whose trial write triggered the recompute. */
  triggeringTaskId: string;
  /** The assessment-DB transaction the recompute must run in (the `writeTrial` tx). */
  transaction: import('../../repositories/interfaces/base.repository.interface').Transaction;
}
