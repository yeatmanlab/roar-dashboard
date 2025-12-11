import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runs } from './runs';
import { assessmentStageEnum, scoreTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Runs Scores
 *
 * Stores information about run scores in the system. For every run, scores are recorded throughout the
 * assessment. These scores are stored in the assessment database without any PII for research purposes.
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

    taskId: p.uuid().notNull(),
    taskVariantId: p.uuid().notNull(),

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
  ],
);

export type RunScore = typeof runScores.$inferSelect;
export type NewRunScore = typeof runScores.$inferInsert;
