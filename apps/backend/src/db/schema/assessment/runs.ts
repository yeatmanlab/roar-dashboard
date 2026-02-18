import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Runs Table
 *
 * Stores assessment run records. A run represents a single attempt at completing an assessment
 * (task variant) by a user. Each run can have multiple trials and scores associated with it.
 *
 * Note: This table is in the assessment database, intentionally without foreign key constraints
 * to the core database. IDs reference core entities but are not enforced at the database level
 * for research data isolation purposes.
 *
 * @see {@link runTrials} - Individual trial records within this run
 * @see {@link runScores} - Computed scores for this run
 */

export const runs = db.table(
  'runs',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    userId: p.uuid().notNull(),
    taskId: p.uuid().notNull(),
    taskVariantId: p.uuid().notNull(),
    taskVersion: p.text().notNull(),

    administrationId: p.uuid().notNull(),

    bestRun: p.boolean().notNull().default(false),
    reliableRun: p.boolean().notNull().default(false),

    engagementFlags: p.jsonb(),
    metadata: p.jsonb(),

    completedAt: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Lookup for user's runs for a specific administration + task
    p.index('runs_user_administration_task_idx').on(table.userId, table.administrationId, table.taskId),

    //- Lookup for all runs by a user
    p.index('runs_user_id_idx').on(table.userId),

    // - Lookup to identify best runs for a user
    p
      .index('runs_user_best_run_idx')
      .on(table.userId)
      .where(sql`${table.bestRun} = true`),
  ],
);

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
