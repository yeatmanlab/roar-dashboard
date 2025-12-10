import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { tasks } from './tasks';
import { taskVariantStatusEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Task Variants Table
 *
 * Stores information about task variants in the system. Each task variant is a variant of a task that can be used to
 * create assessments. A single task usually has multiple variants, each with different parameters.
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
      .references(() => tasks.id, { onDelete: 'restrict' })
      .notNull(),

    name: p.text(),
    description: p.text(),
    status: taskVariantStatusEnum().notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Unique constraint to ensure a single variant name per task
    p
      .uniqueIndex('task_variants_task_name_unique_idx')
      .on(table.taskId, sql`lower(${table.name})`)
      .where(sql`${table.name} IS NOT NULL`),

    // Indexes
    // - Task ID with status lookups
    p.index('task_variants_task_id_status_idx').on(table.taskId, table.status),
  ],
);

export type TaskVariant = typeof taskVariants.$inferSelect;
export type NewTaskVariant = typeof taskVariants.$inferInsert;
