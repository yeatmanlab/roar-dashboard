import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import type { RunScore, NewRunScore } from '../db/schema';
import { runScores } from '../db/schema/assessment';
import type { Transaction } from './interfaces/base.repository.interface';

/**
 * Parameters for upserting many run-score rows.
 */
export interface RunScoresUpsertManyParams {
  /** Score rows to upsert. */
  data: NewRunScore[];

  /** Optional transaction context — pass when called inside an existing transaction. */
  transaction?: Transaction;
}

/**
 * Run Scores Repository
 *
 * Provides data access methods for the `app.run_scores` table.
 *
 * The natural key `(run_id, type, domain, name, assessment_stage)` is enforced by a
 * unique constraint with `NULLS NOT DISTINCT`, which lets `upsertMany` use
 * `ON CONFLICT ... DO UPDATE` to replace the current value for any given score
 * within a run. This matches the read-path invariant in `report.repository.ts`
 * that assumes at most one current row per natural key.
 */
export class RunScoresRepository extends BaseRepository<RunScore, typeof runScores> {
  constructor(db: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {
    super(db, runScores);
  }

  /**
   * Upsert one or more score rows by their natural key.
   *
   * Existing rows matching `(run_id, type, domain, name, assessment_stage)` are updated
   * with the incoming `value` and `category_score`; rows with no match are inserted.
   * `updated_at` is bumped automatically by the `run_scores_set_updated_at` trigger.
   *
   * Idempotent: replaying the same input produces the same final state.
   *
   * Returns an empty array on empty input.
   *
   * @param params - Score rows to upsert and optional transaction context
   * @returns Array of `{ id }` for each affected row. Postgres does not formally guarantee
   *          ordering of `RETURNING` rows for multi-value inserts, so callers should not
   *          rely on a specific correspondence between input and output indices.
   */
  async upsertMany(params: RunScoresUpsertManyParams): Promise<{ id: string }[]> {
    const { data, transaction } = params;
    if (data.length === 0) return [];

    const db = transaction ?? this.db;

    const result = await db
      .insert(runScores)
      .values(data)
      .onConflictDoUpdate({
        target: [runScores.runId, runScores.type, runScores.domain, runScores.name, runScores.assessmentStage],
        set: {
          // EXCLUDED references the row that would have been inserted; this lets the update
          // pick up the incoming value instead of leaving the prior one in place.
          // updated_at is bumped automatically by the run_scores_set_updated_at trigger.
          value: sql`excluded.value`,
          categoryScore: sql`excluded.category_score`,
        },
      })
      .returning({ id: runScores.id });

    return result;
  }
}
