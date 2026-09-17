import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runs } from './runs';
import { assessmentStageEnum, scoreTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Run Scores Table
 *
 * Stores computed scores for assessment runs. A single run can have multiple scores across
 * different domains and score types (e.g., raw score, percentile, theta estimate).
 *
 * Note: `taskId` and `taskVariantId` are denormalized from the parent run for query performance,
 * allowing score lookups without joining to the runs table.
 *
 * Key fields:
 * - `type` - Score type enum (e.g., raw, percentile, theta)
 * - `domain` - Assessment domain being measured (e.g., phonics, vocabulary)
 * - `name` - Specific score name within the domain
 * - `value` - The score value (stored as text for flexibility)
 * - `assessmentStage` - Which stage this score applies to (practice vs test)
 * - `categoryScore` - Whether this is a category-level aggregate score
 *
 * @see {@link runs} - Parent run this score belongs to (cascade delete)
 * @see {@link ../assessment-fdw/run-scores.ts} — FDW mirror of this table in core DB
 */

export const runScores = db.table(
  'run_scores',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    runId: p
      .uuid()
      .references(() => runs.id, { onDelete: 'cascade' })
      .notNull(),

    type: scoreTypeEnum().notNull(),
    domain: p.text().notNull(),
    name: p.text().notNull(),
    value: p.text().notNull(),
    assessmentStage: assessmentStageEnum(),
    categoryScore: p.boolean(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Lookup for scores by run ID
    p.index('run_scores_run_id_idx').on(table.runId),

    // - Lookup for scores by run ID and type
    p.index('run_scores_run_id_type_idx').on(table.runId, table.type),

    // Constraints
    // - Natural-key unique constraint enabling ON CONFLICT upserts.
    //   `assessment_stage` is nullable; `nullsNotDistinct()` ensures rows with the same
    //   (run_id, type, domain, name) and a NULL stage are treated as duplicates rather
    //   than distinct rows. Requires Postgres 15+.
    p
      .unique('run_scores_natural_key_unique')
      .on(table.runId, table.type, table.domain, table.name, table.assessmentStage)
      .nullsNotDistinct(),

    // - Raw scores are stage-scoped (CAT progression is per-stage). Computed scores
    //   may be cross-stage and so allow NULL. The api-contract enforces the same rule
    //   at validation time via a discriminated-union schema; this CHECK is the DB
    //   defense-in-depth.
    p.check(
      'run_scores_raw_requires_stage',
      sql`${table.type} <> 'raw'::app.score_type OR ${table.assessmentStage} IS NOT NULL`,
    ),
  ],
);

export type RunScore = typeof runScores.$inferSelect;
export type NewRunScore = typeof runScores.$inferInsert;
