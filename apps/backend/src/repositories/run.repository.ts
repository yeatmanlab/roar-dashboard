import { sql, inArray, eq, and, isNull, ne, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import type { Run } from '../db/schema/';
import { runs, runScores } from '../db/schema/assessment';
import type { BaseGetByIdParams, Transaction } from './interfaces/base.repository.interface';
import { SCORE_TYPE, SCORE_DOMAIN, ASSESSMENT_STAGE, SCORE_NAME } from '../constants/run-scores';
import { BEST_RUN_TIER } from '../constants/best-run';
import { COMPOSITE_RUN_TASK_ID, COMPOSITE_RUN_TASK_VARIANT_ID, COMPOSITE_RUN_TASK_VERSION } from '../constants/run';

/**
 * Run stats for an administration (started/completed counts from assessment DB).
 */
export interface AdministrationRunStats {
  started: number;
  completed: number;
}

/**
 * A single foundational-composite input score row: one `run_scores` row from a subtest's
 * `use_for_reporting` run, tagged with the run's `taskId` so the service can route it to
 * the correct subtest by slug.
 */
export interface CompositeInputScoreRow {
  taskId: string;
  runId: string;
  domain: string;
  name: string;
  value: string;
}

/**
 * Result of gathering foundational-composite inputs: the relevant score `rows`, plus
 * `reportingTaskIds` — the requested tasks that have a `use_for_reporting` run at all
 * (regardless of whether it produced composite scores). The latter lets callers tell
 * "subtest not taken" apart from "subtest taken but produced no usable score".
 */
export interface CompositeGatherResult {
  rows: CompositeInputScoreRow[];
  reportingTaskIds: string[];
}

/**
 * Run Repository
 *
 * Provides data access methods for the runs table.
 * Extends BaseRepository for standard CRUD operations.
 */
export class RunRepository extends BaseRepository<Run, typeof runs> {
  constructor(db: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {
    super(db, runs);
  }

  /**
   * Retrieves a run by ID, excluding soft-deleted records.
   *
   * Overrides the base implementation to filter out runs where `deletedAt` is set,
   * ensuring deleted runs are invisible to all code paths.
   *
   * @param params - Object containing the run ID
   * @returns The run if found and not soft-deleted, null otherwise
   */
  override async getById(params: BaseGetByIdParams): Promise<Run | null> {
    const [entity] = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.id, params.id), isNull(runs.deletedAt)))
      .limit(1);

    return entity ?? null;
  }

  /**
   * Get run stats (started, completed counts) for multiple administrations.
   *
   * - started: Count of distinct users who have at least one non-deleted run
   * - completed: Count of distinct users who have at least one non-deleted completed run
   *
   * Returns a Map where keys are administration IDs and values are the stats.
   * Administrations with no runs will not appear in the map.
   *
   * @param administrationIds - Array of administration IDs to get stats for
   * @returns Map of administration ID to run stats
   */
  async getRunStatsByAdministrationIds(administrationIds: string[]): Promise<Map<string, AdministrationRunStats>> {
    if (administrationIds.length === 0) {
      return new Map();
    }

    // Count distinct users per administration (excluding soft-deleted runs):
    // - started: users with any non-deleted run record
    // - completed: users with at least one non-deleted run where completedAt is not null
    const result = await this.db
      .select({
        administrationId: runs.administrationId,
        started: sql<number>`COUNT(DISTINCT ${runs.userId})::int`,
        completed: sql<number>`COUNT(DISTINCT CASE WHEN ${runs.completedAt} IS NOT NULL THEN ${runs.userId} END)::int`,
      })
      .from(runs)
      // Exclude the synthetic foundational-composite run so it cannot inflate the
      // started/completed participation counts.
      .where(
        and(
          inArray(runs.administrationId, administrationIds),
          isNull(runs.deletedAt),
          ne(runs.taskId, COMPOSITE_RUN_TASK_ID),
        ),
      )
      .groupBy(runs.administrationId);

    const statsMap = new Map<string, AdministrationRunStats>();
    for (const row of result) {
      statsMap.set(row.administrationId, {
        started: row.started,
        completed: row.completed,
      });
    }

    return statsMap;
  }

  /**
   * Gather the foundational-composite input scores for a student in an administration.
   *
   * For each given task, picks that task's winning `use_for_reporting = true`, non-deleted
   * run — the most recent by `created_at`, with `id` as a deterministic tiebreak — chosen
   * independently of whether that run has composite scores yet, then returns the relevant
   * computed score rows from those winning runs:
   * - `(computed, composite_foundational, thetaEstimate)` — every subtest's estimate
   * - `(computed, composite_foundational, thetaSE)` — Letter/Phoneme/Word SE (for the LPW
   *   inverse-variance weights). Sentence's `thetaEstimate` is read the same way and routed
   *   to the Stage-2 blend by the service (by slug); its SE, if any, is unused.
   *
   * Selecting the run from the runs (not from a score join) guarantees the canonical newest
   * reporting run is used even when it has no composite scores yet — an older run is never
   * silently substituted. `reportingTaskIds` reports which requested tasks have a reporting
   * run at all (regardless of scores), so callers can tell "subtest not taken" apart from
   * "subtest taken but produced no usable score".
   *
   * @param params.userId - The student
   * @param params.administrationId - The administration partition
   * @param params.taskIds - The foundational subtest task IDs to gather
   * @param params.transaction - Optional transaction context (the `writeTrial` tx)
   * @returns `rows` (input score rows tagged with their run's `taskId`) and `reportingTaskIds`
   */
  async getReportingRunScoresForComposite(params: {
    userId: string;
    administrationId: string;
    taskIds: string[];
    transaction?: Transaction;
  }): Promise<CompositeGatherResult> {
    const { userId, administrationId, taskIds, transaction } = params;
    if (taskIds.length === 0) {
      return { rows: [], reportingTaskIds: [] };
    }
    const db = transaction ?? this.db;

    // 1. The winning reporting run per task — most recent by created_at, id as a
    //    deterministic tiebreak — chosen from the runs themselves (not gated by the score
    //    join) so the canonical newest reporting run is always the one used.
    const reportingRuns = await db
      .select({ taskId: runs.taskId, runId: runs.id })
      .from(runs)
      .where(
        and(
          eq(runs.userId, userId),
          eq(runs.administrationId, administrationId),
          inArray(runs.taskId, taskIds),
          eq(runs.useForReporting, true),
          isNull(runs.deletedAt),
        ),
      )
      .orderBy(desc(runs.createdAt), desc(runs.id));

    const runIdByTaskId = new Map<string, string>();
    for (const run of reportingRuns) {
      if (!runIdByTaskId.has(run.taskId)) {
        runIdByTaskId.set(run.taskId, run.runId);
      }
    }

    const reportingTaskIds = [...runIdByTaskId.keys()];
    const runIds = [...runIdByTaskId.values()];
    if (runIds.length === 0) {
      return { rows: [], reportingTaskIds };
    }

    const taskIdByRunId = new Map<string, string>();
    for (const [taskId, runId] of runIdByTaskId) {
      taskIdByRunId.set(runId, taskId);
    }

    // 2. The relevant composite input scores for exactly those winning runs.
    const scoreRows = await db
      .select({
        runId: runScores.runId,
        domain: runScores.domain,
        name: runScores.name,
        value: runScores.value,
      })
      .from(runScores)
      .where(
        and(
          inArray(runScores.runId, runIds),
          eq(runScores.type, SCORE_TYPE.COMPUTED),
          eq(runScores.domain, SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
          inArray(runScores.name, [SCORE_NAME.THETA_ESTIMATE, SCORE_NAME.THETA_SE]),
        ),
      );

    const rows = scoreRows.map((row) => ({
      taskId: taskIdByRunId.get(row.runId)!,
      runId: row.runId,
      domain: row.domain,
      name: row.name,
      value: row.value,
    }));

    return { rows, reportingTaskIds };
  }

  /**
   * Acquire the transaction-scoped advisory lock that serializes foundational-composite
   * recomputation for a `(userId, administrationId)`.
   *
   * Must be called BEFORE reading the subtests' `use_for_reporting` runs, so the whole
   * gather → compute → write sees one consistent, fully-recomputed snapshot and concurrent
   * writes for the same student/administration cannot race or lose updates.
   *
   * `transaction` is **required**: `pg_advisory_xact_lock` is transaction-scoped and
   * releases at transaction end, so acquiring it outside a transaction would release it
   * immediately and provide no protection. The required type makes that misuse a compile
   * error. `hashtext()` yields the int4 keys for the two-argument advisory-lock overload.
   *
   * @param params.userId - The student
   * @param params.administrationId - The administration
   * @param params.transaction - The transaction the lock must span (required)
   */
  async lockCompositeForUpdate(params: {
    userId: string;
    administrationId: string;
    transaction: Transaction;
  }): Promise<void> {
    const { userId, administrationId, transaction } = params;
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userId}::text), hashtext(${administrationId}::text))`,
    );
  }

  /**
   * Find or create the dedicated foundational-composite run for a `(userId,
   * administrationId)`, returning its id.
   *
   * The composite run is identified by the sentinel `COMPOSITE_RUN_TASK_ID`; there is
   * exactly one per `(userId, administrationId)`.
   *
   * Concurrency: there is no unique constraint on the sentinel run, so callers MUST already
   * hold the composite advisory lock (see {@link lockCompositeForUpdate}) for this
   * `(userId, administrationId)` before calling. `FoundationalCompositeService.recomputeForRun`
   * acquires it at the start of the recompute — that lock, not a DB constraint, is what
   * prevents duplicate composite runs and lost updates.
   *
   * @param params.userId - The student
   * @param params.administrationId - The administration
   * @param params.transaction - The transaction to run in (required; the caller must already
   *   hold the composite advisory lock via {@link lockCompositeForUpdate})
   * @returns The composite run's id
   */
  async findOrCreateCompositeRun(params: {
    userId: string;
    administrationId: string;
    transaction: Transaction;
  }): Promise<{ id: string }> {
    const { userId, administrationId, transaction } = params;
    const db = transaction;

    const existing = await db
      .select({ id: runs.id })
      .from(runs)
      .where(
        and(
          eq(runs.userId, userId),
          eq(runs.administrationId, administrationId),
          eq(runs.taskId, COMPOSITE_RUN_TASK_ID),
          isNull(runs.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const [created] = await db
      .insert(runs)
      .values({
        userId,
        taskId: COMPOSITE_RUN_TASK_ID,
        taskVariantId: COMPOSITE_RUN_TASK_VARIANT_ID,
        taskVersion: COMPOSITE_RUN_TASK_VERSION,
        administrationId,
        isAnonymous: false,
        useForReporting: true,
      })
      .returning({ id: runs.id });

    // A successful INSERT ... RETURNING always yields exactly one row.
    return created!;
  }

  /**
   * Get a non-deleted run by administration ID.
   *
   * Returns the first non-deleted run found for the given administration, or null if none exist.
   * Useful for checking existence (null check) or accessing run data.
   *
   * Excludes the synthetic foundational-composite run (`COMPOSITE_RUN_TASK_ID`) so that, for
   * example, a composite run never blocks administration deletion as if it were real
   * assessment data.
   *
   * @param administrationId - The administration ID to look up
   * @returns The first non-composite run for this administration, or null if none exist
   */
  async getByAdministrationId(administrationId: string): Promise<Run | null> {
    const result = await this.db
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.administrationId, administrationId),
          isNull(runs.deletedAt),
          ne(runs.taskId, COMPOSITE_RUN_TASK_ID),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Recompute `use_for_reporting` for all runs in a `(user_id, administration_id, task_variant_id)`
   * partition, atomically promoting the single best run to `true` and demoting all others to
   * `false`.
   *
   * The "best run" is determined by a four-tier ranking that mirrors the legacy Firestore
   * `selectBestRun` behavior. See `constants/best-run.ts` (`BEST_RUN_TIER`) for the named
   * tiers; the numeric priorities are interpolated into the SQL below rather than inlined as
   * magic numbers.
   *
   * 1. Reliable + completed — earliest `created_at`
   * 2. Reliable + incomplete — lowest `thetaSE`, then highest `numAttempted`
   * 3. Unreliable + completed — latest `created_at`
   * 4. Unreliable + incomplete — lowest `thetaSE`, then highest `numAttempted`, then earliest `created_at`
   *
   * Architectural note: this method encodes business rules (tier priority, in-tier
   * tiebreakers) in SQL. That deviates from the usual "business logic belongs in services"
   * principle, by deliberate analogy with `repositories/access-controls/` — both are cases
   * where the rules can only be applied efficiently as joins/ordering against many rows in
   * a single round-trip. Doing the ranking in TypeScript would require fetching every
   * candidate run plus its scores into memory and reintroducing TOCTOU races against
   * concurrent writers. If a second consumer of this ranking ever appears (e.g., a
   * dry-run preview endpoint), extract the ORDER BY expression into an injectable helper
   * along the lines of `AdministrationAccessControls`.
   *
   * Implementation notes:
   *
   * - The partition's candidates (non-deleted, non-aborted runs) are locked via `FOR UPDATE`
   *   so concurrent recomputes for the same partition serialize at the row-lock level.
   *   `FOR UPDATE` cannot coexist with window functions in the same CTE, so the locking
   *   happens in `locked_candidates` and the ranking happens in a follow-on `ranked` CTE.
   * - The outer `UPDATE` deliberately includes aborted runs (only `deleted_at IS NULL`) so a
   *   previously-true `use_for_reporting` on a now-aborted or now-ineligible run gets reset to
   *   `false` in the same statement.
   * - If no candidates exist (e.g., every run in the partition is aborted), the scalar
   *   subquery on `winner` returns NULL and `(r.id = NULL) IS TRUE` evaluates to `false` —
   *   so every run in the partition correctly ends up `use_for_reporting = false`. This is
   *   why the SQL uses a scalar subquery instead of `UPDATE ... FROM (winner)` (which would
   *   be an inner join and produce zero affected rows on an empty winner).
   * - thetaSE / numAttempted lookups use `LEFT JOIN` against `app.run_scores`; runs without
   *   scores still rank deterministically within their tier via `NULLS LAST`.
   * - The `created_at` column is used as a proxy for the legacy `timeStarted`; the new schema
   *   has no dedicated start timestamp.
   *
   * @param params.userId - User ID partitioning the runs
   * @param params.administrationId - Administration ID partitioning the runs
   * @param params.taskVariantId - Task variant ID partitioning the runs
   * @param params.transaction - Optional transaction context (use when called inside an existing tx)
   */
  async recomputeUseForReporting(params: {
    userId: string;
    administrationId: string;
    taskVariantId: string;
    transaction?: Transaction;
  }): Promise<void> {
    const { userId, administrationId, taskVariantId, transaction } = params;
    const db = transaction ?? this.db;

    // CAT score field names sourced from constants for consistency with the upsert path.
    const thetaSeName = SCORE_NAME.THETA_SE_RAW;
    const numAttemptedName = SCORE_NAME.NUM_ATTEMPTED;
    const scoreType = SCORE_TYPE.RAW;
    const scoreDomain = SCORE_DOMAIN.COMPOSITE;
    const scoreStage = ASSESSMENT_STAGE.TEST;

    // See the JSDoc for the architectural rationale (business logic in SQL by analogy with
    // access controls) and the choice of CTE-with-scalar-subquery over UPDATE...FROM.
    await db.execute(sql`
      WITH locked_candidates AS (
        SELECT r.id, r.reliable_run, r.completed_at, r.created_at
        FROM app.runs r
        WHERE r.user_id = ${userId}
          AND r.administration_id = ${administrationId}
          AND r.task_variant_id = ${taskVariantId}
          AND r.deleted_at IS NULL
          AND r.aborted_at IS NULL
        FOR UPDATE
      ),
      ranked AS (
        SELECT
          lc.id,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE
                WHEN lc.reliable_run AND lc.completed_at IS NOT NULL THEN ${BEST_RUN_TIER.RELIABLE_COMPLETED}
                WHEN lc.reliable_run AND lc.completed_at IS NULL THEN ${BEST_RUN_TIER.RELIABLE_INCOMPLETE}
                WHEN NOT lc.reliable_run AND lc.completed_at IS NOT NULL THEN ${BEST_RUN_TIER.UNRELIABLE_COMPLETED}
                ELSE ${BEST_RUN_TIER.UNRELIABLE_INCOMPLETE}
              END,
              CASE WHEN lc.reliable_run AND lc.completed_at IS NOT NULL THEN lc.created_at END ASC NULLS LAST,
              CASE WHEN lc.reliable_run AND lc.completed_at IS NULL THEN theta_se.value::numeric END ASC NULLS LAST,
              CASE WHEN lc.reliable_run AND lc.completed_at IS NULL THEN num_attempted.value::numeric END DESC NULLS LAST,
              CASE WHEN NOT lc.reliable_run AND lc.completed_at IS NOT NULL THEN lc.created_at END DESC NULLS LAST,
              CASE WHEN NOT lc.reliable_run AND lc.completed_at IS NULL THEN theta_se.value::numeric END ASC NULLS LAST,
              CASE WHEN NOT lc.reliable_run AND lc.completed_at IS NULL THEN num_attempted.value::numeric END DESC NULLS LAST,
              CASE WHEN NOT lc.reliable_run AND lc.completed_at IS NULL THEN lc.created_at END ASC NULLS LAST,
              lc.id ASC
          ) AS rn
        FROM locked_candidates lc
        LEFT JOIN app.run_scores theta_se
          ON theta_se.run_id = lc.id
          AND theta_se.type = ${scoreType}::app.score_type
          AND theta_se.domain = ${scoreDomain}
          AND theta_se.assessment_stage = ${scoreStage}::app.assessment_stage
          AND theta_se.name = ${thetaSeName}
        LEFT JOIN app.run_scores num_attempted
          ON num_attempted.run_id = lc.id
          AND num_attempted.type = ${scoreType}::app.score_type
          AND num_attempted.domain = ${scoreDomain}
          AND num_attempted.assessment_stage = ${scoreStage}::app.assessment_stage
          AND num_attempted.name = ${numAttemptedName}
      ),
      winner AS (
        SELECT id FROM ranked WHERE rn = 1
      )
      UPDATE app.runs r
      SET use_for_reporting = ((r.id = (SELECT id FROM winner)) IS TRUE)
      WHERE r.user_id = ${userId}
        AND r.administration_id = ${administrationId}
        AND r.task_variant_id = ${taskVariantId}
        AND r.deleted_at IS NULL
    `);
  }
}
