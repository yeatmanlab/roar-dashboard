import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { AnyPgColumn } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';
import { taskVariantStatusEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Task Variants Table
 *
 * Stores information about task variants in the system. Each task variant is a variant of a task that can be used to
 * create assessments. A single task usually has multiple variants, each with different configurations.
 */

export const taskVariants = db.table(
  'task_variants',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    taskId: p
      .uuid()
      .references((): AnyPgColumn => tasks.id)
      .notNull(),

    name: p.text().notNull(),
    description: p.text().notNull(),
    status: taskVariantStatusEnum().notNull(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Task ID lookups
    p.index('task_variants_task_id_idx').on(table.taskId),
    // - Task ID with status lookups
    p.index('task_variants_task_id_status_idx').on(table.taskId, table.status),
  ],
);

export type TaskVariant = typeof taskVariants.$inferSelect;
export type NewTaskVariant = typeof taskVariants.$inferInsert;
