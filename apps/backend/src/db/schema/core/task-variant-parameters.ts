import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { taskVariants } from './task-variants';

const db = p.pgSchema('app');

/**
 * Task Variant Parameters Table
 *
 * Stores configuration parameters for task variants. Each parameter is a key-value pair that
 * customizes how the assessment runs (e.g., time limits, difficulty settings, language).
 *
 * Note: Uses `taskVariantId` as the primary key, implying one parameter record per variant.
 * If multiple parameters are needed, they should be stored in the JSONB `value` field.
 *
 * @see {@link taskVariants} - The task variant this parameter configures
 */

export const taskVariantParameters = db.table(
  'task_variant_parameters',
  {
    taskVariantId: p
      .uuid()
      .references(() => taskVariants.id)
      .notNull()
      .primaryKey(),

    name: p.text().notNull(),
    value: p.jsonb().notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Parameter name should be unique per variant Id
    p.index('task_variant_parameters_name_variant_id_idx').on(table.taskVariantId, table.name),
  ],
);

export type TaskVariantParameter = typeof taskVariantParameters.$inferSelect;
export type NewTaskVariantParameter = typeof taskVariantParameters.$inferInsert;
