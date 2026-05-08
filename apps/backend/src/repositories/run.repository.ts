import { sql, inArray, eq, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import type { Run } from '../db/schema/';
import { runs } from '../db/schema/assessment';
import type { BaseGetByIdParams, Transaction } from './interfaces/base.repository.interface';
import { SCORE_TYPE, SCORE_DOMAIN, ASSESSMENT_STAGE, SCORE_NAME } from '../constants/run-scores';

/**
 * Run stats for an administration (started/completed counts from assessment DB).
 */
export interface AdministrationRunStats {
  started: number;
  completed: number;
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
      .where(and(inArray(runs.administrationId, administrationIds), isNull(runs.deletedAt)))
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
   * Get a non-deleted run by administration ID.
   *
   * Returns the first non-deleted run found for the given administration, or null if none exist.
   * Useful for checking existence (null check) or accessing run data.
   *
   * @param administrationId - The administration ID to look up
   * @returns The first run for this administration, or null if none exist
   */
  async getByAdministrationId(administrationId: string): Promise<Run | null> {
    const result = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.administrationId, administrationId), isNull(runs.deletedAt)))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Recompute `use_for_reporting` for all runs in a `(user_id, administration_id, task_variant_id)`
   * partition, atomically promoting the single best run to `true` and demoting all others to
   * `false`.
   *
   * The "best run" is determined by a four-tier ranking that mirrors the legacy Firestore
   * `selectBestRun` behavior:
   *
   * 1. Reliable + completed — earliest `created_at`
   * 2. Reliable + incomplete — lowest `thetaSE`, then highest `numAttempted`
   * 3. Unreliable + completed — latest `created_at`
   * 4. Unreliable + incomplete — lowest `thetaSE`, then highest `numAttempted`, then earliest `created_at`
   *
   * Implementation notes:
   *
   * - The partition's candidates (non-deleted, non-aborted runs) are locked via `FOR UPDATE`
   *   so concurrent recomputes for the same partition serialize at the row-lock level.
   * - The outer `UPDATE` deliberately includes aborted runs (only `deleted_at IS NULL`) so a
   *   previously-true `use_for_reporting` on a now-aborted or now-ineligible run gets reset to
   *   `false` in the same statement.
   * - If no candidates exist (e.g., every run in the partition is aborted), the statement
   *   sets every run's `use_for_reporting` to `false`, which is the correct behavior.
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
    const thetaSeName = SCORE_NAME.THETA_SE;
    const numAttemptedName = SCORE_NAME.NUM_ATTEMPTED;
    const scoreType = SCORE_TYPE.RAW;
    const scoreDomain = SCORE_DOMAIN.COMPOSITE;
    const scoreStage = ASSESSMENT_STAGE.TEST;

    // SQL shape rationale:
    // - `locked_candidates` acquires row locks on the eligible runs (non-deleted, non-aborted)
    //   so concurrent recomputes for the same partition serialize. FOR UPDATE cannot coexist
    //   with window functions in the same CTE, so the ranking happens in a follow-on CTE that
    //   reads the locked rows.
    // - The outer UPDATE uses a scalar subquery on `winner` rather than `UPDATE ... FROM`
    //   because UPDATE...FROM is an inner join: if `winner` is empty (e.g., every run in the
    //   partition is aborted), the outer UPDATE would affect zero rows and previously-true
    //   `use_for_reporting` flags would not get reset to false. With a scalar subquery and
    //   `IS TRUE`, an empty winner produces NULL on every row's comparison, which `IS TRUE`
    //   collapses to false — the desired "no eligible runs → all false" behavior.
    // - The outer WHERE deliberately omits `aborted_at IS NULL` so that previously-true
    //   `use_for_reporting` on a now-aborted (or now-ineligible) run gets reset.
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
                WHEN lc.reliable_run AND lc.completed_at IS NOT NULL THEN 1
                WHEN lc.reliable_run AND lc.completed_at IS NULL THEN 2
                WHEN NOT lc.reliable_run AND lc.completed_at IS NOT NULL THEN 3
                ELSE 4
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
