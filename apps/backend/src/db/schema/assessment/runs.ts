import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Runs Table
 *
 * Stores information about runs in the system. For every assessment taken by a user, a run is created. Runs and
 * corresponding trials are stored in the assessment database without any PII for research purposes.
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
    assignmentId: p.uuid().notNull(),

    bestRun: p.boolean().notNull().default(false),
    reliableRun: p.boolean().notNull().default(false),

    engagementFlags: p.jsonb(),
    metadata: p.jsonb(),

    excludeFromResearch: p.boolean().notNull().default(false),

    completedAt: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Lookup for user's runs for a specific assignment + task
    p.index('runs_user_assignment_task_idx').on(table.userId, table.assignmentId, table.taskId),

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
