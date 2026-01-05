import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { taskVariants } from './task-variants';

const db = p.pgSchema('app');

/**
 * Task Variant Parameters Table
 *
 * Stores configuration parameters for task variants. Each parameter is a key-value pair that
 * customizes how the assessment runs (e.g., time limits, difficulty settings, language).
 * A single task variant can have multiple parameters, each identified by a unique name.
 *
 * Key fields:
 * - `name` - The parameter name/key (unique per task variant)
 * - `value` - JSONB value for the parameter (can be string, number, object, array, etc.)
 *
 * @see {@link taskVariants} - The task variant this parameter configures
 */

export const taskVariantParameters = db.table(
  'task_variant_parameters',
  {
    taskVariantId: p
      .uuid()
      .references(() => taskVariants.id, { onDelete: 'cascade' })
      .notNull(),

    name: p.text().notNull(),
    value: p.jsonb().notNull(),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'task_variant_parameters_pkey',
      columns: [table.taskVariantId, table.name],
    }),
  ],
);

export type TaskVariantParameter = typeof taskVariantParameters.$inferSelect;
export type NewTaskVariantParameter = typeof taskVariantParameters.$inferInsert;
