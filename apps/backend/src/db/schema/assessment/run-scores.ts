import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runs } from './runs';
import { assessmentStageEnum, scoreTypeEnum } from '../enums';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Runs Scores
 *
 * Stores information about run scores in the system. For every run, scores are recorded throughout the
 * assessment. These scores are stored in the assessment database without any PII for research purposes.
 */

export const runScores = db.table('run_scores', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  runId: p
    .uuid()
    .references((): AnyPgColumn => runs.id)
    .notNull(),

  taskId: p.uuid().notNull(),
  taskVariantId: p.uuid().notNull(),

  type: scoreTypeEnum().notNull(),
  domain: p.text().notNull(),
  name: p.text().notNull(),
  value: p.text(),
  assessmentStage: assessmentStageEnum().notNull(),
  categoryScore: p.boolean(),

  ...timestamps,
});

export type RunScore = typeof runScores.$inferSelect;
export type NewRunScore = typeof runScores.$inferInsert;
